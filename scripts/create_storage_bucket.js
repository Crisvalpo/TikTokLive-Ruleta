const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('No SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  console.log('Buckets existentes:', buckets ? buckets.map(b => b.name) : listErr);

  const exists = buckets && buckets.some(b => b.name === 'product-images');
  if (!exists) {
    const { data, error } = await supabase.storage.createBucket('product-images', {
      public: true,
      fileSizeLimit: 52428800
    });
    if (error) console.error('Error creando bucket:', error);
    else console.log('✅ Bucket product-images creado exitosamente:', data);
  } else {
    console.log('ℹ️ Bucket product-images ya existe.');
  }
}

main().catch(console.error);
