import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { RegistrationForm } from '@/components/registration/RegistrationForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import { fetchFormFields, splitFieldValues } from '@/lib/form-fields';
import { insertPayment, insertRefund, fetchPayments, syncPaidAmount } from '@/lib/payments';
import type { PaymentRecord } from '@/lib/payments';
import type { FormField, FormStep } from '@/lib/form-fields';
import { PaymentHistory } from '@/components/registration/PaymentHistory';

interface RegistrationRow {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string | null;
  gender: string | null;
  cpf: string | null;
  rg: string | null;
  cep: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_christian: boolean;
  perfil_fe: string | null;
  is_baptized: boolean | null;
  church: string | null;
  pastor: string | null;
  church_role: string | null;
  church_role_other: string | null;
  godparent: string | null;
  godparent_contact: string | null;
  pastoral_authorization: boolean;
  health_info: string | null;
  has_allergies: boolean | null;
  allergy_description: string | null;
  dietary_restrictions: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  payment_method: string;
  payment_status: string | null;
  private_notes: string | null;
  lot_id: string | null;
}

interface EventLot {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

const STEP_LABELS = ['Dados Pessoais', 'Vida Cristã', 'Saúde', 'Emergência', 'Outros...', 'Pagamento'];

export default function RegistrationEditPage() {
  const { id, eventId } = useParams<{ id: string; eventId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stepParam = parseInt(searchParams.get('step') || '0', 10);
  const initialStep = stepParam >= 0 && stepParam <= 5 ? stepParam : 0;
  const [isLoading, setIsLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [defaultValues, setDefaultValues] = useState<Record<string, any>>({});
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundDialogData, setRefundDialogData] = useState<{
    paidAmount: number; eventId: string; data: Record<string, any>;
  } | null>(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);

  const [lots, setLots] = useState<EventLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [termsText, setTermsText] = useState<string | null>(null);
  const [disabledSteps, setDisabledSteps] = useState<FormStep[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [overpaymentOpen, setOverpaymentOpen] = useState(false);
  const [overpaymentData, setOverpaymentData] = useState<{
    amount: number;
    currentPaid: number;
    price: number;
  } | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState('pix');

  const refreshPayments = async () => {
    if (!id) return;
    const updated = await fetchPayments(id);
    setPayments(updated);
  };

  useEffect(() => {
    if (!id) return;
    fetchPayments(id).then(setPayments);
  }, [id]);

  const processAddPayment = async (amount: number) => {
    setPaying(true);
    const method = currentPaymentMethod || 'pix';

    const { error } = await insertPayment(id!, amount, method);
    if (error) {
      toast.error('Erro ao registrar pagamento: ' + error);
      setPaying(false);
      return;
    }

    toast.success('Pagamento registrado!');
    setPayAmount('');
    setPayDialogOpen(false);
    setPaying(false);
    setOverpaymentOpen(false);

    const { data: updatedReg } = await supabase
      .from('registrations')
      .select('payment_status, paid_amount')
      .eq('id', id)
      .single();
    if (updatedReg) {
      setDefaultValues((prev) => ({
        ...prev,
        payment_status: updatedReg.payment_status,
        paid_amount: updatedReg.paid_amount,
      }));
    }
    refreshPayments();
  };

  const handleAddPayment = async () => {
    setPaying(true);
    const amount = parseFloat(payAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      setPaying(false);
      return;
    }

    const price = selectedLot?.price ?? 0;
    const currentPaid = Number(defaultValues.paid_amount) || 0;

    if (price > 0 && currentPaid + amount >= price) {
      setPayDialogOpen(false);
      setOverpaymentData({ amount, currentPaid, price });
      setOverpaymentOpen(true);
      setPaying(false);
      return;
    }

    await processAddPayment(amount);
  };

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single();
      if (!data) {
        setFetching(false);
        return;
      }

      const reg = data as unknown as RegistrationRow;

      const [lotsData, eventRes] = await Promise.all([
        supabase
          .from('event_lots')
          .select('id, name, price, description')
          .eq('event_id', eventId)
          .order('start_date', { ascending: true }),
        supabase.from('events').select('is_custom, terms_text, step_personal, step_christian_life, step_health, step_emergency, step_other').eq('id', eventId).single(),
      ]);

      if (lotsData.data) {
        setLots(lotsData.data as EventLot[]);
      }

      let fFields: FormField[] = [];
      let custom = false;
      if (eventRes.data && eventId) {
        custom = eventRes.data.is_custom ?? false;
        setIsCustom(custom);
        setTermsText(eventRes.data.terms_text ?? null);
        const disabledSteps: FormStep[] = [];
        if (eventRes.data.step_personal === false) disabledSteps.push('personal');
        if (eventRes.data.step_christian_life === false) disabledSteps.push('christian_life');
        if (!eventRes.data.step_health) disabledSteps.push('health');
        if (!eventRes.data.step_emergency) disabledSteps.push('emergency');
        if (eventRes.data.step_other === false) disabledSteps.push('other');
        setDisabledSteps(disabledSteps);
        fFields = await fetchFormFields(eventId, custom, disabledSteps);
        setFormFields(fFields);
      }

      const extra = (reg as any).extra_fields || {};
      const values: Record<string, any> = {
        full_name: reg.full_name,
        email: reg.email,
        whatsapp: reg.whatsapp,
        birth_date: reg.birth_date || undefined,
        gender: (reg.gender as 'M' | 'F') || undefined,
        cpf: reg.cpf || undefined,
        rg: reg.rg || undefined,
        cep: reg.cep || undefined,
        address: reg.address || undefined,
        city: reg.city || undefined,
        state: reg.state || undefined,
        is_christian: reg.is_christian,
        perfil_fe: reg.perfil_fe || undefined,
        is_baptized: reg.is_baptized || undefined,
        church: reg.church || undefined,
        pastor: reg.pastor || undefined,
        church_role: reg.church_role || undefined,
        church_role_other: reg.church_role_other || undefined,
        godparent: reg.godparent || undefined,
        godparent_contact: reg.godparent_contact || undefined,
        pastoral_authorization: reg.pastoral_authorization,
        accept_terms: (reg as any).accept_terms ?? false,
        health_info: reg.health_info || undefined,
        has_allergies: reg.has_allergies || undefined,
        allergy_description: reg.allergy_description || undefined,
        dietary_restrictions: reg.dietary_restrictions || undefined,
        emergency_contact: reg.emergency_contact || undefined,
        emergency_phone: reg.emergency_phone || undefined,
        payment_method: reg.payment_method || 'pix',
        payment_status: reg.payment_status || undefined,
        paid_amount: (reg as any).paid_amount || undefined,
        lot_id: reg.lot_id || undefined,
        private_notes: reg.private_notes || undefined,
        ...extra,
      };

      if (custom && fFields.length > 0) {
        for (const field of fFields) {
          if (field.db_column && (reg as any)[field.db_column] !== undefined && values[field.field_key] === undefined) {
            values[field.field_key] = (reg as any)[field.db_column];
          }
        }
      }

      setDefaultValues(values);
      setCurrentPaymentMethod(values.payment_method || 'pix');
      setSelectedLotId(reg.lot_id);

      setFetching(false);
    };
    fetch();
  }, [id, eventId]);

