export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'refunded';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer' | 'other';
export type UserRole = 'admin' | 'moderator';
export type Gender = 'M' | 'F';
export type ChurchRole =
  | 'Pastor' | 'Missionário' | 'Diácono' | 'Presbítero'
  | 'Líder de Ministério' | 'Obreiro' | 'Membro' | 'Congregado' | 'Outro';

export interface EventLot {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  start_date: string;
  end_date: string;
  max_capacity: number | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  is_open: boolean;
  max_capacity: number | null;
  price: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  registration_number: number;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string | null;
  gender: Gender | null;
  is_christian: boolean;
  is_baptized: boolean | null;
  church: string | null;
  pastor: string | null;
  church_role: ChurchRole | null;
  church_role_other: string | null;
  godparent: string | null;
  godparent_contact: string | null;
  pastoral_authorization: boolean;
  health_info: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_amount: number | null;
  lot_id: string | null;
  private_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offering {
  id: string;
  event_id: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  received_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  event_id: string;
  description: string;
  category: string | null;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardKpis {
  total_events: number;
  open_events: number;
  total_registrations: number;
  paid_registrations: number;
  pending_registrations: number;
  total_revenue: number;
  total_offerings: number;
  total_expenses: number;
  total_income: number;
  balance: number;
}

export interface FinancialSummary {
  income_registrations: number;
  income_offerings: number;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface DashboardEventRow {
  id: string;
  title: string;
  slug: string;
  is_open: boolean;
  start_date: string | null;
  price: number;
  max_capacity: number | null;
  total_registrations: number;
  paid_count: number;
  pending_count: number;
  revenue: number;
}
