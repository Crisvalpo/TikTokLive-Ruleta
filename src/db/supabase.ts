import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import {
  InternalGameEvent,
  Product,
  ProductImage,
  ProductWithImages,
  Buyer,
  BuyerWithSales,
  Sale,
  ProductFilters,
  StockStatus,
  InteractiveSession,
  LiveSession
} from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// ============================================================
// LUKE LIVE SUBASTAS — Servicio Supabase (esquema "subastas")
// ============================================================

export class SupabaseService {
  private supabase: any = null;
  private enabled: boolean = false;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        this.supabase = createClient(url, key, { db: { schema: 'subastas' } });
        this.enabled = true;
        console.log('✅ Supabase Client inicializado para esquema "subastas"');
      } catch (err) {
        console.warn('⚠️ Error al crear cliente Supabase:', err);
      }
    } else {
      console.log('ℹ️ Supabase no configurado en .env. Operando en modo local.');
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================================
  // PRODUCTOS — CRUD
  // ============================================================

  public async getProducts(filters: ProductFilters = {}): Promise<Product[]> {
    if (!this.enabled) return [];
    try {
      let query = this.supabase.from('products').select('*, product_images(*)');

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,code.ilike.%${filters.search}%,character.ilike.%${filters.search}%,franchise.ilike.%${filters.search}%`);
      }
      if (filters.item_type) query = query.eq('item_type', filters.item_type);
      if (filters.franchise) query = query.ilike('franchise', `%${filters.franchise}%`);
      if (filters.size) query = query.eq('size', filters.size);
      if (filters.stock_status) query = query.eq('stock_status', filters.stock_status);
      if (filters.condition) query = query.eq('condition', filters.condition);
      if (filters.min_price) query = query.gte('base_price', filters.min_price);
      if (filters.max_price) query = query.lte('base_price', filters.max_price);

      query = query.order('created_at', { ascending: false });

      if (filters.limit) query = query.limit(filters.limit);
      if (filters.offset) query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1);

      const { data, error } = await query;
      if (data) {
        return (data || []).map((p: any) => ({
          ...p,
          images: p.product_images || []
        }));
      }
      return [];
    } catch (err: any) {
      console.error('❌ Error en getProducts:', err.message);
      return [];
    }
  }

  public async getCategories(): Promise<string[]> {
    const defaults = ['Disfraz', 'Accesorio', 'Prenda', 'Juguetes Americanos', 'Coleccionables', 'Peluches', 'Calzado', 'Decoración'];
    if (!this.enabled) return defaults;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('item_type');
      if (error || !data) return defaults;
      const custom = data.map((d: any) => d.item_type).filter(Boolean);
      return Array.from(new Set([...defaults, ...custom]));
    } catch {
      return defaults;
    }
  }

  public async getProductByCode(code: string): Promise<ProductWithImages | null> {
    if (!this.enabled || !code) return null;
    try {
      const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const m = clean.match(/^([A-Za-z]+)0*(\d+)$/);
      const variants = [code, clean, `#${clean}`];
      if (m) {
        const prefix = m[1];
        const num = m[2];
        variants.push(`${prefix}${num}`, `#${prefix}${num}`);
        variants.push(`${prefix}0${num}`, `#${prefix}0${num}`);
        variants.push(`${prefix}00${num}`, `#${prefix}00${num}`);
      }

      const { data, error } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .in('code', [...new Set(variants)])
        .limit(1);

      if (error || !data || data.length === 0) return null;
      const product = data[0];

      // Cargar accesorios vinculados
      const { data: accessories } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('parent_product_id', product.id);

      return { ...product, images: product.product_images || [], accessories: accessories || [] };
    } catch (err: any) {
      console.error('❌ Error buscando producto por código:', err.message);
      return null;
    }
  }

  public async getProductById(id: string): Promise<ProductWithImages | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      const { data: accessories } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('parent_product_id', data.id);

      return { ...data, images: data.product_images || [], accessories: accessories || [] };
    } catch (err: any) {
      console.error('❌ Error buscando producto por ID:', err.message);
      return null;
    }
  }

  public async createProduct(product: Partial<Product>): Promise<Product | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .insert({
          code: product.code,
          title: product.title,
          description: product.description,
          item_type: product.item_type || 'disfraz',
          character: product.character,
          franchise: product.franchise,
          size: product.size,
          condition: product.condition || 'excelente',
          base_price: product.base_price || 0,
          warehouse_location: product.warehouse_location,
          stock_status: product.stock_status || 'disponible',
          parent_product_id: product.parent_product_id
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando producto:', error.message);
        return null;
      }
      console.log(`✅ Producto creado: [${data.code}] ${data.title}`);
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en createProduct:', err.message);
      return null;
    }
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando producto:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en updateProduct:', err.message);
      return null;
    }
  }

  public async updateProductStatus(id: string, status: StockStatus): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('products')
        .update({ stock_status: status })
        .eq('id', id);

      if (error) {
        console.error('❌ Error actualizando stock_status:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('❌ Excepción en updateProductStatus:', err.message);
      return false;
    }
  }

  public async deleteProduct(id: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      // 1. Obtener y eliminar imágenes del storage de Supabase
      const { data: images } = await this.supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', id);

      if (images && images.length > 0) {
        const paths = images.map((img: any) => img.storage_path).filter(Boolean);
        if (paths.length > 0) {
          try {
            await this.supabase.storage.from('product-images').remove(paths);
          } catch (storageErr: any) {
            console.warn('⚠️ Error limpiando archivos de storage:', storageErr.message);
          }
        }
      }

      // 2. Eliminar ventas asociadas si quedaron de pruebas o lives
      await this.supabase
        .from('sales')
        .delete()
        .eq('product_id', id);

      // 3. Eliminar registros de imágenes
      await this.supabase
        .from('product_images')
        .delete()
        .eq('product_id', id);

      // 4. Eliminar el producto de la base de datos
      const { error } = await this.supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error eliminando producto:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('❌ Excepción en deleteProduct:', err.message);
      return false;
    }
  }

  public async getAccessories(parentProductId: string): Promise<Product[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('parent_product_id', parentProductId);

      if (error) return [];
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  // ============================================================
  // IMÁGENES DE PRODUCTOS
  // ============================================================

  public async addProductImage(productId: string, imageUrl: string, storagePath?: string, order: number = 0, caption?: string): Promise<ProductImage | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('product_images')
        .insert({
          product_id: productId,
          image_url: imageUrl,
          storage_path: storagePath,
          display_order: order,
          caption: caption
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error añadiendo imagen:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en addProductImage:', err.message);
      return null;
    }
  }

  public async addProductImages(
    productId: string, 
    images: Array<{ image_url: string; storage_path?: string; display_order?: number; caption?: string }>
  ): Promise<ProductImage[]> {
    if (!this.enabled || !images || images.length === 0) return [];
    try {
      // Determinar el display_order actual más alto para este producto si ya tiene fotos
      const { data: existingImgs } = await this.supabase
        .from('product_images')
        .select('display_order')
        .eq('product_id', productId)
        .order('display_order', { ascending: false })
        .limit(1);

      const baseOrder = (existingImgs && existingImgs.length > 0 && existingImgs[0].display_order !== null)
        ? existingImgs[0].display_order + 1
        : 0;

      const rows = await Promise.all(images.map(async (img, idx) => {
        let finalUrl = img.image_url;
        let storagePath = img.storage_path || null;

        // Si viene como base64, subir automáticamente a Supabase Storage
        if (img.image_url && img.image_url.startsWith('data:image/')) {
          const match = img.image_url.match(/^data:image\/(\w+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const buffer = Buffer.from(match[2], 'base64');
            const fileName = `${productId}_${Date.now()}_${idx}.${ext}`;
            const uploadedUrl = await this.uploadImageToStorage(buffer, fileName);
            if (uploadedUrl) {
              finalUrl = uploadedUrl;
              storagePath = `products/${fileName}`;
            }
          }
        }

        return {
          product_id: productId,
          image_url: finalUrl,
          storage_path: storagePath,
          display_order: img.display_order !== undefined ? img.display_order : (baseOrder + idx),
          caption: img.caption || null
        };
      }));

      const { data, error } = await this.supabase
        .from('product_images')
        .insert(rows)
        .select();

      if (error) {
        console.error('❌ Error añadiendo lote de imágenes:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.error('❌ Excepción en addProductImages:', err.message);
      return [];
    }
  }

  public async deleteProductImage(imageId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      // Obtener la imagen para borrar del Storage también
      const { data: img } = await this.supabase
        .from('product_images')
        .select('storage_path')
        .eq('id', imageId)
        .single();

      if (img?.storage_path) {
        await this.supabase.storage
          .from('product-images')
          .remove([img.storage_path]);
      }

      const { error } = await this.supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        console.error('❌ Error eliminando imagen:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('❌ Excepción en deleteProductImage:', err.message);
      return false;
    }
  }

  public async uploadImageToStorage(file: Buffer, fileName: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const storagePath = `products/${Date.now()}_${fileName}`;
      const { error } = await this.supabase.storage
        .from('product-images')
        .upload(storagePath, file, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('❌ Error subiendo imagen a Storage:', error.message);
        return null;
      }

      const { data: urlData } = this.supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath);

      return urlData?.publicUrl || null;
    } catch (err: any) {
      console.error('❌ Excepción en uploadImageToStorage:', err.message);
      return null;
    }
  }

  // ============================================================
  // COMPRADORES — CRUD
  // ============================================================

  public async getBuyers(): Promise<Buyer[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  public async getBuyerByUsername(tiktokUsername: string): Promise<Buyer | null> {
    if (!this.enabled) return null;
    try {
      // Limpieza flexible del nombre
      const cleanName = tiktokUsername.toLowerCase().replace(/[@\s_.]/g, '');

      const { data, error } = await this.supabase
        .from('buyers')
        .select('*');

      if (error || !data) return null;

      // Búsqueda flexible
      return data.find((b: Buyer) => {
        const bClean = (b.tiktok_username || '').toLowerCase().replace(/[@\s_.]/g, '');
        return bClean === cleanName;
      }) || null;
    } catch (err: any) {
      return null;
    }
  }

  public async createBuyer(buyer: Partial<Buyer>): Promise<Buyer | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .insert({
          tiktok_username: buyer.tiktok_username,
          display_name: buyer.display_name,
          phone: buyer.phone,
          email: buyer.email,
          deposit_paid: buyer.deposit_paid || false,
          deposit_amount: buyer.deposit_amount || 0,
          notes: buyer.notes
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando comprador:', error.message);
        return null;
      }
      console.log(`✅ Comprador registrado: @${data.tiktok_username}`);
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en createBuyer:', err.message);
      return null;
    }
  }

  public async updateBuyer(id: string, updates: Partial<Buyer>): Promise<Buyer | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando comprador:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en updateBuyer:', err.message);
      return null;
    }
  }

  public async getBuyerCart(buyerId: string): Promise<Sale[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('sales')
        .select('*, product:products(*)')
        .eq('buyer_id', buyerId)
        .eq('picked', false)
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  // ============================================================
  // VENTAS / ADJUDICACIONES
  // ============================================================

  public async createSale(productId: string, buyerId: string, salePrice: number, saleType: string = 'subasta', viaTieBreaker: boolean = false, winningBoxNumber?: number, liveSessionId?: string): Promise<Sale | null> {
    if (!this.enabled) return null;
    try {
      let activeSessionId = liveSessionId;
      if (!activeSessionId) {
        const active = await this.getActiveLiveSession();
        if (active) activeSessionId = active.id;
      }

      const { data, error } = await this.supabase
        .from('sales')
        .insert({
          product_id: productId,
          buyer_id: buyerId,
          sale_price: salePrice,
          sale_type: saleType,
          via_tie_breaker: viaTieBreaker,
          winning_box_number: winningBoxNumber,
          live_session_id: activeSessionId || null
        })
        .select('*, product:products(*), buyer:buyers(*)')
        .single();

      if (error) {
        console.error('❌ Error creando venta:', error.message);
        return null;
      }

      // Actualizar estado del producto a "vendido"
      await this.updateProductStatus(productId, 'vendido');

      console.log(`🎉 Venta registrada: Producto ${productId} → $${salePrice.toLocaleString('es-CL')}${activeSessionId ? ` (Jornada: ${activeSessionId})` : ''}`);
      return data;
    } catch (err: any) {
      console.error('❌ Excepción en createSale:', err.message);
      return null;
    }
  }

  public async markAsPicked(saleId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('sales')
        .update({ picked: true, picked_at: new Date().toISOString() })
        .eq('id', saleId);

      if (error) {
        console.error('❌ Error marcando como recogido:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      return false;
    }
  }

  public async getPickingList(): Promise<Sale[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('sales')
        .select('*, product:products(*), buyer:buyers(*)')
        .eq('picked', false)
        .order('created_at', { ascending: true });

      if (error) return [];
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  public async getSalesSummary(): Promise<{ totalSales: number; totalRevenue: number; totalBuyers: number; totalPicked: number; totalPending: number }> {
    if (!this.enabled) return { totalSales: 0, totalRevenue: 0, totalBuyers: 0, totalPicked: 0, totalPending: 0 };
    try {
      const { data, error } = await this.supabase
        .from('sales')
        .select('sale_price, picked, buyer_id');

      if (error || !data) return { totalSales: 0, totalRevenue: 0, totalBuyers: 0, totalPicked: 0, totalPending: 0 };

      const uniqueBuyers = new Set(data.map((s: any) => s.buyer_id));
      return {
        totalSales: data.length,
        totalRevenue: data.reduce((sum: number, s: any) => sum + (s.sale_price || 0), 0),
        totalBuyers: uniqueBuyers.size,
        totalPicked: data.filter((s: any) => s.picked).length,
        totalPending: data.filter((s: any) => !s.picked).length
      };
    } catch (err: any) {
      return { totalSales: 0, totalRevenue: 0, totalBuyers: 0, totalPicked: 0, totalPending: 0 };
    }
  }

  // ============================================================
  // EVENTOS TIKTOK (Auditoría)
  // ============================================================

  public async saveEvent(event: InternalGameEvent): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('tiktok_events')
        .insert({
          event_type: event.type,
          tiktok_user_id: event.userId,
          username: event.username,
          message: event.rawMessage,
          created_at: event.timestamp,
          raw_event: event
        });

      if (error) {
        console.error('❌ Error guardando evento TikTok:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('❌ Excepción al insertar evento:', err.message);
      return false;
    }
  }

  // ============================================================
  // CATÁLOGO PÚBLICO
  // ============================================================

  public async getCatalog(filters: ProductFilters = {}): Promise<ProductWithImages[]> {
    // Solo muestra productos disponibles, con imágenes
    const catalogFilters = { ...filters, stock_status: 'disponible' as const };
    const products = await this.getProducts(catalogFilters);
    return products.map((p: any) => ({
      ...p,
      images: (p.product_images || []).sort((a: ProductImage, b: ProductImage) => a.display_order - b.display_order)
    }));
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  public async getAvailableProductsForQueue(limit: number = 20): Promise<ProductWithImages[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('stock_status', 'disponible')
        .is('parent_product_id', null)  // Solo productos principales, no accesorios
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return [];
      return (data || []).map((p: any) => ({
        ...p,
        images: (p.product_images || []).sort((a: ProductImage, b: ProductImage) => a.display_order - b.display_order)
      }));
    } catch (err: any) {
      return [];
    }
  }

  // ============================================================
  // SESIÓN INTERACTIVA (Persistencia en Supabase)
  // ============================================================

  public async saveInteractiveSession(session: InteractiveSession): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      // Filtrar solo los datos que deben persistir (cola, frases, fondo, offset, compradores, ganadores)
      const dataToSave = {
        queue: session.queue || [],
        currentProductIndex: session.currentProductIndex || 0,
        activeProduct: session.activeProduct || null,
        heroBannerSlides: session.heroBannerSlides || [],
        heroBannerInterval: session.heroBannerInterval || 3.8,
        whatsappNumber: session.whatsappNumber || '',
        cardBgUrl: session.cardBgUrl || '',
        cardOffsetY: session.cardOffsetY || 90,
        approvedBidders: session.approvedBidders || [],
        winnersHistory: session.winnersHistory || [],
        autoAdvance: session.autoAdvance ?? true,
        requireApproval: session.requireApproval ?? true
      };

      const { error } = await this.supabase
        .from('interactive_sessions')
        .upsert({
          id: 'current',
          session_data: dataToSave,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn('⚠️ Error guardando sesión en Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('⚠️ Excepción guardando sesión en Supabase:', err.message);
      return false;
    }
  }

  public async getInteractiveSession(): Promise<Partial<InteractiveSession> | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('interactive_sessions')
        .select('session_data')
        .eq('id', 'current')
        .single();

      if (error || !data || !data.session_data) return null;
      return data.session_data;
    } catch (err: any) {
      console.warn('⚠️ Excepción obteniendo sesión de Supabase:', err.message);
      return null;
    }
  }

  // ============================================================
  // GESTIÓN DE BOLSAS DE COMPRA Y RESERVAS (10 MIN)
  // ============================================================

  public async getActiveBuyerBag(username: string): Promise<any | null> {
    if (!this.enabled) return null;
    const cleanUser = username.trim().replace(/^@/, '');
    const buyer = await this.getBuyerByUsername(cleanUser);
    if (!buyer) return null;

    const { data, error } = await this.supabase
      .from('buyer_bags')
      .select('*, buyers(*)')
      .eq('buyer_id', buyer.id)
      .in('status', ['ABIERTA_PENDIENTE_ABONO', 'ABIERTA_ACTIVA'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Error buscando bolsa activa:', error.message);
      return null;
    }
    return data;
  }

  public async createOrGetBuyerBag(
    username: string,
    options?: {
      reservedProductCode?: string;
      reservedProductId?: string;
      expiresAt?: string;
    }
  ): Promise<{ bag: any; isNewBag: boolean }> {
    if (!this.enabled) {
      return {
        bag: {
          id: `local_bag_${Date.now()}`,
          buyer_id: 'local_buyer',
          status: 'ABIERTA_PENDIENTE_ABONO',
          deposit_paid: false,
          deposit_amount: 0,
          reservation_expires_at: options?.expiresAt || null,
          reserved_product_code: options?.reservedProductCode || null,
          total_accumulated: 0,
          items_count: 0
        },
        isNewBag: true
      };
    }

    const cleanUser = username.trim().replace(/^@/, '');
    let buyer = await this.getBuyerByUsername(cleanUser);
    if (!buyer) {
      buyer = await this.createBuyer({ tiktok_username: cleanUser });
    }

    if (!buyer) {
      throw new Error(`No se pudo crear o encontrar al comprador @${cleanUser}`);
    }

    // 1. Buscar si ya tiene una bolsa activa
    const existingBag = await this.getActiveBuyerBag(cleanUser);
    if (existingBag) {
      return { bag: existingBag, isNewBag: false };
    }

    // 2. Crear nueva bolsa
    const { data: newBag, error } = await this.supabase
      .from('buyer_bags')
      .insert({
        buyer_id: buyer.id,
        status: buyer.deposit_paid ? 'ABIERTA_ACTIVA' : 'ABIERTA_PENDIENTE_ABONO',
        deposit_paid: buyer.deposit_paid || false,
        deposit_amount: buyer.deposit_amount || 0,
        reservation_expires_at: options?.expiresAt || null,
        reserved_product_id: options?.reservedProductId || null,
        reserved_product_code: options?.reservedProductCode || null,
        total_accumulated: 0,
        items_count: 0
      })
      .select('*, buyers(*)')
      .single();

    if (error) {
      console.error('❌ Error creando nueva bolsa de compras:', error.message);
      throw error;
    }

    return { bag: newBag, isNewBag: true };
  }

  public async confirmBagDeposit(
    bagId: string,
    depositAmount: number = 5000,
    phone?: string
  ): Promise<any | null> {
    if (!this.enabled) return null;

    const { data: bag, error: bagErr } = await this.supabase
      .from('buyer_bags')
      .update({
        status: 'ABIERTA_ACTIVA',
        deposit_paid: true,
        deposit_amount: depositAmount,
        reservation_expires_at: null
      })
      .eq('id', bagId)
      .select('*, buyers(*)')
      .single();

    if (bagErr || !bag) {
      console.error('❌ Error confirmando abono de bolsa:', bagErr?.message);
      return null;
    }

    // Actualizar datos del comprador
    await this.supabase
      .from('buyers')
      .update({
        deposit_paid: true,
        deposit_amount: depositAmount,
        ...(phone ? { phone, whatsapp_phone: phone } : {})
      })
      .eq('id', bag.buyer_id);

    // Si tenía una prenda reservada, asegurar que pase a estado vendido
    if (bag.reserved_product_id) {
      await this.updateProductStatus(bag.reserved_product_id, 'vendido');
    }

    return bag;
  }

  public async releaseExpiredReservation(bagId: string): Promise<boolean> {
    if (!this.enabled) return false;

    const { data: bag, error } = await this.supabase
      .from('buyer_bags')
      .select('*')
      .eq('id', bagId)
      .single();

    if (error || !bag) return false;

    // Liberar la prenda al inventario disponible
    if (bag.reserved_product_id) {
      await this.updateProductStatus(bag.reserved_product_id, 'disponible');
    }

    // Actualizar la bolsa para remover la reserva
    await this.supabase
      .from('buyer_bags')
      .update({
        reserved_product_id: null,
        reserved_product_code: null,
        reservation_expires_at: null
      })
      .eq('id', bagId);

    console.log(`🔄 Prenda #${bag.reserved_product_code} LIBERADA por expiración de 10 min de bolsa ${bagId}`);
    return true;
  }

  public async findPendingBagByProductCode(productCode: string): Promise<any | null> {
    if (!this.enabled) return null;
    const cleanCode = productCode.trim().toUpperCase().replace(/^#/, '');

    const { data, error } = await this.supabase
      .from('buyer_bags')
      .select('*, buyers(*)')
      .ilike('reserved_product_code', cleanCode)
      .eq('status', 'ABIERTA_PENDIENTE_ABONO')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Error buscando bolsa por código de producto:', error.message);
      return null;
    }
    return data;
  }

  public async getActiveBagsList(): Promise<any[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('buyer_bags')
        .select('*, buyers(*)')
        .in('status', ['ABIERTA_PENDIENTE_ABONO', 'ABIERTA_ACTIVA', 'CERRADA_PARA_ENVIO'])
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data;
    } catch (err: any) {
      console.warn('⚠️ Error obteniendo lista de bolsas:', err.message);
      return [];
    }
  }

  public async getCompleteBuyerSummary(username: string): Promise<{
    username: string;
    hasActiveBag: boolean;
    bagStatus: string;
    depositAmount: number;
    itemsCount: number;
    totalAmount: number;
    pendingBalance: number;
    items: Array<{ code: string; title: string; amount: number; date: string }>;
  }> {
    const cleanUser = username.trim().replace(/^@/, '');
    const cleanLower = cleanUser.toLowerCase().replace(/[@\s_.]/g, '');

    let bag = null;
    let sales: any[] = [];

    if (this.enabled) {
      bag = await this.getActiveBuyerBag(cleanUser);
      const buyer = await this.getBuyerByUsername(cleanUser);
      if (buyer) {
        const { data } = await this.supabase
          .from('sales')
          .select('sale_price, created_at, products(code, title)')
          .eq('buyer_id', buyer.id)
          .order('created_at', { ascending: false });
        sales = data || [];
      }
    }

    const items = sales.map((s: any) => ({
      code: s.products?.code || 'S/C',
      title: s.products?.title || 'Prenda Adjudicada',
      amount: s.sale_price || 0,
      date: s.created_at
    }));

    const totalAmount = items.reduce((sum: number, i: any) => sum + i.amount, 0);
    const depositAmount = bag?.deposit_amount || (bag?.deposit_paid ? 5000 : 0);
    const pendingBalance = Math.max(0, totalAmount - depositAmount);

    return {
      username: cleanUser,
      hasActiveBag: Boolean(bag),
      bagStatus: bag?.status || 'SIN_BOLSA',
      depositAmount,
      itemsCount: items.length,
      totalAmount,
      pendingBalance,
      items
    };
  }

  // ============================================================
  // DESPACHO & ENVIOS (BLUE EXPRESS / COURIERS)
  // ============================================================

  public async getBagsPendingDispatch(): Promise<any[]> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('buyer_bags')
        .select('*, buyers(*)')
        .eq('status', 'CERRADA_PARA_ENVIO')
        .order('updated_at', { ascending: false });

      if (error || !data) return [];
      return data;
    } catch (err: any) {
      console.warn('⚠️ Error obteniendo bolsas para despacho:', err.message);
      return [];
    }
  }

  public async updateBagShippingInfo(bagId: string, info: {
    recipient_name?: string;
    recipient_rut?: string;
    recipient_phone?: string;
    recipient_email?: string;
    recipient_address?: string;
    recipient_commune?: string;
    recipient_region?: string;
  }): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('buyer_bags')
        .update({
          ...info,
          status: 'CERRADA_PARA_ENVIO'
        })
        .eq('id', bagId);

      return !error;
    } catch (err: any) {
      return false;
    }
  }

  public async completeBagDispatch(bagId: string, trackingNumber: string, courier: string = 'blue_express'): Promise<any | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('buyer_bags')
        .update({
          status: 'DESPACHADA',
          tracking_number: trackingNumber,
          courier: courier,
          dispatched_at: new Date().toISOString()
        })
        .eq('id', bagId)
        .select('*, buyers(*)')
        .single();

      if (error || !data) {
        console.error('❌ Error completando despacho:', error?.message);
        return null;
      }
      return data;
    } catch (err: any) {
      return null;
    }
  }

  // ============================================================
  // JORNADAS DE LIVE (live_sessions)
  // ============================================================

  public async getActiveLiveSession(): Promise<LiveSession | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('live_sessions')
        .select('*')
        .eq('status', 'ACTIVA')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as LiveSession;
    } catch (err: any) {
      return null;
    }
  }

  public async startLiveSession(title?: string): Promise<LiveSession | null> {
    if (!this.enabled) return null;
    try {
      // Finalizar cualquier sesión activa previa si existiera
      await this.supabase
        .from('live_sessions')
        .update({ status: 'FINALIZADA', ended_at: new Date().toISOString() })
        .eq('status', 'ACTIVA');

      const now = new Date();
      const defaultTitle = `Live ${now.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} - ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;

      const { data, error } = await this.supabase
        .from('live_sessions')
        .insert({
          title: title?.trim() || defaultTitle,
          status: 'ACTIVA',
          started_at: now.toISOString(),
          total_sales_count: 0,
          total_revenue: 0
        })
        .select()
        .single();

      if (error || !data) {
        console.error('❌ Error iniciando jornada de live:', error?.message);
        return null;
      }
      console.log(`🎬 JORNADA DE LIVE INICIADA: "${data.title}" (ID: ${data.id})`);
      return data as LiveSession;
    } catch (err: any) {
      console.error('❌ Excepción en startLiveSession:', err.message);
      return null;
    }
  }

  public async finishLiveSession(sessionId?: string): Promise<LiveSession | null> {
    if (!this.enabled) return null;
    try {
      let targetId = sessionId;
      if (!targetId) {
        const active = await this.getActiveLiveSession();
        if (!active) return null;
        targetId = active.id;
      }

      // Calcular totales de ventas asociadas a este live
      const { data: sales } = await this.supabase
        .from('sales')
        .select('sale_price')
        .eq('live_session_id', targetId);

      const totalCount = sales?.length || 0;
      const totalRevenue = sales?.reduce((sum: number, s: any) => sum + (s.sale_price || 0), 0) || 0;

      const { data, error } = await this.supabase
        .from('live_sessions')
        .update({
          status: 'FINALIZADA',
          ended_at: new Date().toISOString(),
          total_sales_count: totalCount,
          total_revenue: totalRevenue
        })
        .eq('id', targetId)
        .select()
        .single();

      if (error || !data) return null;
      console.log(`🏁 JORNADA DE LIVE FINALIZADA: "${data.title}" • ${totalCount} ventas • $${totalRevenue.toLocaleString('es-CL')}`);
      return data as LiveSession;
    } catch (err: any) {
      return null;
    }
  }

  public async getLiveSessionSummary(sessionId: string): Promise<any | null> {
    if (!this.enabled) return null;
    try {
      const { data: session } = await this.supabase
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session) return null;

      const { data: sales } = await this.supabase
        .from('sales')
        .select('*, buyers(*), products(*)')
        .eq('live_session_id', sessionId)
        .order('created_at', { ascending: true });

      // Agrupar por comprador
      const buyersMap = new Map<string, { buyer: any; items: any[]; total: number }>();
      (sales || []).forEach((sale: any) => {
        const buyerId = sale.buyer_id;
        if (!buyersMap.has(buyerId)) {
          buyersMap.set(buyerId, {
            buyer: sale.buyers,
            items: [],
            total: 0
          });
        }
        const b = buyersMap.get(buyerId)!;
        b.items.push({
          productCode: sale.products?.code,
          productTitle: sale.products?.title,
          price: sale.sale_price
        });
        b.total += sale.sale_price;
      });

      return {
        session,
        salesCount: sales?.length || 0,
        totalRevenue: session.total_revenue || 0,
        buyersBreakdown: Array.from(buyersMap.values())
      };
    } catch (err: any) {
      return null;
    }
  }

  // ============================================================
  // STAFF MEMBERS (GESTIÓN DE PERSONAL)
  // ============================================================

  public async getStaffMembers(): Promise<Array<{ id: string; phone: string; name: string; role: string; is_active: boolean }>> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error al obtener staff_members:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  public async addStaffMember(phone: string, name: string, role: string = 'staff'): Promise<any | null> {
    if (!this.enabled) return null;
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { data, error } = await this.supabase
        .from('staff_members')
        .upsert({
          phone: cleanPhone,
          name: name.trim(),
          role: role.trim(),
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' })
        .select()
        .single();

      if (error) {
        console.error('Error al agregar staff_member:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      return null;
    }
  }

  public async deleteStaffMember(id: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('staff_members')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error al eliminar staff_member:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      return false;
    }
  }

  // ============================================================
  // UBICACIONES DE BODEGA (WAREHOUSE LOCATIONS)
  // ============================================================

  public async getWarehouseLocations(): Promise<Array<{ id: string; code: string; name: string; floor: string; storage_type: string; is_active: boolean }>> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('warehouse_locations')
        .select('*')
        .eq('is_active', true)
        .order('floor', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error al obtener warehouse_locations:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      return [];
    }
  }

  public async createWarehouseLocation(name: string, floor: string = 'Piso 1', storage_type: string = 'Perchero'): Promise<any | null> {
    if (!this.enabled) return null;
    try {
      const floorShort = floor.toLowerCase().includes('2') ? 'P2' : (floor.toLowerCase().includes('1') ? 'P1' : 'P0');
      let typeShort = 'LOC';
      const stLower = storage_type.toLowerCase();
      if (stLower.includes('perch')) typeShort = 'PER';
      else if (stLower.includes('caj')) typeShort = 'CAJ';
      else if (stLower.includes('estan')) typeShort = 'EST';
      else if (stLower.includes('repis')) typeShort = 'REP';
      else if (stLower.includes('caja')) typeShort = 'BX';

      const code = `${floorShort}-${typeShort}-${Date.now().toString().slice(-4)}`;

      const { data, error } = await this.supabase
        .from('warehouse_locations')
        .insert({
          code,
          name: name.trim(),
          floor: floor.trim(),
          storage_type: storage_type.trim(),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error al crear warehouse_location:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      return null;
    }
  }

  public async deleteWarehouseLocation(id: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const { error } = await this.supabase
        .from('warehouse_locations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error al eliminar warehouse_location:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      return false;
    }
  }

  // ============================================================
  // IA MEMORY & APRENDIZAJE (WORLD MAP)
  // ============================================================

  public async getAIMemory(): Promise<Array<{ id: string; category: string; concept: string; instruction: string }>> {
    if (!this.enabled) return [];
    try {
      const { data, error } = await this.supabase
        .from('ai_memory')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error al obtener ai_memory:', error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  }

  public async saveAIMemoryRule(concept: string, instruction: string, category: string = 'regla_staff'): Promise<any | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('ai_memory')
        .insert({
          category,
          concept: concept.trim(),
          instruction: instruction.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error al guardar regla en ai_memory:', error.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();
