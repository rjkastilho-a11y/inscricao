import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────

export interface FinancialSummaryData {
  expected_revenue: number;
  income_registrations: number;
  income_offerings: number;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface RegistrationPayment {
  id: string;
  full_name: string;
  event_title: string;
  amount: number;
  lotName: string | null;
  paid_amount: number | null;
  refunded_amount: number | null;
  method: string;
  status: string;
  created_at: string;
}

export interface FinEntry {
  id: string;
  event_id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  entry_date: string;
  created_at: string;
}

export interface RegFilters {
  search?: string;
  status?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FinEntryFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Query Keys ────────────────────────────────────────────────

export const financialKeys = {
  all: ['financial'] as const,
  summary: (eventId?: string) => ['financial', 'summary', eventId] as const,
  registrations: (eventId?: string, filters?: RegFilters) =>
    ['financial', 'registrations', eventId, filters] as const,
  entries: (eventId?: string, type?: string, filters?: FinEntryFilters) =>
    ['financial', 'entries', eventId, type, filters] as const,
};

// ─── Summary (RPC) ────────────────────────────────────────────

async function fetchFinancialSummary(eventId?: string): Promise<FinancialSummaryData> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    p_event_id: eventId ?? null,
  });

  if (error) console.error('[SUPABASE RPC ERROR get_financial_summary]:', error.message, error.details, error.hint);

  const row = data?.[0];
  if (!row) {
    return {
      expected_revenue: 0,
      income_registrations: 0,
      income_offerings: 0,
      total_income: 0,
      total_expenses: 0,
      balance: 0,
    };
  }

  return {
    expected_revenue: Number(row.expected_revenue),
    income_registrations: Number(row.income_registrations),
    income_offerings: Number(row.income_offerings),
    total_income: Number(row.total_income),
    total_expenses: Number(row.total_expenses),
    balance: Number(row.balance),
  };
}

export function useFinancialSummaryData(eventId?: string) {
  return useQuery({
    queryKey: financialKeys.summary(eventId),
    queryFn: () => fetchFinancialSummary(eventId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Registration Payments ─────────────────────────────────────

async function fetchRegistrationPayments(
  eventId: string | null,
  filters: RegFilters
): Promise<RegistrationPayment[]> {
  let query = supabase
    .from('registrations')
    .select('id, full_name, payment_method, payment_status, paid_amount, refunded_amount, created_at, events(title, price), event_lots!lot_id(name, price)')
    .neq('payment_status', 'canceled');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  if (filters.status) {
    query = query.eq('payment_status', filters.status);
  }

  if (filters.method) {
    query = query.eq('payment_method', filters.method);
  }

  if (filters.search) {
    query = query.ilike('full_name', `%${filters.search}%`);
  }

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo + 'T23:59:59');
  }

  const { data, error } = await query;

  if (error) console.error('[SUPABASE QUERY ERROR registrations]:', error.message, error.details, error.hint);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    event_title: (r.events as Record<string, unknown>)?.title as string || '',
    amount: Number((r.event_lots as Record<string, unknown>)?.price ?? (r.events as Record<string, unknown>)?.price ?? 0),
    lotName: (r.event_lots as Record<string, unknown>)?.name as string ?? null,
    paid_amount: r.paid_amount != null ? Number(r.paid_amount) : null,
    refunded_amount: r.refunded_amount != null ? Number(r.refunded_amount) : null,
    method: r.payment_method as string,
    status: r.payment_status as string,
    created_at: r.created_at as string,
  }));
}

export function useRegistrationPayments(eventId: string | null, filters: RegFilters) {
  return useQuery({
    queryKey: financialKeys.registrations(eventId ?? undefined, filters),
    queryFn: () => fetchRegistrationPayments(eventId, filters),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Financial Entries ─────────────────────────────────────────

async function fetchFinancialEntries(
  eventId: string | null,
  type: 'income' | 'expense',
  filters: FinEntryFilters
): Promise<FinEntry[]> {
  let query = supabase
    .from('financial_entries')
    .select('*')
    .eq('type', type)
    .order('entry_date', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.dateFrom) {
    query = query.gte('entry_date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('entry_date', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) console.error('[SUPABASE QUERY ERROR financial_entries]:', error.message, error.details, error.hint);

  return (data ?? []) as FinEntry[];
}

export function useFinancialEntries(
  eventId: string | null,
  type: 'income' | 'expense',
  filters: FinEntryFilters
) {
  return useQuery({
    queryKey: financialKeys.entries(eventId ?? undefined, type, filters),
    queryFn: () => fetchFinancialEntries(eventId, type, filters),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export function useSaveFinEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      editId,
      payload,
    }: {
      editId: string | null;
      payload: {
        event_id: string;
        type: 'income' | 'expense';
        category: string;
        description: string;
        amount: number;
        entry_date: string;
      };
    }) => {
      const { error } = editId
        ? await supabase.from('financial_entries').update(payload).eq('id', editId)
        : await supabase.from('financial_entries').insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteFinEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
