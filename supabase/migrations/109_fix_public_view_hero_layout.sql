-- ==============================================================
-- Kairós Events — Forward-fix: hero_layout na events_public_view
-- Migration: 109_fix_public_view_hero_layout
--
-- A migration 108 recriou a view baseada na definição da 105 e
-- perdeu a coluna hero_layout que a 106 havia adicionado. Sem ela,
-- o hotsite configurado como "Tela cheia" (hero_layout = 'full')
-- caía no modo contido (isFullBleed sempre false).
--
-- Recria a view com o conjunto completo de colunas:
--   church_logo (108) + hero_layout (106) + demais.
-- ==============================================================

DROP VIEW IF EXISTS public.events_public_view;

CREATE VIEW public.events_public_view AS
SELECT e.id, e.church_id, c.name AS church_name,
       c.logo_url AS church_logo,
       e.title, e.slug, e.description,
       e.cover_url, e.hero_layout, e.location, e.start_date, e.end_date, e.is_open, e.is_published,
       e.cta_text, e.theme_color, e.organizer_whatsapp, e.price, e.is_custom, e.step_personal, e.step_christian_life,
       e.step_health, e.step_emergency, e.step_other, e.terms_text, e.terms_enabled,
       e.allowed_payment_methods, e.hidden_fields, e.pix_key, e.bank_details, e.payment_link
FROM public.events e
LEFT JOIN public.churches c ON c.id = e.church_id
WHERE e.deleted_at IS NULL AND (e.is_open = TRUE OR e.is_published = TRUE);

GRANT SELECT ON public.events_public_view TO anon, authenticated;
