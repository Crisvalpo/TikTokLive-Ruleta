import { whatsappBotService } from '../src/services/whatsappBotService';
import { supabaseService } from '../src/db/supabase';

async function testDynamicInfoAndLiveState() {
  console.log('==================================================');
  console.log('🧪 PRUEBA DE INFORMACIÓN DINÁMICA & JORNADA DE LIVE');
  console.log('==================================================\n');

  // Asegurar que no hay jornada previa abierta para la prueba
  await supabaseService.finishLiveSession();

  // 1. Probar respuesta de información sin Live activo
  console.log('1️⃣ Solicitando información (sin Live activo)...');
  const infoReplyNoLive = await whatsappBotService.getInfoReply();
  console.log('\n--- RESPUESTA INFO (SIN LIVE ACTIVO) ---');
  console.log(infoReplyNoLive);
  console.log('----------------------------------------\n');

  if (infoReplyNoLive.includes('https://nn.lukeapp.cl') && infoReplyNoLive.toLowerCase().includes('sin transmisi')) {
    console.log('   ✅ RESPUESTA SIN LIVE CORRECTA.\n');
  } else {
    console.error('   ❌ FALLÓ RESPUESTA SIN LIVE.\n');
  }

  // 2. Simular inicio de Jornada de Live (ej: LIVE-001 "Ropa deportiva")
  const testLiveTitle = 'LIVE-001 "Ropa deportiva"';
  console.log(`2️⃣ Iniciando Jornada de Live simulada: ${testLiveTitle}...`);
  const liveSession = await supabaseService.startLiveSession(testLiveTitle);

  // 3. Solicitar información con Live activo
  console.log('3️⃣ Solicitando información (CON Live activo)...');
  const infoReplyLive = await whatsappBotService.getInfoReply();
  console.log('\n--- RESPUESTA INFO (CON LIVE ACTIVO) ---');
  console.log(infoReplyLive);
  console.log('----------------------------------------\n');

  if (infoReplyLive.includes('ESTAMOS EN TRANSMISIÓN EN VIVO') && infoReplyLive.includes(testLiveTitle)) {
    console.log('   ✅ RESPUESTA CON LIVE ACTIVO 100% CORRECTA.\n');
  } else {
    console.error('   ❌ FALLÓ RESPUESTA CON LIVE ACTIVO.\n');
  }

  // Limpieza: Finalizar jornada simulada
  if (liveSession) {
    await supabaseService.finishLiveSession(liveSession.id);
    console.log('🧹 Jornada simulada finalizada.');
  }

  console.log('\n==================================================');
  console.log('✨ PRUEBAS DE JORNADA Y MENÚ COMPLETADAS');
  console.log('==================================================\n');
}

testDynamicInfoAndLiveState().catch(console.error);
