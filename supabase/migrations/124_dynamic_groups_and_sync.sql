-- ==============================================================
-- Kairós Events — Divisão Dinâmica e Sincronização de Grupos
-- ==============================================================

-- 1. Atualizar a função existente para aceitar tamanho dinâmico
DROP FUNCTION IF EXISTS public.gerar_grupos_evento(uuid);

CREATE OR REPLACE FUNCTION public.gerar_grupos_evento(p_event_id uuid, p_tamanho_grupo integer DEFAULT 6)
 RETURNS TABLE(grupo_numero integer, genero_saida text, integrantes jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 1. Validação de Segurança: dono/admin do evento (paridade com RLS da migration 013)
  IF NOT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = p_event_id
        AND e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Usuário sem permissão para alterar este evento.';
  END IF;

  -- 2. Integridade: limites no banco de dados
  IF p_tamanho_grupo < 2 OR p_tamanho_grupo > 20 THEN
    RAISE EXCEPTION 'O tamanho do grupo deve estar entre 2 e 20.';
  END IF;

  RETURN QUERY
  WITH inscritos_processados AS (
    SELECT
      full_name,
      COALESCE(NULLIF(UPPER(LEFT(TRIM(gender), 1)), ''), 'N') as genero_final
    FROM public.registrations
    WHERE event_id = p_event_id AND deleted_at IS NULL
  ),
  inscritos_embaralhados AS (
    SELECT
      full_name,
      genero_final,
      (row_number() OVER (PARTITION BY genero_final ORDER BY random()) - 1) / p_tamanho_grupo AS grupo_idx
    FROM inscritos_processados
  )
  SELECT
    (grupo_idx + 1)::INT,
    genero_final::TEXT,
    jsonb_agg(jsonb_build_object('nome', full_name))::JSONB
  FROM inscritos_embaralhados
  GROUP BY grupo_idx, genero_final
  ORDER BY genero_final, grupo_idx;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerar_grupos_evento(uuid, integer) TO authenticated;

-- 2. Nova função para Sincronização Incremental (Aloca apenas os novatos)
CREATE OR REPLACE FUNCTION public.sincronizar_grupos_evento(p_event_id uuid, p_tamanho_grupo integer DEFAULT 6)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_reg RECORD;
    v_group_id UUID;
BEGIN
    -- 1. Validação de Segurança: dono/admin do evento (paridade com RLS da migration 013)
    IF NOT (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id
          AND e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
      )
    ) THEN
      RAISE EXCEPTION 'Acesso negado: Usuário sem permissão para alterar este evento.';
    END IF;

    -- 2. Integridade: limites no banco de dados
    IF p_tamanho_grupo < 2 OR p_tamanho_grupo > 20 THEN
      RAISE EXCEPTION 'O tamanho do grupo deve estar entre 2 e 20.';
    END IF;

    -- Itera sobre os inscritos que ainda não têm grupo
    FOR v_reg IN
        SELECT id, COALESCE(NULLIF(UPPER(LEFT(TRIM(gender), 1)), ''), 'N') as genero_final
        FROM public.registrations
        WHERE event_id = p_event_id AND group_assignment_id IS NULL AND deleted_at IS NULL
    LOOP
        v_group_id := NULL;

        -- Tenta encontrar um grupo existente do MESMO gênero com vagas
        SELECT ga.id INTO v_group_id
        FROM public.group_assignments ga
        LEFT JOIN public.registrations r ON r.group_assignment_id = ga.id AND r.deleted_at IS NULL
        WHERE ga.event_id = p_event_id
          AND ga.genero = v_reg.genero_final
        GROUP BY ga.id
        HAVING COUNT(r.id) < p_tamanho_grupo
        ORDER BY ga.grupo_numero ASC
        LIMIT 1;

        -- Se não houver vaga em grupo existente, cria um novo
        IF v_group_id IS NULL THEN
            INSERT INTO public.group_assignments (event_id, grupo_numero, genero)
            VALUES (
                p_event_id,
                COALESCE((SELECT MAX(grupo_numero) FROM public.group_assignments WHERE event_id = p_event_id), 0) + 1,
                v_reg.genero_final
            ) RETURNING id INTO v_group_id;
        END IF;

        -- Aloca o inscrito ao grupo
        UPDATE public.registrations
        SET group_assignment_id = v_group_id
        WHERE id = v_reg.id;
    END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sincronizar_grupos_evento(uuid, integer) TO authenticated;
