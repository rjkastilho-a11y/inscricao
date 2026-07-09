import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard, SkeletonMobileCard, SkeletonTable } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, paymentStatusLabels, paymentMethodLabels } from '@/lib/utils';
import { Pencil, ArrowLeft, Trash2, CheckCircle, Loader2, Check, Copy, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentHistory } from '@/components/registration/PaymentHistory';
import type { PaymentRecord } from '@/lib/payments';
import { insertPayment, fetchPayments } from '@/lib/payments';
import { fetchFormFields } from '@/lib/form-fields';
import type { FormField } from '@/lib/form-fields';

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

function formatReceipt(name: string, eventTitle: string, amount: number): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return [
    `Olá, *${name}*! 👋`,
    '',
    `Passando para confirmar o recebimento do seu pagamento no valor de *R$ ${amount.toFixed(2)}* referente à sua inscrição no evento *${eventTitle}*.`,
    '',
    '✅ *Inscrição Confirmada!*',
    `Data do registro: ${dateStr}`,
  ].join('\n');
}

interface Registration {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string;
  gender: string;
  cpf: string | null;
  rg: string | null;
  cep: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_christian: boolean;
  perfil_fe: string;
  is_baptized: boolean;
  church: string;
  pastor: string;
  church_role: string;
  church_role_other: string;
  godparent: string;
  godparent_contact: string;
  pastoral_authorization: boolean;
  health_info: string;
  has_allergies: boolean | null;
  allergy_description: string | null;
  dietary_restrictions: string | null;
  emergency_contact: string;
  emergency_phone: string;
  payment_method: string;
  payment_status: string;
  private_notes: string;
  created_at: string;
  lot_id: string | null;
  extra_data: Record<string, any> | null;
  events: {
    title: string;
    step_personal: boolean;
    step_christian_life: boolean;
    step_health: boolean;
    step_emergency: boolean;
    step_other: boolean;
  } | null;
  event_lots: { name: string; price: number } | null;
}

