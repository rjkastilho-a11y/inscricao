import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useEvent } from '@/contexts/EventContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable, SkeletonMobileCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate, formatCurrency, paymentStatusLabels, paymentMethodLabels } from '@/lib/utils';
import { toast } from 'sonner';
import { Trash2, Search, X, Download, Upload, FileDown, UserCheck, Loader2, Check, MoreHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Papa from 'papaparse';
import { useTrial } from '@/components/layout/ChurchGuard';

interface Registration {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string | null;
  gender: string | null;
  is_christian: boolean;
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
  events: { title: string; price: number } | null;
  event_lots: { name: string; price: number } | null;
}

export default function RegistrationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { event, eventId } = useEvent();
  const trial = useTrial();

  const [data, setData] = useState<Registration[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('payment_status') || '');
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('registrations')
      .select('*, events(title, price), event_lots!lot_id(name, price)', { count: 'exact' });

    if (statusFilter) {
      query = query.eq('payment_status', statusFilter);
    }
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`
      );
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: result, count, error: fetchErr } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (fetchErr) {
      setFetchError(fetchErr.message);
      setData([]);
      setTotalCount(0);
    } else {
      setFetchError(null);
      setData((result || []) as unknown as Registration[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [search, eventId, statusFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('registrations').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
  };

  const handleToggleCheckIn = async (regId: string, currentStatus: boolean) => {
    setCheckingId(regId);
    const { error } = await supabase
      .from('registrations')
      .update({ checked_in: !currentStatus })
      .eq('id', regId);
    if (!error) {
      setData((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, checked_in: !currentStatus } : r))
      );
    }
    setCheckingId(null);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(0);
    setSearchParams({});
  };

  const hasFilters = search || statusFilter;

  const TEMPLATE_HEADERS = [
    'Nome', 'E-mail', 'WhatsApp', 'Data de Nascimento', 'Gênero',
    'É Cristão', 'É Batizado', 'Igreja', 'Pastor', 'Cargo na Igreja', 'Outro Cargo',
    'Nome do Padrinho', 'Contato do Padrinho', 'Autorização Pastoral',
    'Informações de Saúde', 'Contato de Emergência', 'Telefone de Emergência',
    'Forma de Pagamento', 'Status do Pagamento', 'Observações',
    'Evento',
  ];

  const CSV_MAP: Record<string, string> = {
    'Nome': 'full_name',
    'E-mail': 'email',
    'WhatsApp': 'whatsapp',
    'Data de Nascimento': 'birth_date',
    'Gênero': 'gender',
    'É Cristão': 'is_christian',
    'É Batizado': 'is_baptized',
    'Igreja': 'church',
    'Pastor': 'pastor',
    'Cargo na Igreja': 'church_role',
    'Outro Cargo': 'church_role_other',
    'Nome do Padrinho': 'godparent',
    'Contato do Padrinho': 'godparent_contact',
    'Autorização Pastoral': 'pastoral_authorization',
    'Informações de Saúde': 'health_info',
    'Contato de Emergência': 'emergency_contact',
    'Telefone de Emergência': 'emergency_phone',
    'Forma de Pagamento': 'payment_method',
    'Status do Pagamento': 'payment_status',
    'Observações': 'private_notes',
    'Evento': 'event_title',
  };

  const downloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inscrições');

    ws.columns = TEMPLATE_HEADERS.map((h) => ({ header: h, key: h, width: 22 }));

    ws.addRow({
      'Nome': 'João da Silva',
      'E-mail': 'joao@email.com',
      'WhatsApp': '(21) 99999-9999',
      'Data de Nascimento': '1990-01-15',
      'Gênero': 'M',
      'É Cristão': 'Sim',
      'É Batizado': 'Sim',
      'Igreja': 'Igreja Batista',
      'Pastor': 'Pr. Carlos',
      'Cargo na Igreja': 'Diácono',
      'Outro Cargo': '',
      'Nome do Padrinho': 'Maria Silva',
      'Contato do Padrinho': '(21) 98888-8888',
      'Autorização Pastoral': 'Sim',
      'Informações de Saúde': 'Nenhuma',
      'Contato de Emergência': 'José Santos',
      'Telefone de Emergência': '(21) 97777-7777',
      'Forma de Pagamento': 'PIX',
      'Status do Pagamento': 'Pendente',
      'Observações': '',
      'Evento': 'Nome do Evento',
    });

    (ws as any).dataValidations.add('E2:E1000', { type: 'list', formulae: ['"M,F,other"'] });
    (ws as any).dataValidations.add('F2:F1000', { type: 'list', formulae: ['"Sim,Não"'] });
    (ws as any).dataValidations.add('G2:G1000', { type: 'list', formulae: ['"Sim,Não"'] });
    (ws as any).dataValidations.add('J2:J1000', { type: 'list', formulae: ['"Pastor,Missionário,Diácono,Presbítero,Líder de Ministério,Obreiro,Membro,Congregado,Outro"'] });
    (ws as any).dataValidations.add('N2:N1000', { type: 'list', formulae: ['"Sim,Não"'] });
    (ws as any).dataValidations.add('R2:R1000', { type: 'list', formulae: ['"PIX,Cartão de crédito,Dinheiro,Transferência,Outro"'] });
    (ws as any).dataValidations.add('S2:S1000', { type: 'list', formulae: ['"Pendente,Pago,Em atraso,Reembolsado"'] });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_inscricoes.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length) {
        setImportResult({ success: 0, errors: parsed.errors.map((err) => `Linha ${err.row + 1}: ${err.message}`) });
        return;
      }
      setImportPreview(parsed.data);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    const errors: string[] = [];
    let success = 0;

    const { data: events } = await supabase.from('events').select('id, title');
    const eventMap = new Map((events || []).map((e) => [e.title.toLowerCase(), e.id]));

    const validRecords: Record<string, unknown>[] = [];

    for (let i = 0; i < importPreview.length; i++) {
      const row = importPreview[i];
      const record: Record<string, unknown> = {};

      for (const [ptHeader, dbField] of Object.entries(CSV_MAP)) {
        const val = row[ptHeader]?.trim() || '';
        if (dbField === 'event_title') {
          if (!val) {
            errors.push(`Linha ${i + 2}: Evento é obrigatório`);
            break;
          }
          const eventId = eventMap.get(val.toLowerCase());
          if (!eventId) {
            errors.push(`Linha ${i + 2}: Evento "${val}" não encontrado`);
            break;
          }
          record.event_id = eventId;
          continue;
        }

        if (['is_christian', 'is_baptized', 'pastoral_authorization'].includes(dbField)) {
          record[dbField] = val.toLowerCase() === 'sim';
          continue;
        }

        if (!val) continue;
        record[dbField] = val;
      }

      if (!record.event_id) continue;
      if (!record.full_name || !record.email || !record.whatsapp) {
        errors.push(`Linha ${i + 2}: Nome, E-mail e WhatsApp são obrigatórios`);
        continue;
      }

      validRecords.push(record);
    }

    if (validRecords.length > 0) {
      const { error: batchError } = await supabase.from('registrations').insert(validRecords);

      if (batchError) {
        for (let i = 0; i < validRecords.length; i++) {
          const { error } = await supabase.from('registrations').insert(validRecords[i]);
          if (error) {
            if (error.code === '23505') {
              errors.push(`Registro "${validRecords[i].full_name}": E-mail já cadastrado neste evento`);
            } else {
              errors.push(`Registro "${validRecords[i].full_name}": ${error.message}`);
            }
          } else {
            success++;
          }
        }
      } else {
        success = validRecords.length;
      }
    }

    setImportResult({ success, errors });
    setImporting(false);
    if (success > 0) fetchData();
  };

  const handleExport = async () => {
    setExporting(true);
    const { data, error } = await supabase
      .from('registrations')
      .select('*, events(title, price), event_lots!lot_id(name, price)')
      .order('created_at', { ascending: false });
    if (error || !data) {
      toast.error('Erro ao exportar: ' + (error?.message || 'sem dados'));
      setExporting(false);
      return;
    }
    const rows = data as unknown as Registration[];
    const esc = (v: unknown) => `"${(`${v ?? ''}`).replace(/"/g, '""')}"`;
    const headers = [
      'Nome', 'E-mail', 'WhatsApp', 'Nascimento', 'Gênero',
      'Cristão', 'Batizado', 'Igreja', 'Pastor', 'Cargo', 'Cargo (outro)',
      'Padrinho', 'Contato Padrinho', 'Autorização Pastoral',
      'Saúde', 'Emergência (contato)', 'Emergência (telefone)',
      'Método Pagamento', 'Status Pagamento', 'Valor Pago', 'Observações',
      '% Pago', 'Valor', 'Criado em',
    ];
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [
          esc(r.full_name), esc(r.email), esc(r.whatsapp),
          r.birth_date ? formatDate(r.birth_date) : '',
          r.gender === 'M' ? 'Masculino' : r.gender === 'F' ? 'Feminino' : '',
          r.is_christian ? 'Sim' : 'Não',
          r.is_baptized === null ? '' : r.is_baptized ? 'Sim' : 'Não',
          esc(r.church), esc(r.pastor),
          esc(r.church_role), esc(r.church_role_other),
          esc(r.godparent), esc(r.godparent_contact),
          r.pastoral_authorization ? 'Sim' : 'Não',
          esc(r.health_info), esc(r.emergency_contact), esc(r.emergency_phone),
          paymentMethodLabels[r.payment_method] || r.payment_method,
          paymentStatusLabels[r.payment_status] || r.payment_status,
          (r as any).paid_amount ? Number((r as any).paid_amount).toFixed(2) : '',
          esc(r.private_notes),
          (r as any).event_lots?.price ?? r.events?.price
            ? Math.min(100, Math.round((Number((r as any).paid_amount) / ((r as any).event_lots?.price ?? r.events?.price)) * 100)) + '%'
            : '',
          ((r as any).event_lots?.price ?? r.events?.price) ? Number(((r as any).event_lots?.price ?? r.events?.price)).toFixed(2) : '',
          formatDate(r.created_at),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div>
      <PageHeader
        title="Inscrições"
        badge={event?.title}
        action={{
          label: 'Nova inscrição',
          to: `/app/evento/${eventId}/inscricoes/nova`,
          onClick: trial?.isTrialExceeded ? () => trial.openUpgrade() : undefined,
        }}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex flex-1 gap-2 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou WhatsApp..."
              className="pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="hidden md:inline-flex shrink-0">
            <FileDown className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Modelo</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="hidden md:inline-flex shrink-0">
            <Upload className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Importar CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="hidden md:inline-flex shrink-0">
            <Download className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">{exporting ? 'Exportando...' : 'Exportar'}</span>
          </Button>
          {/* Mobile: more actions */}
          <div className="md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground transition-colors size-9 max-md:h-11 max-md:w-11">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadTemplate}>
                  <FileDown className="h-4 w-4" /> Modelo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4" /> Importar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                  <Download className="h-4 w-4" /> {exporting ? 'Exportando...' : 'Exportar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue>
              {(value) => value ? (paymentStatusLabels[value] || value) : "Status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {Object.entries(paymentStatusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="icon" className="inline-flex max-md:h-11 max-md:w-11" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {loading && (
        <>
          <div className="md:hidden space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonMobileCard key={i} />)}
          </div>
          <div className="hidden md:block">
            <SkeletonTable rows={5} columns={6} />
          </div>
        </>
      )}

      {!loading && fetchError && (
        <div className="text-center py-12 text-destructive">
          <p className="font-semibold">Erro ao carregar inscrições</p>
          <p className="text-sm mt-1">{fetchError}</p>
          <p className="text-sm mt-4 text-muted-foreground">
            Execute o script <code className="bg-muted px-1 rounded">supabase/fix_select_policy.sql</code> no SQL Editor do Supabase Dashboard para corrigir as permissões.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => fetchData()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !fetchError && data.length === 0 && (
        <EmptyState
          title="Nenhuma inscrição encontrada"
          description="Nenhuma inscrição corresponde aos filtros atuais. Tente alterar os termos de busca."
          icon={<Search className="size-12" />}
          action={!hasFilters ? {
            label: 'Nova inscrição',
            to: `/app/evento/${eventId}/inscricoes/nova`,
            onClick: trial?.isTrialExceeded ? () => trial.openUpgrade() : undefined,
          } : undefined}
        />
      )}

      {/* Mobile: cards */}
      {!loading && data.length > 0 && (
        <>
          <div className="md:hidden space-y-3">
            {data.map((reg) => (
              <Card
                key={reg.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors min-h-[140px]"
                onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${reg.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{reg.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{reg.whatsapp}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant={reg.checked_in ? 'default' : 'secondary'}
                          className={reg.checked_in ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                        >
                          {reg.checked_in ? 'Confirmado' : 'Ausente'}
                        </Badge>
                        <Badge
                          variant={reg.payment_status === 'paid' ? 'default' : 'secondary'}
                          className={reg.payment_status === 'refunded' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : reg.payment_status === 'canceled' ? 'bg-muted text-muted-foreground' : ''}
                        >
                          {paymentStatusLabels[reg.payment_status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Valor: {formatCurrency(reg.event_lots?.price ?? reg.events?.price ?? 0)} — {reg.event_lots?.name ?? 'Inscrição Normal'}
                      </p>
                      {(reg as any).paid_amount != null && (
                        <p className="text-sm font-semibold text-emerald-500 mt-1">
                          Pago: {formatCurrency(Number((reg as any).paid_amount))}
                          {(() => {
                            const effectivePrice = reg.event_lots?.price ?? reg.events?.price;
                            if (effectivePrice && Number((reg as any).paid_amount) > 0) {
                              const pct = Math.min(100, Math.round((Number((reg as any).paid_amount) / effectivePrice) * 100));
                              return <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>;
                            }
                            return null;
                          })()}
                        </p>
                      )}
                      {(reg as any).refunded_amount != null && Number((reg as any).refunded_amount) > 0 && (
                        <p className="text-sm font-semibold text-rose-500 mt-0.5">
                          Reembolsado: -{formatCurrency(Number((reg as any).refunded_amount))}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8 max-md:h-11 max-md:w-11"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(reg.id); setDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={reg.checked_in ? 'default' : 'outline'}
                        size="sm"
                        className={
                          reg.checked_in
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 h-8 max-md:h-11 px-3 gap-1.5'
                            : 'h-8 max-md:h-11 px-3 gap-1.5 text-muted-foreground'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCheckIn(reg.id, reg.checked_in);
                        }}
                        disabled={checkingId === reg.id}
                      >
                        {checkingId === reg.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : reg.checked_in ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {checkingId === reg.id
                          ? '...'
                          : reg.checked_in
                            ? 'Confirmado'
                            : 'Check-in'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium">Nº</th>
                  <th className="text-left p-4 text-sm font-medium">Nome</th>
                  <th className="text-left p-4 text-sm font-medium">WhatsApp</th>
                  <th className="text-left p-4 text-sm font-medium">Igreja</th>
                  <th className="text-left p-4 text-sm font-medium">Valor</th>
                  <th className="text-left p-4 text-sm font-medium">Valor Pago</th>
                  <th className="text-left p-4 text-sm font-medium">% Pago</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Presença</th>
                  <th className="text-left p-4 text-sm font-medium">Data</th>
                  <th className="text-left p-4 text-sm font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((reg, idx) => (
                  <tr
                    key={reg.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${reg.id}`)}
                  >
                    <td className="p-4 text-base">{page * pageSize + idx + 1}</td>
                    <td className="p-4 text-base font-medium">{reg.full_name}</td>
                    <td className="p-4 text-base">{reg.whatsapp}</td>
                    <td className="p-4 text-base">{reg.church || '-'}</td>
                    <td className="p-4 text-base">
                      <span>{formatCurrency(reg.event_lots?.price ?? reg.events?.price ?? 0)}</span>
                      <br />
                      <span className="text-[10px] text-muted-foreground">{reg.event_lots?.name ?? 'Inscrição Normal'}</span>
                    </td>
                    <td className="p-4 text-base font-medium">
                      {(reg as any).paid_amount != null
                        ? formatCurrency(Number((reg as any).paid_amount))
                        : '-'}
                    </td>
                    <td className="p-4 text-base font-medium">
                      {(() => {
                        const effectivePrice = reg.event_lots?.price ?? reg.events?.price;
                        const paid = (reg as any).paid_amount;
                        if (effectivePrice && paid != null) {
                          const pct = Math.min(100, Math.round((Number(paid) / effectivePrice) * 100));
                          return (
                            <span className={pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : ''}>
                              {pct}%
                            </span>
                          );
                        }
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </td>
                    <td className="p-4 text-base">
                      <Badge
                        variant={reg.payment_status === 'paid' ? 'default' : 'secondary'}
                        className={reg.payment_status === 'refunded' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : reg.payment_status === 'canceled' ? 'bg-muted text-muted-foreground' : ''}
                      >
                        {paymentStatusLabels[reg.payment_status]}
                      </Badge>
                    </td>
                    <td className="p-4 text-base">
                      <Button
                        variant={reg.checked_in ? 'default' : 'outline'}
                        size="sm"
                        className={
                          reg.checked_in
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 h-7 px-2.5 gap-1'
                            : 'h-7 px-2.5 gap-1 text-muted-foreground'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCheckIn(reg.id, reg.checked_in);
                        }}
                        disabled={checkingId === reg.id}
                      >
                        {checkingId === reg.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : reg.checked_in ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <UserCheck className="h-3 w-3" />
                        )}
                        {checkingId === reg.id
                          ? '...'
                          : reg.checked_in
                            ? 'Confirmado'
                            : 'Check-in'}
                      </Button>
                    </td>
                    <td className="p-4 text-base">{formatDate(reg.created_at)}</td>
                    <td className="p-4 text-base">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(reg.id); setDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); setImportFile(null); setImportPreview(null); setImportResult(null); } }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar Inscrições via CSV</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV com os dados das inscrições.
              Os cabeçalhos devem seguir o formato do modelo disponível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted">
              <FileDown className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">
                Baixe o modelo CSV para ver o formato esperado.
              </p>
              <Button size="sm" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={downloadTemplate}>
                Baixar modelo
              </Button>
            </div>
            <div>
              <Label htmlFor="csv-file" className="text-foreground">Selecionar arquivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="file:text-foreground file:bg-muted file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-sm file:mr-3"
              />
            </div>
            {importPreview && (
              <div className="text-sm text-muted-foreground">
                {importPreview.length} registro(s) encontrado(s) no arquivo.
              </div>
            )}
            {importResult && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-400">
                  {importResult.success} inscrição(ões) importada(s) com sucesso.
                </p>
                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-400">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={() => { setImportDialogOpen(false); setImportFile(null); setImportPreview(null); setImportResult(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground"
              onClick={handleImport}
              disabled={!importPreview || importing || !!importResult}
            >
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir inscrição</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta inscrição? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => { handleDelete(); setDialogOpen(false); }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
