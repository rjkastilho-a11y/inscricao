import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────

export interface Registration {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string | null;
  gender: string | null;
  is_christian: boolean;
  perfil_fe: string;
  is_baptized: boolean | null;
  church: string | null;
  pastor: string | null;
  church_role: string | null;
  church_role_other: string | null;
  godparent: string | null;
  godparent_contact: string | null;
  pastoral_authorization: boolean;
  health_info: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  payment_method: string;
  payment_status: string;
  private_notes: string | null;
  checked_in: boolean;
  created_at: string;
  event_id: string;
  invite_id?: string | null;
  origin?: string | null;
  events: { title: string; price: number } | null;
  event_lots: { name: string; price: number } | null;
  extra_fields: Record<string, unknown> | null;
  extra_data?: Record<string, any> | null;
  paid_amount?: number | null;
  refunded_amount?: number | null;
}

export interface RegistrationListFilters {
  search?: string;
  statusFilter?: string;
  originFilter?: string;
  churchFilter?: string;
  checkinFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  churchCollected?: boolean;
}

export interface RegistrationListSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface RegistrationListResult {
  data: Registration[];
  totalCount: number;
}

// ─── Query Keys ────────────────────────────────────────────────

export const registrationKeys = {
  all: ['registrations'] as const,
  list: (eventId: string | null, filters: RegistrationListFilters, sort: RegistrationListSort, page: number) =>
    ['registrations', 'list', eventId, filters, sort, page] as const,
  churches: (eventId: string | null) =>
    ['registrations', 'churches', eventId] as const,
};

// ─── Fetch List ────────────────────────────────────────────────

const PAGE_SIZE = 20;

const SORTABLE_FIELDS = ['full_name', 'church', 'payment_status', 'checked_in', 'created_at', 'paid_amount'];

async function fetchRegistrationList(
  eventId: string | null,
  filters: RegistrationListFilters,
  sort: RegistrationListSort,
  page: number
): Promise<RegistrationListResult> {
  let query = supabase
    .from('registrations')
    .select('*, events(title, price), event_lots!lot_id(name, price)', { count: 'exact' });

  if (filters.statusFilter) {
    query = query.eq('payment_status', filters.statusFilter);
  } else {
    query = query.neq('payment_status', 'canceled');
  }

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  if (filters.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%`
    );
  }

  if (filters.churchFilter && filters.churchCollected) {
    query = query.eq('church', filters.churchFilter);
  }

  if (filters.checkinFilter === 'checked') {
    query = query.eq('checked_in', true);
  } else if (filters.checkinFilter === 'pending') {
    query = query.eq('checked_in', false);
  }

  if (filters.originFilter === 'invite') {
    query = query.not('invite_id', 'is', null);
  } else if (filters.originFilter === 'hotsite') {
    query = query.eq('origin', 'public').eq('extra_data->>source', 'hotsite');
  } else if (filters.originFilter === 'public') {
    query = query.eq('origin', 'public').or('extra_data->>source.is.null,extra_data->>source.eq.direct');
  }

  if (filters.dateFrom) {
    query = query.gte('created_at::date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('created_at::date', filters.dateTo);
  }

  const ascending = sort.direction === 'asc';
  const orderField = SORTABLE_FIELDS.includes(sort.field) ? sort.field : 'created_at';
  query = query.order(orderField, { ascending, nullsFirst: false });

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: result, count, error } = await query.range(from, to);

  if (error) {
    console.error('[SUPABASE QUERY ERROR registrations]:', error.message, error.details, error.hint);
    return { data: [], totalCount: 0 };
  }

  let rows = (result ?? []) as unknown as Registration[];

  if (sort.field === 'price') {
    rows = [...rows].sort((a, b) => {
      const priceA = a.event_lots?.price ?? a.events?.price ?? 0;
      const priceB = b.event_lots?.price ?? b.events?.price ?? 0;
      return ascending ? priceA - priceB : priceB - priceA;
    });
  } else if (sort.field === 'percent_paid') {
    rows = [...rows].sort((a, b) => {
      const priceA = a.event_lots?.price ?? a.events?.price ?? 0;
      const priceB = b.event_lots?.price ?? b.events?.price ?? 0;
      const pctA = priceA ? Math.min(100, Math.round((a.paid_amount || 0) / priceA * 100)) : 0;
      const pctB = priceB ? Math.min(100, Math.round((b.paid_amount || 0) / priceB * 100)) : 0;
      return ascending ? pctA - pctB : pctB - pctA;
    });
  }

  return { data: rows, totalCount: count ?? 0 };
}

// ─── Query Hook ────────────────────────────────────────────────

export function useRegistrationList(
  eventId: string | null,
  filters: RegistrationListFilters,
  sort: RegistrationListSort,
  page: number
) {
  return useQuery({
    queryKey: registrationKeys.list(eventId, filters, sort, page),
    queryFn: () => fetchRegistrationList(eventId, filters, sort, page),
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Churches Query ────────────────────────────────────────────

async function fetchChurches(eventId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('church')
    .eq('event_id', eventId)
    .not('church', 'is', null)
    .neq('church', '')
    .neq('payment_status', 'canceled')
    .order('church');

  if (error) {
    console.error('[SUPABASE QUERY ERROR churches]:', error.message);
    return [];
  }

  const unique = [...new Set((data ?? []).map(r => r.church).filter(Boolean) as string[])];
  return unique;
}

export function useRegistrationChurches(eventId: string | null) {
  return useQuery({
    queryKey: registrationKeys.churches(eventId),
    queryFn: () => fetchChurches(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────

function invalidateRegistrationCaches(queryClient: ReturnType<typeof useQueryClient>, eventId?: string | null) {
  queryClient.invalidateQueries({ queryKey: registrationKeys.all });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['financial'] });
}

export function useDeleteRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRegistrationCaches(queryClient);
    },
  });
}

export function useToggleCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('registrations')
        .update({ checked_in: !currentStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registrationKeys.all });
    },
  });
}

export function useBulkDeleteRegistrations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRegistrationCaches(queryClient);
    },
  });
}
