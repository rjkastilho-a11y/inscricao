ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden_fields jsonb DEFAULT '[]'::jsonb;
