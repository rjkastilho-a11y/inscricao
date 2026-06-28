-- ==============================================================
-- MIGRAÇÃO 030: Remove bypass super_admin de tabelas de negócio
--
-- 1. Remove políticas super_admin de events, registrations,
--    financial_entries, group_assignments, event_invites, event_lots
-- 2. Mantém bypass em tabelas mestre (churches, user_roles)
-- 3. Atualiza SECURITY DEFINER functions para usar user_roles
-- 4. Adiciona índice para performance das subqueries
-- ==============================================================

-- ==============================================================
-- PARTE 1: Remove políticas de bypass super_admin
-- ==============================================================

DROP POLICY IF EXISTS "Public can view open events"   ON public.events;
DROP POLICY IF EXISTS "events_super_admin"          ON public.events;
DROP POLICY IF EXISTS "registrations_super_admin"    ON public.registrations;
DROP POLICY IF EXISTS "financial_super_admin"        ON public.financial_entries;
DROP POLICY IF EXISTS "groups_super_admin"           ON public.group_assignments;
DROP POLICY IF EXISTS "invites_super_admin"          ON public.event_invites;
DROP POLICY IF EXISTS "lots_super_admin"             ON public.event_lots;

-- As políticas abaixo PERMANECEM (tabelas mestre do Painel Mestre):
--   churches_super_admin       → super_admin gerencia igrejas
--   user_roles_super_admin     → super_admin gerencia permissões
--   user_roles_self_read       → cada usuário vê suas roles

-- ==============================================================
-- PARTE 2: Atualiza get_dashboard_kpis para usar user_roles
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_events          BIGINT,
  open_events           BIGINT,
  total_registrations   BIGINT,
  paid_registrations    BIGINT,
  pending_registrations BIGINT,
  total_revenue         DECIMAL,
  total_offerings       DECIMAL,
  total_expenses        DECIMAL,
  total_income          DECIMAL,
  balance               DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  ev AS (
    SELECT e.id, e.price, e.is_open
    FROM public.events e
    WHERE EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND church_id = e.church_id
      )
      AND (p_event_id IS NULL OR e.id = p_event_id)
  ),
  reg AS (
    SELECT r.event_id, r.payment_status, e.price
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    WHERE EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND church_id = r.church_id
      )
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (SELECT 1 FROM ev e WHERE e.id = o.event_id)
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.expenses ex
    WHERE EXISTS (SELECT 1 FROM ev e WHERE e.id = ex.event_id)
      AND (p_event_id IS NULL OR ex.event_id = p_event_id)
  )
  SELECT
    (SELECT COUNT(*) FROM ev),
    (SELECT COUNT(*) FROM public.events
     WHERE is_open = true
       AND EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_id = auth.uid()
           AND church_id = events.church_id
       )
       AND (p_event_id IS NULL OR id = p_event_id)),
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status = 'paid'),
    COUNT(*) FILTER (WHERE payment_status = 'pending'),
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0),
    off.total,
    exp.total,
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0) + off.total,
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0) + off.total - exp.total
  FROM reg, off, exp;
END;
$$;

-- ==============================================================
-- PARTE 3: Atualiza get_financial_summary para usar user_roles
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  income_registrations  DECIMAL,
  income_offerings      DECIMAL,
  total_income          DECIMAL,
  total_expenses        DECIMAL,
  balance               DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  paid_reg AS (
    SELECT COALESCE(SUM(ev.price), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    WHERE r.payment_status = 'paid'
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND church_id = ev.church_id
      )
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = o.event_id
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND church_id = e.church_id
        )
    )
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.expenses ex
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ex.event_id
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND church_id = e.church_id
        )
    )
      AND (p_event_id IS NULL OR ex.event_id = p_event_id)
  )
  SELECT
    paid_reg.total,
    off.total,
    paid_reg.total + off.total,
    exp.total,
    paid_reg.total + off.total - exp.total
  FROM paid_reg, off, exp;
END;
$$;

-- ==============================================================
-- PARTE 4: Índice para performance das subqueries em user_roles
-- ==============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_church
  ON public.user_roles (user_id, church_id);

-- ==============================================================
-- FIM DA MIGRAÇÃO 030
-- ==============================================================
