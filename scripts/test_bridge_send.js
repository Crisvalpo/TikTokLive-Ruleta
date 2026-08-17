const fetch = globalThis.fetch || require('node-fetch');

async function test() {
  const url = process.env.WA_BRIDGE_URL || 'http://127.0.0.1:4000';
  const secret = process.env.WA_BRIDGE_SECRET || 'luke2026';
  const phone = '56935264052';

  console.log(`Enviando mensaje a ${phone} vía ${url}/subastas/send...`);
  try {
    const res = await fetch(`${url}/subastas/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wa-bridge-secret': secret
      },
      body: JSON.stringify({
        to: phone,
        message: '🤖 ¡Hola Cristian! Verificación de puente de WhatsApp completada con éxito.'
      })
    });
    const data = await res.json();
    console.log('RESULTADO DEL PUENTE:', data);
  } catch (err) {
    console.error('ERROR ENVIANDO:', err.message);
  }
}

test();
