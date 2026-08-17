const fetch = globalThis.fetch || require('node-fetch');

async function testImage() {
  // 1x1 transparente PNG en base64
  const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const payload = {
    sessionId: "subastas",
    phone: "226757697364179",
    jid: "226757697364179@lid",
    message: "",
    audio: null,
    image: {
      data: sampleBase64,
      mimeType: "image/png"
    },
    location: null,
    timestamp: Date.now(),
    senderPn: "56935264052@s.whatsapp.net"
  };

  console.log("Enviando imagen simulada a http://localhost:3007/api/webhook/whatsapp...");
  const res = await fetch("http://localhost:3007/api/webhook/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload })
  });

  const data = await res.json();
  console.log("RESPUESTA IMAGEN:", data);
}

testImage();
