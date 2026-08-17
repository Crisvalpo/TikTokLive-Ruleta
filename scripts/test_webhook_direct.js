const fetch = globalThis.fetch || require('node-fetch');

async function simulateWebhook() {
  const payload = {
    id: "test-123",
    sessionId: "subastas",
    webhookUrl: "http://localhost:3007/api/webhook/whatsapp",
    secret: "luke2026",
    payload: {
      sessionId: "subastas",
      phone: "226757697364179",
      jid: "226757697364179@lid",
      message: "Disfraz de Spiderman infantil talla 6 a 8 años perchero A precio 7 mil",
      audio: null,
      image: null,
      location: null,
      timestamp: Date.now(),
      senderPn: "56935264052@s.whatsapp.net"
    }
  };

  console.log("Simulando webhook entrante a http://localhost:3007/api/webhook/whatsapp...");
  const res = await fetch("http://localhost:3007/api/webhook/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("RESPUESTA DEL WEBHOOK:", data);
}

simulateWebhook();
