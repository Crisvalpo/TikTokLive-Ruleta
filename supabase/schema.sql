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

-- 7. Persistencia de Sesión Interactiva (Cola de productos, frases y configuración OBS)
CREATE TABLE IF NOT EXISTS subastas.interactive_sessions (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'current',
  session_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- 8. Bolsas de Compra (Ciclo de vida, acumulación y reserva temporal 10 min)
CREATE TABLE IF NOT EXISTS subastas.buyer_bags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES subastas.buyers(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'ABIERTA_PENDIENTE_ABONO'
    CHECK (status IN ('ABIERTA_PENDIENTE_ABONO', 'ABIERTA_ACTIVA', 'CERRADA_PARA_ENVIO', 'DESPACHADA')),
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_amount INTEGER DEFAULT 0,
  reservation_expires_at TIMESTAMPTZ,
  reserved_product_id UUID REFERENCES subastas.products(id) ON DELETE SET NULL,
  reserved_product_code VARCHAR(20),
  total_accumulated INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  -- Datos de despacho y tracking
  recipient_name VARCHAR(150),
  recipient_rut VARCHAR(20),
  recipient_phone VARCHAR(30),
  recipient_email VARCHAR(150),
  recipient_address TEXT,
  recipient_commune VARCHAR(100),
  recipient_region VARCHAR(100),
  tracking_number VARCHAR(100),
  courier VARCHAR(50) DEFAULT 'blue_express',
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_bags_buyer
  ON subastas.buyer_bags(buyer_id);

CREATE INDEX IF NOT EXISTS idx_buyer_bags_status
  ON subastas.buyer_bags(status);

CREATE INDEX IF NOT EXISTS idx_buyer_bags_expires
  ON subastas.buyer_bags(reservation_expires_at);

CREATE INDEX IF NOT EXISTS idx_buyer_bags_reserved_code
  ON subastas.buyer_bags(reserved_product_code);

-- Auto-actualizar updated_at en products, buyers y buyer_bags
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

CREATE TRIGGER trg_buyer_bags_updated_at
  BEFORE UPDATE ON subastas.buyer_bags
  FOR EACH ROW EXECUTE FUNCTION subastas.update_updated_at();

-- 9. Control de Jornadas de Live (Sesión de transmisión independiente de cuentas de TikTok)
CREATE TABLE IF NOT EXISTS subastas.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('ACTIVA', 'FINALIZADA')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_sales_count INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subastas.sales 
  ADD COLUMN IF NOT EXISTS live_session_id UUID REFERENCES subastas.live_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_live_session ON subastas.sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON subastas.live_sessions(status);

CREATE TRIGGER trg_live_sessions_updated_at
  BEFORE UPDATE ON subastas.live_sessions
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
