-- =============================================================
-- Kairós Events — Check-in público via token
-- Migration: 028_checkin_token
-- Descrição: Adiciona coluna checkin_token à tabela events
--            e RPCs para check-in público com token
-- =============================================================

-- =============================================================
-- PARTE 1 — Coluna checkin_token em events
-- =============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checkin_token TEXT UNIQUE;

COMMENT ON COLUMN public.events.checkin_token IS
  'Token UUID para link público de check-in. Se NULL, o check-in público está desabilitado.';

-- =============================================================
-- PARTE 2 — RPC: Listar inscrições para check-in
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_checkin_list(
  p_event_slug TEXT,
  p_token      TEXT
)
RETURNS TABLE (
  id         UUID,
  full_name  TEXT,
  checked_in BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Valida o token
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = p_event_slug
      AND checkin_token = p_token
      AND checkin_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Link de check-in inválido ou expirado.';
  END IF;

  RETURN QUERY
  SELECT r.id, r.full_name, r.checked_in
  FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.slug = p_event_slug
  ORDER BY r.full_name;
END;
$$;

COMMENT ON FUNCTION public.get_checkin_list IS
  'Retorna id, nome e status de check-in dos inscritos de um evento.
   Requer token de check-in válido. Acesso público via SECURITY DEFINER.';

-- =============================================================
-- PARTE 3 — RPC: Alternar check-in de um inscrito
-- =============================================================
CREATE OR REPLACE FUNCTION public.toggle_checkin(
  p_registration_id UUID,
  p_token           TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current BOOLEAN;
  v_event_slug TEXT;
BEGIN
  -- Descobre o slug do evento desta inscrição
  SELECT e.slug INTO v_event_slug
  FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.id = p_registration_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada.';
  END IF;

  -- Valida o token
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = v_event_slug
      AND checkin_token = p_token
      AND checkin_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Link de check-in inválido ou expirado.';
  END IF;

  -- Alterna o status
  SELECT checked_in INTO v_current
  FROM public.registrations
  WHERE id = p_registration_id;

  UPDATE public.registrations
  SET checked_in = NOT v_current
  WHERE id = p_registration_id;

  RETURN NOT v_current;
END;
$$;

COMMENT ON FUNCTION public.toggle_checkin IS
  'Alterna o status de check-in de uma inscrição.
   Requer token de check-in válido. Retorna o novo status.';

-- =============================================================
-- PARTE 4 — Grants para acesso público
-- =============================================================
GRANT EXECUTE ON FUNCTION public.get_checkin_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_checkin TO anon, authenticated;

-- =============================================================
-- FIM
-- =============================================================
