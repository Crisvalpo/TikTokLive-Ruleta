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
import { GameEngine } from './game/engine';
import { InteractiveEngine } from './interactive/engine';
import { InternalGameEvent } from './types';
import { MOCK_QUIZ, MARIO_QUIZ } from './data/mockQuiz';

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

// Instanciar módulos del Game Show Engine e Interactive Engine
const eventHandler = EventHandler.getInstance();
const tiktokService = new TikTokService(TIKTOK_USERNAME);
const supabaseService = new SupabaseService();
const gameEngine = new GameEngine();
const interactiveEngine = new InteractiveEngine();

// Broadcast WebSocket a todos los clientes (Simulator, OBS y Overlay)
function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Suscribirse a cambios de estado del Game Engine (Quiz & Ruleta)
gameEngine.on('state_change', (session) => {
  broadcast('GAME_STATE_UPDATE', session);
});

// Suscribirse a cambios de estado del Interactive Engine (Subastas de Productos)
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

// Endpoint para abrir una Caja Misteriosa desde la API o Panel de Control
app.post('/api/interactive/open-box', (req, res) => {
  const { boxNumber, username } = req.body;
  const opened = interactiveEngine.openMysteryBox(Number(boxNumber), username);
  res.json({ success: opened, session: interactiveEngine.getSession() });
});


// Suscribirse a eventos internos procesados por EventHandler
eventHandler.on('event', (event: InternalGameEvent) => {
  // Broadcast evento bruto
  broadcast('EVENT', event);

  // Guardar en Supabase (MVP 4)
  supabaseService.saveEvent(event);

  // Procesar en el Game Engine (Quiz & Ruleta)
  gameEngine.processEvent(event);

  // Procesar en el Interactive Engine (Subastas & Modo Interactivo 45s)
  interactiveEngine.processEvent(event);
});

import { generateCategoryQuiz } from './data/categoryGenerator';

// Suscribirse a giros ejecutados por la Ruleta y encadenar automáticamente la siguiente ronda
gameEngine.on('spin', (event: InternalGameEvent) => {
  console.log(`📡 Emitiendo evento SPIN_EXECUTED a clientes WebSocket (OBS/Panel)...`);
  broadcast('SPIN_EXECUTED', event);

  const winningCategory = event.spinResult?.animalName || 'General';
  console.log(`🎰 Ruleta seleccionó categoría: "${winningCategory}". Cargando nueva ronda en 8.5s...`);

  // Tras 8.5s (animación de giro terminada), cargar el Quiz y mostrar la tarjeta de anuncio de categoría
  setTimeout(async () => {
    let quiz = await supabaseService.fetchLiveQuiz(winningCategory);
    let creatorHandle = '@comunidad';

    if (!quiz) {
      console.log(`🤖 Generando nuevo Quiz fresco para categoría "${winningCategory}"...`);
      quiz = generateCategoryQuiz(winningCategory);
      creatorHandle = '@luke_ai';
      supabaseService.saveGeneratedQuiz(quiz, winningCategory);
    } else {
      creatorHandle = quiz.creator_handle || '@comunidad';
    }

    gameEngine.loadQuiz(quiz, creatorHandle, winningCategory);
    gameEngine.showCategoryIntro(winningCategory, creatorHandle);
  }, 8500);
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

const ACCESS_KEY = process.env.ACCESS_KEY || 'luke2026';

// Middleware de seguridad para privatizar rutas operativas del show
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

// --- Rutas HTTP Operativas Privadas ---

app.get('/simulator', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'simulator.html'));
});

app.get('/obs', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'obs.html'));
});

app.get('/interactive', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'interactive.html'));
});

app.get('/obs-interactive', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'obs-interactive.html'));
});

app.get('/roulette', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'obs.html'));
});

app.get('/overlay', requireAccessKey, (req, res) => {
  res.sendFile(path.join(publicDir, 'overlay.html'));
});

app.use('/api', requireAccessKey);

