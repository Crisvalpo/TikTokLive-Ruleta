const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3007/api/webhook/whatsapp';
const PHONE = '56935264052@s.whatsapp.net';

async function testInfallibleMedia() {
  console.log('🧪 PRUEBA 1: Selección Directa de Producto por Código ("Para el producto D008")');
  let res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "Para el producto D008",
        senderPn: PHONE
      }
    })
  });
  let data = await res.json();
  console.log('🤖 [SELECCIÓN DE PRODUCTO]:', data);

  console.log('\n🧪 PRUEBA 2: Envío de Video Corto para #D008');
  // Buffer de video simulado (bytes MP4 mínimos)
  const dummyVideoBase64 = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQ==').toString('base64');
  res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "",
        video: {
          data: dummyVideoBase64,
          mimeType: "video/mp4"
        },
        senderPn: PHONE
      }
    })
  });
  data = await res.json();
  console.log('🤖 [SUBIDA DE VIDEO]:', data);
}

testInfallibleMedia();
