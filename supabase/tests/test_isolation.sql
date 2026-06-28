-- ==============================================================
-- SCRIPT DE TESTE: Isolamento RLS Multi-Tenant
--
-- Execute no SQL Editor do Supabase Dashboard.
-- Cada teste imprime PASS ou FAIL no resultado.
-- ==============================================================

-- ==============================================================
-- SETUP: Criar dados de teste
-- ==============================================================

-- 1. Criar 2 igrejas de teste
INSERT INTO public.churches (id, name, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Igreja Teste A', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'Igreja Teste B', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar 2 usuários de teste (via auth.users — requer service_role)
--    NOTA: Em produção, estes usuários seriam criados via signUp.
--    Para teste, insira manualmente ou use o Supabase Dashboard.
--
--    Para este script, assumimos que os UUIDs existem:
--    user_a = admin da igreja A
--    user_b = admin da igreja B
--    user_super = super_admin
--
--    Ajuste os UUIDs abaixo conforme seu ambiente:
DO $$
DECLARE
  v_user_a UUID := 'b0000000-0000-0000-0000-000000000001';
  v_user_b UUID := 'b0000000-0000-0000-0000-000000000002';
  v_user_super UUID := 'b0000000-0000-0000-0000-000000000003';
  v_event_a UUID;
  v_event_b UUID;
  v_result TEXT;
BEGIN
  -- Criar roles
  INSERT INTO public.user_roles (user_id, role, church_id) VALUES
    (v_user_a, 'admin', 'a0000000-0000-0000-0000-000000000001'),
    (v_user_b, 'admin', 'a0000000-0000-0000-0000-000000000002'),
    (v_user_super, 'super_admin', NULL)
  ON CONFLICT DO NOTHING;

  -- Criar eventos de teste
  INSERT INTO public.events (title, slug, church_id, is_open, price) VALUES
    ('Evento A', 'evento-a', 'a0000000-0000-0000-0000-000000000001', true, 50)
  RETURNING id INTO v_event_a;

  INSERT INTO public.events (title, slug, church_id, is_open, price) VALUES
    ('Evento B', 'evento-b', 'a0000000-0000-0000-0000-000000000002', true, 100)
  RETURNING id INTO v_event_b;

  -- ============================================================
  -- TESTE 1: Admin igreja A NÃO vê eventos da igreja B
  -- ============================================================
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" TO v_user_a::text;
  SET LOCAL "request.jwt.claims" TO json_build_object(
    'app_metadata', json_build_object(
      'church_id', 'a0000000-0000-0000-0000-000000000001',
      'church_role', 'admin'
    )
  )::text;

  IF (SELECT COUNT(*) FROM public.events WHERE id = v_event_b) = 0 THEN
    RAISE NOTICE 'TESTE 1: PASS — Admin igreja A não vê eventos da igreja B';
  ELSE
    RAISE NOTICE 'TESTE 1: FAIL — Admin igreja A conseguiu ver eventos da igreja B';
  END IF;

  RESET ROLE;

  -- ============================================================
  -- TESTE 2: Admin igreja B NÃO vê eventos da igreja A
  -- ============================================================
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" TO v_user_b::text;
  SET LOCAL "request.jwt.claims" TO json_build_object(
    'app_metadata', json_build_object(
      'church_id', 'a0000000-0000-0000-0000-000000000002',
      'church_role', 'admin'
    )
  )::text;

  IF (SELECT COUNT(*) FROM public.events WHERE id = v_event_a) = 0 THEN
    RAISE NOTICE 'TESTE 2: PASS — Admin igreja B não vê eventos da igreja A';
  ELSE
    RAISE NOTICE 'TESTE 2: FAIL — Admin igreja B conseguiu ver eventos da igreja A';
  END IF;

  RESET ROLE;

  -- ============================================================
  -- TESTE 3: Anônimo NÃO inscreve em evento fechado
  -- ============================================================
  UPDATE public.events SET is_open = false WHERE id = v_event_a;

  SET LOCAL ROLE anon;

  BEGIN
    INSERT INTO public.registrations (event_id, full_name, email, church_id)
    VALUES (v_event_a, 'Teste', 'teste@teste.com', 'a0000000-0000-0000-0000-000000000001');
    RAISE NOTICE 'TESTE 3: FAIL — Anônimo conseguiu inserir em evento fechado';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TESTE 3: PASS — Anônimo bloqueado em evento fechado';
  END;

  RESET ROLE;
  UPDATE public.events SET is_open = true WHERE id = v_event_a;

  -- ============================================================
  -- TESTE 4: Anônimo INSERE em evento aberto
  -- ============================================================
  SET LOCAL ROLE anon;

  BEGIN
    INSERT INTO public.registrations (event_id, full_name, email, church_id)
    VALUES (v_event_a, 'Teste Aberto', 'aberto@teste.com', 'a0000000-0000-0000-0000-000000000001');
    RAISE NOTICE 'TESTE 4: PASS — Anônimo inseriu em evento aberto';
    -- Limpar
    DELETE FROM public.registrations WHERE email = 'aberto@teste.com';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TESTE 4: FAIL — Anônimo não conseguiu inserir em evento aberto: %', SQLERRM;
  END;

  RESET ROLE;

  -- ============================================================
  -- TESTE 5: get_dashboard_kpis retorna dados para super_admin
  -- ============================================================
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" TO v_user_super::text;
  SET LOCAL "request.jwt.claims" TO json_build_object(
    'app_metadata', json_build_object(
      'church_id', 'a0000000-0000-0000-0000-000000000001',
      'church_role', 'super_admin'
    )
  )::text;

  IF (SELECT total_events FROM public.get_dashboard_kpis()) > 0 THEN
    RAISE NOTICE 'TESTE 5: PASS — get_dashboard_kpis retorna dados para super_admin';
  ELSE
    RAISE NOTICE 'TESTE 5: FAIL — get_dashboard_kpis retorna 0 para super_admin';
  END IF;

  RESET ROLE;

  -- ============================================================
  -- TESTE 6: get_dashboard_kpis retorna 0 para admin sem dados
  -- ============================================================
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" TO v_user_a::text;
  SET LOCAL "request.jwt.claims" TO json_build_object(
    'app_metadata', json_build_object(
      'church_id', 'a0000000-0000-0000-0000-000000000001',
      'church_role', 'admin'
    )
  )::text;

  -- Admin da igreja A só vê eventos da igreja A
  IF (SELECT COUNT(*) FROM public.events) <= (SELECT COUNT(*) FROM public.events WHERE church_id = 'a0000000-0000-0000-0000-000000000001') THEN
    RAISE NOTICE 'TESTE 6: PASS — Admin igreja A só vê seus eventos';
  ELSE
    RAISE NOTICE 'TESTE 6: FAIL — Admin igreja A vê eventos de outras igrejas';
  END IF;

  RESET ROLE;

  -- ============================================================
  -- LIMPEZA
  -- ============================================================
  DELETE FROM public.events WHERE id IN (v_event_a, v_event_b);
  DELETE FROM public.user_roles WHERE user_id IN (v_user_a, v_user_b, v_user_super);
  DELETE FROM public.churches WHERE id IN (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002'
  );

  RAISE NOTICE '--- Testes de isolamento RLS concluídos ---';
END;
$$;
