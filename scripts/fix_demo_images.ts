import { supabaseService } from '../src/db/supabase';

async function fixImages() {
  console.log('🔧 REPARANDO Y ACTUALIZANDO FOTOGRAFÍAS DE PRODUCTOS DE MUESTRA');

  const products = await supabaseService.getProducts({ limit: 50 });
  console.log(`Encontrados ${products.length} productos en Supabase subastas.`);

  const demoMap: Record<string, string> = {
    'D001': 'https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?auto=format&fit=crop&w=800&q=80',
    'D002': 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80',
    'A003': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    'P004': 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
    'D005': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'
  };

  for (const p of products) {
    if (demoMap[p.code]) {
      // Eliminar fotos antiguas o corruptas
      if (p.images && p.images.length > 0) {
        for (const img of p.images) {
          await supabaseService.deleteProductImage(img.id);
        }
      }
      // Insertar nueva foto limpia de alta resolución HTTPS
      await supabaseService.addProductImage(p.id, demoMap[p.code], 0);
      console.log(`✅ Foto arreglada exitosamente para #${p.code} -> ${demoMap[p.code]}`);
    }
  }

  console.log('✨ TODAS LAS IMÁGENES HAN SIDO REPARADAS EXITOSAMENTE.');
}

fixImages().catch(console.error);
