import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
  refunded_count: number;
  revenue: number;
  expected_revenue: number;
}

async function fetchDashboardKpis(eventId?: string): Promise<DashboardKpis> {
  const { data, error } = await supabase.rpc('get_dashboard_kpis', {
    p_event_id: eventId ?? null,
  });

  if (error) console.error('[SUPABASE RPC ERROR get_dashboard_kpis]:', error.message, error.details, error.hint);

  const row = data?.[0];
  if (!row) {
    return {
      total_events: 0,
      open_events: 0,
      total_registrations: 0,
      paid_registrations: 0,
      pending_registrations: 0,
      total_revenue: 0,
      total_offerings: 0,
      total_expenses: 0,
      total_income: 0,
      balance: 0,
    };
  }

  return {
    total_events: Number(row.total_events),
    open_events: Number(row.open_events),
    total_registrations: Number(row.total_registrations),
    paid_registrations: Number(row.paid_registrations),
    pending_registrations: Number(row.pending_registrations),
    total_revenue: Number(row.total_revenue),
    total_offerings: Number(row.total_offerings),
    total_expenses: Number(row.total_expenses),
    total_income: Number(row.total_income),
    balance: Number(row.balance),
  };
}

async function fetchDashboardPerEvent(eventId?: string): Promise<DashboardEventRow[]> {
  let query = supabase
    .from('v_dashboard_per_event')
    .select('*');

  if (eventId) {
    query = query.eq('id', eventId);
  }

  const { data, error } = await query;

  if (error) console.error('[SUPABASE VIEW ERROR v_dashboard_per_event]:', error.message, error.details, error.hint);
  return (data ?? []).map((row) => ({
    ...row,
    price: Number(row.price),
    revenue: Number(row.revenue),
    refunded_count: Number(row.refunded_count ?? 0),
    expected_revenue: Number(row.expected_revenue ?? 0),
  }));
}

export function useDashboardKpis(eventId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', eventId],
    queryFn: () => fetchDashboardKpis(eventId),
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardPerEvent(eventId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'per-event', eventId],
    queryFn: () => fetchDashboardPerEvent(eventId),
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
