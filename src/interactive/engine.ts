import { EventEmitter } from 'events';
import { ProductItem, InteractiveSession, InteractiveSessionState, InternalGameEvent, BidEvent, MysteryBox, TiedPlayer } from '../types';

export class InteractiveEngine extends EventEmitter {
  private session: InteractiveSession;
  private roundTimer: NodeJS.Timeout | null = null;
  private autoAdvanceTimer: NodeJS.Timeout | null = null;
  private interestedUsers: Set<string> = new Set();

  constructor() {
    super();
    // Productos de demostración por defecto
    const initialQueue: ProductItem[] = [
      { id: 'prod_1', code: '0045', title: 'Polera Nike negra', startingPrice: 500, durationSeconds: 45 },
      { id: 'prod_2', code: '0046', title: 'Polera Adidas roja', startingPrice: 700, durationSeconds: 45 },
      { id: 'prod_3', code: '0047', title: 'Chaqueta Denim Oversize', startingPrice: 1000, durationSeconds: 45 },
      { id: 'prod_4', code: '0048', title: 'Polerón Hoodie Puma', startingPrice: 800, durationSeconds: 45 }
    ];

    this.session = {
      id: `session_int_${Date.now()}`,
      state: 'IDLE',
      queue: initialQueue,
      currentProductIndex: 0,
      activeProduct: initialQueue[0] || null,
      timeRemaining: initialQueue[0]?.durationSeconds || 45,
      currentHighestBid: 0,
      currentLeader: null,
      interestedPlayersCount: 0,
      recentBids: [],
      autoAdvance: true,
      winner: null,
      tiedPlayers: [],
      mysteryBoxes: [],
      approvedBidders: ['juan', 'maria', 'cristian'],
      pendingApprovals: [],
      requireApproval: true
    };
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
      const isTiedPlayer = this.session.tiedPlayers.some(p => p.username.toLowerCase() === event.username.toLowerCase());
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

    if (this.session.state !== 'ROUND_ACTIVE') {
      return false;
    }

    if (!event.numericValue) {
      return false;
    }

    const bidAmount = event.numericValue;

    // Helper para comparar nombres de usuario ignorando espacios, puntos, guiones y arrobas
    const cleanName = (s: string) => (s || '').toLowerCase().replace(/[@\s_.]/g, '');
    const evtClean = cleanName(event.username);

    // 2. Control de Acceso: Verificar si la vendedora exige que el comprador esté en la lista de aprobados
    if (this.session.requireApproval) {
      const isApproved = this.session.approvedBidders.some(u => {
        const uClean = cleanName(u);
        return uClean === evtClean || evtClean.includes(uClean) || uClean.includes(evtClean);
      });
      if (!isApproved) {
        console.log(`🔒 PUJA DE @${event.username} ($${bidAmount}) RETENIDA. Espectador no está en lista de aprobados.`);
        
        // Guardar solicitud pendiente
        const idx = this.session.pendingApprovals.findIndex(p => p.username.toLowerCase() === event.username.toLowerCase());
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
    this.interestedUsers.clear();
    this.session.interestedPlayersCount = 0;
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
   * Avanza al siguiente producto en la cola e inicia la ronda automáticamente
   */
  public nextProduct(): boolean {
    this.clearTimers();

    if (this.session.currentProductIndex + 1 < this.session.queue.length) {
      this.session.currentProductIndex++;
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

  // --- Gestión de Cola de Productos ---

  public addProduct(title: string, code: string, startingPrice: number, durationSeconds: number = 45): ProductItem {
    const newProduct: ProductItem = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: code.trim() || `${this.session.queue.length + 100}`,
      title: title.trim() || 'Producto sin nombre',
      startingPrice: Number(startingPrice) || 0,
      durationSeconds: Number(durationSeconds) || 45
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

  public approveBidder(username: string): boolean {
    if (!username) return false;
    const cleanUser = username.trim().replace(/^@/, '');
    const alreadyApproved = this.session.approvedBidders.some(u => u.toLowerCase() === cleanUser.toLowerCase());

    if (!alreadyApproved) {
      this.session.approvedBidders.push(cleanUser);
      console.log(`✅ COMPRADOR APROBADO: @${cleanUser}`);
    }

    // Buscar si tenía alguna oferta pendiente retenida y procesarla inmediatamente si la ronda sigue activa
    const pendingIdx = this.session.pendingApprovals.findIndex(p => p.username.toLowerCase() === cleanUser.toLowerCase());
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
    const idx = this.session.approvedBidders.findIndex(u => u.toLowerCase() === cleanUser.toLowerCase());
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

  private emitStateChange() {
    this.emit('state_change', this.getSession());
  }
}

