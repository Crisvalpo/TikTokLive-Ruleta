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
app.use(express.json());
app.use(express.static(publicDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Instanciar módulos
const eventHandler = EventHandler.getInstance();
const tiktokService = new TikTokService(TIKTOK_USERNAME);
const supabaseService = new SupabaseService();
const interactiveEngine = new InteractiveEngine();

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

interactiveEngine.on('winner_declared', (winner) => {
  broadcast('INTERACTIVE_WINNER_DECLARED', winner);
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
  const key = req.query.key || req.headers['x-access-key'];
  if (key === ACCESS_KEY) {
    return next();
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
// API — ESTADO Y CONEXIÓN TIKTOK
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
  const { title, code, startingPrice, durationSeconds } = req.body;
  const newProduct = interactiveEngine.addProduct(title, code, startingPrice, durationSeconds);
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

app.post('/api/interactive/show-buyer-total', (req, res) => {
  const { username } = req.body;
  const summary = interactiveEngine.getBuyerSummary(username);
  broadcast('SHOW_BUYER_TOTAL_OVERLAY', summary);
  res.json({ success: true, summary });
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
