import { supabaseService } from '../src/db/supabase';

async function cleanAndReseed() {
  console.log('🧹 REINICIANDO IMÁGENES Y POBLANDO URLS HTTPS EN SUPABASE SUBASTAS...');

  // 1. Obtener todas las imágenes existentes
  const client = (supabaseService as any).supabase;
  const { data: allImages } = await client.from('product_images').select('id');
  
  if (allImages && allImages.length > 0) {
    console.log(`Borrando ${allImages.length} imagen(es) antiguas...`);
    for (const img of allImages) {
      await supabaseService.deleteProductImage(img.id);
    }
  }

  // 2. Obtener productos
  const products = await supabaseService.getProducts({ limit: 50 });
  const demoMap: Record<string, string> = {
    'D001': 'https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?auto=format&fit=crop&w=800&q=80',
    'D002': 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80',
    'A003': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    'P004': 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
    'D005': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'
  };

  for (const p of products) {
    const url = demoMap[p.code] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';
    await supabaseService.addProductImage(p.id, url, 0);
    console.log(`✅ Foto asignada a #${p.code} (${p.title}) -> ${url}`);
  }

  console.log('✨ REINICIO DE IMÁGENES COMPLETADO CON ÉXITO.');
}

cleanAndReseed().catch(console.error);
