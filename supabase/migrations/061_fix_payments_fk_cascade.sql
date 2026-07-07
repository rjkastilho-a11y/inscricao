-- =============================================
-- 061: Volta FK payments → registrations para CASCADE
-- Permite deletar inscrições que tenham pagamentos
-- =============================================

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_registration_id_fkey,
  ADD CONSTRAINT payments_registration_id_fkey
    FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
    ON DELETE CASCADE;
