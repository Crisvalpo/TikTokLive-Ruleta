-- ============================================================
-- LUKE LIVE SUBASTAS — Esquema Dedicado "subastas"
-- Ejecutar en Supabase Studio (https://api-oracle.lukeapp.cl)
-- ============================================================

-- 1. Crear esquema dedicado
CREATE SCHEMA IF NOT EXISTS subastas;

-- 2. Inventario de productos (disfraces, accesorios, prendas)
CREATE TABLE IF NOT EXISTS subastas.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  item_type VARCHAR(30) NOT NULL DEFAULT 'disfraz'
    CHECK (item_type IN ('disfraz', 'accesorio', 'prenda')),
  character VARCHAR(100),
  franchise VARCHAR(100),
  size VARCHAR(20),
  condition VARCHAR(30) DEFAULT 'excelente'
    CHECK (condition IN ('excelente', 'bueno', 'regular')),
  base_price INTEGER NOT NULL DEFAULT 0,
  warehouse_location VARCHAR(100),
  stock_status VARCHAR(20) DEFAULT 'disponible'
    CHECK (stock_status IN ('disponible', 'en_subasta', 'vendido', 'reservado')),
  parent_product_id UUID REFERENCES subastas.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Imágenes de productos (multi-imagen con orden de visualización)
CREATE TABLE IF NOT EXISTS subastas.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES subastas.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  display_order INTEGER DEFAULT 0,
  caption VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Compradores autorizados (con validación de abono $5.000 CLP)
CREATE TABLE IF NOT EXISTS subastas.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  phone VARCHAR(30),
  email VARCHAR(200),
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Registro de ventas / adjudicaciones
CREATE TABLE IF NOT EXISTS subastas.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES subastas.products(id),
  buyer_id UUID NOT NULL REFERENCES subastas.buyers(id),
  sale_price INTEGER NOT NULL,
  sale_type VARCHAR(20) DEFAULT 'subasta'
    CHECK (sale_type IN ('subasta', 'combo', 'directo')),
  via_tie_breaker BOOLEAN DEFAULT FALSE,
  winning_box_number INTEGER,
  picked BOOLEAN DEFAULT FALSE,
  picked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Historial de eventos del chat TikTok (auditoría)
CREATE TABLE IF NOT EXISTS subastas.tiktok_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  tiktok_user_id VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_event JSONB
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_status
  ON subastas.products(stock_status);

CREATE INDEX IF NOT EXISTS idx_products_type
  ON subastas.products(item_type);

CREATE INDEX IF NOT EXISTS idx_products_franchise
  ON subastas.products(franchise);

CREATE INDEX IF NOT EXISTS idx_products_code
  ON subastas.products(code);

CREATE INDEX IF NOT EXISTS idx_products_parent
  ON subastas.products(parent_product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON subastas.product_images(product_id, display_order);

CREATE INDEX IF NOT EXISTS idx_buyers_username
  ON subastas.buyers(tiktok_username);

CREATE INDEX IF NOT EXISTS idx_sales_buyer
  ON subastas.sales(buyer_id);

CREATE INDEX IF NOT EXISTS idx_sales_product
  ON subastas.sales(product_id);

CREATE INDEX IF NOT EXISTS idx_sales_picked
  ON subastas.sales(picked);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_user
  ON subastas.tiktok_events(tiktok_user_id);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_created
  ON subastas.tiktok_events(created_at DESC);

-- ============================================================
-- FUNCIONES AUXILIARES
-- ============================================================

-- Auto-actualizar updated_at en products y buyers
CREATE OR REPLACE FUNCTION subastas.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON subastas.products
  FOR EACH ROW EXECUTE FUNCTION subastas.update_updated_at();

CREATE TRIGGER trg_buyers_updated_at
  BEFORE UPDATE ON subastas.buyers
  FOR EACH ROW EXECUTE FUNCTION subastas.update_updated_at();

-- ============================================================
-- PUBLICACIÓN PARA SUPABASE REALTIME (opcional)
-- ============================================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE subastas.products;
-- ALTER PUBLICATION supabase_realtime ADD TABLE subastas.sales;

-- ============================================================
-- STORAGE BUCKET (ejecutar manualmente en Dashboard de Supabase)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('product-images', 'product-images', true);

-- ============================================================
-- DATOS DE EJEMPLO (opcional para pruebas)
-- ============================================================

-- INSERT INTO subastas.products (code, title, item_type, character, franchise, size, condition, base_price, warehouse_location)
-- VALUES
--   ('D001', 'Disfraz Elsa Frozen Completo', 'disfraz', 'Elsa', 'Disney Frozen', '4-6 años', 'excelente', 8000, 'Percha A1'),
--   ('D002', 'Traje Spider-Man Classic', 'disfraz', 'Spider-Man', 'Marvel', '6-8 años', 'bueno', 6000, 'Percha A3'),
--   ('A001', 'Corona y Cetro Elsa', 'accesorio', 'Elsa', 'Disney Frozen', 'Único', 'excelente', 2000, 'Caja B2'),
--   ('P001', 'Capa Batman con Capucha', 'prenda', 'Batman', 'DC Comics', 'M', 'excelente', 4000, 'Percha C1');

-- INSERT INTO subastas.buyers (tiktok_username, display_name, phone, deposit_paid, deposit_amount)
-- VALUES
--   ('emily_isidora', 'Emily Isidora', '+56912345678', true, 5000),
--   ('pao.luke', 'Pao Luke', '+56987654321', true, 5000);
