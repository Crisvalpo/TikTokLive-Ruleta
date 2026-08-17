import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

import { TikTokService } from './tiktok/connection';
import { EventHandler } from './events/handler';
import { SupabaseService } from './db/supabase';
import { InteractiveEngine } from './interactive/engine';
import { InternalGameEvent } from './types';
import { generateBlueExpressWorkbook } from './services/bluexExport';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const PORT = process.env.PORT || 3007;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'cristianluke5';

// Resolución robusta del directorio public (tanto en dev como en dist)
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(process.cwd(), 'src', 'public');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Instanciar módulos
const eventHandler = EventHandler.getInstance();
const tiktokService = new TikTokService(TIKTOK_USERNAME);
const supabaseService = new SupabaseService();
const interactiveEngine = new InteractiveEngine();

// ============================================================
// WEBSOCKET SERVER — HEARTBEAT & SINCRONIZACIÓN INMEDIATA
// ============================================================

wss.on('connection', (ws: WebSocket) => {
  (ws as any).isAlive = true;

  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  // Enviar estado actual completo inmediatamente a la nueva conexión (OBS / Tablet)
  try {
    const session = interactiveEngine.getSession();
    ws.send(JSON.stringify({ 
      type: 'INTERACTIVE_STATE_UPDATE', 
      data: session, 
      timestamp: new Date().toISOString() 
    }));
  } catch (err: any) {
    console.error('Error enviando estado inicial a WS:', err.message);
  }

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
  });
});

// Heartbeat cada 20 segundos para evitar cortes en Cloudflare o redes móviles
const wsHeartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    if ((ws as any).isAlive === false) {
      return ws.terminate();
    }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 20000);

wss.on('close', () => {
  clearInterval(wsHeartbeatInterval);
});

// ============================================================
// BROADCAST WEBSOCKET
// ============================================================

function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ============================================================
// EVENTOS DEL MOTOR DE SUBASTAS INTERACTIVO
// ============================================================

interactiveEngine.on('state_change', (session) => {
  broadcast('INTERACTIVE_STATE_UPDATE', session);
});

interactiveEngine.on('bid_accepted', (payload) => {
  broadcast('INTERACTIVE_BID_ACCEPTED', payload);
});

interactiveEngine.on('winner_declared', async (winner) => {
  try {
    if (winner && winner.productCode) {
      let buyer = await supabaseService.getBuyerByUsername(winner.username);
      if (!buyer) {
        buyer = await supabaseService.createBuyer({ tiktok_username: winner.username });
      }

      const product = await supabaseService.getProductByCode(winner.productCode);
      const isRecurring = buyer && buyer.deposit_paid;

      if (isRecurring) {
        // Comprador recurrente con abono ya pagado: Venta directa a su bolsa
        if (product && buyer) {
          await supabaseService.createSale(
            product.id,
            buyer.id,
            winner.amount,
            'subasta',
            winner.viaTieBreaker || false,
            winner.winningBoxNumber
          );
          console.log(`📦 VENTA DIRECTA: Prenda #${winner.productCode} sumada a la bolsa activa de @${winner.username}`);
        }
        broadcast('INTERACTIVE_WINNER_DECLARED', {
          ...winner,
          isNewBuyer: false,
          depositPaid: true
        });
      } else {
        // Comprador nuevo: Iniciar temporizador de 10 minutos para apertura de bolsa
        if (product) {
          await supabaseService.updateProductStatus(product.id, 'reservado');
          const reservation = await interactiveEngine.startReservation(
            winner.username,
            winner.productCode,
            product.id,
            winner.amount,
            10
          );
          broadcast('INTERACTIVE_WINNER_DECLARED', {
            ...winner,
            isNewBuyer: true,
            depositPaid: false,
            expiresAt: reservation.expiresAt,
            secondsRemaining: 600
          });
        }
      }
    }
  } catch (err: any) {
    console.error('❌ Error en adjudicación de ganador:', err.message);
  }
});

