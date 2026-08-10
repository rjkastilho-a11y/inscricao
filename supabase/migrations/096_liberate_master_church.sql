-- ==============================================================
-- MIGRATION 096: Libera a igreja Master (Kairós Legacy)
-- Conta master vira Annual + VIP, ativa e sem trial.
-- Resolve a igreja dinamicamente: a que o super_admin master
-- está vinculado (não depende de UUID fixo nem do nome).
-- Idempotente: reexecutar só reafirma os mesmos valores.
-- Depende de: 094 (plan_type/is_vip + public.master_email())
-- ==============================================================

UPDATE public.churches c
SET plan_type          = 'annual',
    is_vip             = true,
    status             = 'active',
    is_active          = true,
    trial_ends_at      = NULL,
    trial_suspended_at = NULL
WHERE c.id IN (
  SELECT ur.church_id
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE lower(u.email) = lower(public.master_email())
    AND ur.role = 'super_admin'
    AND ur.church_id IS NOT NULL
);

-- ==============================================================
-- FIM DA MIGRAÇÃO 096
-- ==============================================================