app.get('/api/status', (req, res) => {
  res.json({
    status: tiktokService.getStatus(),
    session: gameEngine.getSession(),
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

// Endpoint para el Simulador de TikTok
app.post('/api/simulator/send', (req, res) => {
  const { username, comment, userId } = req.body;
  const event = tiktokService.simulateComment(username || 'juan', comment || 'A', userId);
  res.json({ success: true, event });
});

// --- Endpoints REST para el Modo Interactivo / Subastas ---

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

interactiveEngine.on('show_buyer_total', (summary) => {
  broadcast('SHOW_BUYER_TOTAL_OVERLAY', summary);
});

// --- Endpoints Quiz & Game Engine ---

app.get('/api/admin/quizzes', async (req, res) => {
  const quizzes = await supabaseService.fetchAllPublicQuizzes();
  res.json({ success: true, quizzes });
});

app.post('/api/admin/load-quiz-by-id', async (req, res) => {
  const { quizId } = req.body;
  const quiz = await supabaseService.fetchQuizById(quizId);
  if (quiz) {
    gameEngine.loadQuiz(quiz, quiz.creator_handle || '@comunidad', quiz.category);
    gameEngine.showCategoryIntro(quiz.category || quiz.title, quiz.creator_handle || '@comunidad');
    res.json({ success: true, quiz });
  } else {
    res.status(404).json({ success: false, error: 'Quiz no encontrado' });
  }
});

app.post('/api/admin/load-mario', (req, res) => {
  gameEngine.loadQuiz(MARIO_QUIZ, '@nintendo_fans');
  gameEngine.showCategoryIntro('Super Mario Bros', '@nintendo_fans');
  res.json({ success: true, quiz: MARIO_QUIZ });
});

app.post('/api/admin/load-category', async (req, res) => {
  const { category } = req.body;
  const quiz = await supabaseService.fetchLiveQuiz(category);
  if (quiz) {
    gameEngine.loadQuiz(quiz, (quiz as any).creator_handle || '@comunidad');
    res.json({ success: true, quiz });
  } else {
    gameEngine.loadQuiz(MOCK_QUIZ, '@comunidad');
    res.json({ success: true, fallback: true, quiz: MOCK_QUIZ });
  }
});

app.post('/api/admin/action', (req, res) => {
  const { action } = req.body;

  if (action === 'start_question') {
    gameEngine.startQuestion(0);
  } else if (action === 'next_question') {
    gameEngine.nextQuestion();
  } else if (action === 'show_result') {
    gameEngine.showResult();
  } else if (action === 'show_leaderboard') {
    gameEngine.showLeaderboard();
  }

  res.json({ success: true, session: gameEngine.getSession() });
});

// Manejo de conexiones WebSocket entrantes
wss.on('connection', (ws) => {
  console.log('🔌 Cliente WebSocket conectado al Game Show & Interactive Engine.');

  // Enviar estado de ambas sesiones inmediatamente
  ws.send(JSON.stringify({
    type: 'GAME_STATE_UPDATE',
    data: gameEngine.getSession()
  }));

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

// Iniciar Servidor
server.listen(PORT, async () => {
  console.log(`\n==================================================`);
  console.log(`🚀 LUKE LIVE GAME ENGINE corriendo en puerto ${PORT}`);
  console.log(`👗 Panel Vendedora Modo Interactivo: http://localhost:${PORT}/interactive?key=${ACCESS_KEY}`);
  console.log(`📺 Overlay OBS Modo Interactivo:     http://localhost:${PORT}/obs-interactive?key=${ACCESS_KEY}`);
  console.log(`🎮 Simulador de TikTok:              http://localhost:${PORT}/simulator?key=${ACCESS_KEY}`);
  console.log(`📺 Pantalla OBS Game Show / Ruleta:  http://localhost:${PORT}/obs?key=${ACCESS_KEY}`);
  console.log(`==================================================\n`);

  if (TIKTOK_USERNAME) {
    tiktokService.connect().catch(() => {}).finally(() => {
      broadcast('STATUS_UPDATE', tiktokService.getStatus());
    });
  }
});

