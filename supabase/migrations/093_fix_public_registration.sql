-- =============================================================
-- Kairós Events — Correção da inscrição pública (anon)
-- Migration: 093_fix_public_registration
-- Descrição: O INSERT público (anon) em registrations usava
--            .select('id') no cliente, que o PostgREST traduz em
--            INSERT ... RETURNING. O RETURNING exige uma policy de
--            SELECT para o papel anon, que não existe (a migration
--            029 removeu registrations_public_select). Isso causava
--            o erro 42501 "new row violates row-level security
--            policy" para todo visitante anônimo.
--
-- Correção: o cliente passa a inserir com returning:'minimal'
--            (sem RETURNING) e busca o id da inscrição recém-criada
--            por esta RPC (email é UNIQUE por evento).
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_registration_id_by_email(
  p_event_id UUID,
  p_email    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.registrations
  WHERE event_id = p_event_id
    AND LOWER(email) = LOWER(p_email)
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.get_registration_id_by_email IS
  'Retorna o id da inscrição recém-criada para um evento e e-mail '
  '(e-mail é UNIQUE por evento). Usado pela página pública de '
  'inscrição após insert com returning minimal, evitando o erro de '
  'RLS no INSERT ... RETURNING para o papel anon.';

GRANT EXECUTE ON FUNCTION public.get_registration_id_by_email TO anon, authenticated;

-- =============================================================
-- FIM
-- =============================================================
