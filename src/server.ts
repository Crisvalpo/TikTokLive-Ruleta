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

// Instanciar módulos del Game Show Engine
const eventHandler = EventHandler.getInstance();
const tiktokService = new TikTokService(TIKTOK_USERNAME);
const supabaseService = new SupabaseService();
const gameEngine = new GameEngine();

// Broadcast WebSocket a todos los clientes (Simulator, OBS y Overlay)
function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Suscribirse a cambios de estado de la sesión del Game Engine
gameEngine.on('state_change', (session) => {
  broadcast('GAME_STATE_UPDATE', session);
});

// Suscribirse a eventos internos procesados por EventHandler
eventHandler.on('event', (event: InternalGameEvent) => {
  // Broadcast evento bruto
  broadcast('EVENT', event);

  // Guardar en Supabase (MVP 4)
  supabaseService.saveEvent(event);

  // Procesar en el Game Engine (MVP 5 - Quiz & Ruleta)
  gameEngine.processEvent(event);
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
      // Persistir el nuevo quiz en Supabase para nutrir quiz.lukeapp.cl para siempre
      supabaseService.saveGeneratedQuiz(quiz, winningCategory);
    } else {
      creatorHandle = quiz.creator_handle || '@comunidad';
    }

    gameEngine.loadQuiz(quiz, creatorHandle, winningCategory);
    gameEngine.showCategoryIntro(winningCategory, creatorHandle);
  }, 8500);
});

const ACCESS_KEY = process.env.ACCESS_KEY || 'luke2026';

// Middleware de seguridad para privatizar rutas operativas del show
function requireAccessKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.query.key || req.headers['x-access-key'];
  if (key === ACCESS_KEY) {
    return next();
  }
  // Si no se provee la clave secreta o es incorrecta, redirigir a la portada pública
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
    session: gameEngine.getSession()
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

// Endpoint para obtener la lista completa de Quizzes creados en quiz.lukeapp.cl
app.get('/api/admin/quizzes', async (req, res) => {
  const quizzes = await supabaseService.fetchAllPublicQuizzes();
  res.json({ success: true, quizzes });
});

// Endpoint para cargar un Quiz específico por ID seleccionado en el simulador
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

// Endpoint especial para cargar y arrancar inmediatamente el Quiz de Mario Bros
app.post('/api/admin/load-mario', (req, res) => {
  gameEngine.loadQuiz(MARIO_QUIZ, '@nintendo_fans');
  gameEngine.showCategoryIntro('Super Mario Bros', '@nintendo_fans');
  res.json({ success: true, quiz: MARIO_QUIZ });
});

// Endpoint para cargar un Quiz por categoría (reciclado de Supabase o local)
app.post('/api/admin/load-category', async (req, res) => {
  const { category } = req.body;
  const quiz = await supabaseService.fetchLiveQuiz(category);
  if (quiz) {
    gameEngine.loadQuiz(quiz, (quiz as any).creator_handle || '@comunidad');
    res.json({ success: true, quiz });
  } else {
    // Si no hay quiz en Supabase para esa categoría, se usa el catálogo de respaldo local
    gameEngine.loadQuiz(MOCK_QUIZ, '@comunidad');
    res.json({ success: true, fallback: true, quiz: MOCK_QUIZ });
  }
});

// Endpoint para acciones del Presentador (Host Control)
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
  console.log('🔌 Cliente WebSocket conectado al Game Show Engine.');

  // Enviar estado de la sesión y de TikTok inmediatamente
  ws.send(JSON.stringify({
    type: 'GAME_STATE_UPDATE',
    data: gameEngine.getSession()
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
  console.log(`🚀 LUKE LIVE GAME SHOW ENGINE corriendo en puerto ${PORT}`);
  console.log(`🎮 Simulador de TikTok: http://localhost:${PORT}/simulator`);
  console.log(`📺 Pantalla OBS Game Show: http://localhost:${PORT}/obs`);
  console.log(`🎰 Overlay Ruleta:        http://localhost:${PORT}/overlay`);
  console.log(`==================================================\n`);

  // Intentar conectar al TikTok LIVE configurado si se especificó
  if (TIKTOK_USERNAME) {
    await tiktokService.connect();
    broadcast('STATUS_UPDATE', tiktokService.getStatus());
  }
});
