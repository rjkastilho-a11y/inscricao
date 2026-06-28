# Arquitetura Multi-Tenant — Kairós Events

## Visão Geral

O sistema usa **JWT Claims + Row Level Security (RLS)** no Supabase para isolamento de tenants (igrejas). Cada igreja é um "tenant" isolado, e os dados são filtrados automaticamente pelo banco de dados.

## Fluxo de Dados

```
┌─────────────┐     signUp      ┌──────────────┐
│  Frontend   │ ──────────────► │  Supabase    │
│  (React)    │                 │  Auth        │
└──────┬──────┘                 └──────┬───────┘
       │                               │
       │  1. raw_user_meta_data        │  2. Trigger on_auth_user_created
       │     { church_name }           │     → Cria church + user_roles
       │                               │
       │  3. user_roles INSERT         │  4. Trigger sync_user_jwt_claims
       │                               │     → Atualiza raw_app_meta_data
       │                               │
       │  5. Nova sessão JWT           │
       │     app_metadata:             │
       │     { church_id, church_role }│
       │                               │
       │  6. Query com RLS             │  7. auth.jwt() verifica claims
       │     SELECT * FROM events      │     → Retorna só dados da igreja
       └───────────────────────────────┘
```

## Tabelas Principais

| Tabela | Descrição | RLS |
|---|---|---|
| `churches` | Tenants (igrejas) | `churches_member_select` + `churches_super_admin` |
| `user_roles` | Papéis dos usuários por igreja | `user_roles_self_read` + `user_roles_admin_manage` + `user_roles_super_admin` |
| `events` | Eventos por igreja | `events_church_isolation` + `events_public_read` |
| `registrations` | Inscrições por evento | `registrations_church_*` + `registrations_public_insert` |
| `financial_entries` | Lançamentos financeiros | `financial_church_*` |
| `group_assignments` | Grupos de inscritos | `groups_church_*` + `groups_super_admin` |
| `event_invites` | Convites | `invites_admin_*` + `invites_public_validate` |
| `event_lots` | Lotes/preços | `lots_church_*` + `lots_public_read` |
| `event_form_fields` | Campos dinâmicos | `fields_public_read` + `fields_admin_*` |

## Triggers

| Trigger | Tabela | Função |
|---|---|---|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` — Cria igreja + admin no signup |
| `trg_events_set_church_id` | `events` | `set_church_id_from_session()` — Preenche church_id |
| `trg_registrations_set_church_id` | `registrations` | `set_church_id_from_event()` — Herda church_id do evento |
| `trg_sync_jwt_claims_insert/update/delete` | `user_roles` | `sync_user_jwt_claims()` — Sincroniza JWT |
| `trg_registrations_check_trial` | `registrations` | `check_trial_registration_limit()` — Limite trial |
| `trg_registrations_rate_limit` | `registrations` | `check_registration_rate_limit()` — Max 5/10min |

## RPCs (Funções SECURITY DEFINER)

| RPC | Descrição | Quem pode chamar |
|---|---|---|
| `get_dashboard_kpis(p_event_id)` | KPIs agregados do dashboard | authenticated (usa JWT para filtrar) |
| `get_financial_summary(p_event_id)` | Resumo financeiro | authenticated |
| `set_active_church(p_church_id)` | Troca contexto do super_admin | super_admin |
| `log_audit_action(p_action, ...)` | Registra ação de auditoria | super_admin |
| `get_first_admin_email(p_church_id)` | Email do admin de uma igreja | authenticated |
| `get_my_registration(p_id, p_email)` | Consulta inscrição pública | anon, authenticated |

## Como Depurar

### 1. Verificar JWT de um usuário

```sql
SELECT
  email,
  raw_app_meta_data ->> 'church_id' AS church_id,
  raw_app_meta_data ->> 'church_role' AS church_role
FROM auth.users
WHERE email = 'usuario@exemplo.com';
```

### 2. Verificar políticas de uma tabela

```sql
SELECT policyname, roles, cmd, qual::text, with_check::text
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;
```

### 3. Simular RLS de um usuário

```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{
  "app_metadata": {
    "church_id": "uuid-da-igreja",
    "church_role": "admin"
  }
}';
SELECT * FROM public.events;
RESET ROLE;
```

### 4. Verificar convergência user_roles vs JWT

```sql
-- Usuários com divergência
SELECT u.email, ur.role, raw_app_meta_data->>'church_role' AS jwt_role
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role != (raw_app_meta_data->>'church_role')::user_role_enum;
```

### 5. Rodar diagnóstico completo

Execute `supabase/check_rls_policies.sql` no SQL Editor.

## Gerações da Arquitetura

| Gerações | Migrações | Abordagem |
|---|---|---|
| Gen 1 (001-004) | `has_role()` function | Single tenant, role-based |
| Gen 2 (005-012) | Subquery em `user_roles` | Multi-tenant com EXISTS subquery |
| Gen 3 (013-028) | Misto | Features adicionadas com padrões inconsistentes |
| Gen 4 (029-036) | JWT Claims + RLS | **Atual.** auth.jwt() em todas as políticas |

## Convenções

### Adicionar tabela com RLS

1. Criar tabela com `church_id UUID NOT NULL REFERENCES churches(id)`
2. Adicionar trigger `BEFORE INSERT` para preencher `church_id`
3. Habilitar RLS: `ALTER TABLE t ENABLE ROW LEVEL SECURITY;`
4. Criar política `FOR ALL TO authenticated USING (church_id = JWT church_id)`
5. Se houver dados públicos: criar política `FOR SELECT TO anon`

### Modificar triggers JWT

1. Sempre usar `SECURITY DEFINER SET search_path = public`
2. Usar `COALESCE(NEW.user_id, OLD.user_id)` para lidar com INSERT/UPDATE/DELETE
3. Backfill necessário após mudanças no trigger

### Adicionar RPC

1. Criar com `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
2. Verificar `auth.jwt()` para role/church_id
3. `GRANT EXECUTE ON FUNCTION ... TO authenticated;`

## Comandos Úteis

```bash
# Rodar migrations
supabase db push

# Verificar migrations pendentes
supabase migration list

# Resetar banco (CUIDADO: apaga dados)
supabase db reset

# Verificar status
supabase status
```
