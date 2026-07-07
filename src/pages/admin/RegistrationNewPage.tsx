import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { RegistrationForm } from '@/components/registration/RegistrationForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useEvent } from '@/contexts/EventContext';
import { CheckCircle, Loader2, ClipboardEdit } from 'lucide-react';
import { toast } from 'sonner';
import { fetchFormFields, splitFieldValues } from '@/lib/form-fields';
import type { FormStep } from '@/lib/form-fields';
import { insertPayment } from '@/lib/payments';
import { useTrial } from '@/components/layout/ChurchGuard';

async function hashTerms(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
import type { FormField } from '@/lib/form-fields';

interface EventLot {
  id: string;
  name: string;
  description: string | null;
  price: number;
  start_date: string;
  end_date: string;
  max_capacity: number | null;
}

type LotStatus = 'active' | 'upcoming' | 'expired' | 'full';

function getLotStatus(lot: EventLot, count: number): LotStatus {
  const now = new Date();
  if (lot.max_capacity !== null && count >= lot.max_capacity) return 'full';
  if (now < new Date(lot.start_date)) return 'upcoming';
  if (now > new Date(lot.end_date)) return 'expired';
  return 'active';
}

const STATUS_CONFIG: Record<LotStatus, { label: string; className: string }> = {
  upcoming: { label: 'Em breve', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  expired: { label: 'Encerrado', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  full: { label: 'Lote Cheio', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  active: { label: '', className: '' },
};

export default function RegistrationNewPage() {
  const navigate = useNavigate();
  const { eventId, event } = useEvent();
  const trial = useTrial();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [lots, setLots] = useState<EventLot[]>([]);
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});
  const [selectedLot, setSelectedLot] = useState<EventLot | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);
  const [disabledSteps, setDisabledSteps] = useState<FormStep[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('pix');
  const [pendingPayment, setPendingPayment] = useState<{ amount: number; method: string } | null>(null);

  const handleAddPayment = () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setPendingPayment({ amount, method: payMethod });
    setPayDialogOpen(false);
    setPayAmount('');
    toast.success('Pagamento será registrado após confirmar a inscrição.');
  };

  const clearFormError = useCallback(() => {
    setFormError(null);
    setIsDuplicateEmail(false);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId || !event) return;

      const [lotsRes, regsRes] = await Promise.all([
        supabase.from('event_lots').select('*').eq('event_id', eventId).order('start_date', { ascending: true }),
        supabase.from('registrations').select('lot_id').eq('event_id', eventId),
      ]);

      if (lotsRes.data && lotsRes.data.length > 0) {
        setLots(lotsRes.data as EventLot[]);
      }

      const counts: Record<string, number> = {};
      regsRes.data?.forEach((r) => {
        if (r.lot_id) counts[r.lot_id] = (counts[r.lot_id] || 0) + 1;
      });
      setLotCounts(counts);

      const fFields = await fetchFormFields(eventId, event.is_custom ?? false, (() => {
        const disabled: FormStep[] = [];
        if (event.step_personal === false) disabled.push('personal');
        if (event.step_christian_life === false) disabled.push('christian_life');
        if (event.step_health === false) disabled.push('health');
        if (event.step_emergency === false) disabled.push('emergency');
        if (event.step_other === false) disabled.push('other');
        setDisabledSteps(disabled);
        return disabled;
      })());
      const filteredFields = event.terms_enabled === false
        ? fFields.filter(f => f.field_key !== 'accept_terms')
        : fFields;
      setFormFields(filteredFields);
      setFieldsLoaded(true);
    };
    fetchData();
  }, [eventId, event]);

  const handleSubmit = async (data: Record<string, any>) => {
    setIsLoading(true);
    setFormError(null);
    const { columns, extra } = splitFieldValues(data, formFields);
    const payload: any = {
      ...columns,
      event_id: eventId,
      extra_fields: Object.keys(extra).length > 0 ? extra : null,
      payment_status: data.payment_status ?? 'pending',
      payment_method: data.payment_method ?? 'pix',
      private_notes: data.private_notes ?? null,
    };
    if (selectedLot) {
      payload.lot_id = selectedLot.id;
    }

    if (data.accept_terms && event?.terms_text) {
      payload.terms_accepted_at = new Date().toISOString();
      payload.terms_version = await hashTerms(event.terms_text);
    }

    const { data: newReg, error } = await supabase.from('registrations').insert(payload).select('id').single();
    if (error) {
      if (error.code === '23505') {
        setFormError('Este e-mail já está inscrito neste evento.');
        setIsDuplicateEmail(true);
      } else {
        setFormError('Erro ao criar inscrição: ' + error.message);
      }
      setIsLoading(false);
      return;
    }

    if (data.payment_status === 'paid' && Number(data.paid_amount) > 0 && newReg?.id) {
      const { error: paymentError } = await insertPayment(
        newReg.id,
        Number(data.paid_amount),
        data.payment_method || 'pix'
      );
      if (paymentError) {
        toast.error('Erro ao registrar no histórico: ' + paymentError);
      }
    }

    if (pendingPayment && newReg?.id) {
      const { error: paymentError } = await insertPayment(
        newReg.id,
        pendingPayment.amount,
        pendingPayment.method
      );
      if (paymentError) {
        toast.error('Inscrição criada, mas erro ao registrar pagamento: ' + paymentError);
      } else {
        toast.success('Pagamento registrado!');
      }
      setPendingPayment(null);
    }

    navigate(`/app/evento/${eventId}/inscricoes`);
  };

  function renderLotCard(lot: EventLot) {
    const count = lotCounts[lot.id] || 0;
    const status = getLotStatus(lot, count);
    const disabled = status !== 'active';
    const cfg = STATUS_CONFIG[status];

    return (
      <div
        key={lot.id}
        className={`border rounded-lg p-4 transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer hover:border-primary'
        } ${
          selectedLot?.id === lot.id ? 'border-primary ring-1 ring-primary' : 'border-border'
        }`}
        onClick={() => !disabled && setSelectedLot(lot)}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{lot.name}</span>
              {status !== 'active' && (
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.className}`}>
                  {cfg.label}
                </span>
              )}
              {selectedLot?.id === lot.id && <CheckCircle className="size-4 text-primary" />}
            </div>
            {lot.description && (
              <p className="text-sm text-muted-foreground">{lot.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(lot.start_date).toLocaleDateString('pt-BR')} até {new Date(lot.end_date).toLocaleDateString('pt-BR')}
              {lot.max_capacity !== null && ` · ${count}/${lot.max_capacity} vagas`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">
              {lot.price > 0 ? `R$ ${lot.price.toFixed(2)}` : 'Grátis'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (fieldsLoaded && event?.is_custom && formFields.length === 0) {
    return (
      <div>
        <PageHeader
          title="Nova Inscrição"
          description={`Evento: ${event?.title ?? ''}`}
        />
        <Card className="max-w-xl mx-auto bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center pt-2">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                <ClipboardEdit className="size-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-lg font-semibold">Formulário não configurado</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              O formulário personalizado deste evento ainda não possui campos.
              Acesse a aba <strong>Formulário</strong> na seção Secretaria para criar os campos de inscrição.
            </p>
            <Button onClick={() => navigate(`/app/evento/${eventId}/formulario`)}>
              Ir para Formulário
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showForm && lots.length > 0) {
    return (
      <div>
        <PageHeader
          title="Nova Inscrição"
          description={`Evento: ${event?.title ?? ''}`}
        />
        <Card className="max-w-xl bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold">Selecione o lote para a inscrição</h2>

            <div
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${
                selectedLot === null ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
              onClick={() => setSelectedLot(null)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Inscrição Normal</span>
                    {selectedLot === null && <CheckCircle className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Preço padrão do evento, sem lote específico</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">
                    {event && event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                  </p>
                </div>
              </div>
            </div>

            {lots.map(renderLotCard)}

            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Continuar
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (trial?.isTrialExceeded) {
    return (
      <div>
        <PageHeader title="Nova Inscrição" description={`Evento: ${event?.title ?? ''}`} />
        <Card className="max-w-xl mx-auto bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Seu período de avaliação expirou.</p>
            <Button onClick={() => trial.openUpgrade()}>Fazer upgrade do plano</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Nova Inscrição"
        description={`Evento: ${event?.title ?? ''}`}
      />
      {selectedLot ? (
        <div className="max-w-xl mx-auto mb-4 bg-primary/10 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">{selectedLot.name} — R$ {selectedLot.price.toFixed(2)}</span>
        </div>
      ) : (
        <div className="max-w-xl mx-auto mb-4 bg-muted border border-border rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">Inscrição Normal — {event && event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}</span>
        </div>
      )}
      <Card className="bg-card backdrop-blur-md border-border shadow-lg">
        <CardContent className="space-y-4 pt-6">
          <RegistrationForm
            isAdmin
            onSubmit={handleSubmit}
            isLoading={isLoading}
            lotId={selectedLot?.id}
            lotPrice={selectedLot?.price ?? event?.price ?? 0}
            errorMessage={formError}
            onClearError={clearFormError}
            errorActionLabel={isDuplicateEmail ? 'Corrigir e-mail' : undefined}
            eventId={eventId ?? undefined}
            fields={formFields}
            customMode={event?.is_custom ?? false}
            termsText={event?.terms_text}
            disabledSteps={disabledSteps}
            onAddPayment={() => setPayDialogOpen(true)}
            onPaymentMethodChange={setPayMethod}
          />
        </CardContent>
      </Card>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar pagamento</DialogTitle>
            <DialogDescription>
              Registre um pagamento para esta inscrição. Ele será lançado após a confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="pay-amount">Valor (R$)</Label>
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
            <Button variant="outline" onClick={() => { setPayDialogOpen(false); setPayAmount(''); }}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600"
              onClick={handleAddPayment}
              disabled={!payAmount}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
