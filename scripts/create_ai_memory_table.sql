CREATE TABLE IF NOT EXISTS subastas.ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL DEFAULT 'regla_general',
  concept VARCHAR(100) NOT NULL,
  instruction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar reglas base aprendidas
INSERT INTO subastas.ai_memory (category, concept, instruction)
VALUES
  ('ubicacion', 'percheros', 'Los percheros se identifican con letras mayúsculas (ej: P1 • Perchero A, P2 • Perchero B).'),
  ('ubicacion', 'cajones', 'Los cajones y cajas se identifican con números de dos dígitos (ej: P1 • Cajón 01, P2 • Cajón 02).'),
  ('categoria', 'juguetes', 'Las figuras de acción, muñecos, autos a escala y juguetes importados se clasifican como "Juguetes Americanos".'),
  ('categoria', 'disfraces', 'Los trajes y disfraces infantiles y adultos se clasifican como "Disfraz".'),
  ('precios', 'expresiones_chilenas', '"8 lucas", "8 mil", "8k" o "8" para precio base equivale a 8000 CLP.')
ON CONFLICT DO NOTHING;
