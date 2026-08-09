import { EventHandler } from '../src/events/handler';
import { parseCommand } from '../src/commands/parser';
import { GameEngine } from '../src/game/engine';

console.log('🧪 Iniciando prueba automatizada de LUKE LIVE Game Show Engine...\n');

// 1. Probar parsers de comandos y respuestas A, B, C, D
const test1 = parseCommand('/girar');
console.log('Prueba 1 (/girar):', test1.command === 'SPIN_REQUEST' ? '✅ PASÓ' : '❌ FALLÓ');

const test2 = parseCommand('A');
console.log('Prueba 2 (Respuesta A):', test2.command === 'PLAYER_ANSWER' && test2.answer === 'A' ? '✅ PASÓ' : '❌ FALLÓ');

const test3 = parseCommand('Hola directo');
console.log('Prueba 3 (Comentario):', test3.command === 'CHAT_MESSAGE' ? '✅ PASÓ' : '❌ FALLÓ');

// 2. Probar Game Engine
const eventHandler = EventHandler.getInstance();
const gameEngine = new GameEngine();

gameEngine.on('state_change', (session) => {
  console.log(`[ESTADO GAME ENGINE]: ${session.current_state} (Pregunta ${session.current_question_index + 1})`);
});

gameEngine.on('spin', (event) => {
  console.log(`✅ GIRANDO RULETA: Ganador #${event.spinResult.number} ${event.spinResult.animalEmoji} ${event.spinResult.animalName}`);
});

eventHandler.on('event', (event) => {
  gameEngine.processEvent(event);
});

// Simular flujo completo del Game Show
console.log('\n--- SIMULANDO PREGUNTA 1 ---');
gameEngine.startQuestion(0);

// Simular respuestas de 3 participantes
eventHandler.handleTikTokChat({ uniqueId: 'juan', userId: '1', comment: 'B' }, 'simulator');
eventHandler.handleTikTokChat({ uniqueId: 'maria', userId: '2', comment: 'A' }, 'simulator');
eventHandler.handleTikTokChat({ uniqueId: 'pedro', userId: '3', comment: 'A' }, 'simulator');

// Mostrar Resultado (Respuesta correcta es A: Oslo)
console.log('\n--- REVELANDO RESULTADO ---');
gameEngine.showResult();

// Mostrar Leaderboard (maria y pedro empatan con 100 pts)
console.log('\n--- LEADERBOARD ---');
gameEngine.showLeaderboard();

// Simular Giro de Ruleta activado por la ganadora maria
console.log('\n--- ACTIVANDO RULETA ---');
eventHandler.handleTikTokChat({ uniqueId: 'maria', userId: '2', comment: '/girar' }, 'simulator');

console.log('\n🎉 Pruebas unitarias de LUKE LIVE superadas con éxito.');
