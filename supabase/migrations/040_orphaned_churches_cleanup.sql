-- ==============================================================
-- MIGRAÇÃO 040: Cleanup de igrejas órfãs via pg_cron
--
-- Igrejas "órfãs": criadas pelo trigger handle_new_user()
-- mas cujo admin nunca confirmou o email.
-- Risco: dados inconsistentes + storage usage desnecessário.
--
-- Requer extensão pg_cron (já vem no Supabase por padrão).
-- ==============================================================

-- ==============================================================
-- (1) HABILITAR EXTENSÃO pg_cron (idempotente)
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==============================================================
-- (2) FUNÇÃO: identificar + soft-delete igrejas órfãs
--
-- Critério: igreja criada há mais de 24h onde TODOS os admins
-- associados nunca confirmaram email (email_confirmed_at IS NULL)
-- e a igreja não tem dados (eventos, inscrições, pagamentos).
-- ==============================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_churches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_church RECORD;
BEGIN
  -- Igrejas criadas há mais de 24h sem admin confirmado
  FOR v_church IN
    SELECT c.id
    FROM public.churches c
    WHERE c.deleted_at IS NULL
      AND c.created_at < now() - INTERVAL '24 hours'
      AND NOT EXISTS (
        -- Pelo menos 1 admin com email confirmado
        SELECT 1
        FROM public.user_roles ur
        JOIN auth.users u ON u.id = ur.user_id
        WHERE ur.church_id = c.id
          AND ur.role = 'admin'
          AND u.email_confirmed_at IS NOT NULL
      )
      AND NOT EXISTS (
        -- Sem dados associados (eventos = dados reais da igreja)
        SELECT 1 FROM public.events e WHERE e.church_id = c.id
      )
  LOOP
    -- Soft delete da igreja
    UPDATE public.churches
    SET deleted_at = now()
    WHERE id = v_church.id;

    -- Remove roles órfãs vinculadas
    DELETE FROM public.user_roles
    WHERE church_id = v_church.id;

    v_deleted := v_deleted + 1;

    RAISE NOTICE 'Igreja órfã removida: %', v_church.id;
  END LOOP;

  -- Limpa rate limits antigos também (rodar junto)
  DELETE FROM public.rate_limits
  WHERE created_at < now() - INTERVAL '24 hours';

  RETURN v_deleted;
END;
$$;

-- ==============================================================
-- (3) AGENDAR: rodar todo dia às 03:00 UTC
-- ==============================================================

SELECT cron.schedule(
  'cleanup-orphaned-churches',     -- nome do job
  '0 3 * * *',                     -- cron: todo dia às 03:00 UTC
  $$SELECT public.cleanup_orphaned_churches()$$
);

-- ==============================================================
-- (4) VIEW para auditoria: igrejas órfãs atuais
-- ==============================================================

CREATE OR REPLACE VIEW public.v_orphaned_churches AS
SELECT
  c.id,
  c.name,
  c.created_at,
  c.status,
  u.email AS admin_email,
  u.email_confirmed_at
FROM public.churches c
LEFT JOIN public.user_roles ur ON ur.church_id = c.id AND ur.role = 'admin'
LEFT JOIN auth.users u ON u.id = ur.user_id
WHERE c.deleted_at IS NULL
  AND c.created_at < now() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur2
    JOIN auth.users u2 ON u2.id = ur2.user_id
    WHERE ur2.church_id = c.id
      AND ur2.role = 'admin'
      AND u2.email_confirmed_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.events e WHERE e.church_id = c.id
  );

-- ==============================================================
-- FIM DA MIGRAÇÃO 040
-- ==============================================================
