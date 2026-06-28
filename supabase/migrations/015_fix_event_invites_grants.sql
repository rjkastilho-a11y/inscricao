-- =============================================================
-- Kairós Events — Fix event_invites grants
-- Migration: 015_fix_event_invites_grants
-- Descrição: Adiciona GRANTs ausentes na tabela event_invites
--            e corrige a função use_event_invite com search_path
-- =============================================================

-- =============================================================
-- PARTE 1 — GRANTs ausentes (migration 014 não incluiu)
-- O frontend faz queries diretas (.from('event_invites')) tanto
-- como authenticated (GestaoConvites) quanto como anon
-- (EventRegistration → validação de token)
-- =============================================================
GRANT ALL ON public.event_invites TO anon, authenticated;

-- =============================================================
-- PARTE 2 — Corrige use_event_invite com SET search_path
-- A função é SECURITY DEFINER e precisa de search_path explícito
-- para evitar search-path injection e garantir que encontra a
-- tabela event_invites no schema correto
-- =============================================================
CREATE OR REPLACE FUNCTION public.use_event_invite(p_token TEXT)
RETURNS TABLE (
  p_invite_id   UUID,
  p_event_id    UUID,
  p_valid       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      UUID;
  v_ev_id   UUID;
  v_used    BOOLEAN;
  v_event_exists BOOLEAN;
BEGIN
  -- Verifica se o token existe e não foi usado (lock para race condition)
  SELECT id, event_id, used
  INTO v_id, v_ev_id, v_used
  FROM public.event_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    p_invite_id := NULL;
    p_event_id  := NULL;
    p_valid     := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_used THEN
    p_invite_id := v_id;
    p_event_id  := v_ev_id;
    p_valid     := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Marca como usado
  UPDATE public.event_invites
  SET used = true, used_at = now()
  WHERE id = v_id;

  p_invite_id := v_id;
  p_event_id  := v_ev_id;
  p_valid     := TRUE;
  RETURN NEXT;
END;
$$;

-- =============================================================
-- PARTE 3 — Garantir que a função esteja acessível via REST API
-- O Supabase expõe funções public.* via REST; anon/authenticated
-- precisam de EXECUTE para chamar via supabase.rpc()
-- =============================================================
GRANT EXECUTE ON FUNCTION public.use_event_invite(p_token TEXT) TO anon, authenticated;

-- =============================================================
-- FIM DA MIGRAÇÃO 015
-- =============================================================
