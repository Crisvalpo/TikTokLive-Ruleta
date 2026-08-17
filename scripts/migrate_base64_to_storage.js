const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

async function migrate() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { db: { schema: 'subastas' } });

  console.log('🔄 Consultando imágenes en subastas.product_images...');
  const { data: images, error } = await supabase
    .from('product_images')
    .select('id, product_id, image_url, storage_path, display_order')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error obteniendo imágenes:', error);
    process.exit(1);
  }

  console.log(`📸 Encontradas ${images.length} imágenes en total.`);
  let migratedCount = 0;

  for (const img of images) {
    if (img.image_url && img.image_url.startsWith('data:image/')) {
      const match = img.image_url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) continue;

      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      const storagePath = `products/${img.product_id}_${img.id}.${ext}`;

      console.log(`📤 Subiendo imagen ${img.id} a bucket "product-images" (${storagePath})...`);

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(storagePath, buffer, {
          contentType: `image/${match[1]}`,
          upsert: true
        });

      if (uploadErr) {
        console.error(`❌ Error subiendo a storage imagen ${img.id}:`, uploadErr.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;
      console.log(`✅ URL generada: ${publicUrl}`);

      const { error: updateErr } = await supabase
        .from('product_images')
        .update({
          image_url: publicUrl,
          storage_path: storagePath
        })
        .eq('id', img.id);

      if (updateErr) {
        console.error(`❌ Error actualizando BD para imagen ${img.id}:`, updateErr.message);
      } else {
        migratedCount++;
      }
    } else {
      console.log(`ℹ️ Imagen ${img.id} ya tiene URL de archivo (${img.image_url.substring(0, 50)}...).`);
    }
  }

  console.log(`\n🎉 Migración finalizada: ${migratedCount} imágenes migradas a Supabase Storage con éxito!`);
}

migrate().catch(console.error);
