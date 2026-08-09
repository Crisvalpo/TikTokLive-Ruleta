import { EventHandler } from '../src/events/handler';
import { GameEngine } from '../src/game/engine';
import { SupabaseService } from '../src/db/supabase';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCategoryAssemblyTest() {
  console.log('🎬 INICIANDO PRUEBA DE ENSAMBLE DE QUIZ DE COMUNIDAD Y CATEGORÍAS...\n');

  const API_BASE = 'http://localhost:3000/api';

  // 1. Cargar Quiz ensamblado de la categoría 'Cine' o 'General'
  console.log('📚 1. Cargando Quiz ensamblado para categoría "Cine y Series"...');
  const res = await fetch(`${API_BASE}/admin/load-category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'Cine y Series' })
  });
  const data = await res.json();
  console.log('  ➔ Resultado de Carga:', data.quiz ? `Quiz "${data.quiz.title}" (Creadores: ${data.quiz.creator_handle || '@comunidad'})` : 'Usando fallback local');

  await sleep(2000);

  // 2. Iniciar Pregunta 1 del Quiz ensamblado
  console.log('\n▶️ 2. Iniciando Pregunta 1 en el Game Show...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start_question' })
  });

  await sleep(3000);

  // 3. Simular espectadores respondiendo
  console.log('💬 3. Simulando respuestas de espectadores en vivo...');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'juan', comment: 'A' })
  });
  await sleep(1500);

  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maria', comment: 'A' })
  });
  await sleep(2000);

  // 4. Revelar Resultado
  console.log('⏱️ 4. Revelando Respuesta Correcta (RESULT)...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'show_result' })
  });
  await sleep(3000);

  // 5. Mostrar Leaderboard
  console.log('🏆 5. Mostrando Leaderboard...');
  await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'show_leaderboard' })
  });
  await sleep(3000);

  // 6. Ganadora @maria hace girar la Ruleta de Categorías
  console.log('🎰 6. La ganadora @maria activa la Ruleta de Categorías con /girar...');
  await fetch(`${API_BASE}/simulator/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maria', comment: '/girar' })
  });

  console.log('\n✨ Prueba de Ensamble y Categorías ejecutada exitosamente.');
}

runCategoryAssemblyTest().catch(console.error);
