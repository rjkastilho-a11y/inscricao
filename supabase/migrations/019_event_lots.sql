CREATE TABLE public.event_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.registrations ADD COLUMN lot_id UUID REFERENCES public.event_lots(id) ON DELETE SET NULL;

ALTER TABLE public.event_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_lots_public_select" ON public.event_lots
  FOR SELECT USING (true);

CREATE POLICY "event_lots_admin_all" ON public.event_lots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.user_roles ur ON ur.church_id = e.church_id
      WHERE e.id = event_lots.event_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.update_event_lots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_event_lots_updated_at
  BEFORE UPDATE ON public.event_lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_lots_updated_at();

GRANT SELECT ON public.event_lots TO anon, authenticated;
GRANT ALL ON public.event_lots TO authenticated;
