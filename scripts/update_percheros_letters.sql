-- Actualizar los percheros existentes para que usen letras (A, B, C, D)
DELETE FROM subastas.warehouse_locations WHERE storage_type = 'Perchero';

INSERT INTO subastas.warehouse_locations (code, name, floor, storage_type)
VALUES 
  ('P1-PER-A', '🧥 P1 • Perchero A', 'Piso 1', 'Perchero'),
  ('P1-PER-B', '🧥 P1 • Perchero B', 'Piso 1', 'Perchero'),
  ('P1-PER-C', '🧥 P1 • Perchero C', 'Piso 1', 'Perchero'),
  ('P1-PER-D', '🧥 P1 • Perchero D', 'Piso 1', 'Perchero'),
  ('P2-PER-A', '🧥 P2 • Perchero A', 'Piso 2', 'Perchero'),
  ('P2-PER-B', '🧥 P2 • Perchero B', 'Piso 2', 'Perchero'),
  ('P2-PER-C', '🧥 P2 • Perchero C', 'Piso 2', 'Perchero')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, floor = EXCLUDED.floor;
