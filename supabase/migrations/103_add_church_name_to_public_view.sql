-- ==============================================================
-- Kairós Events — Adicionar nome da igreja/organizador à events_public_view
-- Migration: 103_add_church_name_to_public_view
-- Descrição: Recria events_public_view com LEFT JOIN em churches,
--            expondo apenas o nome (c.name AS church_name) para o
--            hotsite exibir o organizador. A view roda com privilégios
--            do owner (sem security_invoker), então o JOIN não amplia
--            o RLS de churches — apenas o nome é projetado.
-- ==============================================================

DROP VIEW IF EXISTS public.events_public_view;

CREATE VIEW public.events_public_view AS
SELECT
  e.id,
  e.church_id,
  c.name AS church_name,
  e.title,
  e.slug,
  e.description,
  e.cover_url,
  e.location,
  e.start_date,
  e.end_date,
  e.is_open,
  e.is_published,
  e.cta_text,
  e.price,
  e.is_custom,
  e.step_personal,
  e.step_christian_life,
  e.step_health,
  e.step_emergency,
  e.step_other,
  e.terms_text,
  e.terms_enabled,
  e.allowed_payment_methods,
  e.hidden_fields,
  e.pix_key,
  e.bank_details,
  e.payment_link
FROM public.events e
LEFT JOIN public.churches c ON c.id = e.church_id
WHERE e.deleted_at IS NULL AND (e.is_open = TRUE OR e.is_published = TRUE);

COMMENT ON VIEW public.events_public_view IS
  'Exposição pública (hotsite/checkout) da tabela events. Roda com privilégios do owner: o WHERE é a barreira de segurança (não amplia o RLS da tabela) e só colunas públicas são projetadas. church_name vem de LEFT JOIN em churches. checkin_token fica fora (obtido via RPC get_comprovante).';

GRANT SELECT ON public.events_public_view TO anon, authenticated;
