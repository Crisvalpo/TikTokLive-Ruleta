import { supabaseService } from '../src/db/supabase';

async function seedDemoData() {
  console.log('==================================================');
  console.log('🌱 POBLANDO DATOS DE EJEMPLO — LUKE LIVE SUBASTAS');
  console.log('==================================================\n');

  if (!supabaseService.isEnabled()) {
    console.error('❌ Supabase no está configurado correctamente.');
    return;
  }

  const demoProducts = [
    {
      code: 'D001',
      title: 'Disfraz Spiderman Deluxe Infantil',
      item_type: 'disfraz',
      character: 'Spiderman',
      franchise: 'Marvel',
      size: '6-8 años',
      base_price: 5000,
      warehouse_location: 'Percha A1',
      condition: 'excelente',
      description: 'Disfraz completo acolchado de Spiderman con máscara completa respirable.',
      images: [
        'https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1635863138275-d9b33299680b?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      code: 'D002',
      title: 'Vestido Princesa Elsa Frozen II',
      item_type: 'disfraz',
      character: 'Elsa',
      franchise: 'Disney',
      size: '4-6 años',
      base_price: 6000,
      warehouse_location: 'Percha A2',
      condition: 'excelente',
      description: 'Hermoso vestido de Elsa con capa brillante y detalles en lentejuelas plateadas.',
      images: [
        'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      code: 'A003',
      title: 'Máscara Batman Articulada Electrónica',
      item_type: 'accesorio',
      character: 'Batman',
      franchise: 'DC Comics',
      size: 'Talla Única',
      base_price: 3500,
      warehouse_location: 'Caja B1',
      condition: 'bueno',
      description: 'Máscara rígida de Batman con cambiador de voz incorporado.',
      images: [
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      code: 'P004',
      title: 'Polerón Hoodie Marvel Avengers Oversize',
      item_type: 'prenda',
      character: 'Avengers',
      franchise: 'Marvel',
      size: 'M',
      base_price: 4000,
      warehouse_location: 'Percha C3',
      condition: 'excelente',
      description: 'Polerón con capucha algodón franela con estampado oficial de los Vengadores.',
      images: [
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      code: 'D005',
      title: 'Disfraz Goku Dragon Ball Z Gi Clásico',
      item_type: 'disfraz',
      character: 'Goku',
      franchise: 'Dragon Ball',
      size: '8-10 años',
      base_price: 5500,
      warehouse_location: 'Percha A4',
      condition: 'excelente',
      description: 'Traje completo de artes marciales de Goku con muñequeras y cinturón azul.',
      images: [
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'
      ]
    }
  ];

  const demoBuyers = [
    { tiktok_username: 'pao.luke', display_name: 'Pao Luke', deposit_paid: true, deposit_amount: 5000 },
    { tiktok_username: 'emily_isidora', display_name: 'Emily Isidora', deposit_paid: true, deposit_amount: 5000 },
    { tiktok_username: 'cristian.luke', display_name: 'Cristian Luke', deposit_paid: true, deposit_amount: 5000 }
  ];

  console.log('1️⃣ Insertando Compradores Aprobados...');
  for (const b of demoBuyers) {
    const existing = await supabaseService.getBuyerByUsername(b.tiktok_username);
    if (!existing) {
      const created = await supabaseService.createBuyer(b);
      console.log(`  ✅ Comprador creado: @${b.tiktok_username}`);
    } else {
      console.log(`  ℹ️ Comprador ya existente: @${b.tiktok_username}`);
    }
  }

  console.log('\n2️⃣ Insertando Productos e Imágenes en Bodega...');
  for (const p of demoProducts) {
    const existing = await supabaseService.getProductByCode(p.code);
    let productId = existing?.id;

    if (!existing) {
      const created = await supabaseService.createProduct({
        code: p.code,
        title: p.title,
        description: p.description,
        item_type: p.item_type as any,
        character: p.character,
        franchise: p.franchise,
        size: p.size,
        base_price: p.base_price,
        warehouse_location: p.warehouse_location,
        condition: p.condition as any,
        stock_status: 'disponible'
      });
      if (created) {
        productId = created.id;
        console.log(`  ✅ Prenda #${p.code} (${p.title}) creada.`);
      }
    } else {
      console.log(`  ℹ️ Prenda #${p.code} ya existía.`);
    }

    if (productId && p.images) {
      for (let idx = 0; idx < p.images.length; idx++) {
        await supabaseService.addProductImage(productId, p.images[idx], idx);
      }
      console.log(`     📸 ${p.images.length} foto(s) asociada(s) a #${p.code}`);
    }
  }

  console.log('\n==================================================');
  console.log('✨ POBLAMIENTO COMPLETADO EXITOSAMENTE');
  console.log('==================================================\n');
}

seedDemoData().catch(console.error);
