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
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate, formatCurrency, normalizeText, paymentStatusLabels, paymentMethodLabels } from '@/lib/utils';
import { toast } from 'sonner';
import { Trash2, Search, X, Download, Upload, FileDown, UserCheck, Loader2, Check, MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Papa from 'papaparse';
import { useTrial } from '@/components/layout/ChurchGuard';
import { fetchFormFields } from '@/lib/form-fields';
import type { FormField, FieldType, FormStep } from '@/lib/form-fields';

interface Registration {
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
  events: { title: string; price: number } | null;
  event_lots: { name: string; price: number } | null;
  extra_fields: Record<string, unknown> | null;
}

interface FormMapping {
  fields: FormField[];
  headers: string[];
  labelToField: Record<string, FormField>;
  keyToField: Record<string, FormField>;
  dbColumnToField: Record<string, FormField>;
  booleanFields: Set<string>;
  selectFields: Record<string, string[]>;
}

async function getFormMapping(eventId: string, isCustom: boolean, disabledSteps?: FormStep[]): Promise<FormMapping> {
  const fields = await fetchFormFields(eventId, isCustom, disabledSteps);
  const headers = fields.map((f) => f.label);
  const labelToField: Record<string, FormField> = {};
  const keyToField: Record<string, FormField> = {};
  const dbColumnToField: Record<string, FormField> = {};
  const booleanFields = new Set<string>();
  const selectFields: Record<string, string[]> = {};

  for (const f of fields) {
    labelToField[f.label] = f;
    keyToField[f.field_key] = f;
    if (f.db_column) dbColumnToField[f.db_column] = f;
    if (f.field_type === 'checkbox' && (!f.options || f.options.length === 0)) {
      booleanFields.add(f.field_key);
    }
    if (f.field_type === 'gender') {
      booleanFields.add(f.field_key);
    }
    if (f.options && f.options.length > 0) {
      selectFields[f.field_key] = f.options;
    }
  }

  return { fields, headers, labelToField, keyToField, dbColumnToField, booleanFields, selectFields };
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  'PIX': 'pix',
  'Cartão de crédito': 'credit_card',
  'Dinheiro': 'cash',
  'Transferência': 'bank_transfer',
  'Outro': 'other',
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  'Pendente': 'pending',
  'Pago': 'paid',
  'Em atraso': 'overdue',
  'Reembolsado': 'refunded',
  'Cancelado': 'canceled',
};

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
  const [churchFilter, setChurchFilter] = useState(searchParams.get('church') || '');
  const [checkinFilter, setCheckinFilter] = useState(searchParams.get('checkin') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [sortField, setSortField] = useState(searchParams.get('sort') || 'full_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((searchParams.get('dir') as 'asc' | 'desc') || 'asc');
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [churches, setChurches] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter) params.set('payment_status', statusFilter);
    if (churchFilter) params.set('church', churchFilter);
    if (checkinFilter) params.set('checkin', checkinFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (sortField !== 'full_name') params.set('sort', sortField);
    if (sortDirection !== 'asc') params.set('dir', sortDirection);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, churchFilter, checkinFilter, dateFrom, dateTo, sortField, sortDirection, setSearchParams]);

  useEffect(() => {
    if (!eventId) return;
    supabase.from('registrations')
      .select('church')
      .eq('event_id', eventId)
      .not('church', 'is', null)
      .neq('church', '')
      .neq('payment_status', 'canceled')
      .order('church')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.church).filter(Boolean) as string[])];
        setChurches(unique);
      });
  }, [eventId]);

  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('registrations')
      .select('*, events(title, price), event_lots!lot_id(name, price)', { count: 'exact' });

    if (statusFilter) {
      query = query.eq('payment_status', statusFilter);
    } else {
      query = query.neq('payment_status', 'canceled');
    }
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`
      );
    }
    if (churchFilter) {
      query = query.eq('church', churchFilter);
    }
    if (checkinFilter === 'checked') {
      query = query.eq('checked_in', true);
    } else if (checkinFilter === 'pending') {
      query = query.eq('checked_in', false);
    }
    if (dateFrom) {
      query = query.gte('created_at::date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at::date', dateTo);
    }

    const ascending = sortDirection === 'asc';
    const sortableFields = ['full_name', 'church', 'payment_status', 'checked_in', 'created_at', 'paid_amount'];
    const orderField = sortableFields.includes(sortField) ? sortField : 'created_at';
    query = query.order(orderField, { ascending, nullsFirst: false });

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: result, count, error: fetchErr } = await query.range(from, to);

    if (fetchErr) {
      setFetchError(fetchErr.message);
      setData([]);
      setTotalCount(0);
    } else {
      setFetchError(null);
      let rows = (result || []) as unknown as Registration[];

      if (sortField === 'price') {
        rows = [...rows].sort((a, b) => {
          const priceA = a.event_lots?.price ?? a.events?.price ?? 0;
          const priceB = b.event_lots?.price ?? b.events?.price ?? 0;
          return ascending ? priceA - priceB : priceB - priceA;
        });
      } else if (sortField === 'percent_paid') {
        rows = [...rows].sort((a, b) => {
          const priceA = a.event_lots?.price ?? a.events?.price ?? 0;
          const priceB = b.event_lots?.price ?? b.events?.price ?? 0;
          const pctA = priceA ? Math.min(100, Math.round(((a as any).paid_amount || 0) / priceA * 100)) : 0;
          const pctB = priceB ? Math.min(100, Math.round(((b as any).paid_amount || 0) / priceB * 100)) : 0;
          return ascending ? pctA - pctB : pctB - pctA;
        });
      }

      setData(rows);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [search, eventId, statusFilter, page, sortField, sortDirection, churchFilter, checkinFilter, dateFrom, dateTo]);

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

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('registrations')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
    } else {
      toast.success(`${ids.length} inscrição(ões) excluída(s) com sucesso`);
      setSelectedIds(new Set());
      fetchData();
    }

    setBulkDeleting(false);
    setBulkDeleteOpen(false);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'full_name' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setChurchFilter('');
    setCheckinFilter('');
    setDateFrom('');
    setDateTo('');
    setSortField('full_name');
    setSortDirection('asc');
    setPage(0);
    setSearchParams({});
  };

  const hasFilters = search || statusFilter || churchFilter || checkinFilter || dateFrom || dateTo || sortField !== 'full_name';

  const getDisabledSteps = (): FormStep[] => {
    const disabled: FormStep[] = [];
    if (event?.step_personal === false) disabled.push('personal');
    if (event?.step_christian_life === false) disabled.push('christian_life');
    if (event?.step_health === false) disabled.push('health');
    if (event?.step_emergency === false) disabled.push('emergency');
    if (event?.step_other === false) disabled.push('other');
    return disabled;
  };

  const META_HEADERS = ['payment_method', 'payment_status', 'paid_amount', 'private_notes', 'event_title'];

  const getSampleValue = (field: FormField): string => {
    switch (field.field_type) {
      case 'email': return 'email@exemplo.com';
      case 'phone': return '(21) 99999-9999';
      case 'cpf': return '000.000.000-00';
      case 'cnpj': return '00.000.000/0000-00';
      case 'cep': return '00000-000';
      case 'date': return '15/01/2000';
      case 'gender': return 'M';
      case 'number': return '0';
      case 'textarea': return 'Texto de exemplo';
      case 'select':
      case 'checkbox':
        if (field.options && field.options.length > 0) return field.options.slice(0, 2).join(',');
        return 'Sim';
      default: return 'Exemplo';
    }
  };

  const downloadTemplate = async () => {
    if (!eventId) return;
    const mapping = await getFormMapping(eventId, event?.is_custom ?? false, getDisabledSteps());
    
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inscrições');

    // Use field_key as header for exact matching during import
    const fieldHeaders = mapping.fields.map((f) => f.field_key);
    const allHeaders = [...fieldHeaders, ...META_HEADERS];
    ws.columns = allHeaders.map((h) => ({ header: h, key: h, width: 22 }));

    const sampleRow: Record<string, string> = {};
    for (const field of mapping.fields) {
      sampleRow[field.field_key] = getSampleValue(field);
    }
    sampleRow['payment_method'] = 'pix';
    sampleRow['payment_status'] = 'pending';
    sampleRow['paid_amount'] = '';
    sampleRow['private_notes'] = '';
    sampleRow['event_title'] = event?.title || '';
    ws.addRow(sampleRow);

    let colIndex = 0;
    for (const field of mapping.fields) {
      colIndex++;
      const colLetter = String.fromCharCode(64 + colIndex);
      const range = `${colLetter}2:${colLetter}1000`;

      if (field.field_type === 'gender') {
        (ws as any).dataValidations.add(range, { type: 'list', formulae: ['"M,F,other"'] });
      } else if (field.field_type === 'checkbox' && (!field.options || field.options.length === 0)) {
        (ws as any).dataValidations.add(range, { type: 'list', formulae: ['"Sim,Não"'] });
      } else if (field.options && field.options.length > 0) {
        const formulae = ['"' + field.options.join(',') + '"'];
        (ws as any).dataValidations.add(range, { type: 'list', formulae });
      }
    }

    const metaStartCol = fieldHeaders.length + 1;
    const paymentMethodCol = String.fromCharCode(64 + metaStartCol);
    const paymentStatusCol = String.fromCharCode(64 + metaStartCol + 1);
    (ws as any).dataValidations.add(`${paymentMethodCol}2:${paymentMethodCol}1000`, { type: 'list', formulae: ['"pix,credit_card,cash,bank_transfer,other,external_link"'] });
    (ws as any).dataValidations.add(`${paymentStatusCol}2:${paymentStatusCol}1000`, { type: 'list', formulae: ['"pending,paid,overdue,refunded,canceled"'] });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_inscricoes.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

    if (isXlsx) {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        if (!ws || ws.rowCount < 2) {
          setImportResult({ success: 0, errors: ['Arquivo xlsx vazio ou sem dados.'] });
          return;
        }
        const headerRow = ws.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value ?? '').trim();
        });
        const data: Record<string, string>[] = [];
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const record: Record<string, string> = {};
          headers.forEach((header, idx) => {
            if (!header) return;
            const cell = row.getCell(idx + 1);
            let val: string;
            if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
              val = String((cell.value as any).result ?? '');
            } else if (cell.value && typeof cell.value === 'object' && 'text' in cell.value) {
              val = String((cell.value as any).text ?? '');
            } else if (cell.value instanceof Date) {
              const d = cell.value;
              val = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            } else {
              val = cell.value != null ? String(cell.value) : '';
            }
            record[header] = val.trim();
          });
          data.push(record);
        });
        setImportPreview(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setImportResult({ success: 0, errors: [`Erro ao ler arquivo xlsx: ${msg}`] });
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true } as Papa.ParseConfig);
        const typedParsed = parsed as Papa.ParseResult<Record<string, string>>;
        const realErrors = typedParsed.errors.filter(
          (err) => !err.message.includes('Too few fields') && !err.message.includes('Too many fields')
        );
        if (realErrors.length) {
          setImportPreview(typedParsed.data);
          setImportResult({ success: 0, errors: realErrors.map((err) => `Linha ${err.row + 1}: ${err.message}`) });
          return;
        }
        setImportPreview(typedParsed.data);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0 || !eventId) return;
    setImporting(true);

    for (const row of importPreview) {
      for (const key of Object.keys(row)) {
        if (typeof row[key] !== 'string') {
          row[key] = String(row[key] ?? '');
        }
      }
    }

    const errors: string[] = [];
    let success = 0;

    const mapping = await getFormMapping(eventId, event?.is_custom ?? false, getDisabledSteps());

    const headerToField: Record<string, { field_key: string; db_column: string | null; field_type: FieldType; options: string[] | null; label: string }> = {};
    const normalizedMap = new Map<string, string>();
    const normalizeHeader = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');

    const KNOWN_FIELD_KEY_TO_DB_COLUMN: Record<string, string> = {
      'full_name': 'full_name',
      'email': 'email',
      'whatsapp': 'whatsapp',
      'birth_date': 'birth_date',
      'gender': 'gender',
      'cpf': 'cpf',
      'rg': 'rg',
      'cep': 'cep',
      'address': 'address',
      'city': 'city',
      'state': 'state',
      'perfil_fe': 'perfil_fe',
      'is_baptized': 'is_baptized',
      'church': 'church',
      'pastor': 'pastor',
      'church_role': 'church_role',
      'church_role_other': 'church_role_other',
      'godparent': 'godparent',
      'godparent_contact': 'godparent_contact',
      'pastoral_authorization': 'pastoral_authorization',
      'health_info': 'health_info',
      'has_allergies': 'has_allergies',
      'allergy_description': 'allergy_description',
      'dietary_restrictions': 'dietary_restrictions',
      'emergency_contact': 'emergency_contact',
      'emergency_phone': 'emergency_phone',
      'accept_terms': 'accept_terms',
      'payment_method': 'payment_method',
      'payment_status': 'payment_status',
      'private_notes': 'private_notes',
    };

    const LABEL_TO_DB_COLUMN: Record<string, string> = {
      'nome': 'full_name',
      'nome completo': 'full_name',
      'full_name': 'full_name',
      'e-mail': 'email',
      'email': 'email',
      'whatsapp': 'whatsapp',
      'celular': 'whatsapp',
      'telefone': 'whatsapp',
      'data de nascimento': 'birth_date',
      'nascimento': 'birth_date',
      'data nascimento': 'birth_date',
      'birthday': 'birth_date',
      'gênero': 'gender',
      'genero': 'gender',
      'gender': 'gender',
      'cpf': 'cpf',
      'rg': 'rg',
      'cep': 'cep',
      'endereço': 'address',
      'endereco': 'address',
      'address': 'address',
      'cidade': 'city',
      'city': 'city',
      'estado': 'state',
      'state': 'state',
      'você se considera cristão(ã)?': 'perfil_fe',
      'é cristão?': 'perfil_fe',
      'cristão': 'perfil_fe',
      'é batizado(a)?': 'is_baptized',
      'batizado': 'is_baptized',
      'igreja': 'church',
      'church': 'church',
      'pastor': 'pastor',
      'cargo/função na igreja': 'church_role',
      'cargo': 'church_role',
      'qual cargo?': 'church_role_other',
      'nome do padrinho/madrinha': 'godparent',
      'padrinho': 'godparent',
      'contato do padrinho/madrinha': 'godparent_contact',
      'autorização pastoral': 'pastoral_authorization',
      'informações de saúde': 'health_info',
      'saúde': 'health_info',
      'possui alergias?': 'has_allergies',
      'alergias': 'has_allergies',
      'descreva as alergias': 'allergy_description',
      'restrições alimentares': 'dietary_restrictions',
      'nome do contato de emergência': 'emergency_contact',
      'contato de emergência': 'emergency_contact',
      'telefone de emergência': 'emergency_phone',
      'nome do cônjuge': 'spouse_name',
      'nome do conjuge': 'spouse_name',
      'cônjuge': 'spouse_name',
      'conjuge': 'spouse_name',
      'estado civil': 'marital_status',
      'estado civil?': 'marital_status',
      'data de casamento': 'wedding_date',
      'data casamento': 'wedding_date',
      'possui necessidades especiais?': 'has_special_needs',
      'necessidades especiais': 'has_special_needs',
      'qual?': 'special_needs_description',
      'qual necessidade?': 'special_needs_description',
    };

    const KNOWN_CUSTOM_FIELD_KEY_TO_DB_COLUMN: Record<string, string> = {
      'e-crsitao': 'perfil_fe',
      'e-cristao': 'perfil_fe',
      'e-pastor': 'pastor',
      'nome-da-igreja': 'church',
      'e-batizado': 'is_baptized',
      'cargo': 'church_role',
      'qual-cargo': 'church_role_other',
      'padrinho': 'godparent',
      'contato-do-padrinho': 'godparent_contact',
    };

    const dynamicFieldKeyToDbColumn: Record<string, string> = {};
    for (const field of mapping.fields) {
      if (field.db_column) {
        dynamicFieldKeyToDbColumn[field.field_key] = field.db_column;
      }
    }

    const resolveDbColumn = (fieldKey: string, dbColumn: string | null, label: string): string | null => {
      if (dbColumn) return dbColumn;
      if (dynamicFieldKeyToDbColumn[fieldKey]) return dynamicFieldKeyToDbColumn[fieldKey];
      if (KNOWN_CUSTOM_FIELD_KEY_TO_DB_COLUMN[fieldKey]) return KNOWN_CUSTOM_FIELD_KEY_TO_DB_COLUMN[fieldKey];
      const labelLower = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (LABEL_TO_DB_COLUMN[labelLower]) return LABEL_TO_DB_COLUMN[labelLower];
      return null;
    };

    for (const field of mapping.fields) {
      headerToField[field.label] = { field_key: field.field_key, db_column: field.db_column, field_type: field.field_type, options: field.options, label: field.label };
      headerToField[field.field_key] = { field_key: field.field_key, db_column: field.db_column, field_type: field.field_type, options: field.options, label: field.label };
      normalizedMap.set(normalizeHeader(field.label), field.label);
      normalizedMap.set(normalizeHeader(field.field_key), field.label);
    }
    headerToField['Forma de Pagamento'] = { field_key: 'payment_method', db_column: 'payment_method', field_type: 'select', options: null, label: 'Forma de Pagamento' };
    headerToField['payment_method'] = { field_key: 'payment_method', db_column: 'payment_method', field_type: 'select', options: null, label: 'Forma de Pagamento' };
    headerToField['Status do Pagamento'] = { field_key: 'payment_status', db_column: 'payment_status', field_type: 'select', options: null, label: 'Status do Pagamento' };
    headerToField['payment_status'] = { field_key: 'payment_status', db_column: 'payment_status', field_type: 'select', options: null, label: 'Status do Pagamento' };
    headerToField['Valor Pago'] = { field_key: 'paid_amount', db_column: 'paid_amount', field_type: 'number', options: null, label: 'Valor Pago' };
    headerToField['paid_amount'] = { field_key: 'paid_amount', db_column: 'paid_amount', field_type: 'number', options: null, label: 'Valor Pago' };
    headerToField['Observações'] = { field_key: 'private_notes', db_column: 'private_notes', field_type: 'textarea', options: null, label: 'Observações' };
    headerToField['private_notes'] = { field_key: 'private_notes', db_column: 'private_notes', field_type: 'textarea', options: null, label: 'Observações' };
    headerToField['Evento'] = { field_key: 'event_title', db_column: null, field_type: 'text', options: null, label: 'Evento' };
    headerToField['event_title'] = { field_key: 'event_title', db_column: null, field_type: 'text', options: null, label: 'Evento' };
    normalizedMap.set(normalizeHeader('Forma de Pagamento'), 'Forma de Pagamento');
    normalizedMap.set(normalizeHeader('payment_method'), 'Forma de Pagamento');
    normalizedMap.set(normalizeHeader('Status do Pagamento'), 'Status do Pagamento');
    normalizedMap.set(normalizeHeader('payment_status'), 'Status do Pagamento');
    normalizedMap.set(normalizeHeader('Valor Pago'), 'Valor Pago');
    normalizedMap.set(normalizeHeader('paid_amount'), 'Valor Pago');
    normalizedMap.set(normalizeHeader('Observações'), 'Observações');
    normalizedMap.set(normalizeHeader('private_notes'), 'Observações');
    normalizedMap.set(normalizeHeader('Evento'), 'Evento');
    normalizedMap.set(normalizeHeader('event_title'), 'Evento');

    const { data: events } = await supabase.from('events').select('id, title');
    const eventMap = new Map((events || []).map((e) => [e.title.toLowerCase(), e.id]));

    const validRecords: Record<string, unknown>[] = [];

    for (let i = 0; i < importPreview.length; i++) {
      const row = importPreview[i];
      const record: Record<string, unknown> = {};
      const extraData: Record<string, unknown> = {};

      for (const csvHeader of Object.keys(row)) {
        const trimmedHeader = csvHeader.trim();
        const normalizedCsvHeader = normalizeHeader(trimmedHeader);
        let fieldInfo = headerToField[trimmedHeader];
        if (!fieldInfo) {
          const originalLabel = normalizedMap.get(normalizedCsvHeader);
          if (originalLabel) fieldInfo = headerToField[originalLabel];
        }
        if (!fieldInfo) {
          for (const [key, label] of normalizedMap.entries()) {
            if (key === normalizedCsvHeader) {
              fieldInfo = headerToField[label];
              break;
            }
          }
        }
        if (!fieldInfo) continue;

        const val = row[csvHeader]?.trim() || '';

        if (fieldInfo.field_key === 'event_title') {
          if (!val) {
            record.event_id = eventId;
            continue;
          }
          const foundEventId = eventMap.get(val.toLowerCase());
          if (!foundEventId) {
            record.event_id = eventId;
            continue;
          }
          record.event_id = foundEventId;
          continue;
        }

        if (!val) continue;

        if (fieldInfo.field_type === 'checkbox' && (!fieldInfo.options || fieldInfo.options.length === 0)) {
          const boolVal = val.toLowerCase() === 'sim' || val.toLowerCase() === 'true' || val.toLowerCase() === '1';
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          if (dbCol) {
            record[dbCol] = boolVal;
          } else {
            extraData[fieldInfo.field_key] = boolVal;
          }
          continue;
        }

        if (fieldInfo.field_type === 'checkbox' && fieldInfo.options && fieldInfo.options.length > 0) {
          const csvOptions = val.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          const selectedValues = csvOptions.filter((s: string) => fieldInfo.options!.includes(s));
          if (selectedValues.length > 0) {
            extraData[fieldInfo.field_key] = selectedValues;
          }
          continue;
        }

        if (fieldInfo.field_type === 'gender' || fieldInfo.field_key === 'gender') {
          const lower = val.toLowerCase();
          const genderVal = (lower === 'masculino' || lower === 'm') ? 'M'
            : (lower === 'feminino' || lower === 'f') ? 'F'
            : 'other';
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          if (dbCol) {
            record[dbCol] = genderVal;
          } else {
            extraData[fieldInfo.field_key] = genderVal;
          }
          continue;
        }

        if (fieldInfo.field_key === 'payment_method') {
          const methodVal = PAYMENT_METHOD_MAP[val] || val.toLowerCase().replace(/\s+/g, '_');
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          record[dbCol || 'payment_method'] = methodVal;
          continue;
        }

        if (fieldInfo.field_key === 'payment_status') {
          const statusVal = PAYMENT_STATUS_MAP[val] || val.toLowerCase().replace(/\s+/g, '_');
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          record[dbCol || 'payment_status'] = statusVal;
          continue;
        }

        if (fieldInfo.field_type === 'number') {
          const numVal = parseFloat(val.replace(',', '.'));
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          if (dbCol) {
            record[dbCol] = isNaN(numVal) ? val : numVal;
          } else {
            extraData[fieldInfo.field_key] = isNaN(numVal) ? val : numVal;
          }
          continue;
        }

        if (fieldInfo.field_type === 'date' && val) {
          let dbVal = val;
          const partsSlash = val.split('/');
          if (partsSlash.length === 3 && partsSlash[0].length === 2) {
            dbVal = `${partsSlash[2]}-${partsSlash[1].padStart(2, '0')}-${partsSlash[0].padStart(2, '0')}`;
          }
          const partsDash = val.split('-');
          if (partsDash.length === 3 && partsDash[0].length === 4) {
            const testDate = new Date(val);
            if (!isNaN(testDate.getTime())) {
              dbVal = val;
            }
          }
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          if (dbCol) {
            record[dbCol] = dbVal;
          } else {
            extraData[fieldInfo.field_key] = dbVal;
          }
          continue;
        }

        if (fieldInfo.field_type === 'cpf' && val) {
          const digits = val.replace(/\D/g, '');
          let formatted = val;
          if (digits.length === 11) {
            formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
          }
          const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
          if (dbCol) {
            record[dbCol] = formatted;
          } else {
            extraData[fieldInfo.field_key] = formatted;
          }
          continue;
        }

        const BOOLEAN_DB_COLUMNS = new Set([
          'is_baptized', 'has_allergies', 'accept_terms',
          'pastoral_authorization', 'checked_in',
        ]);
        const dbCol = resolveDbColumn(fieldInfo.field_key, fieldInfo.db_column, fieldInfo.label);
        const normalVal =
          (fieldInfo.field_type === 'text' || fieldInfo.field_type === 'textarea')
            ? normalizeText(val)
            : fieldInfo.field_type === 'email'
              ? val.trim().toLowerCase()
              : val;
        if (dbCol) {
          if (BOOLEAN_DB_COLUMNS.has(dbCol)) {
            const lower = val.toLowerCase();
            record[dbCol] = lower === 'sim' || lower === 'true' || lower === '1' || lower === 'yes';
          } else {
            record[dbCol] = normalVal;
          }
        } else {
          extraData[fieldInfo.field_key] = normalVal;
        }
      }

      if (Object.keys(extraData).length > 0) {
        record.extra_fields = extraData;
      }

      if (record.church_role && typeof record.church_role === 'string') {
        const ROLE_MAP: Record<string, string> = {
          'pastor': 'Pastor', 'missionario': 'Missionário', 'missionário': 'Missionário',
          'diacovo': 'Diácono', 'diácono': 'Diácono', 'presbitero': 'Presbítero',
          'presbítero': 'Presbítero', 'lider de ministerio': 'Líder de Ministério',
          'líder de ministério': 'Líder de Ministério', 'obreiro': 'Obreiro',
          'membro': 'Membro', 'congregado': 'Congregado', 'outro': 'Outro',
        };
        const normalized = ROLE_MAP[record.church_role.toLowerCase()];
        if (normalized) record.church_role = normalized;
      }

      if (!record.event_id) {
        record.event_id = eventId;
      }
      if (!record.event_id) {
        errors.push(`Linha ${i + 2}: Coluna "Evento" não encontrada ou valor não corresponde a nenhum evento existente`);
        continue;
      }
      if (!record.full_name || !record.email || !record.whatsapp) {
        errors.push(`Linha ${i + 2}: Nome, E-mail e WhatsApp são obrigatórios`);
        continue;
      }

      validRecords.push(record);
    }

    if (validRecords.length > 0) {
      console.log(`[IMPORT] Processando ${validRecords.length} registros`);
      console.log('[IMPORT] Primeiro registro:', validRecords[0]);

      for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        const { error: insertErr } = await supabase
          .from('registrations')
          .insert(rec);

        if (insertErr && insertErr.code === '23505') {
          const { error: updateErr } = await supabase
            .from('registrations')
            .update(rec)
            .eq('email', rec.email)
            .eq('event_id', rec.event_id);
          if (updateErr) {
            errors.push(`Registro "${rec.full_name}": ${updateErr.message}`);
          } else {
            success++;
          }
        } else if (insertErr) {
          console.error(`[IMPORT] Erro insert "${rec.full_name}":`, insertErr.code, insertErr.message);
          errors.push(`Registro "${rec.full_name}": ${insertErr.message}`);
        } else {
          success++;
        }
      }

      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      console.log(`[IMPORT] Verificação: esperava ${success}, banco tem ${count}`);

      const { data: paidRegs } = await supabase
        .from('registrations')
        .select('id, paid_amount, payment_method')
        .eq('event_id', eventId)
        .eq('payment_status', 'paid')
        .gt('paid_amount', 0);

      if (paidRegs && paidRegs.length > 0) {
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('registration_id')
          .in('registration_id', paidRegs.map((r) => r.id))
          .eq('status', 'paid');

        const existingIds = new Set((existingPayments || []).map((p) => p.registration_id));
        const newPayments = paidRegs
          .filter((r) => !existingIds.has(r.id))
          .map((r) => ({
            registration_id: r.id,
            amount: Number(r.paid_amount),
            status: 'paid' as const,
            payment_method: r.payment_method || 'pix',
          }));

        if (newPayments.length > 0) {
          await supabase.from('payments').insert(newPayments);
        }
      }
    }

    setImportResult({ success, errors });
    setImporting(false);
    if (success > 0) fetchData();
  };

  const handleExport = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
    const mapping = await getFormMapping(eventId, event?.is_custom ?? false);

      const { data, error } = await supabase
        .from('registrations')
        .select('*, events(title, price), event_lots!lot_id(name, price)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error || !data) {
        toast.error('Erro ao exportar: ' + (error?.message || 'sem dados'));
        return;
      }
      const rows = data as unknown as Registration[];
      const esc = (v: unknown) => `"${(`${v ?? ''}`).replace(/"/g, '""')}"`;

      const META_EXPORT_HEADERS = ['event_title', 'payment_method', 'payment_status', 'paid_amount', 'private_notes', 'pct_paid', 'price', 'created_at'];
      const fieldHeaders = mapping.fields.map((f) => f.field_key);
      const allHeaders = [...fieldHeaders, ...META_EXPORT_HEADERS];

      const csv = [
        allHeaders.join(','),
        ...rows.map((r) => {
          const fieldValues: string[] = [];
          for (const field of mapping.fields) {
            let val = '';
            if (field.db_column) {
              val = String((r as any)[field.db_column] ?? '');
            } else if (r.extra_fields && typeof r.extra_fields === 'object') {
              val = String((r.extra_fields as Record<string, unknown>)[field.field_key] ?? '');
            }

            if (field.field_type === 'checkbox' && (!field.options || field.options.length === 0)) {
              val = val ? 'Sim' : 'Não';
            } else if (field.field_type === 'gender') {
              val = val === 'M' ? 'Masculino' : val === 'F' ? 'Feminino' : val === 'other' ? 'Outro' : '';
            } else if (field.field_type === 'date' && val) {
              val = formatDate(val);
            }

            fieldValues.push(esc(val));
          }

          const effectivePrice = r.event_lots?.price ?? r.events?.price;
          const paidAmount = (r as any).paid_amount ? Number((r as any).paid_amount) : 0;
          const pctPaid = effectivePrice ? Math.min(100, Math.round((paidAmount / effectivePrice) * 100)) + '%' : '';

          const metaValues = [
            esc(r.events?.title || ''),
            r.payment_method || '',
            r.payment_status || '',
            (r as any).paid_amount ? paidAmount.toFixed(2) : '',
            esc(r.private_notes),
            pctPaid,
            effectivePrice ? Number(effectivePrice).toFixed(2) : '',
            formatDate(r.created_at),
          ];

          return [...fieldValues, ...metaValues].join(',');
        }),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + (err?.message || 'erro desconhecido'));
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
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

      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4 shadow-lg">
      <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" onClick={downloadTemplate} className="hidden md:inline-flex shrink-0 rounded-lg">
            <FileDown className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Modelo</span>
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="hidden md:inline-flex shrink-0 rounded-lg">
            <Upload className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Importar CSV</span>
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="hidden md:inline-flex shrink-0 rounded-lg">
            <Download className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">{exporting ? 'Exportando...' : 'Exportar'}</span>
          </Button>
          <div className="md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-card backdrop-blur-md hover:bg-accent text-foreground transition-colors size-9 max-md:h-11 max-md:w-11 md:h-10 md:w-10">
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
        <Select value={churchFilter} onValueChange={(v: string) => { setChurchFilter(v); setPage(0); }}>
          <SelectTrigger className="hidden md:flex w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
            <SelectValue placeholder="Igreja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {churches.map((church) => (
              <SelectItem key={church} value={church}>{church}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="hidden md:flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
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
          <Select value={checkinFilter} onValueChange={(v: string) => { setCheckinFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full md:min-w-0 md:flex-1 md:max-w-[200px] !h-10">
              <SelectValue>
                {(value) => {
                  if (value === 'checked') return '✓ Confirmado';
                  if (value === 'pending') return '○ Pendente';
                  return 'Presença';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="checked">✓ Confirmado</SelectItem>
              <SelectItem value="pending">○ Pendente</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              placeholder="De..."
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
            />
            <span className="text-muted-foreground text-sm">até</span>
            <Input
              type="date"
              placeholder="Até..."
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="w-full md:min-w-0 md:flex-1 md:max-w-[200px]"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="icon" className="inline-flex max-md:h-11 max-md:w-11 md:h-10 md:w-10" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      </div>

      {(search || statusFilter || churchFilter || checkinFilter || dateFrom || dateTo) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-sm text-muted-foreground">
            {loading ? 'Buscando...' : `Mostrando ${data.length} de ${totalCount}`}
          </span>
          {search && (
            <Badge variant="secondary" className="gap-1">
              Busca: {search}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setSearch(''); setPage(0); }} />
            </Badge>
          )}
          {statusFilter && (
            <Badge variant="secondary" className="gap-1">
              Status: {paymentStatusLabels[statusFilter]}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setStatusFilter(''); setPage(0); }} />
            </Badge>
          )}
          {churchFilter && (
            <Badge variant="secondary" className="gap-1">
              Igreja: {churchFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setChurchFilter(''); setPage(0); }} />
            </Badge>
          )}
          {checkinFilter && (
            <Badge variant="secondary" className="gap-1">
              Presença: {checkinFilter === 'checked' ? 'Confirmado' : 'Pendente'}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setCheckinFilter(''); setPage(0); }} />
            </Badge>
          )}
          {dateFrom && (
            <Badge variant="secondary" className="gap-1">
              De: {formatDate(dateFrom)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setDateFrom(''); setPage(0); }} />
            </Badge>
          )}
          {dateTo && (
            <Badge variant="secondary" className="gap-1">
              Até: {formatDate(dateTo)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setDateTo(''); setPage(0); }} />
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearFilters}>
            Limpar todos
          </Button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 mb-4 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionado(s)
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
              Limpar seleção
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Excluir ({selectedIds.size})
          </Button>
        </div>
      )}

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
        <Card className="mb-6 bg-card backdrop-blur-xl border-border shadow-2xl">
          <CardContent className="p-4 md:p-6">
          <div className="md:hidden flex items-center gap-2 mb-3 p-2">
            <Checkbox
              checked={selectedIds.size === data.length && data.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">Selecionar todos</span>
          </div>
          <div className="md:hidden space-y-3">
            {data.map((reg) => (
              <Card
                key={reg.id}
                className={`cursor-pointer hover:bg-accent/50 transition-colors min-h-[140px] ${selectedIds.has(reg.id) ? 'bg-muted/30' : ''}`}
                onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${reg.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(reg.id)}
                          onCheckedChange={() => handleSelect(reg.id)}
                          className="mt-1"
                        />
                      </div>
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
                          variant="secondary"
                          className={
                            reg.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                              : reg.payment_status === 'pending'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
                                : reg.payment_status === 'overdue'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                                  : reg.payment_status === 'refunded'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200'
                                    : reg.payment_status === 'canceled'
                                      ? 'bg-muted text-muted-foreground'
                                      : ''
                          }
                        >
                          {paymentStatusLabels[reg.payment_status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Valor: {formatCurrency(reg.event_lots?.price ?? reg.events?.price ?? 0)} — {reg.event_lots?.name ?? 'Inscrição Normal'}
                      </p>
                      {(reg as any).paid_amount != null && (
                        <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400 mt-1">
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
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8 max-md:h-11 max-md:w-11 md:h-10 md:w-10"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(reg.id); setDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={reg.checked_in ? 'default' : 'outline'}
                        size="sm"
                        className={
                          reg.checked_in
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 h-8 max-md:h-11 md:h-10 px-3 gap-1.5'
                            : 'h-8 max-md:h-11 md:h-10 px-3 gap-1.5 text-muted-foreground'
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
          <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="p-3 w-12">
                    <Checkbox
                      checked={selectedIds.size === data.length && data.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Nº</th>
                  {[
                    { field: 'full_name', label: 'Nome' },
                    { field: null, label: 'WhatsApp' },
                    { field: 'price', label: 'Valor' },
                    { field: 'paid_amount', label: 'Valor Pago' },
                    { field: 'percent_paid', label: '% Pago' },
                    { field: 'payment_status', label: 'Status' },
                    { field: 'checked_in', label: 'Presença' },
                    { field: 'created_at', label: 'Data' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`text-left p-4 text-sm font-medium ${col.field ? 'cursor-pointer hover:bg-muted/80 select-none' : ''}`}
                      onClick={col.field ? () => handleSort(col.field) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.field && sortField === col.field && (
                          sortDirection === 'asc'
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="text-left p-4 text-sm font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((reg, idx) => (
                  <tr
                    key={reg.id}
                    className={`border-b hover:bg-muted/50 dark:even:bg-muted/20 cursor-pointer ${selectedIds.has(reg.id) ? 'bg-muted/30' : ''}`}
                    onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${reg.id}`)}
                  >
                    <td className="p-3 w-12" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(reg.id)}
                        onCheckedChange={() => handleSelect(reg.id)}
                      />
                    </td>
                    <td className="p-4 text-base">{page * pageSize + idx + 1}</td>
                    <td className="p-4 text-base font-medium">{reg.full_name}</td>
                    <td className="p-4 text-base">{reg.whatsapp}</td>
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
                            <span className={pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                              {pct}%
                            </span>
                          );
                        }
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </td>
                    <td className="p-4 text-base">
                      <Badge
                        variant="secondary"
                        className={
                          reg.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                            : reg.payment_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
                              : reg.payment_status === 'overdue'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                                : reg.payment_status === 'refunded'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200'
                                  : reg.payment_status === 'canceled'
                                    ? 'bg-muted text-muted-foreground'
                                    : ''
                        }
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
          </CardContent>
        </Card>
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
              <Label htmlFor="csv-file" className="text-foreground">Selecionar arquivo (CSV ou XLSX)</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,.xlsx"
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
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-400">
                  {importResult.success} inscrição(ões) importada(s) com sucesso.
                </p>
                {importResult.errors.length > 0 && (
                  <>
                    <p className="text-sm font-medium text-red-400">
                      {importResult.errors.length} registro(s) falhou(m) — veja abaixo:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-red-900/30 bg-red-950/20 p-2">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-sm text-red-400">{err}</p>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        const csv = ['Erro', ...importResult.errors.map((e) => `"${e.replace(/"/g, '""')}"`)].join('\n');
                        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" /> Baixar lista de erros
                    </Button>
                  </>
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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir inscrições</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> inscrição(ões)?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
