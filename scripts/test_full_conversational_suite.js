const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3007/api/webhook/whatsapp';
const PHONE = '56935264052@s.whatsapp.net';

async function downloadImageBase64(url) {
  console.log(`⬇️ Descargando imagen desde: ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar imagen`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

async function sendWebhookMessage(messageText) {
  console.log(`\n💬 [STAFF ENVÍA]: "${messageText}"`);
  const payload = {
    sessionId: "subastas",
    phone: "226757697364179",
    jid: "226757697364179@lid",
    message: messageText,
    audio: null,
    image: null,
    senderPn: PHONE
  };

  const res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });

  const data = await res.json();
  console.log('🤖 [RESPUESTA DEL BOT]:', JSON.stringify(data, null, 2));
  return data;
}

async function sendWebhookImage(base64Data) {
  console.log(`\n📸 [STAFF ENVÍA FOTOGRAFÍA] (Tamaño base64: ${base64Data.length} chars)`);
  const payload = {
    sessionId: "subastas",
    phone: "226757697364179",
    jid: "226757697364179@lid",
    message: "",
    audio: null,
    image: {
      data: base64Data,
      mimeType: "image/jpeg"
    },
    senderPn: PHONE
  };

  const res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });

  const data = await res.json();
  console.log('🤖 [RESPUESTA DEL BOT A LA FOTO]:', JSON.stringify(data, null, 2));
  return data;
}

async function runSuite() {
  console.log('🚀 INICIANDO SUITE DE PRUEBAS CONVERSACIONALES CON GEMINI IA & IMÁGENES REALES');

  // PRUEBA 1: Registro con dato faltante (Talla no declarada)
  console.log('\n==========================================================');
  console.log('🧪 ESCENARIO 1: Registro donde el personal olvidó la Talla');
  console.log('==========================================================');
  const res1 = await sendWebhookMessage('Disfraz de Hulk para niño perchero B precio 8 mil');

  // PRUEBA 2: Envío de Foto 1 Real
  console.log('\n==========================================================');
  console.log('🧪 ESCENARIO 2: Envío de Fotografía 1 (URL CloudFront real)');
  console.log('==========================================================');
  const img1Base64 = await downloadImageBase64('https://dpyduco3xqisw.cloudfront.net/DNY-204-1024x1024.jpg');
  await sendWebhookImage(img1Base64);

  // PRUEBA 3: Envío de Foto 2 Real
  console.log('\n==========================================================');
  console.log('🧪 ESCENARIO 3: Envío de Fotografía 2 (URL Bing real)');
  console.log('==========================================================');
  const img2Base64 = await downloadImageBase64('https://tse2.mm.bing.net/th/id/OIP.9am2r4oZlU9su9Aba4BT3AAAAA?r=0&pid=ImgDet&w=152&h=350&c=7&dpr=1,3&o=7&rm=3');
  await sendWebhookImage(img2Base64);

  // PRUEBA 4: Registro de un Juguete completo
  console.log('\n==========================================================');
  console.log('🧪 ESCENARIO 4: Registro Completo de Juguetes Americanos');
  console.log('==========================================================');
  await sendWebhookMessage('Juguete americano figura de acción Batman Hasbro nuevo caja 02 precio 9500');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO!');
}

runSuite();
