import { useEffect, useState, useCallback } from 'react';
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
import { Plus, Trash2, FileText, FileSpreadsheet, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
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
const EXPENSE_CATEGORIES = ['alimentação', 'local', 'materiais', 'transporte', 'divulgação', 'outros'];
const PAYMENT_METHODS = Object.keys(paymentMethodLabels);
const PAYMENT_STATUSES = Object.keys(paymentStatusLabels);

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
  const [collapseReg, setCollapseReg] = useState(() => window.innerWidth < 768);
  const [collapseIncome, setCollapseIncome] = useState(() => window.innerWidth < 768);
  const [collapseExpense, setCollapseExpense] = useState(() => window.innerWidth < 768);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let regQuery = supabase
      .from('registrations')
      .select('id, full_name, payment_method, payment_status, paid_amount, refunded_amount, created_at, events(title, price), event_lots!lot_id(name, price)');

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
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + (r.paid_amount != null ? r.paid_amount : 0), 0);
  const totalActual = paidRegAmount;
  const totalOfferings = incomeEntries.filter((e) => e.category !== 'registration').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const netActual = totalActual;
  const netBalance = netActual + totalOfferings - totalExpenses;

  const filteredRegPayments = regPayments.filter((r) => {
    if (regStatusFilter && r.status !== regStatusFilter) return false;
    if (regMethodFilter && r.method !== regMethodFilter) return false;
    return true;
  });
  const filteredIncome = incomeEntries.filter((e) => e.category !== 'registration');
  const filteredExpenses = expenseEntries;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Financeiro" badge={event?.title} />

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <Button size="sm" className="hidden md:inline-flex bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
        </Button>
        <Button size="sm" className="hidden md:inline-flex bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={handleExportPdf}>
          <FileText className="h-4 w-4 mr-1" /> PDF
        </Button>
        {/* Mobile: export actions */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors size-9 max-md:h-11 max-md:w-11">
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
        <Button size="sm" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground md:ml-auto max-md:h-11" onClick={(e) => { e.stopPropagation(); openAdd('income'); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova entrada
        </Button>
        <Button size="sm" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground max-md:h-11" onClick={(e) => { e.stopPropagation(); openAdd('expense'); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova saída
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Previsto</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-400">{formatCurrency(totalExpected)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Real</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-400">{formatCurrency(netActual)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entradas (Ofertas)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalOfferings)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Entradas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{formatCurrency(netActual + totalOfferings)}</p></CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(netBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inscrições */}
      <Card className="mb-6 bg-card backdrop-blur-xl border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => setCollapseReg(!collapseReg)}>
          <CardTitle className="text-lg text-foreground">Inscrições</CardTitle>
          <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
            {collapseReg ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!collapseReg && (
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                <SelectTrigger className="w-full md:w-[140px]">
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
                <SelectTrigger className="w-full md:w-[140px]">
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
            </div>
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
                <div key={r.id} className={`rounded-lg border border-border border-l-4 ${statusAccent} p-3 space-y-1.5`}>
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
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : r.status === 'refunded'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}
                        onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=4`)}
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
            <div className="hidden md:block rounded-md border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Inscrito</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor Ficha</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor Pago</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">%</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Método</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegPayments.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-accent">
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
                          variant={r.status === 'paid' ? 'default' : 'secondary'}
                          className={`cursor-pointer hover:opacity-80 ${
                            r.status === 'refunded'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                              : r.status === 'canceled'
                                ? 'bg-muted text-muted-foreground'
                                : ''
                          }`}
                          onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${r.id}/editar?step=4`)}
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
            <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
              {collapseIncome ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapseIncome && (
          <CardContent>
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
            <div className="hidden md:block rounded-md border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Categoria</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Evento</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
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
            <Button size="icon" className="h-7 w-7 max-md:h-11 max-md:w-11 bg-card backdrop-blur-md border-border hover:bg-accent text-foreground">
              {collapseExpense ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapseExpense && (
          <CardContent>
            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filteredExpenses.map((e) => (
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
            <div className="hidden md:block rounded-md border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Categoria</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Evento</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
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
