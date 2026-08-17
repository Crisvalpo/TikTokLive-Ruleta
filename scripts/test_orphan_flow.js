const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3007/api/webhook/whatsapp';
const PHONE = '56935264052@s.whatsapp.net';

async function testOrphanFlow() {
  console.log('🧪 PASO 1: Enviar Foto sin producto previo activo');
  const dummyImgBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  
  let res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "",
        image: {
          data: dummyImgBase64,
          mimeType: "image/png"
        },
        senderPn: PHONE
      }
    })
  });
  let data = await res.json();
  console.log('🤖 [RESPUESTA DEL BOT A LA FOTO HUÉRFANA]:', data);

  console.log('\n🧪 PASO 2: Staff responde con el código ("Para el D008")');
  res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        sessionId: "subastas",
        message: "Para el D008",
        senderPn: PHONE
      }
    })
  });
  data = await res.json();
  console.log('🤖 [RESPUESTA TRAS ASIGNAR EL CÓDIGO]:', data);
}

testOrphanFlow();
