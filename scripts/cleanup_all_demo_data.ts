import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

async function cleanupAllDemoData() {
  console.log('==================================================');
  console.log('🧹 LIMPIEZA TOTAL DE DATOS EN ESQUEMA "subastas"');
  console.log('==================================================\n');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Supabase URL o Key no están configurados en .env.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { db: { schema: 'subastas' } });

  console.log('1️⃣ Eliminando registro de ventas (subastas.sales)...');
  const { error: salesErr } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (salesErr) console.error('  ⚠️ Error eliminando ventas:', salesErr.message);
  else console.log('  ✅ Ventas eliminadas.');

  console.log('2️⃣ Eliminando imágenes de productos (subastas.product_images)...');
  const { error: imgsErr } = await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (imgsErr) console.error('  ⚠️ Error eliminando imágenes:', imgsErr.message);
  else console.log('  ✅ Imágenes eliminadas.');

  console.log('3️⃣ Eliminando inventario de productos (subastas.products)...');
  const { error: prodsErr } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (prodsErr) console.error('  ⚠️ Error eliminando productos:', prodsErr.message);
  else console.log('  ✅ Productos eliminados.');

  console.log('4️⃣ Eliminando registro de eventos TikTok (subastas.tiktok_events)...');
  const { error: eventsErr } = await supabase.from('tiktok_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (eventsErr) console.error('  ⚠️ Error eliminando eventos:', eventsErr.message);
  else console.log('  ✅ Historial de eventos TikTok limpiado.');

  console.log('5️⃣ Reiniciando sesiones interactivas (subastas.interactive_sessions)...');
  const { error: sessErr } = await supabase.from('interactive_sessions').delete().neq('id', '');
  if (sessErr) console.error('  ⚠️ Error limpiando sesiones:', sessErr.message);
  else console.log('  ✅ Sesiones interactivas limpiadas.');

  console.log('\n==================================================');
  console.log('✨ BASE DE DATOS LIMPIA Y LISTA PARA PRODUCTOS REALES');
  console.log('==================================================\n');
}

cleanupAllDemoData().catch(console.error);
