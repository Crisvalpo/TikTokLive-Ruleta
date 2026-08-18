const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3007/api/webhook/whatsapp';
const PHONE = '56935264052@s.whatsapp.net';

async function testVideoPromptAndUrl() {
  console.log('🧪 PRUEBA 1: Pedir Prompt de Video para #D2 (Pantera Negra)');
  let res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "Prompt para D02",
        senderPn: PHONE
      }
    })
  });
  let data = await res.json();
  console.log('🤖 [GENERADOR DE PROMPT IA]:', data);

  console.log('\n🧪 PRUEBA 2: Enviar URL de Video para #D2');
  res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "Video para D2: https://storage.googleapis.com/test-videos/panther_showcase.mp4",
        senderPn: PHONE
      }
    })
  });
  data = await res.json();
  console.log('🤖 [GUARDADO DE URL DE VIDEO]:', data);
}

testVideoPromptAndUrl();
