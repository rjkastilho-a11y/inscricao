-- ==============================================================
-- MIGRAÇÃO 037: Rate limiting para signup + webhook
--
-- 1. Tabela rate_limits para controle de taxa
-- 2. Trigger para limitar signup: max 3 contas por IP por hora
-- 3. Função para rate limit de webhook
-- ==============================================================

-- ==============================================================
-- (1) TABELA RATE_LIMITS
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,        -- ex: 'signup:ip:1.2.3.4' ou 'webhook:reg:uuid'
  action      TEXT NOT NULL,        -- ex: 'signup', 'webhook'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_action
  ON public.rate_limits (key, action, created_at DESC);

-- RLS: tabela não exposta ao cliente (apenas service_role acessa)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Nenhum SELECT/INSERT/UPDATE/DELETE permitido via RLS
-- (apenas service_role e SECURITY DEFINER functions acessam)

-- ==============================================================
-- (2) FUNÇÃO: verificar rate limit
-- ==============================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key    TEXT,
  p_action TEXT,
  p_limit  INT DEFAULT 5,
  p_window INTERVAL DEFAULT '1 hour'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limits
  WHERE key = p_key
    AND action = p_action
    AND created_at > now() - p_window;

  IF v_count >= p_limit THEN
    RETURN false; -- bloqueado
  END IF;

  -- Registrar a ação
  INSERT INTO public.rate_limits (key, action)
  VALUES (p_key, p_action);

  RETURN true; -- permitido
END;
$$;

-- ==============================================================
-- (3) FUNÇÃO: limpar rate limits antigos (cron manual)
-- ==============================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 037
-- ==============================================================
