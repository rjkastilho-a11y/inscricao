-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'overdue', 'refunded');
CREATE TYPE payment_method_enum AS ENUM ('pix', 'credit_card', 'cash', 'bank_transfer', 'other');
CREATE TYPE user_role_enum AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE church_role_enum AS ENUM (
  'Pastor', 'Missionário', 'Diácono', 'Presbítero',
  'Líder de Ministério', 'Obreiro', 'Membro', 'Congregado', 'Outro'
);

-- =============================================
-- TABELA: events
-- =============================================
CREATE TABLE public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  location      TEXT,
  is_open       BOOLEAN NOT NULL DEFAULT false,
  max_capacity  INT,
  price         DECIMAL(10,2) DEFAULT 0,
  cover_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: registrations
-- =============================================
CREATE TABLE public.registrations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Dados pessoais
  full_name              TEXT NOT NULL,
  email                  TEXT NOT NULL,
  whatsapp               TEXT NOT NULL,
  birth_date             DATE,
  gender                 TEXT CHECK (gender IN ('M', 'F', 'other')),

  -- Vida cristã
  is_christian           BOOLEAN NOT NULL DEFAULT false,
  is_baptized            BOOLEAN,
  church                 TEXT,
  pastor                 TEXT,
  church_role            church_role_enum,
  church_role_other      TEXT,
  godparent              TEXT,
  godparent_contact      TEXT,
  pastoral_authorization BOOLEAN NOT NULL DEFAULT false,

  -- Saúde e emergência
  health_info            TEXT,
  emergency_contact      TEXT,
  emergency_phone        TEXT,

  -- Pagamento
  payment_method         payment_method_enum DEFAULT 'pix',
  payment_status         payment_status_enum NOT NULL DEFAULT 'pending',

  -- Admin
  private_notes          TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: payments
-- =============================================
CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  amount          DECIMAL(10,2) NOT NULL,
  method          payment_method_enum NOT NULL,
  status          payment_status_enum NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: user_roles
-- =============================================
CREATE TABLE public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    user_role_enum NOT NULL,
  UNIQUE (user_id, role)
);

-- =============================================
-- FUNÇÃO: has_role (SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role_enum)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =============================================
-- TRIGGERS: updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS: habilitar em todas as tabelas
-- =============================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: events
-- =============================================
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT USING (is_open = true);

CREATE POLICY "events_admin_read" ON public.events
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "events_admin_write" ON public.events
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES: registrations
-- =============================================
CREATE POLICY "registrations_public_insert" ON public.registrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND is_open = true
    )
  );

CREATE POLICY "registrations_admin_all" ON public.registrations
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES: user_roles
-- =============================================
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'));
