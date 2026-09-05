import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { ProductItem, InteractiveSession, InteractiveSessionState, InternalGameEvent, BidEvent, MysteryBox, TiedPlayer, WinnerRecord, ActiveReservation } from '../types';
import { supabaseService } from '../db/supabase';

export class InteractiveEngine extends EventEmitter {
  private session: InteractiveSession;
  private roundTimer: NodeJS.Timeout | null = null;
  private autoAdvanceTimer: NodeJS.Timeout | null = null;
  private interestedUsers: Set<string> = new Set();
  private sessionFilePath = path.resolve(process.cwd(), 'data/interactive_session.json');
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private reservationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.session = {
      id: `session_int_${Date.now()}`,
      state: 'IDLE',
      queue: [],
      currentProductIndex: 0,
      activeProduct: null,
      timeRemaining: 45,
      currentHighestBid: 0,
      currentLeader: null,
      interestedPlayersCount: 0,
      recentBids: [],
      autoAdvance: false,
      winner: null,
      tiedPlayers: [],
      mysteryBoxes: [],
      approvedBidders: ['juan', 'maria', 'cristian'],
      pendingApprovals: [],
      requireApproval: false,
      winnersHistory: [],
      antiSniperExtensions: 0,
      maxAntiSniperExtensions: 3,
      whatsappNumber: '+56 9 5483 3942',
      cardBgUrl: '',
      cardTransparentMode: false,
      cardOffsetY: 90,
      heroBannerSlides: [
        { id: 'slide_1', icon: '💬', text: '+56 9 5483 3942' },
        { id: 'slide_2', icon: '✍️', text: 'Escribe al WhatsApp para participar' },
        { id: 'slide_3', icon: '⚡', text: 'Abona y Participa con tu oferta' }
      ],
      heroBannerInterval: 3.8,
      activeReservations: []
    };

