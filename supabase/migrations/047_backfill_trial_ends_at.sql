-- ==============================================================
-- MIGRAÇÃO 047: Backfill de trial_ends_at para igrejas existentes
--
-- Define trial_ends_at = created_at + 14 dias para igrejas
-- que são 'trial' e ainda não têm trial_ends_at definido.
-- ==============================================================

UPDATE public.churches
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE status = 'trial'
  AND deleted_at IS NULL
  AND trial_ends_at IS NULL;

-- ==============================================================
-- FIM DA MIGRAÇÃO 047
-- ==============================================================