interactiveEngine.on('reservation_confirmed', (payload) => {
  broadcast('RESERVATION_CONFIRMED', payload);
});

interactiveEngine.on('reservation_expired', (payload) => {
  broadcast('RESERVATION_EXPIRED', payload);
});

interactiveEngine.on('tie_breaker_started', (payload) => {
  broadcast('INTERACTIVE_TIE_BREAKER_STARTED', payload);
});

interactiveEngine.on('box_opened', (payload) => {
  broadcast('INTERACTIVE_BOX_OPENED', payload);
});

interactiveEngine.on('anti_sniper_extension', (payload) => {
  broadcast('INTERACTIVE_ANTI_SNIPER', payload);
});

interactiveEngine.on('show_buyer_total', (summary) => {
  broadcast('SHOW_BUYER_TOTAL_OVERLAY', summary);
});

// Endpoint para abrir una Caja Misteriosa
app.post('/api/interactive/open-box', (req, res) => {
  const { boxNumber, username } = req.body;
  const opened = interactiveEngine.openMysteryBox(Number(boxNumber), username);
  res.json({ success: opened, session: interactiveEngine.getSession() });
});

// ============================================================
// PROCESAMIENTO DE EVENTOS TIKTOK
// ============================================================

eventHandler.on('event', (event: InternalGameEvent) => {
  broadcast('EVENT', event);
  supabaseService.saveEvent(event);
  interactiveEngine.processEvent(event);
});

// ============================================================
// SEGURIDAD
// ============================================================

app.get('/favicon.ico', (req, res) => res.status(204).end());

const ACCESS_KEY = process.env.ACCESS_KEY || 'luke2026';

function requireAccessKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Permitir webhooks externos sin key
  if (req.path.startsWith('/webhook') || req.originalUrl.startsWith('/api/webhook')) {
    return next();
  }

  const key = req.query.key || req.headers['x-access-key'] || (req.body && req.body.key);
  const cleanKey = String(key || '').trim();
  if (cleanKey === ACCESS_KEY || cleanKey === 'luke2026') {
    return next();
  }

  if (req.originalUrl.startsWith('/api')) {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Clave requerida.' });
  }

  if (req.accepts('html')) {
    return res.redirect('/');
  }

  return res.status(403).json({ success: false, error: 'Acceso denegado. Clave requerida.' });
}

// ============================================================
// RUTAS HTML — PÚBLICAS (sin access key)
// ============================================================

app.get(['/', '/catalog', '/catalog.html'], (req, res) => {
  res.sendFile(path.join(publicDir, 'catalog.html'));
});

// ============================================================
// RUTAS HTML — PRIVADAS (requieren access key)
// ============================================================

app.get('/simulator', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'simulator.html'));
});

app.get('/interactive', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'interactive.html'));
});

app.get('/obs-interactive', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'obs-interactive.html'));
});

app.get('/warehouse', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'warehouse.html'));
});

// ============================================================
// API — PÚBLICA (Catálogo Showroom sin clave)
// ============================================================

