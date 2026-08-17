-- ==============================================================
-- Kairós Events — Hotsite público: is_published + cta_text + events_public_view
-- Migration: 102_add_hotsite_fields_and_public_view
-- Descrição: Adiciona as colunas is_published e cta_text na tabela
--            events para controlar o hotsite público, e cria a VIEW
--            events_public_view com privilégios do owner (sem
--            security_invoker), expondo APENAS as colunas públicas
--            necessárias para o hotsite e checkout. O WHERE interno
--            é a barreira de segurança (is_open OU is_published,
--            sem soft-deleted), permitindo publicar antes de abrir
--            inscrições sem ampliar o RLS da tabela events.
--            checkin_token é EXCLUÍDO da view (fallback via RPC
--            get_comprovante no frontend).
-- ==============================================================

-- 1. Novas colunas de hotsite na tabela events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_text TEXT NOT NULL DEFAULT 'Garantir Inscrição';

COMMENT ON COLUMN public.events.is_published IS
  'Publica o hotsite público do evento. Independente de is_open, que continua controlando a abertura de inscrições.';
COMMENT ON COLUMN public.events.cta_text IS
  'Texto customizado do botão de ação no hotsite público.';

-- 2. VIEW pública segura (owner-privilege) para hotsite/checkout
DROP VIEW IF EXISTS public.events_public_view;

CREATE VIEW public.events_public_view AS
SELECT
  id,
  church_id,
  title,
  slug,
  description,
  cover_url,
  location,
  start_date,
  end_date,
  is_open,
  is_published,
  cta_text,
  price,
  is_custom,
  step_personal,
  step_christian_life,
  step_health,
  step_emergency,
  step_other,
  terms_text,
  terms_enabled,
  allowed_payment_methods,
  hidden_fields,
  pix_key,
  bank_details,
  payment_link
FROM public.events
WHERE deleted_at IS NULL AND (is_open = TRUE OR is_published = TRUE);

COMMENT ON VIEW public.events_public_view IS
  'Exposição pública (hotsite/checkout) da tabela events. Roda com privilégios do owner: o WHERE é a barreira de segurança (não amplia o RLS da tabela) e só colunas públicas são projetadas. checkin_token fica fora (obtido via RPC get_comprovante).';

-- 3. Acesso público e autenticado à VIEW
GRANT SELECT ON public.events_public_view TO anon, authenticated;
