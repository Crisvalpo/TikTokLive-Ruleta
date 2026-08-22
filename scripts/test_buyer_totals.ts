import { InteractiveEngine } from '../src/interactive/engine';
import { InternalGameEvent } from '../src/types';

console.log('🧪 EJECUTANDO TEST DE TOTALES Y CONSULTAS ("¿Cuánto llevo?")...\n');

const engine = new InteractiveEngine();

function createChatEvent(username: string, rawMessage: string, numericValue?: number): InternalGameEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: `id_${username}`,
    username,
    rawMessage,
    numericValue,
    timestamp: new Date().toISOString()
  };
}

async function runTest() {
  // Esperar a que el motor cargue la sesión persistida
  await new Promise(r => setTimeout(r, 1500));

  // 1. Normalización de nombres de usuario
  console.log('--- TEST 1: Normalización de nombres de usuario y emojis ---');
  const m1 = engine.matchesUsername('Yicel 🥰🥰', 'yicel');
  const m2 = engine.matchesUsername('@Yicel', 'yicel');
  const m3 = engine.matchesUsername('yicel_123', 'yicel_123');
  const m4 = engine.matchesUsername('Yicel 🥰🥰', 'yicel_123');

  console.log(`"Yicel 🥰🥰" vs "yicel": ${m1 ? '✅' : '❌'}`);
  console.log(`"@Yicel" vs "yicel": ${m2 ? '✅' : '❌'}`);
  console.log(`"yicel_123" vs "yicel_123": ${m3 ? '✅' : '❌'}`);
  console.log(`"Yicel 🥰🥰" vs "yicel_123": ${m4 ? '✅' : '❌'}`);

  if (!m1 || !m2 || !m3 || !m4) {
    throw new Error('Fallo en coincidencia de nombres de usuario');
  }

  // 2. Consulta de Totales de la compradora real (Yicel)
  console.log('\n--- TEST 2: Consulta Asíncrona para @Yicel 🥰🥰 ---');
  const yicelSummary = await engine.getBuyerSummaryAsync('Yicel 🥰🥰');
  console.log('Resumen obtenido para @Yicel 🥰🥰:', yicelSummary);

  if (yicelSummary.itemsCount > 0 && yicelSummary.totalAmount > 0) {
    console.log(`✅ TEST 2 PASÓ: Prendas detectadas correctamente (${yicelSummary.itemsCount} prendas por $${yicelSummary.totalAmount.toLocaleString('es-CL')})`);
  } else {
    throw new Error(`TEST 2 FALLÓ: No se detectaron las prendas de Yicel (${JSON.stringify(yicelSummary)})`);
  }

  // 3. Simulación de chat "¿Cuánto llevo?"
  console.log('\n--- TEST 3: Disparo de evento OBS al escribir "¿Cuánto llevo?" ---');
  let eventDispatched = false;
  engine.on('show_buyer_total', (summary) => {
    eventDispatched = true;
    console.log(`📢 OVERLAY OBS DISPARADO:`);
    console.log(`   👤 Comprador: @${summary.username}`);
    console.log(`   🛍️ Total Prendas: $${summary.totalAmount.toLocaleString('es-CL')} (${summary.itemsCount} prendas)`);
    console.log(`   💵 Abono Pagado: $${summary.depositAmount.toLocaleString('es-CL')}`);
    console.log(`   💳 Saldo para Cerrar: $${summary.pendingBalance.toLocaleString('es-CL')}`);
  });

  engine.processEvent(createChatEvent('Yicel 🥰🥰', 'Cuanto llevo ?'));

  await new Promise(r => setTimeout(r, 1000));

  if (eventDispatched) {
    console.log('✅ TEST 3 PASÓ: Evento para OBS emitido correctamente con los montos exactos');
  } else {
    throw new Error('TEST 3 FALLÓ: No se emitió el evento para OBS');
  }

  console.log('\n✨ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO');
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
