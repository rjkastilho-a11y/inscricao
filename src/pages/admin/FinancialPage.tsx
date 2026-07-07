import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonStatCard, SkeletonTable } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, paymentStatusLabels, paymentMethodLabels, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, FileSpreadsheet, ChevronDown, ChevronUp, MoreHorizontal, ArrowUpDown, X } from 'lucide-react';
import { useEvent } from '@/contexts/EventContext';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface RegistrationPayment {
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

interface FinEntry {
  id: string;
  event_id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  entry_date: string;
  created_at: string;
}

const INCOME_CATEGORIES = ['oferta', 'doação', 'outros'];
const incomeCategoryLabels: Record<string, string> = { 'oferta': 'Oferta', 'doação': 'Doação', 'outros': 'Outros' };
const EXPENSE_CATEGORIES = ['alimentação', 'local', 'materiais', 'transporte', 'divulgação', 'outros'];
const expenseCategoryLabels: Record<string, string> = { 'alimentação': 'Alimentação', 'local': 'Local', 'materiais': 'Materiais', 'transporte': 'Transporte', 'divulgação': 'Divulgação', 'outros': 'Outros' };
const PAYMENT_METHODS = Object.keys(paymentMethodLabels);
const PAYMENT_STATUSES = Object.keys(paymentStatusLabels);
const PERCENT_FILTERS = ['paid', 'partial', 'unpaid'] as const;
const percentFilterLabels: Record<string, string> = { 'paid': 'Pago (100%)', 'partial': 'Parcial', 'unpaid': 'Não pago' };

export default function FinancialPage() {
  const navigate = useNavigate();
  const { eventId, event } = useEvent();
  const [regPayments, setRegPayments] = useState<RegistrationPayment[]>([]);
  const [finEntries, setFinEntries] = useState<FinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'income' | 'expense'>('income');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ event_id: '', category: '', description: '', amount: '', entry_date: '' });
  const [saving, setSaving] = useState(false);

  const [regStatusFilter, setRegStatusFilter] = useState('');
  const [regMethodFilter, setRegMethodFilter] = useState('');
  const [regPercentFilter, setRegPercentFilter] = useState('');
  const [regSearch, setRegSearch] = useState('');
  const [regDateFrom, setRegDateFrom] = useState('');
  const [regDateTo, setRegDateTo] = useState('');
  const [regSortField, setRegSortField] = useState('full_name');
  const [regSortDirection, setRegSortDirection] = useState<'asc' | 'desc'>('asc');

  const [incomeCategoryFilter, setIncomeCategoryFilter] = useState('');
  const [incomeDateFrom, setIncomeDateFrom] = useState('');
  const [incomeDateTo, setIncomeDateTo] = useState('');
  const [incomeSortField, setIncomeSortField] = useState('entry_date');
  const [incomeSortDirection, setIncomeSortDirection] = useState<'asc' | 'desc'>('desc');

  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');
  const [expenseSortField, setExpenseSortField] = useState('entry_date');
  const [expenseSortDirection, setExpenseSortDirection] = useState<'asc' | 'desc'>('desc');
  const [collapseReg, setCollapseReg] = useState(() => window.innerWidth < 768);
  const [collapseIncome, setCollapseIncome] = useState(() => window.innerWidth < 768);
  const [collapseExpense, setCollapseExpense] = useState(() => window.innerWidth < 768);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let regQuery = supabase
      .from('registrations')
      .select('id, full_name, payment_method, payment_status, paid_amount, refunded_amount, created_at, events(title, price), event_lots!lot_id(name, price)')
      .neq('payment_status', 'canceled');

    if (eventId) {
      regQuery = regQuery.eq('event_id', eventId);
    }

    const { data: regs } = await regQuery;
    if (regs) {
      setRegPayments(
        regs.map((r: any) => ({
          id: r.id,
          full_name: r.full_name,
          event_title: r.events?.title || '',
          amount: Number(r.event_lots?.price ?? r.events?.price ?? 0),
          lotName: r.event_lots?.name ?? null,
          paid_amount: r.paid_amount != null ? Number(r.paid_amount) : null,
          refunded_amount: r.refunded_amount != null ? Number(r.refunded_amount) : null,
          method: r.payment_method,
          status: r.payment_status,
          created_at: r.created_at,
        }))
      );
    }

    let finQuery = supabase.from('financial_entries').select('*').order('entry_date', { ascending: false });
    if (eventId) {
      finQuery = finQuery.eq('event_id', eventId);
    }
    const { data: fins, error: finErr } = await finQuery;
    if (finErr) {
      console.warn('financial_entries query:', finErr.message);
    }
    setFinEntries((fins || []) as FinEntry[]);

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const incomeEntries = finEntries.filter((e) => e.type === 'income');
  const expenseEntries = finEntries.filter((e) => e.type === 'expense');
  const totalExpected = regPayments
    .reduce((sum, r) => sum + r.amount, 0);
  const paidRegAmount = regPayments
    .filter((r) => r.status === 'paid' || (r.paid_amount != null && r.paid_amount > 0))
    .reduce((sum, r) => {
      if (r.paid_amount != null && r.paid_amount > 0) return sum + r.paid_amount;
      return sum + r.amount;
    }, 0);
  const totalActual = paidRegAmount;
  const totalOfferings = incomeEntries.filter((e) => e.category !== 'registration').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const netActual = totalActual;
  const netBalance = netActual + totalOfferings - totalExpenses;

  const filteredRegPayments = useMemo(() => {
    let result = regPayments.filter((r) => {
      if (regStatusFilter && r.status !== regStatusFilter) return false;
      if (regMethodFilter && r.method !== regMethodFilter) return false;
      if (regSearch && !r.full_name.toLowerCase().includes(regSearch.toLowerCase())) return false;
      if (regDateFrom && r.created_at < regDateFrom) return false;
      if (regDateTo && r.created_at > regDateTo + 'T23:59:59') return false;
      if (regPercentFilter) {
        if (r.amount > 0 && r.paid_amount != null) {
          const pct = Math.min(100, Math.round((r.paid_amount / r.amount) * 100));
          if (regPercentFilter === 'paid' && pct !== 100) return false;
          if (regPercentFilter === 'partial' && (pct === 0 || pct === 100)) return false;
          if (regPercentFilter === 'unpaid' && pct !== 0) return false;
        } else {
          if (regPercentFilter !== 'unpaid') return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (regSortField) {
        case 'full_name': valA = a.full_name; valB = b.full_name; break;
        case 'amount': valA = a.amount; valB = b.amount; break;
        case 'paid_amount': valA = a.paid_amount ?? 0; valB = b.paid_amount ?? 0; break;
        case 'method': valA = a.method; valB = b.method; break;
        case 'status': valA = a.status; valB = b.status; break;
        case 'created_at': valA = a.created_at; valB = b.created_at; break;
        default: return 0;
      }
      if (typeof valA === 'string') return regSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return regSortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [regPayments, regStatusFilter, regMethodFilter, regPercentFilter, regSearch, regDateFrom, regDateTo, regSortField, regSortDirection]);

  const filteredIncome = useMemo(() => {
    let result = finEntries.filter((e) => e.type === 'income' && e.category !== 'registration');

    if (incomeCategoryFilter) result = result.filter((e) => e.category === incomeCategoryFilter);
    if (incomeDateFrom) result = result.filter((e) => e.entry_date >= incomeDateFrom);
    if (incomeDateTo) result = result.filter((e) => e.entry_date <= incomeDateTo);

    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (incomeSortField) {
        case 'category': valA = a.category; valB = b.category; break;
        case 'amount': valA = a.amount; valB = b.amount; break;
        case 'entry_date': valA = a.entry_date; valB = b.entry_date; break;
        default: return 0;
      }
      if (typeof valA === 'string') return incomeSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return incomeSortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [finEntries, incomeCategoryFilter, incomeDateFrom, incomeDateTo, incomeSortField, incomeSortDirection]);

  const filteredExpenses = useMemo(() => {
    let result = finEntries.filter((e) => e.type === 'expense');

    if (expenseCategoryFilter) result = result.filter((e) => e.category === expenseCategoryFilter);
    if (expenseDateFrom) result = result.filter((e) => e.entry_date >= expenseDateFrom);
    if (expenseDateTo) result = result.filter((e) => e.entry_date <= expenseDateTo);

    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (expenseSortField) {
        case 'category': valA = a.category; valB = b.category; break;
        case 'amount': valA = a.amount; valB = b.amount; break;
        case 'entry_date': valA = a.entry_date; valB = b.entry_date; break;
        default: return 0;
      }
      if (typeof valA === 'string') return expenseSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return expenseSortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [finEntries, expenseCategoryFilter, expenseDateFrom, expenseDateTo, expenseSortField, expenseSortDirection]);

  const openAdd = (type: 'income' | 'expense') => {
    setDialogType(type);
    setEditId(null);
    setForm({
      event_id: eventId || '',
      category: type === 'income' ? 'oferta' : 'alimentação',
      description: '',
      amount: '',
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const handleRegSort = (field: string) => {
    if (regSortField === field) {
      setRegSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setRegSortField(field);
      setRegSortDirection(field === 'full_name' ? 'asc' : 'desc');
    }
  };

  const handleIncomeSort = (field: string) => {
    if (incomeSortField === field) {
      setIncomeSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setIncomeSortField(field);
      setIncomeSortDirection(field === 'entry_date' ? 'desc' : 'asc');
    }
  };

  const handleExpenseSort = (field: string) => {
    if (expenseSortField === field) {
      setExpenseSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setExpenseSortField(field);
      setExpenseSortDirection(field === 'entry_date' ? 'desc' : 'asc');
    }
  };

  const clearRegFilters = () => {
    setRegSearch('');
    setRegStatusFilter('');
    setRegMethodFilter('');
    setRegPercentFilter('');
    setRegDateFrom('');
    setRegDateTo('');
    setRegSortField('full_name');
    setRegSortDirection('asc');
  };

  const clearIncomeFilters = () => {
    setIncomeCategoryFilter('');
    setIncomeDateFrom('');
    setIncomeDateTo('');
    setIncomeSortField('entry_date');
    setIncomeSortDirection('desc');
  };

  const clearExpenseFilters = () => {
    setExpenseCategoryFilter('');
    setExpenseDateFrom('');
    setExpenseDateTo('');
    setExpenseSortField('entry_date');
    setExpenseSortDirection('desc');
  };

  const hasRegFilters = regSearch || regStatusFilter || regMethodFilter || regPercentFilter || regDateFrom || regDateTo;
  const hasIncomeFilters = incomeCategoryFilter || incomeDateFrom || incomeDateTo;
  const hasExpenseFilters = expenseCategoryFilter || expenseDateFrom || expenseDateTo;

  const openEdit = (entry: FinEntry) => {
    setDialogType(entry.type);
    setEditId(entry.id);
    setForm({
      event_id: entry.event_id,
      category: entry.category,
      description: entry.description,
      amount: String(entry.amount),
      entry_date: entry.entry_date,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.event_id || !form.amount || !form.entry_date) {
      toast.error('Selecione um evento, preencha o valor e a data.');
      return;
    }
    setSaving(true);
    const payload = {
      event_id: form.event_id,
      type: dialogType,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      entry_date: form.entry_date,
    };

    const { error } = editId
      ? await supabase.from('financial_entries').update(payload).eq('id', editId)
      : await supabase.from('financial_entries').insert(payload);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('financial_entries').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }
    fetchData();
  };

  const eventTitle = event?.title ?? '-';

  const escCsv = (v: unknown) => `"${(`${v ?? ''}`).replace(/"/g, '""')}"`;

  const csvBlob = () => {
    const rows: string[] = [];

    rows.push('RESUMO FINANCEIRO');
    rows.push(`Entradas Previstas,${escCsv(formatCurrency(totalExpected))}`);
    rows.push(`Entradas Reais,${escCsv(formatCurrency(totalActual))}`);
    rows.push(`Entradas (Ofertas),${escCsv(formatCurrency(totalOfferings))}`);
    rows.push(`Total Entradas,${escCsv(formatCurrency(totalActual + totalOfferings))}`);
    rows.push(`Saídas,${escCsv(formatCurrency(totalExpenses))}`);
    rows.push(`Saldo,${escCsv(formatCurrency(netBalance))}`);
    rows.push('');

    rows.push('INSCRIÇÕES');
    rows.push('Inscrito,Valor Ficha,Valor Pago,Método,Status,Data');
    for (const r of filteredRegPayments) {
      rows.push([
        escCsv(r.full_name),
        escCsv(formatCurrency(r.amount)),
        r.paid_amount != null ? escCsv(formatCurrency(r.paid_amount)) : '-',
        escCsv(paymentMethodLabels[r.method] || r.method),
        escCsv(paymentStatusLabels[r.status]),
        escCsv(formatDate(r.created_at)),
      ].join(','));
    }
    rows.push('');

    rows.push('OFERTAS / OUTRAS ENTRADAS');
    rows.push('Evento,Categoria,Descrição,Valor,Data');
    for (const e of filteredIncome) {
      rows.push([
        escCsv(eventTitle),
        escCsv(e.category),
        escCsv(e.description),
        escCsv(formatCurrency(e.amount)),
        escCsv(e.entry_date),
      ].join(','));
    }
    rows.push('');

    rows.push('SAÍDAS / DESPESAS');
    rows.push('Evento,Categoria,Descrição,Valor,Data');
    for (const e of filteredExpenses) {
      rows.push([
        escCsv(eventTitle),
        escCsv(e.category),
        escCsv(e.description),
        escCsv(formatCurrency(e.amount)),
        escCsv(e.entry_date),
      ].join(','));
    }

    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    return blob;
  };

  const handleExportExcel = () => {
    const blob = csvBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const escHtml = (v: unknown) => `${v ?? ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const td = (v: unknown) => `<td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${escHtml(v)}</td>`;
    const th = (v: string) => `<th style="border:1px solid #ccc;padding:8px 10px;background:#f5f5f5;font-size:12px;text-align:left">${v}</th>`;

    const grouped: Record<string, { count: number; totalFicha: number; totalPago: number }> = {};
    for (const r of filteredRegPayments) {
      const key = `${r.method}|${r.status}`;
      if (!grouped[key]) grouped[key] = { count: 0, totalFicha: 0, totalPago: 0 };
      grouped[key].count++;
      grouped[key].totalFicha += r.amount;
      if (r.paid_amount != null) grouped[key].totalPago += r.paid_amount;
    }
    const regRows = Object.entries(grouped).map(([key, g]) => {
      const [method, status] = key.split('|');
      return `<tr>${td(g.count)}${td(formatCurrency(g.totalFicha))}${td(formatCurrency(g.totalPago))}${td(paymentMethodLabels[method] || method)}${td(paymentStatusLabels[status])}</tr>`;
    }).join('');

    const incRows = filteredIncome.map((e) =>
      `<tr>${td(eventTitle)}${td(e.category)}${td(e.description || '-')}${td(formatCurrency(e.amount))}${td(e.entry_date)}</tr>`
    ).join('');

    const expRows = filteredExpenses.map((e) =>
      `<tr>${td(eventTitle)}${td(e.category)}${td(e.description || '-')}${td(formatCurrency(e.amount))}${td(e.entry_date)}</tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Financeiro</title></head>
<body style="font-family:sans-serif;padding:20px">
  <h1>Relatório Financeiro</h1>
  <p style="margin-bottom:20px;color:#666">Gerado em ${new Date().toLocaleString('pt-BR')}</p>

  <table style="border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:4px 12px;font-weight:bold">Entradas Previstas</td><td style="padding:4px 12px">${formatCurrency(totalExpected)}</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold">Entradas Reais</td><td style="padding:4px 12px">${formatCurrency(totalActual)}</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold">Entradas (Ofertas)</td><td style="padding:4px 12px">${formatCurrency(totalOfferings)}</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold">Total Entradas</td><td style="padding:4px 12px">${formatCurrency(totalActual + totalOfferings)}</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold">Saídas</td><td style="padding:4px 12px">${formatCurrency(totalExpenses)}</td></tr>
    <tr><td style="padding:4px 12px;font-weight:bold">Saldo</td><td style="padding:4px 12px;font-weight:bold">${formatCurrency(netBalance)}</td></tr>
  </table>

  <h2>Inscrições</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
    <thead><tr>${th('Nº Inscritos')}${th('Valor Ficha')}${th('Valor Pago')}${th('Método')}${th('Status')}</tr></thead>
    <tbody>${regRows || '<tr><td colspan="5" style="padding:12px;color:#999;text-align:center">Nenhum registro</td></tr>'}</tbody>
  </table>

  <h2>Ofertas / Outras Entradas</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
    <thead><tr>${th('Evento')}${th('Categoria')}${th('Descrição')}${th('Valor')}${th('Data')}</tr></thead>
    <tbody>${incRows || '<tr><td colspan="5" style="padding:12px;color:#999;text-align:center">Nenhum registro</td></tr>'}</tbody>
  </table>

  <h2>Saídas / Despesas</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
    <thead><tr>${th('Evento')}${th('Categoria')}${th('Descrição')}${th('Valor')}${th('Data')}</tr></thead>
    <tbody>${expRows || '<tr><td colspan="5" style="padding:12px;color:#999;text-align:center">Nenhum registro</td></tr>'}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Financeiro" badge={event?.title} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Financeiro" badge={event?.title} />

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <Button className="hidden md:inline-flex bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
        </Button>
        <Button className="hidden md:inline-flex bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={handleExportPdf}>
          <FileText className="h-4 w-4 mr-1" /> PDF
        </Button>
        {/* Mobile: export actions */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors size-9 max-md:h-11 max-md:w-11 md:h-10 md:w-10">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground md:ml-auto max-md:h-11 md:h-10" onClick={(e) => { e.stopPropagation(); openAdd('income'); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova entrada
        </Button>
        <Button className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground max-md:h-11 md:h-10" onClick={(e) => { e.stopPropagation(); openAdd('expense'); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova saída
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Previsto</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-xl md:text-3xl font-bold text-blue-400">{formatCurrency(totalExpected)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Real</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-xl md:text-3xl font-bold text-emerald-400">{formatCurrency(netActual)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Entradas (Ofertas)</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-xl md:text-3xl font-bold text-emerald-400">{formatCurrency(totalOfferings)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Saídas</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-xl md:text-3xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Total Entradas</CardTitle></CardHeader>
          <CardContent><p className="font-serif text-xl md:text-3xl font-bold text-foreground">{formatCurrency(netActual + totalOfferings)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-1 md:pb-2"><CardTitle className="text-xs md:text-sm text-muted-foreground">Saldo</CardTitle></CardHeader>
          <CardContent>
            <p className={`font-serif text-xl md:text-3xl font-bold ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(netBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inscrições */}
      <Card className="mb-6 bg-card backdrop-blur-xl border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => setCollapseReg(!collapseReg)}>
          <CardTitle className="text-lg text-foreground">Inscrições</CardTitle>
          <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 md:h-10 md:w-10 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
            {collapseReg ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!collapseReg && (
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              <Input
                placeholder="Buscar inscrito..."
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-xs"
              />
              <Input
                type="date"
                value={regDateFrom}
                onChange={(e) => setRegDateFrom(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="De"
              />
              <Input
                type="date"
                value={regDateTo}
                onChange={(e) => setRegDateTo(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="Até"
              />
              <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
                  <SelectValue>
                    {(value) => value ? (paymentStatusLabels[value] || value) : "Status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{paymentStatusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={regMethodFilter} onValueChange={setRegMethodFilter}>
                <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
                  <SelectValue>
                    {(value) => value ? (paymentMethodLabels[value] || value) : "Método"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{paymentMethodLabels[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={regPercentFilter} onValueChange={setRegPercentFilter}>
                <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
                  <SelectValue placeholder="Pagamento %" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {PERCENT_FILTERS.map((f) => (
                    <SelectItem key={f} value={f}>{percentFilterLabels[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasRegFilters && (
                <Button variant="ghost" size="sm" onClick={clearRegFilters} className="text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
            {hasRegFilters && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {regSearch && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegSearch('')}>
                    Busca: {regSearch} <X className="h-3 w-3" />
                  </Badge>
                )}
                {regDateFrom && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegDateFrom('')}>
                    De: {formatDate(regDateFrom)} <X className="h-3 w-3" />
                  </Badge>
                )}
                {regDateTo && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegDateTo('')}>
                    Até: {formatDate(regDateTo)} <X className="h-3 w-3" />
                  </Badge>
                )}
                {regStatusFilter && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegStatusFilter('')}>
                    Status: {paymentStatusLabels[regStatusFilter]} <X className="h-3 w-3" />
                  </Badge>
                )}
                {regMethodFilter && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegMethodFilter('')}>
                    Método: {paymentMethodLabels[regMethodFilter]} <X className="h-3 w-3" />
                  </Badge>
                )}
                {regPercentFilter && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setRegPercentFilter('')}>
                    Pagamento: {percentFilterLabels[regPercentFilter]} <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filteredRegPayments.map((r) => {
                const statusAccent = r.status === 'paid'
                  ? 'border-l-emerald-500'
                  : r.status === 'refunded'
                    ? 'border-l-orange-500'
                    : r.paid_amount && r.paid_amount > 0
                      ? 'border-l-yellow-500'
                      : 'border-l-red-500';
                return (
                <div key={r.id} className={`rounded-lg border border-border border-l-4 ${statusAccent} p-3 space-y-1.5 cursor-pointer`} onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=5`)}>
                  <p className="font-medium text-sm text-foreground">{r.full_name}</p>
                  <div className="text-sm space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ficha</span>
                      <span className="text-foreground">
                        {formatCurrency(r.amount)}{' — '}{r.lotName ?? 'Inscrição Normal'}
                      </span>
                    </div>
                    {r.paid_amount != null && r.paid_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pago</span>
                        <span className="font-medium text-emerald-400">
                          {formatCurrency(r.paid_amount)}
                          {(() => {
                            if (r.amount > 0) {
                              const pct = Math.min(100, Math.round((r.paid_amount / r.amount) * 100));
                              return <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>;
                            }
                            return null;
                          })()}
                        </span>
                      </div>
                    )}
                    {r.refunded_amount != null && r.refunded_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reembolso</span>
                        <span className="font-medium text-rose-500">
                          -{formatCurrency(r.refunded_amount)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`cursor-pointer hover:opacity-80 ${
                          r.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                            : r.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
                              : r.status === 'overdue'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                                : r.status === 'refunded'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200'
                                  : 'bg-muted text-muted-foreground'
                        }`}
                        onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=5`)}
                      >
                        {paymentStatusLabels[r.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {paymentMethodLabels[r.method] || r.method}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                </div>
              );
              })}
              {filteredRegPayments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma inscrição encontrada.</div>
              )}
            </div>
            {/* Desktop */}
            <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    {[
                      { field: 'full_name', label: 'Inscrito' },
                      { field: 'amount', label: 'Valor Ficha' },
                      { field: 'paid_amount', label: 'Valor Pago' },
                      { field: null, label: '%' },
                      { field: 'method', label: 'Método' },
                      { field: 'status', label: 'Status' },
                      { field: 'created_at', label: 'Data' },
                    ].map(({ field, label }) => (
                      <th
                        key={label}
                        className={`text-left p-4 text-sm font-medium text-muted-foreground ${field ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                        onClick={field ? () => handleRegSort(field) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {field && regSortField === field && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRegPayments.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-accent cursor-pointer" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=5`)}>
                      <td className="p-4 text-sm font-medium text-foreground">{r.full_name}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        <span>{formatCurrency(r.amount)}</span>
                        <br />
                        <span className="text-[10px]">{r.lotName ?? 'Inscrição Normal'}</span>
                      </td>
                      <td className="p-4 text-sm font-medium text-emerald-400">
                        {r.paid_amount != null ? formatCurrency(r.paid_amount) : '-'}
                      </td>
                      <td className="p-4 text-sm font-medium">
                        {(() => {
                          if (r.amount > 0 && r.paid_amount != null) {
                            const pct = Math.min(100, Math.round((r.paid_amount / r.amount) * 100));
                            return (
                              <span className={pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : ''}>
                                {pct}%
                              </span>
                            );
                          }
                          return <span className="text-muted-foreground">-</span>;
                        })()}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{paymentMethodLabels[r.method] || r.method}</td>
                      <td className="p-4 text-sm">
                        <Badge
                          variant="secondary"
                          className={`cursor-pointer hover:opacity-80 ${
                            r.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                              : r.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
                                : r.status === 'overdue'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                                  : r.status === 'refunded'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200'
                                    : 'bg-muted text-muted-foreground'
                          }`}
                          onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=5`)}
                        >
                          {paymentStatusLabels[r.status]}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRegPayments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma inscrição encontrada.</div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Ofertas / Outras Entradas */}
      <Card className="mb-6 bg-card backdrop-blur-xl border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => setCollapseIncome(!collapseIncome)}>
          <CardTitle className="text-lg text-foreground">Ofertas / Outras Entradas</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 md:h-10 md:w-10 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
              {collapseIncome ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapseIncome && (
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              <Select value={incomeCategoryFilter} onValueChange={setIncomeCategoryFilter}>
                <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
                  <SelectValue>
                    {(value) => value ? incomeCategoryLabels[value] || value : "Categoria"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {INCOME_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{incomeCategoryLabels[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={incomeDateFrom}
                onChange={(e) => setIncomeDateFrom(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="De"
              />
              <Input
                type="date"
                value={incomeDateTo}
                onChange={(e) => setIncomeDateTo(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="Até"
              />
              {hasIncomeFilters && (
                <Button variant="ghost" size="sm" onClick={clearIncomeFilters} className="text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
            {hasIncomeFilters && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {incomeCategoryFilter && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setIncomeCategoryFilter('')}>
                    Categoria: {incomeCategoryLabels[incomeCategoryFilter]} <X className="h-3 w-3" />
                  </Badge>
                )}
                {incomeDateFrom && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setIncomeDateFrom('')}>
                    De: {formatDate(incomeDateFrom)} <X className="h-3 w-3" />
                  </Badge>
                )}
                {incomeDateTo && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setIncomeDateTo('')}>
                    Até: {formatDate(incomeDateTo)} <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filteredIncome.map((e) => (
                <div key={e.id} className="rounded-lg border border-border bg-muted p-4 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-medium text-sm capitalize text-foreground">{e.category}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 max-md:h-11 max-md:w-11 -mt-1 -mr-1 text-foreground hover:bg-accent" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{eventTitle}</p>
                  {e.description && <p className="text-sm text-foreground">{e.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-400">{formatCurrency(e.amount)}</span>
                    <span className="text-xs text-muted-foreground">{e.entry_date}</span>
                  </div>
                </div>
              ))}
              {filteredIncome.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada.</div>
              )}
            </div>
            {/* Desktop */}
            <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    {[
                      { field: 'category', label: 'Categoria' },
                      { field: null, label: 'Evento' },
                      { field: null, label: 'Descrição' },
                      { field: 'amount', label: 'Valor' },
                      { field: 'entry_date', label: 'Data' },
                      { field: null, label: 'Ações' },
                    ].map(({ field, label }) => (
                      <th
                        key={label}
                        className={`text-left p-4 text-sm font-medium text-muted-foreground ${field ? 'cursor-pointer hover:text-foreground select-none' : ''} ${label === 'Ações' ? 'text-right' : ''}`}
                        onClick={field ? () => handleIncomeSort(field) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {field && incomeSortField === field && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredIncome.map((e) => (
                    <tr key={e.id} className="border-b border-border hover:bg-accent">
                      <td className="p-4 text-sm font-medium text-foreground capitalize">{e.category}</td>
                      <td className="p-4 text-sm text-muted-foreground">{eventTitle}</td>
                      <td className="p-4 text-sm text-muted-foreground">{e.description || '-'}</td>
                      <td className="p-4 text-sm font-medium text-emerald-400">{formatCurrency(e.amount)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{e.entry_date}</td>
                      <td className="p-4 text-sm text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-accent" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredIncome.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada.</div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Saídas */}
      <Card className="mb-6 bg-card backdrop-blur-xl border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => setCollapseExpense(!collapseExpense)}>
          <CardTitle className="text-lg text-foreground">Saídas / Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 md:h-10 md:w-10 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
              {collapseExpense ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapseExpense && (
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
                  <SelectValue>
                    {(value) => value ? expenseCategoryLabels[value] || value : "Categoria"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{expenseCategoryLabels[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={expenseDateFrom}
                onChange={(e) => setExpenseDateFrom(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="De"
              />
              <Input
                type="date"
                value={expenseDateTo}
                onChange={(e) => setExpenseDateTo(e.target.value)}
                className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
                placeholder="Até"
              />
              {hasExpenseFilters && (
                <Button variant="ghost" size="sm" onClick={clearExpenseFilters} className="text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
            {hasExpenseFilters && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {expenseCategoryFilter && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setExpenseCategoryFilter('')}>
                    Categoria: {expenseCategoryLabels[expenseCategoryFilter]} <X className="h-3 w-3" />
                  </Badge>
                )}
                {expenseDateFrom && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setExpenseDateFrom('')}>
                    De: {formatDate(expenseDateFrom)} <X className="h-3 w-3" />
                  </Badge>
                )}
                {expenseDateTo && (
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => setExpenseDateTo('')}>
                    Até: {formatDate(expenseDateTo)} <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filteredExpenses.map((e) => (
                <div key={e.id} className="rounded-lg border border-border bg-muted p-4 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-medium text-sm capitalize text-foreground">{e.category}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 max-md:h-11 max-md:w-11 md:h-10 md:w-10 -mt-1 -mr-1 text-foreground hover:bg-accent" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{eventTitle}</p>
                  {e.description && <p className="text-sm text-foreground">{e.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-400">{formatCurrency(e.amount)}</span>
                    <span className="text-xs text-muted-foreground">{e.entry_date}</span>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma saída registrada.</div>
              )}
            </div>
            {/* Desktop */}
            <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    {[
                      { field: 'category', label: 'Categoria' },
                      { field: null, label: 'Evento' },
                      { field: null, label: 'Descrição' },
                      { field: 'amount', label: 'Valor' },
                      { field: 'entry_date', label: 'Data' },
                      { field: null, label: 'Ações' },
                    ].map(({ field, label }) => (
                      <th
                        key={label}
                        className={`text-left p-4 text-sm font-medium text-muted-foreground ${field ? 'cursor-pointer hover:text-foreground select-none' : ''} ${label === 'Ações' ? 'text-right' : ''}`}
                        onClick={field ? () => handleExpenseSort(field) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {field && expenseSortField === field && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="border-b border-border hover:bg-accent">
                      <td className="p-4 text-sm font-medium text-foreground capitalize">{e.category}</td>
                      <td className="p-4 text-sm text-muted-foreground">{eventTitle}</td>
                      <td className="p-4 text-sm text-muted-foreground">{e.description || '-'}</td>
                      <td className="p-4 text-sm font-medium text-red-400">{formatCurrency(e.amount)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{e.entry_date}</td>
                      <td className="p-4 text-sm text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-accent" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredExpenses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Nenhuma saída registrada.</div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar' : 'Nova'} {dialogType === 'income' ? 'Entrada' : 'Saída'}</DialogTitle>
            <DialogDescription>
              Preencha os dados da {dialogType === 'income' ? 'entrada' : 'saída'} financeira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Evento</Label>
              <p className="text-sm text-muted-foreground">{eventTitle}</p>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(dialogType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Valor (R$) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Data <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
