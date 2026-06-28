-- ==============================================================
-- SCRIPT DE DIAGNÓSTICO RLS
-- Execute no SQL Editor do Supabase Dashboard
-- ==============================================================

-- 1. Listar TODAS as políticas de todas as tabelas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Verificar políticas ESPECÍFICAS da tabela events
SELECT
  policyname,
  roles,
  cmd,
  qual::text,
  with_check::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events'
ORDER BY policyname;

-- 3. Verificar se há políticas que permitem SELECT sem church_id
--    (auditoria rápida em todas as tabelas)
SELECT
  tablename,
  policyname,
  roles,
  qual::text
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND qual::text NOT ILIKE '%church_id%';

-- 4. Verificar church_id nos dados
SELECT church_id, COUNT(*) AS total
FROM public.events
GROUP BY church_id;

-- 5. Verificar usuários e suas roles
SELECT
  u.email,
  ur.role,
  c.name AS church_name,
  ur.church_id
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.churches c ON c.id = ur.church_id
ORDER BY c.name, ur.role;

-- 6. Verificar triggers ativos de sync JWT
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'user_roles'
ORDER BY trigger_name;

-- 7. Verificar raw_app_meta_data dos usuários
--    (confirme se church_id e church_role estão populados)
SELECT
  email,
  raw_app_meta_data ->> 'church_id' AS jwt_church_id,
  raw_app_meta_data ->> 'church_role' AS jwt_role
FROM auth.users
WHERE raw_app_meta_data ->> 'church_role' IS NOT NULL
ORDER BY email;

-- 8. Verificar se há tabelas sem RLS habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- 9. Verificar convergência: user_roles vs JWT claims
--    (usuários com divergência entre role na tabela e role na JWT)
SELECT
  u.email,
  ur.role AS table_role,
  raw_app_meta_data ->> 'church_role' AS jwt_role,
  ur.church_id AS table_church_id,
  (raw_app_meta_data ->> 'church_id')::uuid AS jwt_church_id
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role != (raw_app_meta_data ->> 'church_role')::user_role_enum
   OR ur.church_id IS DISTINCT FROM (raw_app_meta_data ->> 'church_id')::uuid;

-- 10. Testar o RLS manualmente (simula o usuário atual)
--     Descomente e ajuste o UUID do usuário para testar:
--
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" TO '<user-uuid-aqui>';
-- SET LOCAL "request.jwt.claims" TO '{"app_metadata": {"church_id": "<church-uuid>", "church_role": "admin"}}';
-- SELECT * FROM public.events;
-- RESET ROLE;
