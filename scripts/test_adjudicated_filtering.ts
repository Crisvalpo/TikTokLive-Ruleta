import { InteractiveEngine } from '../src/interactive/engine';

console.log('🧪 INICIANDO TEST DE FILTRADO Y BLOQUEO DE PRODUCTOS ADJUDICADOS...\n');

const engine = new InteractiveEngine();

async function run() {
  // Limpiar cola para el test
  const session = engine.getSession();
  session.queue = [];

  // Agregar 3 productos
  engine.addProduct('Polera Batman', 'B001', 5000);
  engine.addProduct('Polera Superman', 'B002', 6000);
  engine.addProduct('Polera Flash', 'B003', 7000);

  console.log('Productos en cola inicial:', engine.getSession().queue.map(p => `#${p.code}`));

  // Iniciar ronda con B001
  engine.startRound(0);

  // Simular adjudicación de B001 a @maria
  engine.processEvent({
    id: 'evt_1',
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: 'id_maria',
    username: 'maria',
    rawMessage: '12000',
    numericValue: 12000,
    timestamp: new Date().toISOString()
  });
  engine.finishRound(); // Declara ganador a @maria para B001

  // Verificar si isProductAdjudicated detecta B001
  const isB001Adjudicated = engine.isProductAdjudicated('B001');
  const isB002Adjudicated = engine.isProductAdjudicated('B002');

  console.log(`¿B001 está marcado como adjudicado?: ${isB001Adjudicated ? '✅ SÍ' : '❌ NO'}`);
  console.log(`¿B002 está marcado como adjudicado?: ${!isB002Adjudicated ? '✅ NO (Disponible)' : '❌ SÍ'}`);

  if (!isB001Adjudicated || isB002Adjudicated) {
    throw new Error('Fallo en isProductAdjudicated');
  }

  // Avanzar con nextProduct() -> Debería ir a B002
  console.log('\nAvanzando con nextProduct()...');
  engine.nextProduct();
  console.log('Producto activo actual:', engine.getSession().activeProduct?.code);

  if (engine.getSession().activeProduct?.code !== 'B002') {
    throw new Error(`Esperaba B002, pero obtuvo ${engine.getSession().activeProduct?.code}`);
  }
  console.log('✅ TEST PASÓ: nextProduct seleccionó B002');

  // Adjudicar B002
  engine.processEvent({
    id: 'evt_2',
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: 'id_pedro',
    username: 'pedro',
    rawMessage: '15000',
    numericValue: 15000,
    timestamp: new Date().toISOString()
  });
  engine.finishRound();

  // Avanzar con nextProduct() -> Debería saltar los adjudicados e ir a B003
  console.log('\nAvanzando con nextProduct()...');
  engine.nextProduct();
  console.log('Producto activo actual:', engine.getSession().activeProduct?.code);

  if (engine.getSession().activeProduct?.code !== 'B003') {
    throw new Error(`Esperaba B003, pero obtuvo ${engine.getSession().activeProduct?.code}`);
  }
  console.log('✅ TEST PASÓ: nextProduct seleccionó B003');

  console.log('\n✨ TODAS LAS PRUEBAS DE BLOQUEO DE ADJUDICADOS PASARON EXITOSAMENTE');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
