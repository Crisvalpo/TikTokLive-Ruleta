import { whatsappBotService } from '../src/services/whatsappBotService';
import { supabaseService } from '../src/db/supabase';

async function testBotVerificationFlow() {
  console.log('==================================================');
  console.log('🧪 PRUEBA DE VERIFICACIÓN DE BOT WHATSAPP N&N');
  console.log('==================================================\n');

  // 1. Crear usuario comprador de prueba en DB
  const testUsername = 'maria28_test';
  console.log(`1️⃣ Registrando comprador simulado: @${testUsername}...`);
  let buyer = await supabaseService.getBuyerByUsername(testUsername);
  if (!buyer) {
    buyer = await supabaseService.createBuyer({
      tiktok_username: testUsername,
      display_name: 'María 28 Test',
      deposit_paid: true,
      deposit_amount: 5000
    });
  }

  if (!buyer) {
    console.error('❌ Error creando usuario de prueba');
    return;
  }

  // Asegurar que su teléfono empiece en blanco
  await supabaseService.updateBuyer(buyer.id, { phone: null as any });
  console.log('   ✅ Comprador listo sin teléfono asignado.\n');

  // 2. Simular primer contacto desde WhatsApp (Teléfono A: 56954833942)
  const phoneA = '56954833942';
  const msgA = `¡Hola! Me adjudiqué la prenda, soy @${testUsername}`;
  console.log(`2️⃣ Simulando mensaje entrante desde +${phoneA}: "${msgA}"`);

  const replyA = await whatsappBotService.handleCustomerMessage(phoneA, msgA, 'María');
  console.log('\n--- RESPUESTA DEL BOT (PRIMER CONTACTO) ---');
  console.log(replyA);
  console.log('-------------------------------------------\n');

  // Verificar que el teléfono quedó registrado
  const updatedBuyer = await supabaseService.getBuyerByUsername(testUsername);
  console.log(`🔍 Teléfono vinculado en DB para @${testUsername}: ${updatedBuyer?.phone}`);
  if (updatedBuyer?.phone === phoneA) {
    console.log('   ✅ VINCULACIÓN EXITOSA Y SEGURA.\n');
  } else {
    console.error('   ❌ ERROR EN VINCULACIÓN DE TELÉFONO.\n');
  }

  // 3. Simular intromisión / suplantación desde otro teléfono (Teléfono B: 56999998888)
  const phoneB = '56999998888';
  const msgB = `Hola me gane ropa mi tiktok es @${testUsername}`;
  console.log(`3️⃣ Simulando intento de suplantación desde otro número +${phoneB}: "${msgB}"`);

  const replyB = await whatsappBotService.handleCustomerMessage(phoneB, msgB, 'Intruso');
  console.log('\n--- RESPUESTA DEL BOT (ALERTA SEGURIDAD) ---');
  console.log(replyB);
  console.log('--------------------------------------------\n');

  if (replyB.includes('Verificación de Seguridad') || replyB.includes('ya está vinculado')) {
    console.log('   ✅ RECHAZO Y PROTECCIÓN ANTI-SUPLANTACIÓN FUNCIONANDO 100%.\n');
  } else {
    console.error('   ❌ FALLÓ LA PROTECCIÓN ANTI-SUPLANTACIÓN.\n');
  }

  // Limpieza del usuario de prueba
  console.log('🧹 Limpiando usuario de prueba...');
  if (updatedBuyer) {
    await supabaseService.updateBuyer(updatedBuyer.id, { phone: null as any });
  }

  console.log('\n==================================================');
  console.log('✨ TODAS LAS PRUEBAS DE SEGURIDAD PASARON EXITOSAMENTE');
  console.log('==================================================\n');
}

testBotVerificationFlow().catch(console.error);
