import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  FinancialSummary,
  Registration,
  Offering,
  Expense,
  PaymentMethod,
} from '../types';

// ─── Summary ─────────────────────────────────────────────────────

async function fetchFinancialSummary(eventId?: string): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    p_event_id: eventId ?? null,
  });

  if (error) throw error;

  const row = data?.[0];
  if (!row) {
    return {
      income_registrations: 0,
      income_offerings: 0,
      total_income: 0,
      total_expenses: 0,
      balance: 0,
    };
  }

  return {
    income_registrations: Number(row.income_registrations),
    income_offerings: Number(row.income_offerings),
    total_income: Number(row.total_income),
    total_expenses: Number(row.total_expenses),
    balance: Number(row.balance),
  };
}

export function useFinancialSummary(eventId?: string) {
  return useQuery({
    queryKey: ['financial', 'summary', eventId],
    queryFn: () => fetchFinancialSummary(eventId),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Inscrições Pagas ──────────────────────────────────────────

interface PaidRegistrationsParams {
  eventId?: string;
  search?: string;
  method?: string;
}

async function fetchPaidRegistrations(
  params: PaidRegistrationsParams
): Promise<Registration[]> {
  let query = supabase
    .from('registrations')
    .select('*')
    .eq('payment_status', 'paid');

  if (params.eventId) {
    query = query.eq('event_id', params.eventId);
  }

  if (params.search) {
    query = query.or(
      `full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`
    );
  }

  if (params.method) {
    query = query.eq('payment_method', params.method as PaymentMethod);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export function usePaidRegistrations(params: PaidRegistrationsParams = {}) {
  return useQuery({
    queryKey: ['financial', 'paid-registrations', params],
    queryFn: () => fetchPaidRegistrations(params),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Ofertas ───────────────────────────────────────────────────

async function fetchOfferings(eventId?: string): Promise<Offering[]> {
  let query = supabase
    .from('offerings')
    .select('*')
    .order('received_at', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export function useOfferings(eventId?: string) {
  return useQuery({
    queryKey: ['offerings', eventId],
    queryFn: () => fetchOfferings(eventId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateOffering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      newOffering: Omit<Offering, 'id' | 'created_at' | 'updated_at'>
    ) => {
      const { data, error } = await supabase
        .from('offerings')
        .insert(newOffering)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateOffering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Offering> & { id: string }) => {
      const { data, error } = await supabase
        .from('offerings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteOffering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Saídas ────────────────────────────────────────────────────

async function fetchExpenses(eventId?: string): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('paid_at', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export function useExpenses(eventId?: string) {
  return useQuery({
    queryKey: ['expenses', eventId],
    queryFn: () => fetchExpenses(eventId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      newExpense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
    ) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(newExpense)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Exportação CSV ────────────────────────────────────────────

export async function useExportFinancialCsv(eventId?: string) {
  const [offerings, expenses] = await Promise.all([
    fetchOfferings(eventId),
    fetchExpenses(eventId),
  ]);

  const { data: paidRegs } = await supabase
    .from('registrations')
    .select('*')
    .eq('payment_status', 'paid')
    .eq(eventId ? 'event_id' : 'id', eventId ?? '');

  const header = ['Tipo', 'Descrição', 'Valor', 'Método', 'Data'];
  const rows: string[][] = [];

  (paidRegs ?? []).forEach((r: Registration) => {
    rows.push([
      'Inscrição',
      r.full_name,
      '0', // price depende do evento — buscamos separadamente se precisar
      r.payment_method,
      new Date(r.created_at).toLocaleDateString('pt-BR'),
    ]);
  });

  offerings.forEach((o: Offering) => {
    rows.push([
      'Oferta',
      o.description,
      String(Number(o.amount).toFixed(2)),
      o.method,
      new Date(o.received_at).toLocaleDateString('pt-BR'),
    ]);
  });

  expenses.forEach((e: Expense) => {
    rows.push([
      'Saída',
      e.description,
      String(Number(e.amount).toFixed(2)),
      e.method,
      new Date(e.paid_at).toLocaleDateString('pt-BR'),
    ]);
  });

  const csvContent = [
    header.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `financeiro${eventId ? `-${eventId}` : ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Exportação PDF ────────────────────────────────────────────

export async function useExportFinancialPdf(eventId?: string) {
  // jsPDF + jspdf-autotable são importados dinamicamente
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const summary = await fetchFinancialSummary(eventId);
  const offerings = await fetchOfferings(eventId);
  const expenses = await fetchExpenses(eventId);

  const { data: paidRegs } = await supabase
    .from('registrations')
    .select('*, events!inner(price)')
    .eq('payment_status', 'paid')
    .eq(eventId ? 'event_id' : 'id', eventId ?? '');

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Relatório Financeiro', 14, 22);

  // Resumo Financeiro
  doc.setFontSize(14);
  doc.text('Resumo Financeiro', 14, 35);

  doc.setFontSize(10);
  const summaryRows = [
    ['Entradas (Inscrições)', `R$ ${Number(summary.income_registrations).toFixed(2)}`],
    ['Entradas (Ofertas)', `R$ ${Number(summary.income_offerings).toFixed(2)}`],
    ['Total de Entradas', `R$ ${Number(summary.total_income).toFixed(2)}`],
    ['Total de Saídas', `R$ ${Number(summary.total_expenses).toFixed(2)}`],
    ['Saldo', `R$ ${Number(summary.balance).toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: 40,
    head: [['Descrição', 'Valor']],
    body: summaryRows,
    theme: 'striped',
  });

  // Inscrições Pagas
  const regY = (doc as any).lastAutoTable?.finalY ?? 40;
  doc.setFontSize(14);
  doc.text('Inscrições Pagas', 14, regY + 15);

  const regRows = (paidRegs ?? []).map((r: any) => [
    r.full_name,
    r.payment_method,
    `R$ ${Number(r.events?.price ?? 0).toFixed(2)}`,
  ]);

  if (regRows.length > 0) {
    autoTable(doc, {
      startY: regY + 20,
      head: [['Nome', 'Método', 'Valor']],
      body: regRows,
      theme: 'striped',
    });
  }

  // Ofertas
  const offY = (doc as any).lastAutoTable?.finalY ?? regY + 20;
  doc.setFontSize(14);
  doc.text('Ofertas', 14, offY + 15);

  const offRows = offerings.map((o: Offering) => [
    o.description,
    o.method,
    `R$ ${Number(o.amount).toFixed(2)}`,
    new Date(o.received_at).toLocaleDateString('pt-BR'),
  ]);

  if (offRows.length > 0) {
    autoTable(doc, {
      startY: offY + 20,
      head: [['Descrição', 'Método', 'Valor', 'Data']],
      body: offRows,
      theme: 'striped',
    });
  }

  // Saídas
  const expY = (doc as any).lastAutoTable?.finalY ?? offY + 20;
  doc.setFontSize(14);
  doc.text('Saídas', 14, expY + 15);

  const expRows = expenses.map((e: Expense) => [
    e.description,
    e.category ?? '-',
    e.method,
    `R$ ${Number(e.amount).toFixed(2)}`,
    new Date(e.paid_at).toLocaleDateString('pt-BR'),
  ]);

  if (expRows.length > 0) {
    autoTable(doc, {
      startY: expY + 20,
      head: [['Descrição', 'Categoria', 'Método', 'Valor', 'Data']],
      body: expRows,
      theme: 'striped',
    });
  }

  // Saldo Final
  const finalY = (doc as any).lastAutoTable?.finalY ?? expY + 20;
  doc.setFontSize(12);
  doc.text(
    `Saldo Final: R$ ${Number(summary.balance).toFixed(2)}`,
    14,
    finalY + 15
  );

  doc.save(`relatorio-financeiro${eventId ? `-${eventId}` : ''}.pdf`);
}
