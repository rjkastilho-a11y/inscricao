-- ==============================================================
-- MIGRAÇÃO 029: Blindagem RLS com JWT Claims
--
-- 1. Sincroniza church_id + role para raw_app_meta_data (JWT)
-- 2. Remove políticas legadas com brechas de segurança
-- 3. Reconstrói todas as RLS usando auth.jwt()
-- 4. Remove política que vazava registrations para anônimos
-- 5. Adiciona RPC seguro para feedback pós-inscrição
-- ==============================================================

-- ==============================================================
-- PARTE 1: Sincronizar user_roles → auth.users (JWT claims)
-- ==============================================================

CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id  UUID;
  v_church_id  UUID;
  v_role       user_role_enum;
BEGIN
  v_target_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Se o usuário perdeu todas as roles (DELETE), limpa os claims
  IF TG_OP = 'DELETE' THEN
    UPDATE auth.users
    SET raw_app_meta_data =
          raw_app_meta_data - 'church_id' - 'church_role'
    WHERE id = v_target_id;
    RETURN OLD;
  END IF;

  -- Pega a role mais alta do usuário (super_admin > admin > moderator > user)
  SELECT church_id, role INTO v_church_id, v_role
  FROM public.user_roles
  WHERE user_id = v_target_id
  ORDER BY
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin'      THEN 2
      WHEN 'moderator'  THEN 3
      WHEN 'user'       THEN 4
    END
  LIMIT 1;

  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb) ||
        jsonb_build_object(
          'church_id', v_church_id,
          'church_role', v_role
        )
  WHERE id = v_target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_jwt_claims_insert ON public.user_roles;
CREATE TRIGGER trg_sync_jwt_claims_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_jwt_claims();

DROP TRIGGER IF EXISTS trg_sync_jwt_claims_update ON public.user_roles;
CREATE TRIGGER trg_sync_jwt_claims_update
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_jwt_claims();

DROP TRIGGER IF EXISTS trg_sync_jwt_claims_delete ON public.user_roles;
CREATE TRIGGER trg_sync_jwt_claims_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_jwt_claims();

-- Backfill: atualiza todos os usuários existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ur.user_id,
           FIRST_VALUE(ur.church_id) OVER w AS church_id,
           FIRST_VALUE(ur.role) OVER w AS role
    FROM public.user_roles ur
    WINDOW w AS (PARTITION BY ur.user_id
                 ORDER BY CASE ur.role
                   WHEN 'super_admin' THEN 1
                   WHEN 'admin'      THEN 2
                   WHEN 'moderator'  THEN 3
                   WHEN 'user'       THEN 4
                 END)
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) ||
          jsonb_build_object('church_id', r.church_id, 'church_role', r.role)
    WHERE id = r.user_id;
  END LOOP;
END;
$$;

