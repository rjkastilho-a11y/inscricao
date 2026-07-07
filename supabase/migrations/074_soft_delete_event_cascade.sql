-- Soft-delete evento + inscrições em cascata
-- Substitui a função anterior que bloqueava exclusão se houvesse inscrições ativas

CREATE OR REPLACE FUNCTION public.soft_delete_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para deletar este evento';
  END IF;

  -- Soft-delete todas as inscrições ativas do evento
  UPDATE public.registrations
  SET deleted_at = now()
  WHERE event_id = p_event_id AND deleted_at IS NULL;

  -- Soft-delete o evento
  UPDATE public.events
  SET deleted_at = now(),
      is_open = false
  WHERE id = p_event_id;
END;
$$;
