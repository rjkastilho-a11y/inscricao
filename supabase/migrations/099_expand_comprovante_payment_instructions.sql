-- =============================================================
-- Kairós Events — Instruções de pagamento no comprovante
-- Migration: 099
-- Descrição: Expande a RPC get_comprovante para retornar as
--            instruções de pagamento do evento (pix_key,
--            bank_details, payment_link) e o detalhe informado
--            pelo inscrito (payment_method_details), para que
--            apareçam no comprovante impresso/público.
-- Depende da migration 098 (colunas em events e registrations).
-- =============================================================

-- CREATE OR REPLACE não pode alterar o tipo de retorno de uma função
-- existente (42P13), então removemos a versão antiga antes de recriar.
DROP FUNCTION IF EXISTS public.get_comprovante(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_comprovante(
  p_event_slug      TEXT,
  p_registration_id UUID
)
RETURNS TABLE (
  reg_id                 UUID,
  full_name              TEXT,
  email                  TEXT,
  whatsapp               TEXT,
  payment_method         TEXT,
  payment_status         TEXT,
  payment_method_details TEXT,
  paid_amount            NUMERIC,
  event_title            TEXT,
  event_slug             TEXT,
  event_price            NUMERIC,
  event_pix_key          TEXT,
  event_bank_details     TEXT,
  event_payment_link     TEXT,
  checkin_token          TEXT,
  lot_name               TEXT,
  lot_price              NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Descobre o evento pelo slug
  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.slug = p_event_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprovante não encontrado.';
  END IF;

  -- A inscrição deve pertencer a este evento
  IF NOT EXISTS (
    SELECT 1 FROM public.registrations
    WHERE id = p_registration_id
      AND event_id = v_event_id
  ) THEN
    RAISE EXCEPTION 'Comprovante não encontrado.';
  END IF;

  -- Garante token de check-in para o QR sempre existir
  UPDATE public.events
  SET checkin_token = COALESCE(checkin_token, gen_random_uuid()::text)
  WHERE id = v_event_id;

  RETURN QUERY
  SELECT
    r.id,
    r.full_name,
    r.email,
    r.whatsapp,
    r.payment_method,
    r.payment_status,
    r.payment_method_details,
    r.paid_amount,
    e.title,
    e.slug,
    e.price,
    e.pix_key,
    e.bank_details,
    e.payment_link,
    e.checkin_token,
    l.name,
    l.price
  FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  LEFT JOIN public.event_lots l ON l.id = r.lot_id
  WHERE r.id = p_registration_id
    AND e.id = v_event_id;
END;
$$;

COMMENT ON FUNCTION public.get_comprovante IS
  'Retorna os dados do comprovante de uma inscrição (inscrito + evento + lote) '
  'incluindo as instruções de pagamento pendente, e garante o checkin_token do '
  'evento. Requer o slug do evento e o id da inscrição. Acesso público via SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION public.get_comprovante TO anon, authenticated;

-- =============================================================
-- FIM
-- =============================================================
