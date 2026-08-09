import { EventEmitter } from 'events';
import { InternalGameEvent, LiveSession, LiveSessionState, Player, Quiz, QuizQuestion } from '../types';
import { MOCK_QUIZ } from '../data/mockQuiz';

export const CATEGORIES_36 = [
  { id: 1, name: 'Cine y Series', emoji: '🎬' },
  { id: 2, name: 'Deportes', emoji: '⚽' },
  { id: 3, name: 'Música', emoji: '🎵' },
  { id: 4, name: 'Geografía', emoji: '🌍' },
  { id: 5, name: 'Trivia Curiosa', emoji: '🧠' },
  { id: 6, name: 'Videojuegos', emoji: '🎮' },
  { id: 7, name: 'Ciencia', emoji: '🚀' },
  { id: 8, name: 'Historia', emoji: '📜' },
  { id: 9, name: 'Doble Puntaje', emoji: '💥' },
  { id: 10, name: 'Quiz Comunidad', emoji: '🎨' },
  { id: 11, name: 'Gastronomía', emoji: '🍕' },
  { id: 12, name: 'Relámpago', emoji: '⚡' },
  { id: 13, name: 'Superhéroes', emoji: '🦸' },
  { id: 14, name: 'Automovilismo', emoji: '🏎️' },
  { id: 15, name: 'Anime & Manga', emoji: '📺' },
  { id: 16, name: 'Naturaleza', emoji: '🦁' },
  { id: 17, name: 'Arte & Cultura', emoji: '🎭' },
  { id: 18, name: 'Tecnología', emoji: '📱' },
  { id: 19, name: 'Cine y Series', emoji: '🎬' },
  { id: 20, name: 'Deportes', emoji: '⚽' },
  { id: 21, name: 'Música', emoji: '🎵' },
  { id: 22, name: 'Geografía', emoji: '🌍' },
  { id: 23, name: 'Trivia Curiosa', emoji: '🧠' },
  { id: 24, name: 'Videojuegos', emoji: '🎮' },
  { id: 25, name: 'Ciencia', emoji: '🚀' },
  { id: 26, name: 'Historia', emoji: '📜' },
  { id: 27, name: 'Doble Puntaje', emoji: '💥' },
  { id: 28, name: 'Quiz Comunidad', emoji: '🎨' },
  { id: 29, name: 'Gastronomía', emoji: '🍕' },
  { id: 30, name: 'Relámpago', emoji: '⚡' },
  { id: 31, name: 'Superhéroes', emoji: '🦸' },
  { id: 32, name: 'Automovilismo', emoji: '🏎️' },
  { id: 33, name: 'Anime & Manga', emoji: '📺' },
  { id: 34, name: 'Naturaleza', emoji: '🦁' },
  { id: 35, name: 'Arte & Cultura', emoji: '🎭' },
  { id: 36, name: 'Tecnología', emoji: '📱' }
];

export class GameEngine extends EventEmitter {
  private session: LiveSession;
  private playersMap: Map<string, Player> = new Map();
  private quizQuestions: QuizQuestion[] = MOCK_QUIZ.questions;
  private questionTimer: NodeJS.Timeout | null = null;
  private isSpinning: boolean = false;
  private questionEndedAt: number = 0;

  constructor() {
    super();
    this.session = {
      id: `session_${Date.now()}`,
      status: 'WAITING',
      source: 'simulator',
      game_type: 'quiz_roulette',
      current_state: 'WAITING',
      current_question_index: 0,
      current_question: this.quizQuestions[0] || null,
      players: [],
      leaderboard: [],
      created_at: new Date().toISOString(),
      timeRemaining: 0
    };
  }

  public getSession(): LiveSession {
    const now = Date.now();
    const INACTIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inactividad

    // Filtrar jugadores activos en los últimos 5 minutos (manejando la rotación de espectadores de TikTok)
    const activePlayers = Array.from(this.playersMap.values()).filter(p => {
      const lastActive = new Date(p.lastActiveTime).getTime();
      return (now - lastActive) < INACTIVE_TIMEOUT_MS;
    });

    this.session.players = activePlayers;
    this.session.leaderboard = [...activePlayers].sort((a, b) => b.score - a.score);
    return this.session;
  }