-- ==============================================================
-- PARTE 2: RPC seguro para feedback pós-inscrição (substitui
--           a antiga registrations_public_select que vazava tudo)
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_my_registration(p_registration_id UUID, p_email TEXT)
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  email       TEXT,
  event_title TEXT,
  checked_in  BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.full_name, r.email, e.title, r.checked_in, r.created_at
  FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.id = p_registration_id
    AND LOWER(r.email) = LOWER(p_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_registration TO anon, authenticated;

-- ==============================================================
-- PARTE 3: Limpeza de todas as políticas legadas
-- ==============================================================

DROP POLICY IF EXISTS "isolar_eventos_por_igreja"            ON public.events;
DROP POLICY IF EXISTS "permitir_leitura_publica_anonima"     ON public.events;
DROP POLICY IF EXISTS "events_super_admin_all"               ON public.events;
DROP POLICY IF EXISTS "events_public_select"                 ON public.events;
DROP POLICY IF EXISTS "events_church_select"                 ON public.events;
DROP POLICY IF EXISTS "events_church_insert"                 ON public.events;
DROP POLICY IF EXISTS "events_church_update"                 ON public.events;
DROP POLICY IF EXISTS "events_church_delete"                 ON public.events;
DROP POLICY IF EXISTS "events_admin_all"                     ON public.events;
DROP POLICY IF EXISTS "events_admin_read"                    ON public.events;
DROP POLICY IF EXISTS "events_admin_write"                   ON public.events;

DROP POLICY IF EXISTS "registrations_public_insert"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_public_select"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_church_select"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_church_insert"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_church_update"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_church_delete"          ON public.registrations;
DROP POLICY IF EXISTS "registrations_super_admin_all"        ON public.registrations;
DROP POLICY IF EXISTS "registrations_admin_all"              ON public.registrations;
DROP POLICY IF EXISTS "registrations_select_auth"            ON public.registrations;

DROP POLICY IF EXISTS "financial_entries_church_select"      ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_church_insert"      ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_church_update"      ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_church_delete"      ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_super_admin_all"    ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_admin_all"          ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_auth_select"        ON public.financial_entries;

DROP POLICY IF EXISTS "user_roles_self_read"                 ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_church_admin_all"          ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_super_admin_all"           ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all"                 ON public.user_roles;

DROP POLICY IF EXISTS "churches_super_admin_all"             ON public.churches;
DROP POLICY IF EXISTS "churches_member_select"               ON public.churches;

DROP POLICY IF EXISTS "group_assignments_church_select"      ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_insert"      ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_update"      ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_delete"      ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_super_admin_all"    ON public.group_assignments;

DROP POLICY IF EXISTS "event_invites_admin_select"           ON public.event_invites;
DROP POLICY IF EXISTS "event_invites_admin_insert"           ON public.event_invites;
DROP POLICY IF EXISTS "event_invites_admin_update"           ON public.event_invites;
DROP POLICY IF EXISTS "event_invites_admin_delete"           ON public.event_invites;
DROP POLICY IF EXISTS "event_invites_public_select_by_token" ON public.event_invites;

DROP POLICY IF EXISTS "event_lots_public_select"             ON public.event_lots;
DROP POLICY IF EXISTS "event_lots_admin_all"                 ON public.event_lots;

DROP POLICY IF EXISTS "event_form_fields_select_public"      ON public.event_form_fields;
DROP POLICY IF EXISTS "event_form_fields_insert_admin"       ON public.event_form_fields;
DROP POLICY IF EXISTS "event_form_fields_update_admin"       ON public.event_form_fields;
DROP POLICY IF EXISTS "event_form_fields_delete_admin"       ON public.event_form_fields;

-- ==============================================================
-- PARTE 4: Novas políticas baseadas em JWT
-- ==============================================================

--------------------
-- EVENTS
--------------------
-- Usuário autenticado: vê apenas eventos da sua igreja
CREATE POLICY "events_church_isolation" ON public.events
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

-- Anônimo: vê apenas eventos abertos (público)
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT
  TO anon
  USING (is_open = true);

-- Super admin: vê TUDO
CREATE POLICY "events_super_admin" ON public.events
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- REGISTRATIONS
--------------------
-- Anônimo: pode INSERIR se o evento estiver aberto (autocadastro)
CREATE POLICY "registrations_public_insert" ON public.registrations
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND is_open = true)
  );

-- MEMBRO DA IGREJA: CRUD apenas na própria church_id
CREATE POLICY "registrations_church_select" ON public.registrations
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "registrations_church_insert" ON public.registrations
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "registrations_church_update" ON public.registrations
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "registrations_church_delete" ON public.registrations
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

-- Super admin: bypass
CREATE POLICY "registrations_super_admin" ON public.registrations
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- FINANCIAL_ENTRIES
--------------------
CREATE POLICY "financial_church_select" ON public.financial_entries
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "financial_church_insert" ON public.financial_entries
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "financial_church_update" ON public.financial_entries
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "financial_church_delete" ON public.financial_entries
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id);