export default function RegistrationDetailPage() {
  const { id, eventId } = useParams<{ id: string; eventId: string }>();
  const navigate = useNavigate();
  const [reg, setReg] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amount: number;
    receipt: string;
    cleanPhone: string;
  } | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [overpaymentOpen, setOverpaymentOpen] = useState(false);
  const [overpaymentData, setOverpaymentData] = useState<{
    amount: number;
    currentPaid: number;
    price: number;
  } | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);

  const refreshRegistration = async () => {
    if (!id || !eventId) return;
    const [{ data }, { data: eventsRes }] = await Promise.all([
      supabase
        .from('registrations')
        .select('*, events(title, step_personal, step_christian_life, step_health, step_emergency, step_other), event_lots!lot_id(name, price)')
        .eq('id', id)
        .single(),
      supabase
        .from('events')
        .select('is_custom')
        .eq('id', eventId || '')
        .single(),
    ]);
    setReg(data as unknown as Registration);

    if (eventsRes && data) {
      const isCustom = eventsRes.is_custom ?? false;
      const disabledSteps: FormField[] = [];
      if ((data as any).events?.step_personal === false) disabledSteps.push('personal' as any);
      if ((data as any).events?.step_christian_life === false) disabledSteps.push('christian_life' as any);
      if ((data as any).events?.step_health === false) disabledSteps.push('health' as any);
      if ((data as any).events?.step_emergency === false) disabledSteps.push('emergency' as any);
      if ((data as any).events?.step_other === false) disabledSteps.push('other' as any);
      const fields = await fetchFormFields(eventId || '', isCustom, disabledSteps as any);
      setFormFields(fields);
    }

    if (id) {
      const updatedPayments = await fetchPayments(id);
      setPayments(updatedPayments);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      await refreshRegistration();
      setLoading(false);
    };
    fetch();
  }, [id, eventId]);

  useEffect(() => {
    if (!id) return;
    fetchPayments(id).then(setPayments);
  }, [id]);

  const processMarkAsPaid = async (amount: number) => {
    setPaying(true);

    const { data: existingEntry } = await supabase
      .from('financial_entries')
      .select('id, amount')
      .eq('registration_id', id)
      .eq('type', 'income')
      .maybeSingle();

    const entryPayload = {
      event_id: reg!.event_id,
      registration_id: id,
      type: 'income' as const,
      category: 'registration',
      description: 'Inscrição Paga',
      amount: existingEntry ? Number(existingEntry.amount) + amount : amount,
      entry_date: new Date().toISOString().slice(0, 10),
    };

    const { error: finError } = existingEntry
      ? await supabase.from('financial_entries').update(entryPayload).eq('id', existingEntry.id)
      : await supabase.from('financial_entries').insert(entryPayload);

    if (finError) {
      toast.error('Erro ao registrar entrada financeira: ' + finError.message);
      setPaying(false);
      return;
    }

    const { error: paymentError } = await insertPayment(id!, amount, reg!.payment_method);
    if (paymentError) {
      toast.error('Erro ao registrar no histórico: ' + paymentError);
      setPaying(false);
      return;
    }

    await refreshRegistration();

    setPaymentSuccess({
      amount,
      receipt: formatReceipt(reg!.full_name, reg!.events?.title || 'Evento', amount),
      cleanPhone: cleanPhone(reg!.whatsapp),
    });
    setPayAmount('');
    setPaying(false);
    setOverpaymentOpen(false);
  };

  const handleMarkAsPaid = async () => {
    setPaying(true);
    const amount = parseFloat(payAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      setPaying(false);
      return;
    }

    const price = reg?.event_lots?.price ?? 0;
    const currentPaid = Number((reg as any).paid_amount) || 0;

    if (price > 0 && currentPaid + amount >= price) {
      setPayDialogOpen(false);
      setOverpaymentData({ amount, currentPaid, price });
      setOverpaymentOpen(true);
      setPaying(false);
      return;
    }

    await processMarkAsPaid(amount);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      setDeleting(false);
      return;
    }
    navigate('/app/evento/' + eventId + '/inscricoes');
  };

  const refreshPayments = async () => {
    if (!id) return;
    const updated = await fetchPayments(id);
    setPayments(updated);
  };

  const CUSTOM_FIELD_KEY_TO_DB_COLUMN: Record<string, string> = {
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

  const hasField = (fieldKey: string): boolean => {
    return formFields.some(f => {
      if (!f.is_active) return false;
      if (f.field_key === fieldKey || f.db_column === fieldKey) return true;
      if (f.db_column && CUSTOM_FIELD_KEY_TO_DB_COLUMN[f.field_key] === f.db_column && fieldKey === f.db_column) return true;
      if (!f.db_column && CUSTOM_FIELD_KEY_TO_DB_COLUMN[f.field_key] === fieldKey) return true;
      return false;
    });
  };

  const getFieldValue = (fieldKey: string, dbColumn: string | null): unknown => {
    if (dbColumn && (reg as any)[dbColumn] != null) return (reg as any)[dbColumn];
    const extra = (reg as any).extra_fields;
    if (extra && typeof extra === 'object' && extra[fieldKey] != null) return extra[fieldKey];
    if (dbColumn) return (reg as any)[dbColumn];
    return null;
  };

  const formatFieldValue = (field: FormField, val: unknown): string => {
    if (val == null || val === '') return '-';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    if (field.field_type === 'date') return formatDate(String(val));
    return String(val);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Carregando..." />
        <div className="space-y-4">
          <SkeletonCard />
          <div className="md:hidden space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonMobileCard key={i} />)}
          </div>
          <div className="hidden md:block">
            <SkeletonTable rows={3} columns={2} />
          </div>
        </div>
      </div>
    );
  }
  if (!reg) return <div className="text-muted-foreground py-16 text-center">Inscrição não encontrada.</div>;

  return (
    <div>
      <PageHeader title={reg.full_name} />
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/evento/' + eventId + '/inscricoes')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Dados Pessoais</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=0`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hasField('email') && <Row label="E-mail" value={getFieldValue('email', 'email') || '-'} />}
            {hasField('whatsapp') && <Row label="WhatsApp" value={getFieldValue('whatsapp', 'whatsapp') || '-'} />}
            {hasField('birth_date') && <Row label="Nascimento" value={getFieldValue('birth_date', 'birth_date') ? formatDate(String(getFieldValue('birth_date', 'birth_date'))) : '-'} />}
            {hasField('gender') && <Row label="Gênero" value={getFieldValue('gender', 'gender') === 'M' ? 'Masculino' : getFieldValue('gender', 'gender') === 'F' ? 'Feminino' : '-'} />}
            {hasField('cpf') && <Row label="CPF" value={getFieldValue('cpf', 'cpf') || '-'} />}
            {hasField('rg') && <Row label="RG" value={getFieldValue('rg', 'rg') || '-'} />}
            {hasField('cep') && <Row label="CEP" value={getFieldValue('cep', 'cep') || '-'} />}
            {hasField('address') && <Row label="Endereço" value={getFieldValue('address', 'address') || '-'} />}
            {hasField('city') && <Row label="Cidade" value={getFieldValue('city', 'city') || '-'} />}
            {hasField('state') && <Row label="Estado" value={getFieldValue('state', 'state') || '-'} />}
            {hasField('spouse_name') && <Row label="Nome do Cônjuge" value={getFieldValue('spouse_name', 'spouse_name') || '-'} />}
            {hasField('marital_status') && <Row label="Estado Civil" value={getFieldValue('marital_status', 'marital_status') || '-'} />}
            {hasField('wedding_date') && <Row label="Data de Casamento" value={getFieldValue('wedding_date', 'wedding_date') ? formatDate(String(getFieldValue('wedding_date', 'wedding_date'))) : '-'} />}
            {(() => {
              const knownCols = ['email', 'whatsapp', 'birth_date', 'gender', 'cpf', 'rg', 'cep', 'address', 'city', 'state', 'spouse_name', 'marital_status', 'wedding_date'];
              return formFields
                .filter(f => f.is_active && f.step === 'personal' && !knownCols.includes(f.field_key) && !knownCols.includes(f.db_column || ''))
                .filter(f => { const v = getFieldValue(f.field_key, f.db_column); return v != null && v !== '' && v !== false; })
                .map(field => (
                  <Row key={field.id} label={field.label} value={formatFieldValue(field, getFieldValue(field.field_key, field.db_column))} />
                ));
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Vida Cristã</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=1`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hasField('perfil_fe') && <Row label="Perfil" value={getFieldValue('perfil_fe', 'perfil_fe') === 'Já sou cristão(ã)' ? 'Cristão(ã)' : 'Não cristão(ã) / Conhecendo'} />}
            {getFieldValue('perfil_fe', 'perfil_fe') === 'Já sou cristão(ã)' && (
              <>
                {hasField('is_baptized') && <Row label="Batizado" value={getFieldValue('is_baptized', 'is_baptized') ? 'Sim' : 'Não'} />}
                {hasField('church') && <Row label="Igreja" value={getFieldValue('church', 'church') || '-'} />}
                {hasField('pastor') && <Row label="Pastor" value={getFieldValue('pastor', 'pastor') || '-'} />}
                {hasField('church_role') && <Row label="Cargo" value={getFieldValue('church_role', 'church_role') === 'Outro' ? getFieldValue('church_role_other', 'church_role_other') : getFieldValue('church_role', 'church_role') || '-'} />}
                {hasField('pastoral_authorization') && <Row label="Autorização pastoral" value={getFieldValue('pastoral_authorization', 'pastoral_authorization') ? 'Sim' : 'Não'} />}
              </>
            )}
            {(() => {
              const knownCols = ['perfil_fe', 'is_baptized', 'church', 'pastor', 'church_role', 'church_role_other', 'pastoral_authorization'];
              return formFields
                .filter(f => f.is_active && f.step === 'christian_life' && !knownCols.includes(f.field_key) && !knownCols.includes(f.db_column || ''))
                .filter(f => { const v = getFieldValue(f.field_key, f.db_column); return v != null && v !== '' && v !== false; })
                .map(field => (
                  <Row key={field.id} label={field.label} value={formatFieldValue(field, getFieldValue(field.field_key, field.db_column))} />
                ));
            })()}
          </CardContent>
        </Card>

        {reg.events && (reg.events.step_health !== false || reg.events.step_emergency !== false) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-medium">Saúde & Emergência</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=2`)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasField('health_info') && <Row label="Informações de saúde" value={getFieldValue('health_info', 'health_info') || '-'} />}
              {hasField('has_allergies') && <Row label="Possui alergias" value={getFieldValue('has_allergies', 'has_allergies') ? 'Sim' : 'Não'} />}
              {hasField('allergy_description') && getFieldValue('allergy_description', 'allergy_description') && <Row label="Descrição alergias" value={String(getFieldValue('allergy_description', 'allergy_description'))} />}
              {hasField('dietary_restrictions') && getFieldValue('dietary_restrictions', 'dietary_restrictions') && <Row label="Restrições alimentares" value={String(getFieldValue('dietary_restrictions', 'dietary_restrictions'))} />}
              {hasField('has_special_needs') && <Row label="Necessidades Especiais" value={getFieldValue('has_special_needs', 'has_special_needs') ? 'Sim' : 'Não'} />}
              {hasField('special_needs_description') && getFieldValue('special_needs_description', 'special_needs_description') && <Row label="Qual?" value={String(getFieldValue('special_needs_description', 'special_needs_description'))} />}
              {hasField('emergency_contact') && <Row label="Contato de emergência" value={getFieldValue('emergency_contact', 'emergency_contact') || '-'} />}
              {hasField('emergency_phone') && <Row label="Telefone de emergência" value={getFieldValue('emergency_phone', 'emergency_phone') || '-'} />}
              {(() => {
                const knownCols = ['health_info', 'has_allergies', 'allergy_description', 'dietary_restrictions', 'has_special_needs', 'special_needs_description', 'emergency_contact', 'emergency_phone'];
                return formFields
                  .filter(f => f.is_active && (f.step === 'health' || f.step === 'emergency') && !knownCols.includes(f.field_key) && !knownCols.includes(f.db_column || ''))
                  .filter(f => { const v = getFieldValue(f.field_key, f.db_column); return v != null && v !== '' && v !== false; })
                  .map(field => (
                    <Row key={field.id} label={field.label} value={formatFieldValue(field, getFieldValue(field.field_key, field.db_column))} />
                  ));
              })()}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Outros...</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=4`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(() => {
              const knownCols: string[] = [];
              return formFields
                .filter(f => f.is_active && f.step === 'other' && !knownCols.includes(f.field_key) && !knownCols.includes(f.db_column || ''))
                .filter(f => { const v = getFieldValue(f.field_key, f.db_column); return v != null && v !== '' && v !== false; })
                .map(field => (
                  <Row key={field.id} label={field.label} value={formatFieldValue(field, getFieldValue(field.field_key, field.db_column))} />
                ));
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Pagamento</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=5`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Método" value={paymentMethodLabels[reg.payment_method] || reg.payment_method} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="secondary"
                className={
                  reg.payment_status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                    : reg.payment_status === 'pending'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
                      : reg.payment_status === 'cortesia'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200'
                        : reg.payment_status === 'refunded'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200'
                          : reg.payment_status === 'canceled'
                            ? 'bg-muted text-muted-foreground'
                            : ''
                }
              >
                {paymentStatusLabels[reg.payment_status] || reg.payment_status}
              </Badge>
            </div>
            {reg.event_lots && (
              <Row label="Lote" value={`${reg.event_lots.name}${reg.event_lots.price > 0 ? ` — R$ ${reg.event_lots.price.toFixed(2)}` : ''}`} />
            )}
            {(reg as any).paid_amount != null && (
              <Row label="Valor pago" value={`R$ ${Number((reg as any).paid_amount).toFixed(2)}`} />
            )}
            {(reg as any).refunded_amount != null && (
              <Row label="Valor reemb." value={`R$ ${Number((reg as any).refunded_amount).toFixed(2)}`} />
            )}
            <Button
              size="sm"
              className="w-full mt-2 bg-emerald-600/80 text-white hover:bg-emerald-600"
              onClick={() => setPayDialogOpen(true)}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Adicionar pagamento
            </Button>
            <PaymentHistory
              payments={payments}
              registrationId={id!}
              onRefresh={refreshPayments}
              paidAmount={(reg as any).paid_amount}
              paymentMethod={reg.payment_method}
            />
          </CardContent>
        </Card>
      </div>

      {reg.private_notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Observações (admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{reg.private_notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <Button onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar`)}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Excluir
        </Button>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!open) { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); setReceiptCopied(false); }}}>
        <DialogContent>
          {!paymentSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>{reg?.payment_status === 'paid' ? 'Adicionar pagamento' : 'Confirmar pagamento'}</DialogTitle>
                <DialogDescription>
                  Registre o valor pago por <strong>{reg?.full_name}</strong>.
                  O church_id será preenchido automaticamente pelo trigger do banco.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="pay-amount">Valor pago (R$)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); }} disabled={paying}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600/80 text-white hover:bg-emerald-600"
                  onClick={handleMarkAsPaid}
                  disabled={paying || !payAmount}
                >
                  {paying ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Registrando...</> : 'Confirmar pagamento'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="rounded-full bg-emerald-600/20 p-3">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <DialogTitle className="text-lg">Pagamento registrado com sucesso!</DialogTitle>
                    <DialogDescription className="mt-1">
                      R$ {paymentSuccess.amount.toFixed(2)} — {reg?.events?.title || 'Evento'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3">
                {reg?.whatsapp && (
                  <Button
                    className="w-full bg-[#25D366] text-white hover:bg-[#22c35e]"
                    onClick={() => {
                      window.open(
                        `https://wa.me/${paymentSuccess.cleanPhone}?text=${encodeURIComponent(paymentSuccess.receipt)}`,
                        '_blank'
                      );
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar Recibo por WhatsApp
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentSuccess.receipt);
                    setReceiptCopied(true);
                    setTimeout(() => setReceiptCopied(false), 2000);
                  }}
                >
                  {receiptCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {receiptCopied ? 'Copiado!' : 'Copiar Recibo'}
                </Button>
              </div>
              <DialogFooter className="sm:justify-center">
                <Button
                  variant="ghost"
                  onClick={() => { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); setReceiptCopied(false); window.location.reload(); }}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir inscrição</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a inscrição de <strong>{reg?.full_name}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overpaymentOpen} onOpenChange={setOverpaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-600">Valor acima do esperado</DialogTitle>
            <DialogDescription>
              O valor deste pagamento (<strong>R$ {overpaymentData?.amount.toFixed(2)}</strong>)
              somado ao já pago (<strong>R$ {overpaymentData?.currentPaid.toFixed(2)}</strong>)
              ultrapassa o valor da inscrição (<strong>R$ {overpaymentData?.price.toFixed(2)}</strong>).
              <br /><br />
              Deseja prosseguir com este pagamento?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverpaymentOpen(false); setOverpaymentData(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600"
              onClick={() => {
                if (overpaymentData) processMarkAsPaid(overpaymentData.amount);
              }}
              disabled={paying}
            >
              {paying ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-right">{value != null ? String(value) : ''}</span>
    </div>
  );
}
