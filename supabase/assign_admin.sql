-- =============================================
-- ATRIBUIR ROLE ADMIN (executar no SQL Editor do Supabase Studio)
-- =============================================

-- 1. Descubra seu user ID (troque o email):
SELECT id, email, created_at FROM auth.users WHERE email = 'seu-email@exemplo.com';

-- 2. Atribua a role admin:
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'seu-email@exemplo.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Verifique:
SELECT ur.role, u.email FROM public.user_roles ur JOIN auth.users u ON ur.user_id = u.id;
