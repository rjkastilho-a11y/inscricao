-- =============================================
-- 058: RLS policies para payments (admin read/write/delete)
-- =============================================

-- Ler pagamentos (admin)
CREATE POLICY "payments_admin_read" ON public.payments
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Inserir pagamentos (admin)
CREATE POLICY "payments_admin_insert" ON public.payments
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Deletar pagamentos (admin)
CREATE POLICY "payments_admin_delete" ON public.payments
  FOR DELETE USING (has_role(auth.uid(), 'admin'));
