-- Schema para TikTok LIVE + Ruleta Interactiva
-- Ejecutar en Supabase Studio (http://studio-oracle.lukeapp.cl o localhost:54323)

CREATE TABLE IF NOT EXISTS public.tiktok_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    tiktok_user_id VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    raw_event JSONB
);

-- Indice para búsquedas rápidas por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_tiktok_events_user ON public.tiktok_events(tiktok_user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_events_created ON public.tiktok_events(created_at DESC);

-- Publicación para Supabase Realtime si se requiere
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_events;