  public processEvent(event: InternalGameEvent): InternalGameEvent {
    const nowStr = new Date().toISOString();

    // 1. Registrar/Actualizar jugador y刷新 timestamp de última actividad
    let player = this.playersMap.get(event.username);
    if (!player) {
      player = {
        username: event.username,
        score: 0,
        totalCorrect: 0,
        lastActiveTime: nowStr,
        canSpin: true
      };
      this.playersMap.set(event.username, player);
    } else {
      player.lastActiveTime = nowStr;
    }

    // 2. Procesar Respuesta de Quiz (A, B, C, D) con Ventana de Gracia Anti-Lag de 3 segundos
    if (event.type === 'PLAYER_ANSWER' && event.answer) {
      const isWithinGraceWindow = this.questionEndedAt > 0 && (Date.now() - this.questionEndedAt < 3000);
      if (this.session.current_state === 'QUESTION' || isWithinGraceWindow) {
        player.lastAnswer = event.answer;
        player.lastAnswerTime = nowStr;
        console.log(`🎯 RESPUESTA REGISTRADA ${isWithinGraceWindow ? '(Tolerancia Anti-Lag)' : ''}: @${event.username} ➔ ${event.answer}`);
        this.emitStateChange();
      } else {
        console.log(`⚠️ Respuesta de @${event.username} fuera de tiempo (Estado: ${this.session.current_state})`);
      }
    }

    // 3. Procesar Solicitud de Giro (/girar)
    if (event.type === 'SPIN_REQUEST') {
      if (this.isSpinning) {
        console.log(`⏱️ Petición /girar de @${event.username} ignorada (Ruleta en giro).`);
        return event;
      }

      this.isSpinning = true;
      this.session.current_state = 'SPINNING';
      this.emitStateChange();

      // Seleccionar categoría ganadora 1 a 36
      const winningNumber = Math.floor(Math.random() * 36) + 1;
      const categoryItem = CATEGORIES_36.find(a => a.id === winningNumber) || CATEGORIES_36[0];

      event.spinResult = {
        number: winningNumber,
        animalName: categoryItem.name,
        animalEmoji: categoryItem.emoji
      };

      console.log(`\n🎰 LUKE ENGINE: ¡Giro activado por @${event.username}!`);
      console.log(`🎯 Categoría Seleccionada por la Ruleta: #${winningNumber} - ${categoryItem.emoji} ${categoryItem.name}\n`);

      this.emit('spin', event);

      // Tras 7 segundos de animación en OBS, regresar al estado de espera o siguiente pregunta
      setTimeout(() => {
        this.isSpinning = false;
        this.session.current_state = 'LEADERBOARD';
        this.emitStateChange();
      }, 7000);
    }

    return event;
  }

  // --- Cargar Quiz de la Comunidad o Categoría ---

  private resetPlayerScores() {
    this.playersMap.forEach(player => {
      player.score = 0;
      player.lastAnswer = undefined;
    });
    console.log('🔄 PUNTAJES REINICIADOS A 0 PARA LA NUEVA RONDA.');
  }

  public loadQuiz(quiz: Quiz, creatorHandle: string = '@comunidad', categoryName?: string) {
    this.resetPlayerScores();
    this.quizQuestions = (quiz.questions || []).slice(0, GameEngine.MAX_QUESTIONS_PER_ROUND);
    this.session.current_question_index = 0;
    this.session.current_question = this.quizQuestions[0] || null;
    (this.session as any).quizTitle = quiz.title;
    (this.session as any).creatorHandle = creatorHandle;
    (this.session as any).currentCategory = categoryName || (quiz.questions?.[0]?.keyword) || 'Trivia General';
    (this.session as any).coverImage = (quiz as any).cover_image || (quiz as any).coverImage || null;
    this.session.current_state = 'WAITING';
    console.log(`\n📚 QUIZ CARGADO: "${quiz.title}" (Categoría: ${(this.session as any).currentCategory}) (Creado por: ${creatorHandle}) - ${this.quizQuestions.length} preguntas`);
    this.emitStateChange();
  }

  public showCategoryIntro(categoryName: string, creatorHandle: string = '@comunidad') {
    (this.session as any).currentCategory = categoryName;
    (this.session as any).creatorHandle = creatorHandle;
    this.session.current_state = 'CATEGORY_INTRO' as any;
    console.log(`\n📢 ANUNCIO DE NUEVA CATEGORÍA: "${categoryName}" (Creadores: ${creatorHandle})`);
    this.emitStateChange();

    // Tras 6 segundos de anuncio de la categoría, inicia automáticamente la Pregunta 1
    setTimeout(() => {
      this.startQuestion(0);
    }, 6000);
  }

