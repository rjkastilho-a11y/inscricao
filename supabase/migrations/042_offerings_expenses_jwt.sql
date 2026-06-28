-- ==============================================================
-- MIGRAÇÃO 042: Migrar offerings/expenses para JWT isolation
--
-- PROBLEMA:
--   As tabelas offerings e expenses ainda usam subquery em
--   user_roles (padrão legado da migração 011). Todas as outras
--   tabelas foram migradas para auth.jwt() na migração 029.
--
-- SOLUÇÃO:
--   Dropa as 8 políticas legadas e recria usando o padrão JWT:
--   EXISTS (SELECT 1 FROM events e WHERE e.id = <table>.event_id
--           AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid)
-- ==============================================================

-- ==============================================================
-- (1) OFFERINGS — dropar políticas legadas
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'offerings') THEN
    DROP POLICY IF EXISTS "offerings_church_select" ON public.offerings;
    DROP POLICY IF EXISTS "offerings_church_insert" ON public.offerings;
    DROP POLICY IF EXISTS "offerings_church_update" ON public.offerings;
    DROP POLICY IF EXISTS "offerings_church_delete" ON public.offerings;
  END IF;
END;
$$;

-- ==============================================================
-- (2) OFFERINGS — recriar com JWT isolation
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'offerings') THEN
    ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "offerings_church_select" ON public.offerings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = offerings.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "offerings_church_insert" ON public.offerings
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = offerings.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "offerings_church_update" ON public.offerings
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = offerings.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "offerings_church_delete" ON public.offerings
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = offerings.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );
  END IF;
END;
$$;

-- ==============================================================
-- (3) EXPENSES — dropar políticas legadas
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    DROP POLICY IF EXISTS "expenses_church_select" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_church_insert" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_church_update" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_church_delete" ON public.expenses;
  END IF;
END;
$$;

-- ==============================================================
-- (4) EXPENSES — recriar com JWT isolation
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "expenses_church_select" ON public.expenses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = expenses.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "expenses_church_insert" ON public.expenses
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = expenses.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "expenses_church_update" ON public.expenses
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = expenses.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );

    CREATE POLICY "expenses_church_delete" ON public.expenses
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = expenses.event_id
            AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
        )
      );
  END IF;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 042
-- ==============================================================
