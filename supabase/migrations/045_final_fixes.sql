-- ==============================================================
-- MIGRAÇÃO 045: Final fixes — RPCs, soft delete, security
--
-- N1: Restaurar COALESCE(el.price, e.price) nas RPCs do dashboard
-- N2: Adicionar deleted_at IS NULL nas RPCs (SECURITY DEFINER bypass RLS)
-- N3: soft_delete_event() setar is_open = false
-- N4: has_role() adicionar SET search_path = public
-- N5: v_dashboard_stats usar COALESCE para lot pricing
-- ==============================================================

-- ==============================================================
-- N1 + N2: Reescrever get_dashboard_kpis com lot pricing + deleted_at
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
DECLARE
  v_is_super   BOOLEAN;
  v_church_id  UUID;
BEGIN
  v_is_super  := (auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin';
  v_church_id := (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid;

  RETURN QUERY
  WITH
  ev AS (
    SELECT e.id, e.price, e.is_open
    FROM public.events e
    WHERE e.deleted_at IS NULL
      AND (v_is_super OR e.church_id = v_church_id)
      AND (p_event_id IS NULL OR e.id = p_event_id)
  ),
  reg AS (
    SELECT r.event_id, r.payment_status,
           COALESCE(el.price, e.price) AS effective_price
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.deleted_at IS NULL
      AND (v_is_super OR r.church_id = v_church_id)
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
     WHERE deleted_at IS NULL
       AND is_open = true
       AND (v_is_super OR church_id = v_church_id)
       AND (p_event_id IS NULL OR id = p_event_id)),
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status = 'paid'),
    COUNT(*) FILTER (WHERE payment_status = 'pending'),
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0),
    off.total,
    exp.total,
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0) + off.total,
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0) + off.total - exp.total
  FROM reg, off, exp;
END;
$$;

-- ==============================================================
-- N1 + N2: Reescrever get_financial_summary com lot pricing + deleted_at
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  income_registrations DECIMAL,
  income_offerings     DECIMAL,
  total_income         DECIMAL,
  total_expenses       DECIMAL,
  balance              DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_super   BOOLEAN;
  v_church_id  UUID;
BEGIN
  v_is_super  := (auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin';
  v_church_id := (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid;

  RETURN QUERY
  WITH
  paid_reg AS (
    SELECT COALESCE(SUM(COALESCE(el.price, ev.price)), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.payment_status = 'paid'
      AND r.deleted_at IS NULL
      AND ev.deleted_at IS NULL
      AND (v_is_super OR ev.church_id = v_church_id)
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = o.event_id
        AND e.deleted_at IS NULL
        AND (v_is_super OR e.church_id = v_church_id)
    )
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.expenses ex
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ex.event_id
        AND e.deleted_at IS NULL
        AND (v_is_super OR e.church_id = v_church_id)
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
-- N3: soft_delete_event() setar is_open = false
-- ==============================================================

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

  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE event_id = p_event_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Não é possível deletar evento com inscrições ativas. Cancele as inscrições primeiro.';
  END IF;

  UPDATE public.events
  SET deleted_at = now(),
      is_open = false
  WHERE id = p_event_id;
END;
$$;

-- Restore_event também deve restaurar is_open (para o estado anterior)
-- Não sabemos o estado anterior, então restauramos como false (seguro)
CREATE OR REPLACE FUNCTION public.restore_event(p_event_id UUID)
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
    RAISE EXCEPTION 'Sem permissão para restaurar este evento';
  END IF;

  UPDATE public.events
  SET deleted_at = NULL
  WHERE id = p_event_id;
END;
$$;

-- ==============================================================
-- N4: has_role() adicionar SET search_path = public
-- ==============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role_enum)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ==============================================================
-- N5: Recriar v_dashboard_stats com COALESCE para lot pricing
-- ==============================================================

DROP MATERIALIZED VIEW IF EXISTS public.v_dashboard_stats;

CREATE MATERIALIZED VIEW public.v_dashboard_stats AS
SELECT
  e.church_id,
  e.id AS event_id,
  e.title,
  e.is_open,
  e.start_date,
  e.price,
  e.max_capacity,
  COUNT(r.id) AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'paid') AS paid_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'pending') AS pending_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'refunded') AS refunded_count,
  COALESCE(SUM(r.paid_amount) FILTER (WHERE r.payment_status = 'paid'), 0) AS actual_revenue,
  COALESCE(SUM(COALESCE(el.price, e.price)) FILTER (WHERE r.payment_status = 'paid'), 0) AS expected_revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id AND r.deleted_at IS NULL
LEFT JOIN public.event_lots el ON el.id = r.lot_id
WHERE e.deleted_at IS NULL
GROUP BY e.church_id, e.id, e.title, e.is_open, e.start_date, e.price, e.max_capacity;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_dashboard_stats_event
  ON public.v_dashboard_stats (event_id);

CREATE INDEX IF NOT EXISTS idx_v_dashboard_stats_church
  ON public.v_dashboard_stats (church_id);

-- ==============================================================
-- FIM DA MIGRAÇÃO 045
-- ==============================================================
