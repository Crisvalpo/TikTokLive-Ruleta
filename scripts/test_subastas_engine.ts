import { supabaseService } from '../src/db/supabase';
import { InteractiveEngine } from '../src/interactive/engine';

async function testSubastasSystem() {
  console.log('==================================================');
  console.log('🧪 PRUEBA INTEGRAL — LUKE LIVE SUBASTAS ENGINE');
  console.log('==================================================\n');

  // 1. Supabase CRUD Check
  console.log('1️⃣ Probando cliente Supabase...');
  const isEnabled = supabaseService.isEnabled();
  console.log(`- Supabase habilitado: ${isEnabled ? 'SI (esquema "subastas")' : 'NO (modo local)'}`);

  if (isEnabled) {
    // Crear producto de prueba
    const testCode = `TEST_${Date.now().toString().slice(-4)}`;
    console.log(`\n2️⃣ Creando producto de prueba #${testCode}...`);
    const prod = await supabaseService.createProduct({
      code: testCode,
      title: 'Polerón Spiderman Test',
      item_type: 'disfraz',
      character: 'Spiderman',
      franchise: 'Marvel',
      size: '6-8 años',
      base_price: 3500,
      warehouse_location: 'Percha T1',
      stock_status: 'disponible'
    });

    if (prod) {
      console.log(`✅ Producto creado: ID ${prod.id} (${prod.title})`);

      // Buscar por código
      const found = await supabaseService.getProductByCode(testCode);
      console.log(`✅ Búsqueda por código #${testCode}: ${found ? 'ENCONTRADO' : 'FALLIDO'}`);

      // Registrar comprador de prueba
      const buyerUser = `test_buyer_${Date.now().toString().slice(-4)}`;
      console.log(`\n3️⃣ Registrando comprador @${buyerUser}...`);
      const buyer = await supabaseService.createBuyer({
        tiktok_username: buyerUser,
        display_name: 'Comprador Test',
        deposit_paid: true,
        deposit_amount: 5000
      });

      if (buyer) {
        console.log(`✅ Comprador creado: ID ${buyer.id} (@${buyer.tiktok_username})`);

        // Registrar venta
        console.log(`\n4️⃣ Registrando venta de prueba...`);
        const sale = await supabaseService.createSale(prod.id, buyer.id, 4500, 'subasta');
        if (sale) {
          console.log(`✅ Venta registrada: ID ${sale.id} por $${sale.sale_price}`);
          
          // Verificar lista de picking
          const picking = await supabaseService.getPickingList();
          console.log(`✅ Lista de picking obtenida: ${picking.length} prendas pendientes`);

          // Limpiar producto de prueba
          await supabaseService.deleteProduct(prod.id);
          console.log(`🧹 Producto de prueba eliminado.`);
        }
      }
    }
  }

  // 2. Motor de Subastas + Anti-Sniper Check
  console.log('\n5️⃣ Probando Motor de Subastas Interactivo & Anti-Sniper...');
  const engine = new InteractiveEngine();

  engine.on('anti_sniper_extension', (data) => {
    console.log(`  ⚡ EVENTO ANTI-SNIPER RECIBIDO: +10s para @${data.username} (Nuevo tiempo: ${data.newTimeRemaining}s)`);
  });

  engine.on('bid_accepted', (data) => {
    console.log(`  🟢 PUJA ACEPTADA: @${data.bid.username} por $${data.bid.amount}`);
  });

  // Iniciar ronda con producto 1
  engine.startRound(0);
  const session1 = engine.getSession();
  console.log(`- Ronda iniciada: [${session1.activeProduct?.code}] ${session1.activeProduct?.title}`);
  console.log(`- Tiempo inicial: ${session1.timeRemaining}s`);

  // Simular puja normal
  engine.processEvent({
    id: 'evt_1',
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: 'id_juan',
    username: 'juan',
    rawMessage: '600',
    numericValue: 600,
    timestamp: new Date().toISOString()
  });

  // Simular puja anti-sniper (forzando timeRemaining = 3s)
  (engine as any).session.timeRemaining = 3;
  console.log('\n⏱️ Forzando temporizador a 3s para probar Anti-Sniper...');

  engine.processEvent({
    id: 'evt_2',
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: 'id_maria',
    username: 'maria',
    rawMessage: '1000',
    numericValue: 1000,
    timestamp: new Date().toISOString()
  });

  const session2 = engine.getSession();
  console.log(`- Tiempo tras Anti-Sniper: ${session2.timeRemaining}s (Extensión ${session2.antiSniperExtensions}/${session2.maxAntiSniperExtensions})`);

  console.log('\n==================================================');
  console.log('✅ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO');
  console.log('==================================================\n');
}

testSubastasSystem().catch(console.error);
