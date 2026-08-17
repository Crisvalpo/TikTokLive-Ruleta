INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Permitir lectura pública de las imágenes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access product-images'
  ) THEN
    CREATE POLICY "Public Access product-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');
  END IF;
END $$;
