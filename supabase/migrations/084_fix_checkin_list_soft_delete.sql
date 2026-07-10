-- =============================================================
-- Kairós Events — Corrige duplicação de nomes no check-in público
-- Migration: 084_fix_checkin_list_soft_delete
-- Descrição: A RPC get_checkin_list consultava por slug, que
--            após a migração 076 (remoção da UNIQUE global)
--            pode casar múltiplos eventos de igrejas diferentes.
--            Agora usa subquery para obter o event_id exato
--            validado pelo token, eliminando duplicação.
--            Também adiciona filtros de deleted_at e
--            payment_status para consistência com views admin.
-- =============================================================

-- =============================================================
-- PARTE 1 — RPC: Listar inscrições para check-in
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
  -- Valida o token (apenas eventos não-deletados)
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = p_event_slug
      AND checkin_token = p_token
      AND checkin_token IS NOT NULL
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Link de check-in inválido ou expirado.';
  END IF;

  RETURN QUERY
  SELECT r.id, r.full_name, r.checked_in
  FROM public.registrations r
  WHERE r.event_id = (
      SELECT e.id FROM public.events e
      WHERE e.slug = p_event_slug
        AND e.checkin_token = p_token
        AND e.checkin_token IS NOT NULL
        AND e.deleted_at IS NULL
  )
  AND r.deleted_at IS NULL
  AND r.payment_status != 'canceled'
  ORDER BY r.full_name;
END;
$$;

COMMENT ON FUNCTION public.get_checkin_list IS
  'Retorna id, nome e status de check-in dos inscritos de um evento não-deletado.
   Requer token de check-in válido. Acesso público via SECURITY DEFINER.
   Ignora inscrições canceladas e eventos soft-deletados.';

-- =============================================================
-- PARTE 2 — RPC: Alternar check-in de um inscrito
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

  -- Valida o token (apenas eventos não-deletados)
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = v_event_slug
      AND checkin_token = p_token
      AND checkin_token IS NOT NULL
      AND deleted_at IS NULL
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
-- PARTE 3 — Grants para acesso público
-- =============================================================
GRANT EXECUTE ON FUNCTION public.get_checkin_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_checkin TO anon, authenticated;

-- =============================================================
-- FIM
-- =============================================================
