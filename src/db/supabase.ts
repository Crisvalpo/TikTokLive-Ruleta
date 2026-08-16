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
  InteractiveSession
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
        return data.map((p: any) => ({
          ...p,
          images: p.product_images || []
        }));
      }
      return [];
    } catch (err: any) {
      console.error('❌ Excepción en getProducts:', err.message);
      return [];
    }
  }

  public async getProductByCode(code: string): Promise<ProductWithImages | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('code', code)
        .single();

      if (error || !data) return null;

      // Cargar accesorios vinculados
      const { data: accessories } = await this.supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('parent_product_id', data.id);

      return { ...data, images: data.product_images || [], accessories: accessories || [] };
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

      const rows = images.map((img, idx) => ({
        product_id: productId,
        image_url: img.image_url,
        storage_path: img.storage_path || null,
        display_order: img.display_order !== undefined ? img.display_order : (baseOrder + idx),
        caption: img.caption || null
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

  public async createSale(productId: string, buyerId: string, salePrice: number, saleType: string = 'subasta', viaTieBreaker: boolean = false, winningBoxNumber?: number): Promise<Sale | null> {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('sales')
        .insert({
          product_id: productId,
          buyer_id: buyerId,
          sale_price: salePrice,
          sale_type: saleType,
          via_tie_breaker: viaTieBreaker,
          winning_box_number: winningBoxNumber
        })
        .select('*, product:products(*), buyer:buyers(*)')
        .single();

      if (error) {
        console.error('❌ Error creando venta:', error.message);
        return null;
      }

      // Actualizar estado del producto a "vendido"
      await this.updateProductStatus(productId, 'vendido');

      console.log(`🎉 Venta registrada: Producto ${productId} → $${salePrice.toLocaleString('es-CL')}`);
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
}

export const supabaseService = new SupabaseService();
