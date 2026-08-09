import { EventHandler } from '../src/events/handler';
import { GameEngine } from '../src/game/engine';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('🎬 INICIANDO DEMOSTRACIÓN EN VIVO DEL LUKE LIVE GAME SHOW...\n');

  // Hacemos llamadas HTTP al servidor local para que emita por WebSockets a todos los navegadores abiertos

  const API_BASE = 'http://localhost:3000/api';

  // 1. Iniciar Pregunta 1
  console.log('▶️ 1. Iniciando Pregunta 1 en el Game Show...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start_question' })
  });

  await sleep(3000);

  // 2. Simular 3 espectadores respondiendo
  console.log('💬 2. Simulando respuestas de espectadores de TikTok en tiempo real...');
  
  console.log('  ➔ @juan responde B');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'juan', comment: 'B' })
  });
  await sleep(1500);

  console.log('  ➔ @maria responde A');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maria', comment: 'A' })
  });
  await sleep(1500);

  console.log('  ➔ @pedro responde A');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'pedro', comment: 'A' })
  });
  await sleep(3000);

  // 3. Revelar Respuesta Correcta (RESULT)
  console.log('⏱️ 3. Revelando Respuesta Correcta (RESULT)...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'show_result' })
  });
  await sleep(4000);

  // 4. Mostrar Leaderboard
  console.log('🏆 4. Desplegando Podio de Ranking (LEADERBOARD)...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'show_leaderboard' })
  });
  await sleep(4000);

  // 5. La ganadora @maria activa la Ruleta con /girar
  console.log('🎰 5. @maria activa el giro de Ruleta con /girar...');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maria', comment: '/girar' })
  });

  console.log('\n✨ Demostración en vivo completada exitosamente.');
}

runDemo().catch(console.error);
