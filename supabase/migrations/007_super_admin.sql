-- ==============================================================
-- MIGRATION 007: Super Admin — painel master do dono do SaaS
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

-- ==============================================================
-- (1) ADICIONAR ROLE super_admin AO ENUM
-- ==============================================================
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'super_admin';

-- ==============================================================
-- (2) FUNÇÃO AUXILIAR is_super_admin()
-- ==============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
END;
$$;

-- ==============================================================
-- (3) HABILITAR RLS NA TABELA churches
-- ==============================================================
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_super_admin_all"           ON public.churches;
DROP POLICY IF EXISTS "churches_member_select"             ON public.churches;

-- Super admin: controle total sobre todas as igrejas
CREATE POLICY "churches_super_admin_all" ON public.churches
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Membro autenticado: pode ver apenas sua própria igreja
CREATE POLICY "churches_member_select" ON public.churches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = churches.id
    )
  );

-- ==============================================================
-- (4) SUPER ADMIN BYPASS — EVENTS
-- ==============================================================
DROP POLICY IF EXISTS "events_super_admin_all" ON public.events;

CREATE POLICY "events_super_admin_all" ON public.events
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ==============================================================
-- (5) SUPER ADMIN BYPASS — REGISTRATIONS
-- ==============================================================
DROP POLICY IF EXISTS "registrations_super_admin_all" ON public.registrations;

CREATE POLICY "registrations_super_admin_all" ON public.registrations
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ==============================================================
-- (6) SUPER ADMIN BYPASS — FINANCIAL_ENTRIES
-- ==============================================================
DROP POLICY IF EXISTS "financial_entries_super_admin_all" ON public.financial_entries;

CREATE POLICY "financial_entries_super_admin_all" ON public.financial_entries
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ==============================================================
-- (7) SUPER ADMIN BYPASS — USER_ROLES
-- ==============================================================
DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;

CREATE POLICY "user_roles_super_admin_all" ON public.user_roles
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ==============================================================
-- (8) ATRIBUIR SUPER_ADMIN AO DONO DO SISTEMA
-- ==============================================================
-- Ajuste o e-mail abaixo para o e-mail do seu usuário dono do SaaS.
-- Rode este bloco UMA VEZ após criar seu usuário pelo login normal.
-- Caso você já tenha um usuário admin, descomente e ajuste o WHERE:
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'super_admin'::user_role_enum
-- FROM auth.users
-- WHERE email = 'seu-email@exemplo.com'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ==============================================================
-- FIM DA MIGRAÇÃO 007
-- ==============================================================
