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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subastas.buyers ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(30);
ALTER TABLE subastas.buyers ADD COLUMN IF NOT EXISTS rut_titular VARCHAR(20);
ALTER TABLE subastas.buyers ADD COLUMN IF NOT EXISTS nombre_titular_banco VARCHAR(200);
ALTER TABLE subastas.sales ADD COLUMN IF NOT EXISTS bag_id UUID REFERENCES subastas.buyer_bags(id);

CREATE INDEX IF NOT EXISTS idx_buyer_bags_buyer ON subastas.buyer_bags(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_bags_status ON subastas.buyer_bags(status);
CREATE INDEX IF NOT EXISTS idx_buyer_bags_expires ON subastas.buyer_bags(reservation_expires_at);
CREATE INDEX IF NOT EXISTS idx_buyer_bags_reserved_code ON subastas.buyer_bags(reserved_product_code);

CREATE OR REPLACE FUNCTION subastas.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_buyer_bags_updated_at ON subastas.buyer_bags;
CREATE TRIGGER trg_buyer_bags_updated_at
  BEFORE UPDATE ON subastas.buyer_bags
  FOR EACH ROW EXECUTE FUNCTION subastas.update_updated_at();
