const fetch = globalThis.fetch || require('node-fetch');

async function checkSession() {
  const res = await fetch('http://localhost:3007/api/interactive/session?key=luke2026');
  const data = await res.json();
  console.log('--- SESSION STATUS ---');
  console.log('State:', data.session.state);
  console.log('Active Product:', data.session.activeProduct ? { code: data.session.activeProduct.code, title: data.session.activeProduct.title, images: data.session.activeProduct.images } : null);
  console.log('Current Product Index:', data.session.currentProductIndex);
  console.log('Queue Length:', data.session.queue.length);
  console.log('Queue Items:', data.session.queue.map((q, i) => `${i}: [${q.code}] ${q.title}`));
}

checkSession();
