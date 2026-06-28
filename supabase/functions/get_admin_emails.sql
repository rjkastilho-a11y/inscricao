-- Cria uma função que retorna o email do primeiro admin de uma igreja
-- Usa SECURITY DEFINER para acessar auth.users, que não é exposto ao cliente
CREATE OR REPLACE FUNCTION public.get_first_admin_email(p_church_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email::text
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.church_id = p_church_id
    AND ur.role = 'admin'
  LIMIT 1;
$$;