CREATE POLICY "financial_super_admin" ON public.financial_entries
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- USER_ROLES
--------------------
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id
    AND (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id
    AND (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
  );

CREATE POLICY "user_roles_super_admin" ON public.user_roles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- CHURCHES
--------------------
CREATE POLICY "churches_member_select" ON public.churches
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = id);

CREATE POLICY "churches_super_admin" ON public.churches
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- GROUP_ASSIGNMENTS
--------------------
CREATE POLICY "groups_church_select" ON public.group_assignments
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "groups_church_insert" ON public.group_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "groups_church_update" ON public.group_assignments
  FOR UPDATE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "groups_church_delete" ON public.group_assignments
  FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "groups_super_admin" ON public.group_assignments
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- EVENT_INVITES
--------------------
CREATE POLICY "invites_admin_select" ON public.event_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "invites_admin_insert" ON public.event_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "invites_admin_update" ON public.event_invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "invites_admin_delete" ON public.event_invites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

-- Público: valida convite por token (apenas para verificar se existe)
CREATE POLICY "invites_public_validate" ON public.event_invites
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "invites_super_admin" ON public.event_invites
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- EVENT_LOTS
--------------------
-- Público: vê lotes apenas de eventos abertos
CREATE POLICY "lots_public_read" ON public.event_lots
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lots.event_id AND e.is_open = true
    )
  );

-- Membro da igreja: CRUD nos próprios lotes
CREATE POLICY "lots_church_select" ON public.event_lots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lots.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "lots_church_insert" ON public.event_lots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lots.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "lots_church_update" ON public.event_lots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lots.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "lots_church_delete" ON public.event_lots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lots.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

CREATE POLICY "lots_super_admin" ON public.event_lots
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

--------------------
-- EVENT_FORM_FIELDS
--------------------
-- Público + autenticado: pode ler campos (necessário para formulários)
CREATE POLICY "fields_public_read" ON public.event_form_fields
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin: gerenciar campos apenas dos próprios eventos (ou campos default)
CREATE POLICY "fields_admin_insert" ON public.event_form_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
    AND (
      event_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_id
          AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
      )
    )
  );

CREATE POLICY "fields_admin_update" ON public.event_form_fields
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
    AND (
      event_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_id
          AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
      )
    )
  );

CREATE POLICY "fields_admin_delete" ON public.event_form_fields
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
    AND (
      event_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_id
          AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
      )
    )
  );

-- ==============================================================
-- PARTE 5: Atualizar SECURITY DEFINER functions para usar JWT
--           em vez de subquery (performance + consistência)
-- ==============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_events        BIGINT,
  open_events         BIGINT,
  total_registrations BIGINT,
  paid_registrations  BIGINT,
  pending_registrations BIGINT,
  total_revenue       DECIMAL,
  total_offerings     DECIMAL,
  total_expenses      DECIMAL,
  total_income        DECIMAL,
  balance             DECIMAL
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
  v_is_super  := public.is_super_admin();
  v_church_id := (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid;

  RETURN QUERY
  WITH
  ev AS (
    SELECT e.id, e.price, e.is_open
    FROM public.events e
    WHERE (v_is_super OR e.church_id = v_church_id)
      AND (p_event_id IS NULL OR e.id = p_event_id)
  ),
  reg AS (
    SELECT r.event_id, r.payment_status, e.price
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    WHERE (v_is_super OR r.church_id = v_church_id)
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
       AND (v_is_super OR church_id = v_church_id)
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
  v_is_super  := public.is_super_admin();
  v_church_id := (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid;

  RETURN QUERY
  WITH
  paid_reg AS (
    SELECT COALESCE(SUM(ev.price), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    WHERE r.payment_status = 'paid'
      AND (v_is_super OR ev.church_id = v_church_id)
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = o.event_id
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
-- FIM DA MIGRAÇÃO 029
-- ==============================================================
