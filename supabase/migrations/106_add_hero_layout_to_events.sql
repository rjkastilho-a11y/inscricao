ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hero_layout TEXT NOT NULL DEFAULT 'contained';
COMMENT ON COLUMN public.events.hero_layout IS 'Layout do banner principal: contained ou full';

DROP VIEW IF EXISTS public.events_public_view;
CREATE VIEW public.events_public_view AS
SELECT e.id, e.church_id, c.name AS church_name, e.title, e.slug, e.description,
       e.cover_url, e.hero_layout, e.location, e.start_date, e.end_date, e.is_open, e.is_published,
       e.cta_text, e.theme_color, e.organizer_whatsapp, e.price, e.is_custom, e.step_personal, e.step_christian_life,
       e.step_health, e.step_emergency, e.step_other, e.terms_text, e.terms_enabled,
       e.allowed_payment_methods, e.hidden_fields, e.pix_key, e.bank_details, e.payment_link
FROM public.events e
LEFT JOIN public.churches c ON c.id = e.church_id
WHERE e.deleted_at IS NULL AND (e.is_open = TRUE OR e.is_published = TRUE);
GRANT SELECT ON public.events_public_view TO anon, authenticated;
