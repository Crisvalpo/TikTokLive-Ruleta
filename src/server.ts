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
import { generateNextProductCode } from './services/productCodeGenerator';
import { parseStaffVoiceWithWorldMap, parseStaffTextWithWorldMap, StaffAIResult, ParsedProduct } from './services/staffVoiceParser';

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
    const paymentType = (req.query.type === 'prepago') ? 'prepago' : 'por_pagar';
    const bags = await supabaseService.getBagsPendingDispatch();

    const excelBuffer = generateBlueExpressWorkbook(bags || [], paymentType);
    const typeLabel = paymentType === 'por_pagar' ? 'POR_PAGAR' : 'PREPAGO';
    const fileName = `plantilla-envio-masivo-bx-${typeLabel}-${new Date().toISOString().split('T')[0]}.xlsx`;

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

// Memoria temporal del último producto creado y borradores en curso por cada miembro del staff
const lastStaffProductMap: Record<string, any> = {};
const pendingStaffDraftMap: Record<string, Partial<ParsedProduct>> = {};

async function isStaffSender(phone: string, text: string): Promise<boolean> {
  const clean = (phone || '').replace(/[^0-9]/g, '');

  // 1. Verificar en base de datos Supabase
  try {
    const members = await supabaseService.getStaffMembers();
    const activeStaff = members.filter(m => m.is_active).map(m => m.phone.replace(/[^0-9]/g, ''));
    if (activeStaff.some(s => clean.endsWith(s) || s.endsWith(clean))) {
      return true;
    }
  } catch (err) {
    // fallback
  }

  // 2. Verificar en .env
  const staffEnv = process.env.STAFF_WHATSAPP_NUMBERS || '';
  const staffList = staffEnv.split(',').map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);

  if (staffList.length > 0 && staffList.some(s => clean.endsWith(s) || s.endsWith(clean))) {
    return true;
  }

  // 3. También permite comando explícito de staff
  if (text.startsWith('#staff') || text.startsWith('/bodega') || text.startsWith('!bodega') || text.startsWith('#bodega')) {
    return true;
  }
  return false;
}

// Endpoints para gestión de Staff en tiempo real desde la UI
app.get('/api/staff-members', async (req, res) => {
  const members = await supabaseService.getStaffMembers();
  res.json({ success: true, staff: members });
});

app.post('/api/staff-members', async (req, res) => {
  const { phone, name, role } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ success: false, error: 'Teléfono y Nombre son requeridos' });
  }
  const member = await supabaseService.addStaffMember(phone, name, role || 'staff');
  if (member) {
    res.json({ success: true, member });
  } else {
    res.status(500).json({ success: false, error: 'Error agregando miembro del staff' });
  }
});

app.delete('/api/staff-members/:id', async (req, res) => {
  const success = await supabaseService.deleteStaffMember(req.params.id);
  res.json({ success });
});

// Endpoints para gestión de Ubicaciones de Bodega
app.get('/api/warehouse-locations', async (req, res) => {
  const locations = await supabaseService.getWarehouseLocations();
  res.json({ success: true, locations });
});

app.post('/api/warehouse-locations', async (req, res) => {
  const { name, floor, storage_type } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'El nombre de la ubicación es requerido' });
  }
  const location = await supabaseService.createWarehouseLocation(name, floor || 'Piso 1', storage_type || 'Perchero');
  if (location) {
    res.json({ success: true, location });
  } else {
    res.status(500).json({ success: false, error: 'Error creando ubicación' });
  }
});

app.delete('/api/warehouse-locations/:id', async (req, res) => {
  const success = await supabaseService.deleteWarehouseLocation(req.params.id);
  res.json({ success });
});