    this.loadPersistedSession();
  }

  public getSession(): InteractiveSession {
    return { ...this.session };
  }

  /**
   * Procesa un evento entrante del chat (TikTok o Simulador)
   */
  public processEvent(event: InternalGameEvent): boolean {
    // 1. Manejo en estado de Desempate (TIE_BREAKER): Detectar si un finalista elige caja 1, 2, 3 o 4
    if (this.session.state === 'TIE_BREAKER') {
      const isTiedPlayer = this.session.tiedPlayers.some(p => this.matchesUsername(p.username, event.username));
      if (isTiedPlayer) {
        const boxMatch = event.rawMessage.match(/(?:caja|box|#)?\s*([1-4])\b/i);
        if (boxMatch && boxMatch[1]) {
          const boxNum = parseInt(boxMatch[1], 10);
          console.log(`📦 Finalista @${event.username} envió comando para abrir Caja #${boxNum}`);
          return this.openMysteryBox(boxNum, event.username);
        }
      }
      return false;
    }

    // Detección de consultas de saldo o bolsa: "¿Cuánto llevo?", "mi total", "cuanto debo", "mi bolsa", "saldo"
    const totalQueryMatch = event.rawMessage.match(/(?:cuanto|cuánto)\s*(?:llevo|debo)|mi\s*(?:total|bolsa|saldo)|\btotal\b|\bsaldo\b/i);
    if (totalQueryMatch) {
      this.getBuyerSummaryAsync(event.username).then(summary => {
        console.log(`💰 CONSULTA DE SALDO: @${event.username} lleva ${summary.itemsCount} prendas ($${summary.totalAmount}) - Abono: $${summary.depositAmount} - Saldo: $${summary.pendingBalance}`);
        this.emit('show_buyer_total', summary);
      }).catch(err => {
        console.warn('Error consultando resumen de comprador:', err);
      });
    }

    if (this.session.state !== 'ROUND_ACTIVE') {
      return false;
    }

    if (!event.numericValue) {
      return false;
    }

    const bidAmount = event.numericValue;

    // 2. Control de Acceso: Verificar si la vendedora exige que el comprador esté en la lista de aprobados
    if (this.session.requireApproval) {
      const isApproved = this.session.approvedBidders.some(u => this.matchesUsername(u, event.username));
      if (!isApproved) {
        console.log(`🔒 PUJA DE @${event.username} ($${bidAmount}) RETENIDA. Espectador no está en lista de aprobados.`);
        
        // Guardar solicitud pendiente
        const idx = this.session.pendingApprovals.findIndex(p => this.matchesUsername(p.username, event.username));
        if (idx !== -1) {
          this.session.pendingApprovals.splice(idx, 1);
        }
        this.session.pendingApprovals.unshift({
          username: event.username,
          attemptedBid: bidAmount,
          timestamp: new Date().toISOString()
        });

        if (this.session.pendingApprovals.length > 15) {
          this.session.pendingApprovals.pop();
        }

        this.emit('bid_approval_required', {
          username: event.username,
          attemptedBid: bidAmount,
          session: this.getSession()
        });

        this.emitStateChange();
        return false;
      }
    }

    const activeProd = this.session.activeProduct;
    const minRequired = activeProd ? activeProd.startingPrice : 0;

    // La oferta debe ser mayor o igual al precio inicial Y mayor o igual a la oferta más alta actual
    if (bidAmount < minRequired || bidAmount < this.session.currentHighestBid) {
      console.log(`⚠️ Puja ignorada de @${event.username}: $${bidAmount} (Mínima requerida: $${Math.max(minRequired, this.session.currentHighestBid)})`);
      return false;
    }

    // Registrar usuario en lista de interesados únicos
    this.interestedUsers.add(event.username);
    this.session.interestedPlayersCount = this.interestedUsers.size;

    const newBid: BidEvent = {
      username: event.username,
      amount: bidAmount,
      timestamp: new Date().toISOString(),
      source: (event.source as any) || 'tiktok'
    };

    this.session.recentBids.unshift(newBid);
    if (this.session.recentBids.length > 10) {
      this.session.recentBids.pop();
    }

    // Si la oferta supera estrictamente la más alta actual -> Nuevo líder único
    if (bidAmount > this.session.currentHighestBid) {
      this.session.currentHighestBid = bidAmount;
      this.session.currentLeader = {
        username: event.username,
        amount: bidAmount,
        timestamp: new Date().toISOString()
      };
      this.session.tiedPlayers = [{ username: event.username, bidAmount }];
      console.log(`🔥 ¡NUEVA OFERTA LÍDER! @${event.username} de la prenda #${activeProd?.code} por $${bidAmount}`);
    } 
    // Si la oferta iguala a la más alta actual -> Agregar a lista de finalistas empatados
    else if (bidAmount === this.session.currentHighestBid && this.session.currentHighestBid > 0) {
      const alreadyTied = this.session.tiedPlayers.some(p => p.username.toLowerCase() === event.username.toLowerCase());
      if (!alreadyTied) {
        this.session.tiedPlayers.push({ username: event.username, bidAmount });
        console.log(`⚡ ¡OFERTA EMPATADA! @${event.username} igualó la oferta más alta de $${bidAmount}. Total empatados: ${this.session.tiedPlayers.length}`);
      }
    }
    
    // Anti-Sniper: Si la puja llega en los últimos 5 segundos, extender +10s (máx 3 extensiones por ronda)
    if (this.session.timeRemaining <= 5 && this.session.antiSniperExtensions < this.session.maxAntiSniperExtensions) {
      this.session.timeRemaining += 10;
      this.session.antiSniperExtensions++;
      console.log(`⚡ ANTI-SNIPER: Timer extendido +10s para @${event.username}. Extensión ${this.session.antiSniperExtensions}/${this.session.maxAntiSniperExtensions}. Nuevo tiempo: ${this.session.timeRemaining}s`);
      this.emit('anti_sniper_extension', {
        username: event.username,
        extensionNumber: this.session.antiSniperExtensions,
        newTimeRemaining: this.session.timeRemaining,
        session: this.getSession()
      });
    }

    this.emit('bid_accepted', {
      product: activeProd,
      bid: newBid,
      session: this.getSession()
    });

    this.emitStateChange();
    return true;
  }

  /**
   * Inicia la ronda de 45 segundos para el producto actual o indicado
   */
  public startRound(productIndex?: number): boolean {
    this.clearTimers();

    if (productIndex !== undefined && productIndex >= 0 && productIndex < this.session.queue.length) {
      this.session.currentProductIndex = productIndex;
    }

    const currentProd = this.session.queue[this.session.currentProductIndex];
    if (!currentProd) {
      console.warn('⚠️ No hay productos disponibles en la cola para iniciar.');
      this.session.state = 'IDLE';
      this.session.activeProduct = null;
      this.emitStateChange();
      return false;
    }

    this.session.activeProduct = currentProd;
    this.session.timeRemaining = currentProd.durationSeconds || 45;
    this.session.currentHighestBid = 0;
    this.session.currentLeader = null;
    this.session.recentBids = [];
    this.session.winner = null;
    this.session.tiedPlayers = [];
    this.session.mysteryBoxes = [];
    this.session.antiSniperExtensions = 0;
    this.interestedUsers.clear();
    this.session.interestedPlayersCount = 0;
    this.session.cardTransparentMode = false;
    this.session.state = 'ROUND_ACTIVE';

    console.log(`\n==================================================`);
    console.log(`🟢 LUKE LIVE: Inicio de ronda para [${currentProd.code}] ${currentProd.title}`);
    console.log(`⏱️ Tiempo: ${this.session.timeRemaining}s | Precio inicial: $${currentProd.startingPrice}`);
    console.log(`==================================================\n`);

    this.emitStateChange();

    // Iniciar el temporizador regresivo de 1 segundo
    this.roundTimer = setInterval(() => {
      this.tickTimer();
    }, 1000);

    return true;
  }

  private tickTimer() {
    if (this.session.state !== 'ROUND_ACTIVE') return;

    if (this.session.timeRemaining > 0) {
      this.session.timeRemaining--;
      this.emitStateChange();
    } else {
      this.finishRound();
    }
  }

  /**
   * Finaliza la ronda activa y evalúa si hay Ganador Directo o Empate por Cajas Misteriosas
   */
  public finishRound() {
    this.clearTimers();

    const activeProd = this.session.activeProduct;

    // Caso A: Hay 2 o más finalistas empatados en la oferta más alta -> Iniciar Cajas Misteriosas
    if (this.session.tiedPlayers.length > 1) {
      this.startTieBreaker();
      return;
    }

    // Caso B: Hay un único líder sin empate
    if (this.session.currentLeader && activeProd) {
      this.session.state = 'WINNER_ANNOUNCED';
      this.session.winner = {
        username: this.session.currentLeader.username,
        amount: this.session.currentLeader.amount,
        productTitle: activeProd.title,
        productCode: activeProd.code
      };
      this.recordWinner(this.session.winner);
      console.log(`\n🏆 ¡RONDA FINALIZADA CON GANADOR DIRECTO!`);
      console.log(`🎉 Prenda: [${activeProd.code}] ${activeProd.title}`);
      console.log(`👤 Ganador: @${this.session.winner.username} con $${this.session.winner.amount}\n`);
      this.emit('winner_declared', this.session.winner);
    } else {
      this.session.state = 'NO_BID_FINISHED';
      this.session.winner = null;
      console.log(`\n⏱️ RONDA FINALIZADA SIN OFERTAS.`);
      console.log(`Prenda: [${activeProd?.code}] ${activeProd?.title}\n`);
    }

    this.emitStateChange();

    // Auto-avanzar al siguiente producto si autoAdvance está activado
    if (this.session.autoAdvance) {
      console.log(`⌛ Auto-avanzando al siguiente producto en 6 segundos...`);
      this.autoAdvanceTimer = setTimeout(() => {
        this.nextProduct();
      }, 6000);
    }
  }

  /**
   * Inicia la fase de Desempate por Cajas Misteriosas
   */
  public startTieBreaker() {
    this.clearTimers();
    this.session.state = 'TIE_BREAKER';

    // Sortear cuál de las 4 cajas contendrá el premio (1 a 4)
    const winningBoxNum = Math.floor(Math.random() * 4) + 1;

    this.session.mysteryBoxes = [1, 2, 3, 4].map(num => ({
      boxNumber: num,
      opened: false,
      isWinner: num === winningBoxNum
    }));

    console.log(`\n==================================================`);
    console.log(`📦 DESEMPATE ACTIVADO: ${this.session.tiedPlayers.length} finalistas igualados en $${this.session.currentHighestBid}`);
    console.log(`👤 Finalistas: ${this.session.tiedPlayers.map(p => '@' + p.username).join(', ')}`);
    console.log(`🎁 Caja Ganadora Secreta: #${winningBoxNum}`);
    console.log(`==================================================\n`);

    this.emit('tie_breaker_started', {
      session: this.getSession(),
      tiedPlayers: this.session.tiedPlayers
    });

    this.emitStateChange();
  }

  /**
   * Abre una Caja Misteriosa seleccionada por un finalista o por la vendedora
   */
  public openMysteryBox(boxNumber: number, username?: string): boolean {
    if (this.session.state !== 'TIE_BREAKER') {
      return false;
    }

    const box = this.session.mysteryBoxes.find(b => b.boxNumber === boxNumber);
    if (!box || box.opened) {
      console.log(`⚠️ Caja #${boxNumber} ya estaba abierta o es inválida.`);
      return false;
    }

    const openerName = username || (this.session.tiedPlayers[0]?.username || 'finalista');
    box.opened = true;
    box.openedBy = openerName;

    // Registrar la caja elegida en el jugador
    const player = this.session.tiedPlayers.find(p => p.username.toLowerCase() === openerName.toLowerCase());
    if (player) {
      player.chosenBox = boxNumber;
    }

    const activeProd = this.session.activeProduct;

    // ¿Es la caja ganadora?
    if (box.isWinner && activeProd) {
      this.session.state = 'WINNER_ANNOUNCED';
      this.session.winner = {
        username: openerName,
        amount: this.session.currentHighestBid,
        productTitle: activeProd.title,
        productCode: activeProd.code,
        viaTieBreaker: true,
        winningBoxNumber: boxNumber
      };
      this.recordWinner(this.session.winner);

      console.log(`\n🎉 ¡¡¡GANADOR POR CAJA MISTERIOSA!!! 🎉`);
      console.log(`📦 @${openerName} abrió la Caja #${boxNumber} y ENCONTRÓ EL PREMIO!`);
      console.log(`Prenda: [${activeProd.code}] ${activeProd.title} por $${this.session.currentHighestBid}\n`);

      this.emit('winner_declared', this.session.winner);
      this.emitStateChange();

      if (this.session.autoAdvance) {
        console.log(`⌛ Auto-avanzando al siguiente producto en 6 segundos...`);
        this.autoAdvanceTimer = setTimeout(() => {
          this.nextProduct();
        }, 6000);
      }
      return true;
    } else {
      console.log(`❌ @${openerName} abrió la Caja #${boxNumber}... (VACÍA)`);
      this.emit('box_opened', {
        boxNumber,
        openedBy: openerName,
        isWinner: false,
        session: this.getSession()
      });

      this.emitStateChange();
      return true;
    }
  }

  /**
   * Verifica si un producto ya fue adjudicado o está en reserva de 10 minutos
   */
  public isProductAdjudicated(productCode: string): boolean {
    if (!productCode) return false;
    const cleanCode = productCode.trim().toUpperCase().replace(/^#/, '');
    const inWinners = this.session.winnersHistory
      ? this.session.winnersHistory.some(w => (w.productCode || '').trim().toUpperCase().replace(/^#/, '') === cleanCode)
      : false;
    const inReservations = this.session.activeReservations
      ? this.session.activeReservations.some(r => (r.productCode || '').trim().toUpperCase().replace(/^#/, '') === cleanCode)
      : false;
    return inWinners || inReservations;
  }

  /**
   * Avanza al siguiente producto en la cola e inicia la ronda automáticamente (omite los ya adjudicados)
   */
  public nextProduct(): boolean {
    this.clearTimers();

    let nextIdx = this.session.currentProductIndex + 1;
    while (nextIdx < this.session.queue.length) {
      const prod = this.session.queue[nextIdx];
      if (prod && !this.isProductAdjudicated(prod.code)) {
        break;
      }
      console.log(`⏩ Saltando prenda #${prod?.code} porque ya fue adjudicada.`);
      nextIdx++;
    }

    if (nextIdx < this.session.queue.length) {
      this.session.currentProductIndex = nextIdx;
      return this.startRound();
    } else {
      console.log('🎉 COLA DE PRODUCTOS COMPLETADA. Estado: IDLE');
      this.session.state = 'IDLE';
      this.session.activeProduct = null;
      this.emitStateChange();
      return false;
    }
  }

  /**
   * Pausa o reanuda la ronda
   */
  public togglePause(): boolean {
    if (this.session.state === 'ROUND_ACTIVE') {
      this.clearTimers();
      this.session.state = 'PAUSED';
      this.emitStateChange();
      return true;
    } else if (this.session.state === 'PAUSED') {
      this.session.state = 'ROUND_ACTIVE';
      this.roundTimer = setInterval(() => {
        this.tickTimer();
      }, 1000);
      this.emitStateChange();
      return true;
    }
    return false;
  }

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
        text: (s.text || '').trim().substring(0, 40) // Limitar a máximo 40 caracteres por fila
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

  public addProduct(
    title: string,
    code: string,
    startingPrice: number,
    durationSeconds: number = 45,
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
      durationSeconds: Number(durationSeconds) || 45,
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

  // --- Gestión de Compradores Aprobados ---

  // --- Normalización Robusta de Nombres de Usuario ---

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

  // --- Gestión de Compradores Aprobados ---

  public approveBidder(username: string): boolean {
    if (!username) return false;
    const cleanUser = username.trim().replace(/^@/, '');
    const alreadyApproved = this.session.approvedBidders.some(u => this.matchesUsername(u, cleanUser));

    if (!alreadyApproved) {
      this.session.approvedBidders.push(cleanUser);
      console.log(`✅ COMPRADOR APROBADO: @${cleanUser}`);
    }

    // Buscar si tenía alguna oferta pendiente retenida y procesarla inmediatamente si la ronda sigue activa
    const pendingIdx = this.session.pendingApprovals.findIndex(p => this.matchesUsername(p.username, cleanUser));
    if (pendingIdx !== -1) {
      const pendingAttempt = this.session.pendingApprovals.splice(pendingIdx, 1)[0];
      if (pendingAttempt && this.session.state === 'ROUND_ACTIVE') {
        console.log(`🔄 Procesando oferta retenida de @${cleanUser} por $${pendingAttempt.attemptedBid}`);
        this.processEvent({
          id: `evt_retro_${Date.now()}`,
          type: 'CHAT_MESSAGE',
          source: 'system',
          userId: `id_${cleanUser}`,
          username: cleanUser,
          rawMessage: `${pendingAttempt.attemptedBid}`,
          numericValue: pendingAttempt.attemptedBid,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.emitStateChange();
    return true;
  }

  public revokeBidder(username: string): boolean {
    if (!username) return false;
    const cleanUser = username.trim().replace(/^@/, '');
    const idx = this.session.approvedBidders.findIndex(u => this.matchesUsername(u, cleanUser));
    if (idx !== -1) {
      this.session.approvedBidders.splice(idx, 1);
      console.log(`❌ ACCESO DE COMPRA REVOCADO: @${cleanUser}`);
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public setRequireApproval(enabled: boolean) {
    this.session.requireApproval = enabled;
    console.log(`🔒 MODO EXIGIR APROBACIÓN DE COMPRADORES: ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
    this.emitStateChange();
  }

  // --- Gestión de Historial de Adjudicaciones ---

  private recordWinner(winner: { username: string; amount: number; productTitle: string; productCode: string; viaTieBreaker?: boolean; winningBoxNumber?: number }) {
    if (!winner) return;
    const record: WinnerRecord = {
      id: `win_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productCode: winner.productCode,
      productTitle: winner.productTitle,
      username: winner.username,
      amount: winner.amount,
      timestamp: new Date().toISOString(),
      viaTieBreaker: winner.viaTieBreaker,
      winningBoxNumber: winner.winningBoxNumber
    };
    this.session.winnersHistory.unshift(record);
  }

  public removeWinnerRecord(recordId: string): boolean {
    const idx = this.session.winnersHistory.findIndex(w => w.id === recordId);
    if (idx !== -1) {
      this.session.winnersHistory.splice(idx, 1);
      this.emitStateChange();
      return true;
    }
    return false;
  }

  public clearWinnersHistory() {
    this.session.winnersHistory = [];
    this.emitStateChange();
  }

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

    // Fusión de prendas de Supabase y de la memoria en vivo (deduplicando por código)
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

    const hasActiveReservations = this.session.activeReservations
      ? this.session.activeReservations.some(r => this.matchesUsername(r.username, username))
      : false;

    const hasActiveBag = Boolean(
      dbSummary?.hasActiveBag ||
      hasActiveReservations ||
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

    // 1. Buscar en winnersHistory
    if (this.session.winnersHistory) {
      for (const w of this.session.winnersHistory) {
        if (this.matchesUsername(w.username, username)) {
          const code = (w.productCode || 'S/C').toUpperCase().replace(/^#/, '');
          itemsMap.set(code, {
            code: `#${code}`,
            title: w.productTitle || `Prenda #${code}`,
            amount: w.amount || 0,
            date: w.timestamp || new Date().toISOString()
          });
        }
      }
    }

    // 2. Buscar en activeReservations
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
      totalAmount: totalAmount,
      items: items
    };
  }

  // --- Gestión de Reservas Temporales (10 Minutos) ---

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
        console.warn('⚠️ Error registrando reserva en Supabase:', err.message);
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

    // Cancelar temporizador previo si existía para este usuario o prenda
    if (this.reservationTimers.has(cleanCode)) {
      clearTimeout(this.reservationTimers.get(cleanCode)!);
    }

    // Agregar a la lista activa
    if (!this.session.activeReservations) {
      this.session.activeReservations = [];
    }
    this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== cleanCode);
    this.session.activeReservations.push(reservation);

    console.log(`⏱️ RESERVA TEMPORAL INICIADA (10 MIN): @${cleanUser} reservó #${cleanCode} ($${salePrice}). Expira: ${expiresAt}`);

    // Programar expiración automática a los 10 minutos
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

    if (!reservation) {
      console.warn(`⚠️ No se encontró reserva activa para: ${clean}`);
      return false;
    }

    // Detener temporizador
    if (this.reservationTimers.has(reservation.productCode)) {
      clearTimeout(this.reservationTimers.get(reservation.productCode)!);
      this.reservationTimers.delete(reservation.productCode);
    }

    // Remover de reservas pendientes
    this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== reservation.productCode);

    // Confirmar en Supabase
    if (supabaseService.isEnabled()) {
      await supabaseService.confirmBagDeposit(reservation.bagId, depositAmount, phone);
    }

    // Habilitar en lista blanca de compradores
    this.approveBidder(reservation.username);

    console.log(`🎉 RESERVA CONFIRMADA & ABONO RECIBIDO: @${reservation.username} activó su bolsa con #${reservation.productCode}`);

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
    console.log(`⏰ RESERVA EXPIRADA (10 MIN): @${username} no confirmó abono para #${productCode}`);

    if (this.reservationTimers.has(productCode)) {
      clearTimeout(this.reservationTimers.get(productCode)!);
      this.reservationTimers.delete(productCode);
    }

    if (this.session.activeReservations) {
      this.session.activeReservations = this.session.activeReservations.filter(r => r.productCode !== productCode);
    }

    // Liberar la prenda en Supabase
    if (supabaseService.isEnabled()) {
      await supabaseService.releaseExpiredReservation(bagId);
    }

    // Restringir al usuario
    this.revokeBidder(username);

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

  private clearTimers() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  private async loadPersistedSession() {
    try {
      // 1. Intentar cargar desde archivo local en disco
      let localData: any = null;
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf-8');
        localData = JSON.parse(raw);
        console.log(`💾 Sesión interactiva cargada desde disco local (${localData.queue?.length || 0} prendas en cola).`);
      }

      // 2. Intentar cargar desde Supabase (esquema subastas.interactive_sessions)
      let supabaseData: any = null;
      if (supabaseService.isEnabled()) {
        supabaseData = await supabaseService.getInteractiveSession();
        if (supabaseData) {
          console.log(`☁️ Sesión interactiva cargada desde Supabase (${supabaseData.queue?.length || 0} prendas en cola).`);
        }
      }

      // Priorizar datos de Supabase si existen, o locales
      const savedData = supabaseData || localData;
      if (savedData) {
        if (Array.isArray(savedData.queue)) {
          // Filtrar productos demo/mockup antiguos (prod_1, Polera Nike, etc.)
          const cleanQueue = savedData.queue.filter((p: any) => 
            p && 
            !['prod_1', 'prod_2', 'prod_3', 'prod_4'].includes(p.id) && 
            !['0045', '0046', '0047', '0048'].includes(p.code) &&
            !p.title?.toLowerCase().includes('polera nike')
          );
          this.session.queue = cleanQueue;
        }
        if (typeof savedData.currentProductIndex === 'number') this.session.currentProductIndex = savedData.currentProductIndex;
        if (Array.isArray(savedData.heroBannerSlides)) this.session.heroBannerSlides = savedData.heroBannerSlides;
        if (typeof savedData.heroBannerInterval === 'number') this.session.heroBannerInterval = savedData.heroBannerInterval;
        if (typeof savedData.whatsappNumber === 'string') this.session.whatsappNumber = savedData.whatsappNumber;
        if (typeof savedData.cardBgUrl === 'string') this.session.cardBgUrl = savedData.cardBgUrl;
        if (typeof savedData.cardOffsetY === 'number') this.session.cardOffsetY = savedData.cardOffsetY;
        if (Array.isArray(savedData.approvedBidders)) this.session.approvedBidders = savedData.approvedBidders;
        if (Array.isArray(savedData.winnersHistory)) this.session.winnersHistory = savedData.winnersHistory;
        if (typeof savedData.autoAdvance === 'boolean') this.session.autoAdvance = savedData.autoAdvance;
        if (typeof savedData.requireApproval === 'boolean') this.session.requireApproval = savedData.requireApproval;
      }

      // Si la cola quedó vacía, auto-cargar prendas reales disponibles desde Supabase
      if (this.session.queue.length === 0 && supabaseService.isEnabled()) {
        const availableProducts = await supabaseService.getAvailableProductsForQueue();
        if (availableProducts && availableProducts.length > 0) {
          console.log(`📦 Auto-cargando ${availableProducts.length} prendas reales de Supabase a la cola.`);
          this.session.queue = availableProducts.map(p => ({
            id: `prod_${p.id}`,
            code: p.code,
            title: p.title,
            startingPrice: p.base_price || 1000,
            durationSeconds: 45,
            images: (p.images || []).map(img => typeof img === 'string' ? img : img.image_url),
            size: p.size || '',
            warehouseLocation: p.warehouse_location || '',
            supabaseProductId: p.id
          }));
        }
      }

      // Asegurar que activeProduct apunte al producto actual de la cola
      if (this.session.queue.length > 0) {
        if (this.session.currentProductIndex >= this.session.queue.length) {
          this.session.currentProductIndex = 0;
        }
        this.session.activeProduct = this.session.queue[this.session.currentProductIndex] || null;
        this.session.timeRemaining = this.session.activeProduct?.durationSeconds || 45;
      } else {
        this.session.activeProduct = null;
      }

      this.emit('state_change', this.getSession());
      this.persistSession(true);
    } catch (err: any) {
      console.warn('⚠️ Error al cargar sesión persistida:', err.message);
    }
  }

  public persistSession(immediate: boolean = false) {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    const doSave = async () => {
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
          approvedBidders: this.session.approvedBidders || [],
          winnersHistory: this.session.winnersHistory || [],
          autoAdvance: this.session.autoAdvance ?? true,
          requireApproval: this.session.requireApproval ?? true
        };

        // Guardar a disco local
        const dir = path.dirname(this.sessionFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.sessionFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');

        // Guardar a Supabase en background
        if (supabaseService.isEnabled()) {
          supabaseService.saveInteractiveSession(this.session).catch(() => {});
        }
      } catch (err: any) {
        console.warn('⚠️ Error guardando sesión en disco:', err.message);
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

