-- ==============================================================
-- Kairós Events — Perfil da Igreja (name + logo_url)
-- Migration: 108_church_profile
--
-- 1) Colunas logo_url e updated_at em churches.
-- 2) RPC update_church_profile (SECURITY DEFINER + JWT):
--    permite que admin/super_admin editem SOMENTE name e
--    logo_url da própria igreja, sem tocar em campos sensíveis
--    (is_active, status, trial_ends_at, plan_type, is_vip).
-- 3) events_public_view: expõe c.logo_url AS church_logo para o
--    cabeçalho do hotsite.
-- ==============================================================

-- --------------------------------------------------------------
-- 1) COLUNAS EM churches
-- --------------------------------------------------------------
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- --------------------------------------------------------------
-- 2) RPC update_church_profile (segura, apenas colunas seguras)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_church_profile(
  p_name TEXT,
  p_logo_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
  v_role      TEXT;
BEGIN
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid INTO v_church_id;
  SELECT auth.jwt() -> 'app_metadata' ->> 'church_role' INTO v_role;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem igreja vinculada.';
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Sem permissão para editar o perfil da igreja.';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'O nome da igreja não pode ser vazio.';
  END IF;

  UPDATE public.churches
  SET name = p_name,
      logo_url = COALESCE(p_logo_url, ''),
      updated_at = NOW()
  WHERE id = v_church_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_church_profile(TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------
-- 3) VIEW PÚBLICA + church_logo
-- --------------------------------------------------------------
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
