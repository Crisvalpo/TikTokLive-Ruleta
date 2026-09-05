async function test() {
  const base = 'http://localhost:3007/api/interactive';
  const key = 'luke2026';

  console.log('1. Obteniendo bolsas activas...');
  const resBags = await fetch(`${base}/bags?key=${key}`);
  const dataBags = await resBags.json();
  console.log('Bolsas:', dataBags);

  console.log('\n2. Consultando resumen de comprador @emily_isidora...');
  const resSum = await fetch(`${base}/buyer-summary?key=${key}&username=emily_isidora`);
  const dataSum = await resSum.json();
  console.log('Resumen:', dataSum);

  console.log('\n3. Probando Webhook de WhatsApp con código D001...');
  const resWh = await fetch('http://localhost:3007/api/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: '+56954833942',
      text: 'Hola me gane el D001',
      pushName: 'Cristian'
    })
  });
  const dataWh = await resWh.json();
  console.log('Respuesta Webhook:', dataWh);
}

test().catch(console.error);
