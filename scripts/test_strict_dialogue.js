const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3007/api/webhook/whatsapp';
const PHONE = '56935264052@s.whatsapp.net';

async function sendMsg(text) {
  console.log(`\n💬 [STAFF]: "${text}"`);
  const res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: text,
        senderPn: PHONE
      }
    })
  });
  const data = await res.json();
  console.log('🤖 [BOT ACTION]:', data.staffAction);
}

async function testDialogue() {
  console.log('🧪 PRUEBA 1: Enviar orden genérica "Agrega un producto" (No debe guardar nada en BD)');
  await sendMsg('Agrega un producto');

  console.log('\n🧪 PRUEBA 2: Enviar descripción parcial "Disfraz de Thor para niño" (Debe pedir talla, ubicación, precio y estado)');
  await sendMsg('Disfraz de Thor para niño');

  console.log('\n🧪 PRUEBA 3: Completar los datos "Talla 6 a 8 años perchero A precio 9 mil estado excelente" (Ahora sí debe guardar en BD)');
  await sendMsg('Talla 6 a 8 años perchero A precio 9 mil estado excelente');
}

testDialogue();
