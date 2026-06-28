-- ==============================================================
-- MIGRAÇÃO 035: Tabela audit_log para ações de super_admin
--
-- Registra ações sensíveis: toggle is_active, criação de igreja,
-- troca de contexto, etc. Apenas super_admin pode ler.
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         UUID NOT NULL REFERENCES auth.users(id),
  action           TEXT NOT NULL,
  target_church_id UUID REFERENCES public.churches(id),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Log de auditoria para ações sensíveis do super_admin.';

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);

-- RLS: apenas super_admin pode ler, authenticated pode inserir
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin');

-- RPC para inserir log de auditoria (chamada pelo frontend)
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_action           TEXT,
  p_target_church_id UUID DEFAULT NULL,
  p_metadata         JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'church_role') != 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super_admin pode registrar ações de auditoria';
  END IF;

  INSERT INTO public.audit_log (actor_id, action, target_church_id, metadata)
  VALUES (auth.uid(), p_action, p_target_church_id, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_action TO authenticated;

-- ==============================================================
-- FIM DA MIGRAÇÃO 035
-- ==============================================================
