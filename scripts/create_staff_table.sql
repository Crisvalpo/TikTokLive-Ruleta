CREATE TABLE IF NOT EXISTS subastas.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar números iniciales por defecto si no existen
INSERT INTO subastas.staff_members (phone, name, role)
VALUES 
  ('56993425585', 'Cristian (Administrador)', 'admin')
ON CONFLICT (phone) DO NOTHING;