  const doSave = async (data: Record<string, any>) => {
    setIsLoading(true);

    const { columns, extra } = splitFieldValues(data, formFields);
    const payload: any = {
      ...columns,
      lot_id: selectedLotId || null,
      extra_fields: Object.keys(extra).length > 0 ? extra : null,
      payment_status: data.payment_status ?? null,
      private_notes: data.private_notes ?? null,
      payment_method: data.payment_method ?? 'pix',
    };

    if (data.payment_status === 'canceled') {
      payload.group_assignment_id = null as any;
    }

    const { error } = await supabase.from('registrations').update(payload).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar inscrição: ' + error.message);
      setIsLoading(false);
      return;
    }

    const syncError = await syncPaidAmount(id!);
    if (syncError) {
      console.error('syncPaidAmount error:', syncError);
    }

    navigate(`/app/evento/${eventId}/inscricoes/${id}`);
  };

  const handleSubmit = async (data: Record<string, any>) => {
    if (data.payment_status === 'refunded' || data.payment_status === 'canceled') {
      const { data: reg } = await supabase
        .from('registrations')
        .select('paid_amount')
        .eq('id', id)
        .single();
      const paidAmount = Number(reg?.paid_amount || 0);
      if (paidAmount > 0 && eventId) {
        setRefundAmount(paidAmount);
        setRefundDialogData({ paidAmount, eventId, data });
        setRefundDialogOpen(true);
        return;
      }
    }
    doSave(data);
  };

  const handleRefundDecision = async (shouldRefund: boolean) => {
    if (!refundDialogData) return;
    setRefundProcessing(true);

    if (shouldRefund) {
      const amount = Math.min(
        Math.max(refundAmount, 0),
        refundDialogData.paidAmount
      );

      const { data: existingRefund } = await supabase
        .from('financial_entries')
        .select('id')
        .eq('registration_id', id)
        .eq('type', 'expense')
        .maybeSingle();

      const refundPayload = {
        event_id: refundDialogData.eventId,
        registration_id: id,
        type: 'expense' as const,
        category: 'reembolso',
        description: refundDialogData.data.payment_status === 'refunded'
          ? 'Reembolso de inscrição'
          : 'Reembolso por cancelamento',
        amount,
        entry_date: new Date().toISOString().slice(0, 10),
      };

      const { error: refundError } = existingRefund
        ? await supabase.from('financial_entries').update(refundPayload).eq('id', existingRefund.id)
        : await supabase.from('financial_entries').insert(refundPayload);

      if (refundError) {
        toast.error('Erro ao registrar reembolso: ' + refundError.message);
        setRefundProcessing(false);
        return;
      }

      const { error: updateRefundedError } = await supabase
        .from('registrations')
        .update({ refunded_amount: amount })
        .eq('id', id);

      if (updateRefundedError) {
        toast.error('Erro ao salvar valor reembolsado: ' + updateRefundedError.message);
        setRefundProcessing(false);
        return;
      }

      const { error: refundPaymentError } = await insertRefund(
        id!,
        amount,
        refundDialogData.data.payment_method || 'pix'
      );
      if (refundPaymentError) {
        toast.error('Erro ao registrar reembolso no histórico: ' + refundPaymentError);
      }
    }

    setRefundDialogOpen(false);
    setRefundProcessing(false);
    doSave(refundDialogData.data);
  };

  const selectedLot = lots.find(l => l.id === selectedLotId);

  if (fetching) return <div className="text-muted-foreground p-6">Carregando...</div>;

  return (
    <div>
      <PageHeader
        title={`Editar ${STEP_LABELS[initialStep]}`}
        description={defaultValues.full_name ? `Altere os dados de ${defaultValues.full_name} e salve.` : "Altere os dados e salve."}
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          {lots.length > 0 && (
            <div>
              <Label>Lote</Label>
              <Select
                value={selectedLotId || ''}
                onValueChange={(v) => setSelectedLotId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote...">
                    {(value: string) => {
                      const lot = lots.find(l => l.id === value);
                      return lot
                        ? `${lot.name} — ${lot.price > 0 ? `R$ ${lot.price.toFixed(2)}` : 'Grátis'}`
                        : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem lote</SelectItem>
                  {lots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.name} — {lot.price > 0 ? `R$ ${lot.price.toFixed(2)}` : 'Grátis'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <RegistrationForm
            isAdmin
            editing
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            initialStep={initialStep}
            lotId={selectedLotId || undefined}
            lotPrice={selectedLot?.price}
            fields={formFields}
            customMode={isCustom}
            termsText={termsText}
            payments={payments}
            onRefreshPayments={refreshPayments}
            registrationId={id}
            onAddPayment={() => setPayDialogOpen(true)}
            onPaymentMethodChange={setCurrentPaymentMethod}
            disabledSteps={disabledSteps}
          />
        </CardContent>
      </Card>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar pagamento</DialogTitle>
            <DialogDescription>
              Registre um novo pagamento para esta inscrição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="pay-amount-edit">Valor (R$)</Label>
              <Input
                id="pay-amount-edit"
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
            <Button variant="outline" onClick={() => { setPayDialogOpen(false); setPayAmount(''); }} disabled={paying}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600"
              onClick={handleAddPayment}
              disabled={paying || !payAmount}
            >
              {paying ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Registrando...</> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {refundDialogData?.data.payment_status === 'refunded' ? 'Confirmar reembolso' : 'Confirmar cancelamento'}
            </DialogTitle>
            <DialogDescription>
              <p>Esta inscrição possui <strong>R$ {refundDialogData?.paidAmount.toFixed(2)}</strong> pago.</p>
              {refundDialogData?.data.payment_status === 'refunded' && (
                <div className="mt-4 space-y-1">
                  <Label htmlFor="refund-amount">Valor a reembolsar</Label>
                  <Input
                    id="refund-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={refundDialogData.paidAmount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo: R$ {refundDialogData.paidAmount.toFixed(2)}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleRefundDecision(false)} disabled={refundProcessing}>
              {refundDialogData?.data.payment_status === 'refunded' ? 'Não reembolsar' : 'Cancelar sem reembolso'}
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600"
              onClick={() => handleRefundDecision(true)}
              disabled={refundProcessing}
            >
              {refundProcessing
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Reembolsando...</>
                : refundDialogData?.data.payment_status === 'refunded'
                  ? 'Confirmar reembolso'
                  : 'Sim, reembolsar'}
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
                if (overpaymentData) processAddPayment(overpaymentData.amount);
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