  // --- Transiciones de Estado del Game Show ---

  public startQuestion(questionIndex?: number) {
    if (questionIndex !== undefined && questionIndex < this.quizQuestions.length) {
      this.session.current_question_index = questionIndex;
    }

    this.session.current_question = this.quizQuestions[this.session.current_question_index] || this.quizQuestions[0];
    this.session.current_state = 'QUESTION';
    this.session.timeRemaining = 20; // 20s para compensar los 3-5s de latencia RTMP de TikTok LIVE

    // Resetear respuestas previas de jugadores para la nueva pregunta
    this.playersMap.forEach(p => { p.lastAnswer = undefined; });

    console.log(`\n🎤 PREGUNTA INICIADA (#${this.session.current_question_index + 1}): ${this.session.current_question.text}`);
    this.emitStateChange();

    // Iniciar temporizador de 20 segundos
    if (this.questionTimer) clearInterval(this.questionTimer);
    
    this.questionTimer = setInterval(() => {
      if (this.session.timeRemaining! > 0) {
        this.session.timeRemaining!--;
        this.emitStateChange();
      } else {
        clearInterval(this.questionTimer!);
        this.questionTimer = null;
        this.showResult();
      }
    }, 1000);
  }

  public showResult() {
    this.session.current_state = 'RESULT';
    this.questionEndedAt = Date.now();
    const correctOpt = this.session.current_question?.correct_option;

    // Evaluar respuestas y otorgar 100 puntos a los acertados
    this.playersMap.forEach(player => {
      if (player.lastAnswer === correctOpt) {
        player.score += 100;
        player.totalCorrect += 1;
        player.canSpin = true;
      }
    });

    console.log(`\n✅ RESULTADO MOSTRADO. Opción Correcta: ${correctOpt}`);
    this.emitStateChange();

    // Transición automática a LEADERBOARD tras 5 segundos de mostrar la respuesta
    setTimeout(() => {
      if (this.session.current_state === 'RESULT') {
        this.showLeaderboard();
      }
    }, 5000);
  }

  public showLeaderboard() {
    this.session.current_state = 'LEADERBOARD';
    console.log(`\n🏆 LEADERBOARD MOSTRADO.`);
    this.emitStateChange();

    const maxQ = Math.min(this.quizQuestions.length, GameEngine.MAX_QUESTIONS_PER_ROUND);

    // Si aún quedan preguntas en esta ronda (menos de 10), avanzar a la siguiente automáticamente tras 5s
    if (this.session.current_question_index + 1 < maxQ) {
      setTimeout(() => {
        if (this.session.current_state === 'LEADERBOARD') {
          this.nextQuestion();
        }
      }, 5000);
    } else {
      // Si la ronda de 10 preguntas finalizó, esperar 10s para el giro de ruleta. Si nadie gira, auto-girar.
      setTimeout(() => {
        if (this.session.current_state === 'LEADERBOARD' && !this.isSpinning) {
          const lb = this.getSession().leaderboard || [];
          const winnerName = lb.length > 0 ? lb[0].username : 'autobot';
          console.log(`⏱️ Auto-activando giro de Ruleta para @${winnerName}...`);
          this.processEvent({
            id: `sys_${Date.now()}`,
            type: 'SPIN_REQUEST',
            username: winnerName,
            userId: 'auto',
            rawMessage: '/girar',
            source: 'system',
            timestamp: new Date().toISOString()
          });
        }
      }, 10000);
    }
  }

  public static readonly MAX_QUESTIONS_PER_ROUND = 10;

  public nextQuestion() {
    const maxQ = Math.min(this.quizQuestions.length, GameEngine.MAX_QUESTIONS_PER_ROUND);
    if (this.session.current_question_index + 1 < maxQ) {
      this.startQuestion(this.session.current_question_index + 1);
    } else {
      this.session.current_state = 'FINISHED';
      console.log(`\n🎉 RONDA COMPLETADA (Máximo ${maxQ} preguntas).`);
      this.emitStateChange();
    }
  }

  private emitStateChange() {
    this.session.status = this.session.current_state;
    this.emit('state_change', this.getSession());
  }
}
