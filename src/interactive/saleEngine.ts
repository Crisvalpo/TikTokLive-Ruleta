import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { ProductItem, SaleSession, SaleSessionState, SaleClaimRecord, InternalGameEvent, ActiveReservation, HeroBannerSlide } from '../types';
import { supabaseService } from '../db/supabase';

export class SaleEngine extends EventEmitter {
  private session: SaleSession;
  private autoAdvanceTimer: NodeJS.Timeout | null = null;
  private sessionFilePath = path.resolve(process.cwd(), 'data/sale_session.json');
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private reservationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.session = {
      id: `session_sale_${Date.now()}`,
      state: 'IDLE',
      queue: [],
      currentProductIndex: 0,
      activeProduct: null,
      fixedPrice: 0,
      claimedBy: null,
      salesHistory: [],
      autoAdvance: false,
      whatsappNumber: '+56 9 5483 3942',
      cardBgUrl: '',
      cardTransparentMode: false,
      cardOffsetY: 90,
      heroBannerSlides: [
        { id: 'slide_1', icon: '💬', text: '+56 9 5483 3942' },
        { id: 'slide_2', icon: '🛒', text: 'Escribe YO para llevarte la prenda' },
        { id: 'slide_3', icon: '⚡', text: 'Venta Directa • Primero en decir YO gana' }
      ],
      heroBannerInterval: 3.8,
      activeReservations: [],
      approvedBidders: [],
      requireApproval: false
    };

