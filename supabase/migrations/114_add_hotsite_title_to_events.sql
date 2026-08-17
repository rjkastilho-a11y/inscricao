-- ==============================================================
-- Kairós Events — Campo hotsite_title (Nome do Hotsite)
-- Migration: 114_add_hotsite_title_to_events
--
-- Título público/comercial exibido no hotsite no lugar do título
-- interno do evento. Fallback para o título principal quando vazio.
-- ==============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hotsite_title TEXT;

DROP VIEW IF EXISTS public.events_public_view;

CREATE VIEW public.events_public_view AS
SELECT e.id, e.church_id, c.name AS church_name,
       c.logo_url AS church_logo,
       COALESCE(e.organizer_name, c.name) AS display_organizer_name,
       COALESCE(e.organizer_logo_url, c.logo_url) AS display_organizer_logo,
       e.title, e.hotsite_title, e.subtitle, e.slug, e.description,
       e.cover_url, e.hero_layout, e.location, e.location_name, e.show_location, e.show_about, e.show_registration,
       e.start_date, e.end_date, e.is_open, e.is_published,
       e.cta_text, e.theme_color, e.organizer_whatsapp, e.price, e.is_custom, e.step_personal, e.step_christian_life,
       e.step_health, e.step_emergency, e.step_other, e.terms_text, e.terms_enabled,
       e.allowed_payment_methods, e.hidden_fields, e.pix_key, e.bank_details, e.payment_link
FROM public.events e
LEFT JOIN public.churches c ON c.id = e.church_id
WHERE e.deleted_at IS NULL AND (e.is_open = TRUE OR e.is_published = TRUE);

GRANT SELECT ON public.events_public_view TO anon, authenticated;
