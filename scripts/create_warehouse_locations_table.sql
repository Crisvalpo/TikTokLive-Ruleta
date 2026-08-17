CREATE TABLE IF NOT EXISTS subastas.warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  floor VARCHAR(50) NOT NULL DEFAULT 'Piso 1',
  storage_type VARCHAR(50) NOT NULL DEFAULT 'Perchero',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar ubicaciones iniciales estándar si no existen
INSERT INTO subastas.warehouse_locations (code, name, floor, storage_type)
VALUES 
  ('P1-PER-1', '🧥 P1 • Perchero 1', 'Piso 1', 'Perchero'),
  ('P1-PER-2', '🧥 P1 • Perchero 2', 'Piso 1', 'Perchero'),
  ('P1-PER-3', '🧥 P1 • Perchero 3', 'Piso 1', 'Perchero'),
  ('P1-CAJ-01', '📦 P1 • Cajón 01', 'Piso 1', 'Cajón'),
  ('P1-CAJ-02', '📦 P1 • Cajón 02', 'Piso 1', 'Cajón'),
  ('P1-CAJ-03', '📦 P1 • Cajón 03', 'Piso 1', 'Cajón'),
  ('P2-PER-1', '🧥 P2 • Perchero 1', 'Piso 2', 'Perchero'),
  ('P2-PER-2', '🧥 P2 • Perchero 2', 'Piso 2', 'Perchero'),
  ('P2-CAJ-01', '📦 P2 • Cajón 01', 'Piso 2', 'Cajón'),
  ('P2-CAJ-02', '📦 P2 • Cajón 02', 'Piso 2', 'Cajón'),
  ('P2-CAJ-03', '📦 P2 • Cajón 03', 'Piso 2', 'Cajón'),
  ('P2-EST-1', '🗄️ P2 • Estante 1', 'Piso 2', 'Estante')
ON CONFLICT (code) DO NOTHING;