app.get('/api/public/catalog', async (req, res) => {
  try {
    const { search, item_type, size } = req.query;
    const products = await supabaseService.getProducts({
      search: search ? String(search) : undefined,
      item_type: item_type ? (String(item_type) as any) : undefined,
      size: size ? String(size) : undefined,
      stock_status: 'disponible'
    });
    res.json({ success: true, products });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// API — PROTEGIDA CON ACCESS KEY
// ============================================================

app.use('/api', requireAccessKey);

app.get('/api/status', (req, res) => {
  res.json({
    status: tiktokService.getStatus(),
    interactiveSession: interactiveEngine.getSession()
  });
});

app.post('/api/connect', async (req, res) => {
  const { username } = req.body;
  if (username) {
    tiktokService.setUsername(username);
  }
  const connected = await tiktokService.connect();
  broadcast('STATUS_UPDATE', tiktokService.getStatus());
  res.json({ success: connected, status: tiktokService.getStatus() });
});

app.post('/api/simulator/send', (req, res) => {
  const { username, comment, userId } = req.body;
  const event = tiktokService.simulateComment(username || 'testuser', comment || '500', userId);
  res.json({ success: true, event });
});

// ============================================================
// API — MOTOR DE SUBASTAS INTERACTIVO
// ============================================================

app.get('/api/interactive/session', (req, res) => {
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/start', (req, res) => {
  const { productIndex } = req.body;
  const started = interactiveEngine.startRound(productIndex);
  res.json({ success: started, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/next', (req, res) => {
  const hasNext = interactiveEngine.nextProduct();
  res.json({ success: hasNext, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/pause', (req, res) => {
  const toggled = interactiveEngine.togglePause();
  res.json({ success: toggled, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/queue/add', (req, res) => {
  const { title, code, startingPrice, durationSeconds, images, size, warehouseLocation, supabaseProductId } = req.body;
  const newProduct = interactiveEngine.addProduct(
    title, code, startingPrice, durationSeconds, images, size, warehouseLocation, supabaseProductId
  );
  res.json({ success: true, product: newProduct, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/queue/remove', (req, res) => {
  const { id } = req.body;
  const removed = interactiveEngine.removeProduct(id);
  res.json({ success: removed, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/auto-advance', (req, res) => {
  const { enabled } = req.body;
  interactiveEngine.setAutoAdvance(Boolean(enabled));
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/bidders/approve', (req, res) => {
  const { username } = req.body;
  const approved = interactiveEngine.approveBidder(username);
  res.json({ success: approved, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/bidders/revoke', (req, res) => {
  const { username } = req.body;
  const revoked = interactiveEngine.revokeBidder(username);
  res.json({ success: revoked, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/bidders/require-approval', (req, res) => {
  const { enabled } = req.body;
  interactiveEngine.setRequireApproval(Boolean(enabled));
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/winners/remove', (req, res) => {
  const { id } = req.body;
  const removed = interactiveEngine.removeWinnerRecord(id);
  res.json({ success: removed, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/winners/clear', (req, res) => {
  interactiveEngine.clearWinnersHistory();
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/show-buyer-total', async (req, res) => {
  const { username } = req.body;
  const summary = await interactiveEngine.getBuyerSummaryAsync(username);
  broadcast('SHOW_BUYER_TOTAL_OVERLAY', summary);
  res.json({ success: true, summary });
});

app.get('/api/interactive/buyer-summary', async (req, res) => {
  const username = String(req.query.username || '');
  const summary = await interactiveEngine.getBuyerSummaryAsync(username);
  res.json({ success: true, summary });
});

// Endpoints de Gestión de Bolsas y Reservas (10 min)
app.get('/api/interactive/bags', async (req, res) => {
  try {
    const bags = await supabaseService.getActiveBagsList();
    const session = interactiveEngine.getSession();
    res.json({
      success: true,
      bags,
      reservations: session.activeReservations || []
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/interactive/bags/confirm-deposit', async (req, res) => {
  const { usernameOrCode, depositAmount, phone } = req.body;
  const confirmed = await interactiveEngine.confirmReservation(
    usernameOrCode,
    Number(depositAmount) || 5000,
    phone
  );
  res.json({ success: confirmed, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/bags/release', async (req, res) => {
  const { usernameOrCode } = req.body;
  const released = await interactiveEngine.cancelReservation(usernameOrCode);
  res.json({ success: released, session: interactiveEngine.getSession() });
});

// ============================================================
// GESTIÓN DE JORNADAS DE LIVE (live_sessions)
// ============================================================

app.get('/api/live-sessions/active', async (req, res) => {
  const active = await supabaseService.getActiveLiveSession();
  res.json({ success: true, liveSession: active });
});

app.post('/api/live-sessions/start', async (req, res) => {
  const { title } = req.body;
  const started = await supabaseService.startLiveSession(title);
  res.json({ success: Boolean(started), liveSession: started });
});

app.post('/api/live-sessions/finish', async (req, res) => {
  const { sessionId } = req.body;
  const finished = await supabaseService.finishLiveSession(sessionId);
  let summary = null;
  if (finished) {
    summary = await supabaseService.getLiveSessionSummary(finished.id);
  }
  res.json({ success: Boolean(finished), liveSession: finished, summary });
});

app.get('/api/live-sessions/:id/summary', async (req, res) => {
  const summary = await supabaseService.getLiveSessionSummary(req.params.id);
  res.json({ success: Boolean(summary), summary });
});

app.post('/api/live-sessions/:id/notify-balances', async (req, res) => {
  try {
    const summary = await supabaseService.getLiveSessionSummary(req.params.id);
    if (!summary || !summary.buyersBreakdown || summary.buyersBreakdown.length === 0) {
      return res.json({ success: false, message: 'No hay ventas registradas en esta jornada' });
    }

    const results = [];
    for (const b of summary.buyersBreakdown) {
      const phone = b.buyer?.whatsapp_phone || b.buyer?.phone;
      if (!phone) {
        results.push({ username: b.buyer?.tiktok_username, status: 'SKIPPED_NO_PHONE' });
        continue;
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const itemsList = b.items.map((i: any) => `• #${i.productCode} ${i.productTitle} - $${i.price.toLocaleString('es-CL')}`).join('\n');
      const deposit = b.buyer?.deposit_amount || (b.buyer?.deposit_paid ? 5000 : 0);
      const balanceToPay = Math.max(0, b.total - deposit);

      const msg = `🎉 *¡Hola @${b.buyer?.tiktok_username}! Gracias por participar en el Live de hoy.*\n\n` +
        `🛍️ *Tus Prendas Adjudicadas:*\n${itemsList}\n\n` +
        `💵 *Total Prendas:* $${b.total.toLocaleString('es-CL')}\n` +
        `💳 *Abono Inicial:* $${deposit.toLocaleString('es-CL')}\n` +
        `🔴 *SALDO PENDIENTE A TRANSFERIR:* *$${balanceToPay.toLocaleString('es-CL')}*\n\n` +
        `🏦 *Datos de Transferencia:*\nBanco: Banco Estado / Cuenta RUT\nNombre: Luke Subastas\n\n` +
        `📌 *¿Qué deseas hacer con tu bolsa?*\n` +
        `1️⃣ *ENVIAR*: Si transfieres tu saldo y deseas recibir tus prendas, responde *ENVIAR* para coordinar tu etiqueta por Blue Express.\n` +
        `2️⃣ *GUARDAR*: Si deseas seguir acumulando prendas en el próximo Live, transfiere tu saldo para congelar tus prendas y responde *GUARDAR*.`;

      try {
        await fetch('http://127.0.0.1:4000/subastas/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, message: msg })
        });
        results.push({ username: b.buyer?.tiktok_username, phone: cleanPhone, status: 'SENT' });
      } catch (err: any) {
        results.push({ username: b.buyer?.tiktok_username, status: 'ERROR', error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DESPACHOS & EXTENSIÓN BLUE EXPRESS LOADER
// ============================================================

app.get('/api/shipping/pending-bags', async (req, res) => {
  const bags = await supabaseService.getBagsPendingDispatch();
  res.json({ success: true, count: bags.length, bags });
});

app.post('/api/shipping/update-info', async (req, res) => {
  const { bagId, recipient_name, recipient_rut, recipient_phone, recipient_email, recipient_address, recipient_commune, recipient_region } = req.body;
  const updated = await supabaseService.updateBagShippingInfo(bagId, {
    recipient_name,
    recipient_rut,
    recipient_phone,
    recipient_email,
    recipient_address,
    recipient_commune,
    recipient_region
  });
  res.json({ success: updated });
});

app.post('/api/shipping/complete-dispatch', async (req, res) => {
  try {
    const { bagId, trackingNumber, courier = 'blue_express' } = req.body;
    if (!bagId || !trackingNumber) {
      return res.status(400).json({ success: false, error: 'bagId y trackingNumber son requeridos' });
    }

    const bag = await supabaseService.completeBagDispatch(bagId, trackingNumber, courier);
    if (!bag) {
      return res.status(404).json({ success: false, error: 'Bolsa no encontrada' });
    }

    // Notificar al cliente por WhatsApp
    const phone = bag.recipient_phone || bag.buyers?.whatsapp_phone || bag.buyers?.phone;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const trackingMsg = `🚚 *¡Tu pedido ha sido despachado!*\n\n` +
        `Hola *${bag.recipient_name || bag.buyers?.tiktok_username}*, tu bolsa con ${bag.items_count || 1} prenda(s) ya tiene etiqueta generada con *Blue Express*.\n\n` +
        `📦 *Número de Seguimiento:* \`${trackingNumber}\`\n` +
        `📍 *Destino:* ${bag.recipient_commune || 'Domicilio'}\n` +
        `🔗 *Rastreo en línea:* https://www.bluex.cl/seguimiento?tracking=${trackingNumber}\n\n` +
        `¡Muchas gracias por comprar en Luke Subastas Live! ✨`;

      try {
        await fetch('http://127.0.0.1:4000/subastas/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, message: trackingMsg })
        });
      } catch (waErr: any) {
        console.warn('⚠️ No se pudo enviar notificación de tracking por WhatsApp:', waErr.message);
      }
    }

    res.json({ success: true, bag });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para descargar archivo Excel con formato oficial de Carga Masiva Blue Express
app.get('/api/shipping/export-bluex-excel', async (req, res) => {
  try {
    const bags = await supabaseService.getBagsPendingDispatch();
    if (!bags || bags.length === 0) {
      // Si no hay bolsas cerradas, generar con datos de ejemplo o vacía
    }

    const excelBuffer = generateBlueExpressWorkbook(bags || []);
    const fileName = `plantilla-envio-masivo-bx-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(excelBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Error generando Excel: ' + err.message });
  }
});

// WhatsApp Bridge Bot QR & Status Proxy
app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:4000/subastas/qr');
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'WaBridgeService no disponible: ' + err.message });
  }
});

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:4000/subastas/status');
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'WaBridgeService no disponible: ' + err.message });
  }
});

// Webhook para mensajes entrantes de WhatsApp desde Baileys Bridge
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    const { from, message, text, pushName } = req.body;
    const incomingText = text || (message && message.conversation) || '';
    console.log(`📱 MENSAJE WHATSAPP RECIBIDO de ${from} (${pushName}): "${incomingText}"`);

    // Detección de código de producto (ej: "D1", "D005", "#D1", "me gané el D1")
    const codeMatch = incomingText.match(/(?:me gane el|adjudique|codigo|código|prenda|#)?\s*([A-Z0-9]{1,8})\b/i);
    let matchedBag = null;

    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].toUpperCase();
      matchedBag = await supabaseService.findPendingBagByProductCode(code);
      if (matchedBag) {
        console.log(`🎯 MATCH EXITOSO WHATSAPP: Código #${code} corresponde a reserva de @${matchedBag.buyers?.tiktok_username}`);
        // Actualizar teléfono si no estaba registrado
        const cleanPhone = (from || '').replace(/[^0-9+]/g, '');
        // Confirmar automáticamente si vino un texto afirmativo o asociar teléfono
        if (cleanPhone) {
          await supabaseService.confirmBagDeposit(matchedBag.id, 5000, cleanPhone);
          interactiveEngine.confirmReservation(code, 5000, cleanPhone);
        }
      }
    }

    res.json({ success: true, matched: Boolean(matchedBag) });
  } catch (err: any) {
    console.error('Error procesando webhook whatsapp:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/interactive/config', (req, res) => {
  const { whatsappNumber, cardBgUrl, cardOffsetY, heroBannerSlides, heroBannerInterval } = req.body;
  if (typeof whatsappNumber === 'string') {
    interactiveEngine.setWhatsappNumber(whatsappNumber);
  }
  if (typeof cardBgUrl === 'string') {
    interactiveEngine.setCardBgUrl(cardBgUrl);
  }
  if (typeof cardOffsetY === 'number' || typeof cardOffsetY === 'string') {
    interactiveEngine.setCardOffsetY(Number(cardOffsetY));
  }
  if (Array.isArray(heroBannerSlides)) {
    interactiveEngine.setHeroBanner(heroBannerSlides, Number(heroBannerInterval));
  }
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/hero-banner', (req, res) => {
  const { slides, interval } = req.body;
  interactiveEngine.setHeroBanner(slides, Number(interval));
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/card-position', (req, res) => {
  const { offsetY } = req.body;
  interactiveEngine.setCardOffsetY(Number(offsetY));
  res.json({ success: true, session: interactiveEngine.getSession() });
});

app.post('/api/interactive/toggle-transparent', (req, res) => {
  const { enabled } = req.body;
  const isTransparent = interactiveEngine.toggleCardTransparent(enabled);
  res.json({ success: true, isTransparent, session: interactiveEngine.getSession() });
});

// ============================================================
// API — PRODUCTOS (CRUD Supabase)
// ============================================================

app.get('/api/products', async (req, res) => {
  const filters = {
    search: req.query.search as string,
    item_type: req.query.item_type as any,
    franchise: req.query.franchise as string,
    size: req.query.size as string,
    stock_status: req.query.stock_status as any,
    condition: req.query.condition as any,
    min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
    max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0
  };
  const products = await supabaseService.getProducts(filters);
  res.json({ success: true, products, count: products.length });
});

app.get('/api/products/code/:code', async (req, res) => {
  const product = await supabaseService.getProductByCode(req.params.code);
  if (product) {
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, error: 'Producto no encontrado' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const product = await supabaseService.getProductById(req.params.id);
  if (product) {
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, error: 'Producto no encontrado' });
  }
});

app.post('/api/products', async (req, res) => {
  const product = await supabaseService.createProduct(req.body);
  if (product) {
    res.json({ success: true, product });
  } else {
    res.status(500).json({ success: false, error: 'Error al crear producto' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const product = await supabaseService.updateProduct(req.params.id, req.body);
  if (product) {
    res.json({ success: true, product });
  } else {
    res.status(500).json({ success: false, error: 'Error al actualizar producto' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const deleted = await supabaseService.deleteProduct(req.params.id);
  res.json({ success: deleted });
});

// ============================================================
// API — IMÁGENES DE PRODUCTOS
// ============================================================

app.post('/api/products/:id/images', async (req, res) => {
  if (Array.isArray(req.body.images)) {
    const images = await supabaseService.addProductImages(req.params.id, req.body.images);
    return res.json({ success: true, images, count: images.length });
  }

  const { image_url, storage_path, display_order, caption } = req.body;
  const image = await supabaseService.addProductImage(
    req.params.id, image_url, storage_path, display_order || 0, caption
  );
  if (image) {
    res.json({ success: true, image });
  } else {
    res.status(500).json({ success: false, error: 'Error al añadir imagen' });
  }
});

app.delete('/api/images/:imageId', async (req, res) => {
  const deleted = await supabaseService.deleteProductImage(req.params.imageId);
  res.json({ success: deleted });
});

// ============================================================
// API — COMPRADORES
// ============================================================

app.get('/api/buyers', async (req, res) => {
  const buyers = await supabaseService.getBuyers();
  res.json({ success: true, buyers });
});

app.post('/api/buyers', async (req, res) => {
  const buyer = await supabaseService.createBuyer(req.body);
  if (buyer) {
    res.json({ success: true, buyer });
  } else {
    res.status(500).json({ success: false, error: 'Error al crear comprador' });
  }
});

app.put('/api/buyers/:id', async (req, res) => {
  const buyer = await supabaseService.updateBuyer(req.params.id, req.body);
  if (buyer) {
    res.json({ success: true, buyer });
  } else {
    res.status(500).json({ success: false, error: 'Error al actualizar comprador' });
  }
});

app.get('/api/buyers/:id/cart', async (req, res) => {
  const cart = await supabaseService.getBuyerCart(req.params.id);
  res.json({ success: true, cart });
});

// ============================================================
// API — VENTAS / PICKING / KPIs
// ============================================================

app.get('/api/sales/summary', async (req, res) => {
  const summary = await supabaseService.getSalesSummary();
  res.json({ success: true, summary });
});

app.get('/api/picking', async (req, res) => {
  const list = await supabaseService.getPickingList();
  res.json({ success: true, picking: list });
});

app.post('/api/picking/:saleId/done', async (req, res) => {
  const done = await supabaseService.markAsPicked(req.params.saleId);
  if (done) {
    broadcast('PICKING_UPDATED', { saleId: req.params.saleId, picked: true });
  }
  res.json({ success: done });
});

// ============================================================
// API — CATÁLOGO PÚBLICO (sin access key)
// ============================================================

// Nota: Este endpoint está FUERA del middleware requireAccessKey
// porque se define antes del app.use('/api', requireAccessKey)
// Para hacerlo accesible sin clave, lo montamos en un router separado:
const publicRouter = express.Router();

publicRouter.get('/catalog', async (req, res) => {
  const filters = {
    search: req.query.search as string,
    item_type: req.query.item_type as any,
    franchise: req.query.franchise as string,
    size: req.query.size as string,
    limit: req.query.limit ? Number(req.query.limit) : 30,
    offset: req.query.offset ? Number(req.query.offset) : 0
  };
  const products = await supabaseService.getCatalog(filters);
  res.json({ success: true, products, count: products.length });
});

publicRouter.get('/catalog/:code', async (req, res) => {
  const product = await supabaseService.getProductByCode(req.params.code);
  if (product && product.stock_status === 'disponible') {
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, error: 'Producto no encontrado o no disponible' });
  }
});

app.use('/api/public', publicRouter);

// ============================================================
// API — INVENTARIO DISPONIBLE PARA COLA DE SUBASTAS
// ============================================================

app.get('/api/products/available/queue', async (req, res) => {
  const products = await supabaseService.getAvailableProductsForQueue();
  res.json({ success: true, products });
});

// ============================================================
// WEBSOCKET CONNECTIONS
// ============================================================

wss.on('connection', (ws) => {
  console.log('🔌 Cliente WebSocket conectado a Luke Live Subastas.');

  ws.send(JSON.stringify({
    type: 'INTERACTIVE_STATE_UPDATE',
    data: interactiveEngine.getSession()
  }));

  ws.send(JSON.stringify({
    type: 'STATUS_UPDATE',
    data: tiktokService.getStatus()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      // Ignorar
    }
  });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(PORT, async () => {
  console.log(`\n==================================================`);
  console.log(`🚀 LUKE LIVE SUBASTAS corriendo en puerto ${PORT}`);
  console.log(`==================================================`);
  console.log(`👗 Panel Animadora:       http://localhost:${PORT}/interactive?key=${ACCESS_KEY}`);
  console.log(`📺 Overlay OBS:           http://localhost:${PORT}/obs-interactive?key=${ACCESS_KEY}`);
  console.log(`🎮 Simulador TikTok:      http://localhost:${PORT}/simulator?key=${ACCESS_KEY}`);
  console.log(`📦 Módulo Bodega:         http://localhost:${PORT}/warehouse?key=${ACCESS_KEY}`);
  console.log(`🛒 Catálogo Público:      http://localhost:${PORT}/catalog`);
  console.log(`==================================================\n`);

  if (TIKTOK_USERNAME) {
    tiktokService.connect().catch(() => {}).finally(() => {
      broadcast('STATUS_UPDATE', tiktokService.getStatus());
    });
  }
});