    this.loadPersistedSession();
  }

  public getSession(): SaleSession {
    return { ...this.session };
  }

  // ============================================================
  // PROCESAMIENTO DE EVENTOS DEL CHAT
  // ============================================================

  /**
   * Procesa un evento del chat. Si alguien dice "yo" mientras
   * el estado es OFFERING, se adjudica la prenda al primero.
   */
  public processEvent(event: InternalGameEvent): boolean {
    // Detección de consultas de saldo/bolsa (compartida con subasta)
    const totalQueryMatch = event.rawMessage.match(/(?:cuanto|cuánto)\s*(?:llevo|debo)|mi\s*(?:total|bolsa|saldo)|\btotal\b|\bsaldo\b/i);
    if (totalQueryMatch) {
      this.getBuyerSummaryAsync(event.username).then(summary => {
        console.log(`💰 [VENTA] CONSULTA DE SALDO: @${event.username} lleva ${summary.itemsCount} prendas ($${summary.totalAmount})`);
        this.emit('show_buyer_total', summary);
      }).catch(err => {
        console.warn('Error consultando resumen de comprador:', err);
      });
    }

    // Solo procesar "yo" si estamos en estado OFFERING
    if (this.session.state !== 'OFFERING') {
      if (event.type === 'CLAIM_YO') {
        console.warn(`⚠️ [VENTA] Evento 'YO' de @${event.username} ignorado porque el estado actual es '${this.session.state}' (debe estar en 'OFFERING'). Presiona 'Ofrecer' en la UI.`);
      }
      return false;
    }

    // Verificar que sea un evento CLAIM_YO
    if (event.type !== 'CLAIM_YO') {
      return false;
    }

    // Verificar si se exige aprobación previa de compradores
    if (this.session.requireApproval) {
      const isApproved = (this.session.approvedBidders || []).some(user =>
        this.matchesUsername(user, event.username)
      );
      if (!isApproved) {
        console.warn(`⚠️ [VENTA] @${event.username} intentó comprar pero no está en la lista de compradores aprobados.`);
        this.emit('unapproved_attempt', { username: event.username, event });
        return false;
      }
    }

    const activeProd = this.session.activeProduct;
    if (!activeProd) {
      return false;
    }

    // ¡PRIMER "YO" VÁLIDO! — Adjudicar inmediatamente
    this.session.state = 'SOLD';
    this.session.claimedBy = {
      username: event.username,
      timestamp: new Date().toISOString()
    };

    // Registrar en historial de ventas
    const claimRecord: SaleClaimRecord = {
      id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productCode: activeProd.code,
      productTitle: activeProd.title,
      username: event.username,
      price: this.session.fixedPrice,
      timestamp: new Date().toISOString()
    };
    this.session.salesHistory.unshift(claimRecord);

    console.log(`\n==================================================`);
    console.log(`🛒 ¡VENTA DIRECTA! @${event.username} dijo YO primero`);
    console.log(`👗 Prenda: [${activeProd.code}] ${activeProd.title}`);
    console.log(`💰 Precio: $${this.session.fixedPrice.toLocaleString('es-CL')}`);
    console.log(`==================================================\n`);

    this.emit('sale_claimed', {
      username: event.username,
      product: activeProd,
      price: this.session.fixedPrice,
      claimRecord,
      session: this.getSession()
    });

    this.emitStateChange();

    // Auto-avanzar al siguiente producto después de 5 segundos si está habilitado
    if (this.session.autoAdvance) {
      console.log(`⌛ [VENTA] Auto-avanzando al siguiente producto en 5 segundos...`);
      this.autoAdvanceTimer = setTimeout(() => {
        this.nextProduct();
      }, 5000);
    }

    return true;
  }

  // ============================================================
  // CONTROL DE FLUJO DE VENTA
  // ============================================================

  /**
   * Ofrece un producto a la venta (pone a la venta con precio fijo)
   */
  public offerProduct(productIndex?: number, customPrice?: number): boolean {
    this.clearTimers();

    if (productIndex !== undefined && productIndex >= 0 && productIndex < this.session.queue.length) {
      this.session.currentProductIndex = productIndex;
    }

    const currentProd = this.session.queue[this.session.currentProductIndex];
    if (!currentProd) {
      console.warn('⚠️ [VENTA] No hay productos en la cola para ofrecer.');
      this.session.state = 'IDLE';
      this.session.activeProduct = null;
      this.emitStateChange();
      return false;
    }

    this.session.activeProduct = currentProd;
    this.session.fixedPrice = customPrice || currentProd.startingPrice || 0;
    this.session.claimedBy = null;
    this.session.cardTransparentMode = false;
    this.session.state = 'OFFERING';

    console.log(`\n==================================================`);
    console.log(`🟢 [VENTA DIRECTA] Ofreciendo: [${currentProd.code}] ${currentProd.title}`);
    console.log(`💰 Precio: $${this.session.fixedPrice.toLocaleString('es-CL')}`);
    console.log(`👉 Esperando el primer "YO" del chat...`);
    console.log(`==================================================\n`);

    this.emit('product_offered', {
      product: currentProd,
      price: this.session.fixedPrice,
      session: this.getSession()
    });

    this.emitStateChange();
    return true;
  }

  /**
   * Salta el producto actual sin venderlo
   */
  public skipProduct(): boolean {
    this.clearTimers();
    const skippedProd = this.session.activeProduct;

    if (skippedProd) {
      console.log(`⏩ [VENTA] Saltando prenda: [${skippedProd.code}] ${skippedProd.title}`);
    }

    this.session.state = 'IDLE';
    this.session.claimedBy = null;
    this.emitStateChange();
    return true;
  }

  /**
   * Avanza al siguiente producto en la cola y lo ofrece
   */
  public nextProduct(customPrice?: number): boolean {
    this.clearTimers();

    let nextIdx = this.session.currentProductIndex + 1;
    while (nextIdx < this.session.queue.length) {
      const prod = this.session.queue[nextIdx];
      if (prod && !this.isProductSold(prod.code)) {
        break;
      }
      console.log(`⏩ [VENTA] Saltando #${prod?.code} porque ya fue vendida.`);
      nextIdx++;
    }

    if (nextIdx < this.session.queue.length) {
      this.session.currentProductIndex = nextIdx;
      return this.offerProduct(undefined, customPrice);
    } else {
      console.log('🎉 [VENTA] Cola de productos completada. Estado: IDLE');
      this.session.state = 'IDLE';
      this.session.activeProduct = null;
      this.emitStateChange();
      return false;
    }
  }

  /**
   * Pausa o reanuda las ofertas de venta
   */
  public togglePause(): boolean {
    if (this.session.state === 'OFFERING') {
      this.session.state = 'PAUSED';
      this.emitStateChange();
      return true;
    } else if (this.session.state === 'PAUSED') {
      this.session.state = 'OFFERING';
      this.emitStateChange();
      return true;
    }
    return false;
  }

  /**
   * Verifica si un producto ya fue vendido en esta sesión
   */
  public isProductSold(productCode: string): boolean {
    if (!productCode) return false;
    const cleanCode = productCode.trim().toUpperCase().replace(/^#/, '');
    return this.session.salesHistory.some(
      s => (s.productCode || '').trim().toUpperCase().replace(/^#/, '') === cleanCode
    );
  }

  // ============================================================
  // GESTIÓN DE COLA DE PRODUCTOS
  // ============================================================

  public addProduct(
    title: string,
    code: string,
    startingPrice: number,
    durationSeconds: number = 0,
    images?: string[],
    size?: string,
    warehouseLocation?: string,
    supabaseProductId?: string,
    video_url?: string
  ): ProductItem {
    const cleanCode = (code !== undefined && code !== null ? String(code) : '').trim();
    const cleanTitle = (title !== undefined && title !== null ? String(title) : '').trim();
    const cleanSize = (size !== undefined && size !== null ? String(size) : '').trim();
    const cleanLoc = (warehouseLocation !== undefined && warehouseLocation !== null ? String(warehouseLocation) : '').trim();
    const cleanSupabaseId = (supabaseProductId !== undefined && supabaseProductId !== null ? String(supabaseProductId) : '').trim();
    const cleanVideoUrl = (video_url !== undefined && video_url !== null ? String(video_url) : '').trim();

    const newProduct: ProductItem = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: cleanCode || `${this.session.queue.length + 100}`,
      title: cleanTitle || 'Producto sin nombre',
      startingPrice: Number(startingPrice) || 0,
      durationSeconds: 0, // No se usa en venta directa
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      size: cleanSize,
      warehouseLocation: cleanLoc,
      supabaseProductId: cleanSupabaseId,
      video_url: cleanVideoUrl
    };

    this.session.queue.push(newProduct);

    if (!this.session.activeProduct && this.session.state === 'IDLE') {
      this.session.activeProduct = newProduct;
    }

    this.emitStateChange();
    return newProduct;
  }

  public removeProduct(productId: string): boolean {
    const idx = this.session.queue.findIndex(p => p.id === productId);
    if (idx !== -1) {
      this.session.queue.splice(idx, 1);
      if (this.session.currentProductIndex >= this.session.queue.length) {
        this.session.currentProductIndex = Math.max(0, this.session.queue.length - 1);
      }
      this.session.activeProduct = this.session.queue[this.session.currentProductIndex] || null;
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public setAutoAdvance(enabled: boolean) {
    this.session.autoAdvance = enabled;
    this.emitStateChange();
  }

  // ============================================================
  // CONFIGURACIÓN VISUAL
  // ============================================================

  public setCardOffsetY(offsetY: number) {
    this.session.cardOffsetY = Math.max(0, Math.min(800, Number(offsetY) || 0));
    this.emitStateChange();
  }

  public setWhatsappNumber(num: string) {
    const cleanNum = (num || '').trim();
    this.session.whatsappNumber = cleanNum;
    if (this.session.heroBannerSlides && this.session.heroBannerSlides.length > 0) {
      const waSlide = this.session.heroBannerSlides.find(s => s.id === 'slide_1' || s.icon === '💬');
      if (waSlide && cleanNum) {
        waSlide.text = cleanNum;
      }
    }
    this.emitStateChange();
  }

  public setHeroBanner(slides: Array<{ id?: string; icon?: string; text: string }>, interval?: number) {
    if (Array.isArray(slides) && slides.length > 0) {
      this.session.heroBannerSlides = slides.map((s, idx) => ({
        id: s.id || `slide_${Date.now()}_${idx}`,
        icon: (s.icon || '💬').trim(),
        text: (s.text || '').trim().substring(0, 40)
      })).filter(s => s.text.length > 0);
    }
    if (typeof interval === 'number' && !isNaN(interval) && interval >= 1.5) {
      this.session.heroBannerInterval = Math.min(20, interval);
    }
    this.emitStateChange();
  }

  public setCardBgUrl(url: string) {
    this.session.cardBgUrl = (url || '').trim();
    this.emitStateChange();
  }

  public toggleCardTransparent(enabled?: boolean): boolean {
    if (typeof enabled === 'boolean') {
      this.session.cardTransparentMode = enabled;
    } else {
      this.session.cardTransparentMode = !this.session.cardTransparentMode;
    }
    this.emitStateChange();
    return this.session.cardTransparentMode;
  }

  // ============================================================
  // NORMALIZACIÓN DE USERNAMES (misma lógica que InteractiveEngine)
  // ============================================================

  public normalizeUsername(username: string): string {
    if (!username) return '';
    const clean = username.trim().replace(/^@/, '').toLowerCase().replace(/[@\s_.-]/g, '');
    const alphaNumeric = clean.replace(/[^\p{L}\p{N}]/gu, '');
    return alphaNumeric || clean;
  }

  public matchesUsername(userA: string, userB: string): boolean {
    if (!userA || !userB) return false;
    const cleanA = userA.trim().replace(/^@/, '').toLowerCase().replace(/[@\s_.-]/g, '');
    const cleanB = userB.trim().replace(/^@/, '').toLowerCase().replace(/[@\s_.-]/g, '');
    if (cleanA === cleanB) return true;

    const normA = this.normalizeUsername(userA);
    const normB = this.normalizeUsername(userB);
    if (!normA || !normB) return false;

    if (normA === normB) return true;
    if (normA.length >= 3 && normB.length >= 3) {
      return normA.includes(normB) || normB.includes(normA);
    }
    return false;
  }

  // ============================================================
  // GESTIÓN DE COMPRADORES APROBADOS
  // ============================================================

  public addApprovedBidder(username: string): boolean {
    const clean = (username || '').trim().replace(/^@/, '');
    if (!clean) return false;
    if (!this.session.approvedBidders) {
      this.session.approvedBidders = [];
    }
    const exists = this.session.approvedBidders.some(u => this.matchesUsername(u, clean));
    if (!exists) {
      this.session.approvedBidders.push(clean);
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public removeApprovedBidder(username: string): boolean {
    const clean = (username || '').trim().replace(/^@/, '');
    if (!clean || !this.session.approvedBidders) return false;
    const initialLen = this.session.approvedBidders.length;
    this.session.approvedBidders = this.session.approvedBidders.filter(
      u => !this.matchesUsername(u, clean)
    );
    if (this.session.approvedBidders.length !== initialLen) {
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public toggleRequireApproval(enabled?: boolean): boolean {
    if (typeof enabled === 'boolean') {
      this.session.requireApproval = enabled;
    } else {
      this.session.requireApproval = !this.session.requireApproval;
    }
    this.emitStateChange();
    return Boolean(this.session.requireApproval);
  }

  // ============================================================
  // HISTORIAL DE VENTAS
  // ============================================================

  public removeSaleRecord(recordId: string): boolean {
    const idx = this.session.salesHistory.findIndex(s => s.id === recordId);
    if (idx !== -1) {
      this.session.salesHistory.splice(idx, 1);
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public clearSalesHistory() {
    this.session.salesHistory = [];
    this.emitStateChange();
  }

  // ============================================================
  // CONSULTA DE RESUMEN DEL COMPRADOR
  // ============================================================

  public async getBuyerSummaryAsync(username: string) {
    if (!username) {
      return {
        username: '',
        hasActiveBag: false,
        bagStatus: 'SIN_BOLSA',
        depositAmount: 0,
        itemsCount: 0,
        totalAmount: 0,
        pendingBalance: 0,
        items: []
      };
    }

    const localSummary = this.getBuyerSummary(username);
    let dbSummary: any = null;

    if (supabaseService.isEnabled()) {
      try {
        dbSummary = await supabaseService.getCompleteBuyerSummary(username);
      } catch (err: any) {
        console.warn('⚠️ Error consultando resumen en Supabase:', err.message);
      }
    }

    const itemsMap = new Map<string, { code: string; title: string; amount: number; date?: string }>();

    if (dbSummary?.items) {
      for (const item of dbSummary.items) {
        const codeKey = (item.code || '').toUpperCase().replace(/^#/, '');
        itemsMap.set(codeKey, item);
      }
    }

    if (localSummary?.items) {
      for (const item of localSummary.items) {
        const codeKey = (item.code || '').toUpperCase().replace(/^#/, '');
        if (!itemsMap.has(codeKey)) {
          itemsMap.set(codeKey, item);
        }
      }
    }

    const mergedItems = Array.from(itemsMap.values());
    const totalAmount = mergedItems.reduce((sum, i) => sum + (i.amount || 0), 0);
    const depositAmount = dbSummary ? (dbSummary.depositAmount || 0) : 0;
    const pendingBalance = Math.max(0, totalAmount - depositAmount);

    const hasActiveBag = Boolean(
      dbSummary?.hasActiveBag ||
      mergedItems.length > 0
    );

    let bagStatus = 'SIN_BOLSA';
    if (dbSummary && dbSummary.bagStatus && dbSummary.bagStatus !== 'SIN_BOLSA') {
      bagStatus = dbSummary.bagStatus;
    } else if (hasActiveBag) {
      bagStatus = depositAmount > 0 ? 'ABIERTA_ACTIVA' : 'ABIERTA_PENDIENTE_ABONO';
    }

    return {
      username: username.trim().replace(/^@/, ''),
      hasActiveBag,
      bagStatus,
      depositAmount,
      itemsCount: mergedItems.length,
      totalAmount,
      pendingBalance,
      items: mergedItems
    };
  }

  public getBuyerSummary(username: string) {
    if (!username) {
      return { username: '', itemsCount: 0, totalAmount: 0, items: [] };
    }

    const itemsMap = new Map<string, { code: string; title: string; amount: number; date?: string }>();

    // Buscar en salesHistory
    if (this.session.salesHistory) {
      for (const s of this.session.salesHistory) {
        if (this.matchesUsername(s.username, username)) {
          const code = (s.productCode || 'S/C').toUpperCase().replace(/^#/, '');
          itemsMap.set(code, {
            code: `#${code}`,
            title: s.productTitle || `Prenda #${code}`,
            amount: s.price || 0,
            date: s.timestamp || new Date().toISOString()
          });
        }
      }
    }

    // Buscar en activeReservations
    if (this.session.activeReservations) {
      for (const r of this.session.activeReservations) {
        if (this.matchesUsername(r.username, username)) {
          const code = (r.productCode || 'S/C').toUpperCase().replace(/^#/, '');
          if (!itemsMap.has(code)) {
            itemsMap.set(code, {
              code: `#${code}`,
              title: r.productTitle || `Prenda #${code}`,
              amount: r.salePrice || 0,
              date: r.expiresAt || new Date().toISOString()
            });
          }
        }
      }
    }

    const items = Array.from(itemsMap.values());
    const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0);

    return {
      username: username.trim().replace(/^@/, ''),
      itemsCount: items.length,
      totalAmount,
      items
    };
  }

  // ============================================================
  // RESERVAS TEMPORALES (10 min) — Reutilizadas de la lógica de subasta
  // ============================================================

  public async startReservation(
    username: string,
    productCode: string,
    productId: string,
    salePrice: number,
    durationMinutes: number = 10
  ): Promise<ActiveReservation> {
    const cleanUser = username.trim().replace(/^@/, '');
    const cleanCode = productCode.trim().toUpperCase().replace(/^#/, '');
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    let bagId = `bag_${Date.now()}`;
    let buyerId = `buyer_${cleanUser}`;

    if (supabaseService.isEnabled()) {
      try {
        const { bag } = await supabaseService.createOrGetBuyerBag(cleanUser, {
          reservedProductCode: cleanCode,
          reservedProductId: productId,
          expiresAt
        });
        if (bag) {
          bagId = bag.id;
          buyerId = bag.buyer_id;
        }
      } catch (err: any) {
        console.warn('⚠️ [VENTA] Error registrando reserva en Supabase:', err.message);
      }
    }

    const reservation: ActiveReservation = {
      bagId,
      buyerId,
      username: cleanUser,
      productCode: cleanCode,
      productTitle: this.session.activeProduct?.title || `Prenda #${cleanCode}`,
      salePrice,
      expiresAt,
      secondsRemaining: durationMinutes * 60
    };

    if (this.reservationTimers.has(cleanCode)) {
      clearTimeout(this.reservationTimers.get(cleanCode)!);
    }

    if (!this.session.activeReservations) {
      this.session.activeReservations = [];
    }
    this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== cleanCode);
    this.session.activeReservations.push(reservation);

    console.log(`⏱️ [VENTA] RESERVA TEMPORAL (10 MIN): @${cleanUser} reservó #${cleanCode} ($${salePrice})`);

    const timer = setTimeout(async () => {
      await this.expireReservation(cleanUser, cleanCode, bagId);
    }, durationMinutes * 60 * 1000);

    this.reservationTimers.set(cleanCode, timer);
    this.emitStateChange();

    return reservation;
  }

  public async confirmReservation(
    usernameOrCode: string,
    depositAmount: number = 5000,
    phone?: string
  ): Promise<boolean> {
    const clean = (usernameOrCode || '').trim().replace(/^[@#]/, '');
    if (!this.session.activeReservations) return false;

    const reservation = this.session.activeReservations.find(
      r => r.productCode.toUpperCase() === clean.toUpperCase() || r.username.toLowerCase() === clean.toLowerCase()
    );

    if (!reservation) return false;

    if (this.reservationTimers.has(reservation.productCode)) {
      clearTimeout(this.reservationTimers.get(reservation.productCode)!);
      this.reservationTimers.delete(reservation.productCode);
    }

    this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== reservation.productCode);

    if (supabaseService.isEnabled()) {
      await supabaseService.confirmBagDeposit(reservation.bagId, depositAmount, phone);
    }

    console.log(`🎉 [VENTA] RESERVA CONFIRMADA: @${reservation.username} activó su bolsa con #${reservation.productCode}`);

    this.emit('reservation_confirmed', {
      username: reservation.username,
      productCode: reservation.productCode,
      depositAmount,
      bagId: reservation.bagId,
      session: this.getSession()
    });

    this.emitStateChange();
    return true;
  }

  public async expireReservation(username: string, productCode: string, bagId: string) {
    console.log(`⏰ [VENTA] RESERVA EXPIRADA: @${username} no confirmó para #${productCode}`);

    if (this.reservationTimers.has(productCode)) {
      clearTimeout(this.reservationTimers.get(productCode)!);
      this.reservationTimers.delete(productCode);
    }

    if (this.session.activeReservations) {
      this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== productCode);
    }

    if (supabaseService.isEnabled()) {
      await supabaseService.releaseExpiredReservation(bagId);
    }

    this.emit('reservation_expired', {
      username,
      productCode,
      bagId,
      session: this.getSession()
    });

    this.emitStateChange();
  }

  public async cancelReservation(usernameOrCode: string): Promise<boolean> {
    const clean = (usernameOrCode || '').trim().replace(/^[@#]/, '');
    if (!this.session.activeReservations) return false;

    const reservation = this.session.activeReservations.find(
      r => r.productCode.toUpperCase() === clean.toUpperCase() || r.username.toLowerCase() === clean.toLowerCase()
    );

    if (!reservation) return false;
    await this.expireReservation(reservation.username, reservation.productCode, reservation.bagId);
    return true;
  }

  // ============================================================
  // PERSISTENCIA Y ESTADO
  // ============================================================

  private clearTimers() {
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  private async loadPersistedSession() {
    try {
      let localData: any = null;
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf-8');
        localData = JSON.parse(raw);
        console.log(`💾 [VENTA] Sesión de venta cargada desde disco (${localData.queue?.length || 0} prendas).`);
      }

      if (localData) {
        if (Array.isArray(localData.queue)) this.session.queue = localData.queue;
        if (typeof localData.currentProductIndex === 'number') this.session.currentProductIndex = localData.currentProductIndex;
        if (Array.isArray(localData.heroBannerSlides)) this.session.heroBannerSlides = localData.heroBannerSlides;
        if (typeof localData.heroBannerInterval === 'number') this.session.heroBannerInterval = localData.heroBannerInterval;
        if (typeof localData.whatsappNumber === 'string') this.session.whatsappNumber = localData.whatsappNumber;
        if (typeof localData.cardBgUrl === 'string') this.session.cardBgUrl = localData.cardBgUrl;
        if (typeof localData.cardOffsetY === 'number') this.session.cardOffsetY = localData.cardOffsetY;
        if (Array.isArray(localData.salesHistory)) this.session.salesHistory = localData.salesHistory;
        if (typeof localData.autoAdvance === 'boolean') this.session.autoAdvance = localData.autoAdvance;
        if (Array.isArray(localData.approvedBidders)) this.session.approvedBidders = localData.approvedBidders;
        if (typeof localData.requireApproval === 'boolean') this.session.requireApproval = localData.requireApproval;
      }

      // Si la cola quedó vacía, auto-cargar prendas disponibles de Supabase
      if (this.session.queue.length === 0 && supabaseService.isEnabled()) {
        const availableProducts = await supabaseService.getAvailableProductsForQueue();
        if (availableProducts && availableProducts.length > 0) {
          console.log(`📦 [VENTA] Auto-cargando ${availableProducts.length} prendas de Supabase.`);
          this.session.queue = availableProducts.map(p => ({
            id: `prod_${p.id}`,
            code: p.code,
            title: p.title,
            startingPrice: p.base_price || 1000,
            durationSeconds: 0,
            images: (p.images || []).map((img: any) => typeof img === 'string' ? img : img.image_url),
            size: p.size || '',
            warehouseLocation: p.warehouse_location || '',
            supabaseProductId: p.id
          }));
        }
      }

      if (this.session.queue.length > 0) {
        if (this.session.currentProductIndex >= this.session.queue.length) {
          this.session.currentProductIndex = 0;
        }
        this.session.activeProduct = this.session.queue[this.session.currentProductIndex] || null;
        this.session.fixedPrice = this.session.activeProduct?.startingPrice || 0;
      } else {
        this.session.activeProduct = null;
      }

      this.emit('state_change', this.getSession());
      this.persistSession(true);
    } catch (err: any) {
      console.warn('⚠️ [VENTA] Error cargando sesión persistida:', err.message);
    }
  }

  public persistSession(immediate: boolean = false) {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    const doSave = () => {
      try {
        const dataToSave = {
          queue: this.session.queue || [],
          currentProductIndex: this.session.currentProductIndex || 0,
          activeProduct: this.session.activeProduct || null,
          heroBannerSlides: this.session.heroBannerSlides || [],
          heroBannerInterval: this.session.heroBannerInterval || 3.8,
          whatsappNumber: this.session.whatsappNumber || '',
          cardBgUrl: this.session.cardBgUrl || '',
          cardOffsetY: this.session.cardOffsetY || 90,
          salesHistory: this.session.salesHistory || [],
          autoAdvance: this.session.autoAdvance ?? false,
          approvedBidders: this.session.approvedBidders || [],
          requireApproval: this.session.requireApproval ?? false
        };

        const dir = path.dirname(this.sessionFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.sessionFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      } catch (err: any) {
        console.warn('⚠️ [VENTA] Error guardando sesión:', err.message);
      }
    };

    if (immediate) {
      doSave();
    } else {
      this.saveDebounceTimer = setTimeout(doSave, 300);
    }
  }

  private emitStateChange() {
    this.emit('state_change', this.getSession());
    this.persistSession(false);
  }
}