// Helper robusto para enviar presencia (Escribiendo... / Grabando audio...)
async function sendWhatsAppPresence(phone: string, state: 'composing' | 'recording' | 'paused' | 'available' = 'composing'): Promise<boolean> {
  const cleanPhone = (phone || '').split('@')[0].replace(/[^0-9]/g, '');
  if (!cleanPhone) return false;

  const url = process.env.WA_BRIDGE_URL || 'http://127.0.0.1:4000';
  const secret = process.env.WA_BRIDGE_SECRET || 'luke2026';

  try {
    const res = await fetch(`${url}/subastas/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wa-bridge-secret': secret
      },
      body: JSON.stringify({ to: cleanPhone, state })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Helper robusto para enviar mensajes de WhatsApp con autenticación
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const cleanPhone = (phone || '').split('@')[0].replace(/[^0-9]/g, '');
  if (!cleanPhone) return false;

  const url = process.env.WA_BRIDGE_URL || 'http://127.0.0.1:4000';
  const secret = process.env.WA_BRIDGE_SECRET || 'luke2026';

  try {
    const res = await fetch(`${url}/subastas/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wa-bridge-secret': secret
      },
      body: JSON.stringify({ to: cleanPhone, text: message })
    });
    const data = await res.json();
    console.log(`📤 WHATSAPP RESPUESTA a ${cleanPhone}:`, data);
    return Boolean(data.success);
  } catch (err: any) {
    console.error(`❌ Error enviando WhatsApp a ${cleanPhone}:`, err.message);
    return false;
  }
}

// Control de Idempotencia y anti-duplicados (Evita procesar reintentos en < 60s)
const processedMessageIds = new Map<string, number>();
function isDuplicateMessage(msgId: string): boolean {
  if (!msgId) return false;
  const now = Date.now();
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 60000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(msgId)) return true;
  processedMessageIds.set(msgId, now);
  return false;
}

