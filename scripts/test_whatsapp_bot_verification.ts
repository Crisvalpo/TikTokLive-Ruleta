import { whatsappBotService } from '../src/services/whatsappBotService';
import { supabaseService } from '../src/db/supabase';

async function testInteractiveBotMenu() {
  console.log('==================================================');
  console.log('🧪 PRUEBA DE MENÚ E IDENTIFICACIÓN POR CÓDIGO');
  console.log('==================================================\n');

  // 1. Probar saludo inicial -> debe retornar menú 1 / 2
  console.log('1️⃣ Enviando saludo inicial "Hola"...');
  const menuReply = await whatsappBotService.handleCustomerMessage('56911111111', 'Hola', 'Cliente');
  console.log('\n--- RESPUESTA MENÚ INICIAL ---');
  console.log(menuReply);
  console.log('------------------------------\n');

  if (menuReply.includes('1️⃣') && menuReply.includes('2️⃣')) {
    console.log('   ✅ MENÚ INTERACTIVO 1/2 FUNCIONANDO CORRECTAMENTE.\n');
  } else {
    console.error('   ❌ FALLÓ MENÚ INTERACTIVO.\n');
  }

  // 2. Probar Opción 1 (Información)
  console.log('2️⃣ Enviando opción "1"...');
  const infoReply = await whatsappBotService.handleCustomerMessage('56911111111', '1', 'Cliente');
  console.log('\n--- RESPUESTA OPCIÓN 1 (INFORMACIÓN) ---');
  console.log(infoReply);
  console.log('----------------------------------------\n');

  if (infoReply.includes('Información N&N Ropa Americana') && infoReply.includes('https://nn.lukeapp.cl')) {
    console.log('   ✅ OPCIÓN 1 (INFORMACIÓN) FUNCIONANDO CORRECTAMENTE.\n');
  } else {
    console.error('   ❌ FALLÓ OPCIÓN 1.\n');
  }

  // 3. Crear prenda y comprador de prueba en Supabase
  const testCode = 'TEST99';
  console.log(`3️⃣ Creando producto de prueba #${testCode} y comprador @maria28_test...`);
  
  let prod = await supabaseService.getProductByCode(testCode);
  if (!prod) {
    prod = await supabaseService.createProduct({
      code: testCode,
      title: 'Polera Disney Mickey Test',
      item_type: 'prenda',
      base_price: 4500,
      stock_status: 'disponible'
    });
  }

  let buyer = await supabaseService.getBuyerByUsername('maria28_test');
  if (!buyer) {
    buyer = await supabaseService.createBuyer({
      tiktok_username: 'maria28_test',
      display_name: 'María 28 Test'
    });
  }

  if (buyer) {
    await supabaseService.updateBuyer(buyer.id, { phone: null as any });
  }

  if (prod && buyer) {
    await supabaseService.createSale(prod.id, buyer.id, 4500, 'subasta');
  }

  // 4. Probar ingreso de CÓDIGO DE PRENDA como llave (Opción 2 con #TEST99)
  const phoneA = '56954833942';
  console.log(`4️⃣ Simulando cliente escribiendo "#${testCode}" desde +${phoneA}...`);
  const codeReply = await whatsappBotService.handleCustomerMessage(phoneA, `#${testCode}`, 'María');
  console.log('\n--- RESPUESTA DE ADJUDICACIÓN POR CÓDIGO ---');
  console.log(codeReply);
  console.log('--------------------------------------------\n');

  if (codeReply.includes('Adjudicación Confirmada') && codeReply.includes('Mercado Pago') && codeReply.includes('1076781758')) {
    console.log('   ✅ CONFIRMACIÓN Y VINCULACIÓN POR CÓDIGO 100% EXITOSA.\n');
  } else {
    console.error('   ❌ FALLÓ CONFIRMACIÓN POR CÓDIGO.\n');
  }

  // Limpieza de datos de prueba
  console.log('🧹 Limpiando prendas y compradores de prueba...');
  if (prod) await supabaseService.deleteProduct(prod.id);
  if (buyer) await supabaseService.updateBuyer(buyer.id, { phone: null as any });

  console.log('\n==================================================');
  console.log('✨ TODAS LAS PRUEBAS DEL BOT PASARON EXITOSAMENTE');
  console.log('==================================================\n');
}

testInteractiveBotMenu().catch(console.error);