function extractProductCodeFromMessage(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Evitar capturar palabras comunes como "Talla", "Piso", etc.
  const match = trimmed.match(/(?:#|producto\s+|para\s+(?:el\s+)?producto\s+|código\s+|codigo\s+)?([A-Za-z]\d{1,4})(?:\b|$)/i);
  return match && match[1] ? match[1].toUpperCase() : null;
}

// Webhook para mensajes entrantes de WhatsApp desde Baileys Bridge
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    // Desempaquetar payload de wa-bridge
    const body = req.body.payload || req.body || {};
    const msgId = body.id || body.msgId || (req.body && req.body.id);

    // Anti-duplicados por reintentos de timeout
    if (msgId && isDuplicateMessage(msgId)) {
      console.log(`⏭️ Webhook duplicado ignorado: ${msgId}`);
      return res.json({ success: true, duplicate: true });
    }

    const rawPhone = body.senderPn || body.phone || body.from || '';
    const cleanPhone = rawPhone.split('@')[0].replace(/[^0-9]/g, '');
    const incomingText = (typeof body.message === 'string' ? body.message : (body.text || body.conversation || '')).trim();
    const pushName = body.pushName || body.name || '';

    // Extracción de Audio
    const rawAudio = (body.audio && body.audio.data) || body.audioBase64 || (body.media && body.media.type === 'audio' ? body.media.data : null);
    const audioMime = (body.audio && body.audio.mimeType) || (body.media && body.media.mimetype) || 'audio/ogg; codecs=opus';

    // Extracción de Imagen
    const rawImage = (body.image && body.image.data) || body.imageBase64 || (body.media && (body.media.type === 'image' || (body.media.mimetype && body.media.mimetype.startsWith('image/'))) ? body.media.data : null);

    // Extracción de Video
    const rawVideo = (body.video && body.video.data) || body.videoBase64 || (body.media && (body.media.type === 'video' || (body.media.mimetype && body.media.mimetype.startsWith('video/'))) ? body.media.data : null);

    console.log(`📱 MENSAJE WHATSAPP RECIBIDO de ${cleanPhone} (${pushName}): "${incomingText}" [Audio: ${Boolean(rawAudio)}, Imagen: ${Boolean(rawImage)}, Video: ${Boolean(rawVideo)}]`);

    const isStaff = await isStaffSender(cleanPhone, incomingText);
    console.log(`🔍 ¿Es Staff Autorizado (${cleanPhone})?: ${isStaff}`);

    // ============================================================
    // 1. FLUJO STAFF BODEGA (Ingreso de productos por voz/texto, fotos y videos)
    // ============================================================
    if (isStaff) {
      // Disparar feedback visual inmediato al teléfono del usuario ("escribiendo...")
      sendWhatsAppPresence(cleanPhone, rawAudio ? 'recording' : 'composing').catch(() => {});

      // 🔍 1.1 Resolver Producto Destino (por código explícito o último activo)
      const mentionedCode = extractProductCodeFromMessage(incomingText);
      let targetProduct = lastStaffProductMap[cleanPhone] || null;

      if (mentionedCode) {
        const found = await supabaseService.getProductByCode(mentionedCode);
        if (found) {
          targetProduct = found;
          lastStaffProductMap[cleanPhone] = found;
          delete pendingStaffDraftMap[cleanPhone];
        }
      }

      // Si no hay producto en memoria pero hay productos en DB y llegó multimedia, tomar el más reciente
      if (!targetProduct && (rawImage || rawVideo)) {
        const allProds = await supabaseService.getProducts();
        if (allProds.length > 0) {
          targetProduct = allProds[0];
          lastStaffProductMap[cleanPhone] = targetProduct;
        }
      }

      // 🎥 1.2 Si viene un VIDEO adjunto
      if (rawVideo) {
        if (targetProduct) {
          try {
            const buffer = Buffer.from(rawVideo.replace(/^data:video\/\w+;base64,/, ''), 'base64');
            const fileName = `video_${targetProduct.id}_${Date.now()}.mp4`;
            const publicUrl = await supabaseService.uploadImageToStorage(buffer, fileName);
            if (publicUrl) {
              await supabaseService.updateProduct(targetProduct.id, { video_url: publicUrl });
              await sendWhatsAppMessage(cleanPhone, `🎬 *¡Video guardado con éxito!* ✨\nSe adjuntó al producto *#${targetProduct.code}* (${targetProduct.title}). Se reproducirá en pantalla durante la transmisión.`);
              return res.json({ success: true, staffAction: 'video_uploaded', productId: targetProduct.id, videoUrl: publicUrl });
            }
          } catch (vidErr: any) {
            console.error('Error procesando video de staff:', vidErr.message);
          }
        } else {
          await sendWhatsAppMessage(cleanPhone, `ℹ️ Recibí un video, pero no hay un producto activo. Primero envía la descripción o código de la prenda.`);
          return res.json({ success: true, staffAction: 'video_orphan' });
        }
      }

      // 📸 1.3 Si viene una IMAGEN adjunta
      if (rawImage) {
        if (targetProduct) {
          try {
            const buffer = Buffer.from(rawImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const fileName = `${targetProduct.id}_${Date.now()}.jpg`;
            const publicUrl = await supabaseService.uploadImageToStorage(buffer, fileName);
            if (publicUrl) {
              await supabaseService.addProductImage(targetProduct.id, publicUrl, `products/${fileName}`);
              await sendWhatsAppMessage(cleanPhone, `📸 *¡Foto guardada con éxito!* ✨\nSe adjuntó al producto *#${targetProduct.code}* (${targetProduct.title}).\n_Puedes seguir enviando más fotos o dictar un nuevo producto._`);
              return res.json({ success: true, staffAction: 'photo_uploaded', productId: targetProduct.id });
            }
          } catch (imgErr: any) {
            console.error('Error procesando imagen de staff:', imgErr.message);
          }
        } else {
          await sendWhatsAppMessage(cleanPhone, `ℹ️ Recibí una foto, pero no tienes un producto reciente activo. Primero envía un audio o texto con la descripción de la prenda para asignarle su código.`);
          return res.json({ success: true, staffAction: 'photo_orphan' });
        }
      }

      // 🏷️ 1.4 Si el usuario solo escribió un CÓDIGO de producto existente (sin audio ni imagen)
      if (mentionedCode && targetProduct && !rawAudio && incomingText.length <= 30) {
        await sendWhatsAppMessage(cleanPhone, `🎯 *Producto seleccionado:* *#${targetProduct.code}* (${targetProduct.title})\n\n📸 *Envía ahora las fotos o un video corto por aquí y se guardarán en esta prenda.* 🚀`);
        return res.json({ success: true, staffAction: 'product_selected', product: targetProduct });
      }

      // B) Si viene AUDIO DE VOZ (Nota de voz PTT o audio de WhatsApp)
      let aiResult: StaffAIResult | null = null;
      const currentDraft = pendingStaffDraftMap[cleanPhone];

      if (rawAudio) {
        try {
          console.log(`🎙️ Procesando audio de voz de Staff con Gemini AI + Mapa del Mundo (${cleanPhone})...`);
          const audioBuffer = Buffer.from(rawAudio.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
          aiResult = await parseStaffVoiceWithWorldMap(supabaseService, audioBuffer, audioMime, currentDraft);
        } catch (audioErr: any) {
          console.error('❌ Error procesando audio con Gemini:', audioErr.message);
        }
      }

      // C) Si viene TEXTO
      if (!aiResult && incomingText.length > 1 && !incomingText.startsWith('http')) {
        console.log(`🧠 Procesando texto de Staff con Gemini AI + Mapa del Mundo (${cleanPhone}): "${incomingText}"`);
        aiResult = await parseStaffTextWithWorldMap(supabaseService, incomingText, currentDraft);
      }

      // D) Ejecutar Meta-Tools según la intención detectada
      if (aiResult) {
        console.log(`🎯 INTENCIÓN STAFF DETECTADA: ${aiResult.intent} [isComplete: ${aiResult.isComplete}]`);

        // 1. INICIAR REGISTRO O PEDIR INSTRUCCIONES
        if (aiResult.intent === 'INICIAR_REGISTRO') {
          delete pendingStaffDraftMap[cleanPhone];
          const reply = 
            `🎙️ *¡Listo para registrar un nuevo producto!*\n\n` +
            `Por favor envíame un audio o mensaje detallando:\n` +
            `1️⃣ *Prenda y Personaje* (ej: Disfraz Batman Infantil)\n` +
            `2️⃣ *Talla* (ej: 4-6 años, M, Estándar)\n` +
            `3️⃣ *Ubicación en Bodega* (ej: Perchero A o Cajón 01)\n` +
            `4️⃣ *Precio Base* (ej: 8 mil)\n` +
            `5️⃣ *Estado* (Excelente, Bueno o Regular)\n\n` +
            `_Dime todo de corrido o en partes y lo iré anotando._`;

          await sendWhatsAppMessage(cleanPhone, reply);
          return res.json({ success: true, staffAction: 'prompt_start_registration' });
        }

        // 2. BORRADOR INCOMPLETO (NO GUARDAR EN BD HASTA TENER TODOS LOS DATOS)
        if (!aiResult.isComplete || aiResult.intent === 'COMPLETAR_DATOS') {
          if (aiResult.product) {
            pendingStaffDraftMap[cleanPhone] = aiResult.product;
          }

          const missingList: string[] = [];
          if (aiResult.missingFields?.includes('size')) missingList.push('❌ *Falta la TALLA* (ej: 4-6 años, M, etc.)');
          if (aiResult.missingFields?.includes('warehouse_location')) missingList.push('❌ *Falta la UBICACIÓN en bodega* (ej: Perchero A, Cajón 01, Estante 1)');
          if (aiResult.missingFields?.includes('base_price')) missingList.push('❌ *Falta el PRECIO BASE* (ej: 7 mil)');
          if (aiResult.missingFields?.includes('condition')) missingList.push('❌ *Falta el ESTADO de conservación* (Excelente, Bueno o Regular)');

          const productTitle = aiResult.product?.title || 'Producto en proceso';
          const draftReply = 
            `📝 *Anoté el borrador:* _"${productTitle}"_\n\n` +
            `⚠️ *Antes de guardarlo en bodega, faltan estos datos obligatorios:*\n` +
            `${missingList.join('\n')}\n\n` +
            `👉 _Dímelos por audio o texto para guardarlo y pedirte las fotos._`;

          await sendWhatsAppMessage(cleanPhone, draftReply);
          return res.json({ success: true, staffAction: 'draft_pending', missingFields: aiResult.missingFields });
        }

        // 3. REGISTRO COMPLETO Y VALIDADO (GUARDAR EN BASE DE DATOS)
        if (aiResult.isComplete && aiResult.product) {
          const parsed = aiResult.product;
          const code = await generateNextProductCode(supabaseService, parsed.item_type || 'Prenda');

          const created = await supabaseService.createProduct({
            code,
            title: parsed.title || 'Producto de Bodega',
            item_type: parsed.item_type || 'Prenda',
            character: parsed.character,
            franchise: parsed.franchise,
            size: parsed.size || 'Estándar',
            base_price: parsed.base_price || 5000,
            warehouse_location: parsed.warehouse_location || 'Bodega Principal',
            condition: parsed.condition || 'excelente',
            stock_status: 'disponible'
          });

          if (created) {
            delete pendingStaffDraftMap[cleanPhone];
            lastStaffProductMap[cleanPhone] = created;

            const staffReply = 
              `🤖 *¡Producto Registrado con Éxito!*\n\n` +
              `🏷️ *Código Asignado:* \`#${code}\`\n` +
              `📦 *Categoría:* ${parsed.item_type}\n` +
              `📝 *Título:* ${parsed.title}\n` +
              (parsed.character ? `🦸 *Personaje:* ${parsed.character} (${parsed.franchise || 'General'})\n` : '') +
              `📏 *Talla:* ${parsed.size}\n` +
              `💰 *Precio Base:* $${(parsed.base_price || 0).toLocaleString('es-CL')}\n` +
              `📍 *Ubicación:* ${parsed.warehouse_location}\n` +
              `✨ *Estado:* ${(parsed.condition || 'excelente').toUpperCase()}\n` +
              (parsed.transcription ? `🎙️ _"${parsed.transcription}"_\n` : '') +
              `\n📸 *¡Ahora envíame las fotos de esta prenda por aquí!* (Frente y espalda) para que aparezcan en pantalla durante la transmisión en vivo. 🚀`;

            await sendWhatsAppMessage(cleanPhone, staffReply);
            return res.json({ success: true, staffAction: 'product_created', product: created, parsed });
          }
        }

        // 4. APRENDER NUEVA REGLA O PREFERENCIA
        if (aiResult.intent === 'APRENDER_REGLA' && aiResult.learnedRule) {
          const { concept, instruction, category } = aiResult.learnedRule;
          await supabaseService.saveAIMemoryRule(concept, instruction, category || 'regla_staff');

          const reply = 
            `🧠 *¡Regla Aprendida y Guardada en el Mapa del Mundo!*\n\n` +
            `📌 *Concepto:* ${concept}\n` +
            `📝 *Instrucción:* ${instruction}\n\n` +
            `_Esta regla ahora se aplicará automáticamente a los próximos ingresos de bodega._`;

          await sendWhatsAppMessage(cleanPhone, reply);
          return res.json({ success: true, staffAction: 'rule_learned', rule: aiResult.learnedRule });
        }

        // 5. CONSULTAR STOCK O INFORMACIÓN
        if (aiResult.intent === 'CONSULTAR_STOCK') {
          const reply = aiResult.queryResponse || 
            `🔍 *Consulta de Stock*: Para ver el inventario en tiempo real o buscar prendas, puedes ingresar directamente a https://tiktok.lukeapp.cl/warehouse?key=luke2026`;
          await sendWhatsAppMessage(cleanPhone, reply);
          return res.json({ success: true, staffAction: 'stock_query' });
        }

        // 6. SALUDO O AYUDA
        if (aiResult.intent === 'SALUDO_O_AYUDA') {
          const reply = 
            `👋 *¡Hola! Soy el Asistente IA de Bodega.*\n\n` +
            `Puedes enviarme:\n` +
            `🎙️ *Notas de voz:* "Disfraz de Spiderman talla 6 a 8 años perchero A precio 7 mil estado excelente"\n` +
            `📝 *Textos:* Descripción de artículos para registrarlos\n` +
            `📸 *Fotos:* Para adjuntarlas al último producto creado\n` +
            `🧠 *Reglas:* "Recuerda que los Legos van en el cajón 3"`;
          await sendWhatsAppMessage(cleanPhone, reply);
          return res.json({ success: true, staffAction: 'greeting' });
        }
      }
    }

    // ============================================================
    // 2. FLUJO CLIENTES COMPRADORES (Adjudicación y reserva de prendas)
    // ============================================================
    const codeMatch = incomingText.match(/(?:me gane el|adjudique|codigo|código|prenda|#)?\s*([A-Z0-9]{1,8})\b/i);
    let matchedBag = null;

    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].toUpperCase();
      matchedBag = await supabaseService.findPendingBagByProductCode(code);
      if (matchedBag) {
        console.log(`🎯 MATCH EXITOSO WHATSAPP: Código #${code} corresponde a reserva de @${matchedBag.buyers?.tiktok_username}`);
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

app.get('/api/categories', async (req, res) => {
  const categories = await supabaseService.getCategories();
  res.json({ success: true, categories });
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
