import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { RegistrationForm } from '@/components/registration/RegistrationForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { fetchFormFields, splitFieldValues } from '@/lib/form-fields';
import type { FormField, FormStep } from '@/lib/form-fields';

async function hashTerms(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

export default function EventRegistration() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [event, setEvent] = useState<any>(null);
  const [lots, setLots] = useState<EventLot[]>([]);
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});
  const [selectedLot, setSelectedLot] = useState<EventLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<'trial_expired' | 'trial_limit' | 'inactive' | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(token ? null : true);
  const [showForm, setShowForm] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [disabledSteps, setDisabledSteps] = useState<FormStep[]>([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('is_open', true)
        .single();

      if (error) {
        setError('Evento não encontrado ou inscrições encerradas.');
        setLoading(false);
        return;
      }

      if (data.end_date && new Date(data.end_date) < new Date()) {
        setError('Evento não encontrado ou inscrições encerradas.');
        setLoading(false);
        return;
      }

      setEvent(data);

      const { data: isBlocked } = await supabase
        .rpc('is_event_registration_blocked', { event_uuid: data.id });
      
      if (isBlocked) {
        setBlocked(true);
        // Determine block reason
        const { data: church } = await supabase
          .from('churches')
          .select('status, trial_ends_at, is_active')
          .eq('id', data.church_id)
          .maybeSingle();
        
        if (church) {
          if (!church.is_active) {
            setBlockReason('inactive');
          } else if (church.status === 'suspended') {
            setBlockReason('trial_expired');
          } else if (church.status === 'trial' && church.trial_ends_at && new Date(church.trial_ends_at) < new Date()) {
            setBlockReason('trial_expired');
          } else {
            setBlockReason('trial_limit');
          }
        }
      }

      const [lotsRes, regsRes] = await Promise.all([
        supabase.from('event_lots').select('*').eq('event_id', data.id).order('start_date', { ascending: true }),
        supabase.from('registrations').select('lot_id').eq('event_id', data.id),
      ]);

      if (lotsRes.data && lotsRes.data.length > 0) {
        setLots(lotsRes.data as EventLot[]);
      }

      const counts: Record<string, number> = {};
      regsRes.data?.forEach((r) => {
        if (r.lot_id) counts[r.lot_id] = (counts[r.lot_id] || 0) + 1;
      });
      setLotCounts(counts);

      const fFields = await fetchFormFields(data.id, data.is_custom ?? false, (() => {
        const disabled: FormStep[] = [];
        if (data.step_personal === false) disabled.push('personal');
        if (data.step_christian_life === false) disabled.push('christian_life');
        if (data.step_health === false) disabled.push('health');
        if (data.step_emergency === false) disabled.push('emergency');
        if (data.step_other === false) disabled.push('other');
        setDisabledSteps(disabled);
        return disabled;
      })());
      const filteredFields = data.terms_enabled === false
        ? fFields.filter(f => f.field_key !== 'accept_terms')
        : fFields;
      setFormFields(filteredFields);

      setLoading(false);
    };

    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (!token || !event) return;

    const validateToken = async () => {
      const { data, error } = await supabase
        .from('event_invites')
        .select('id, used')
        .eq('token', token)
        .eq('event_id', event.id)
        .maybeSingle();

      if (error || !data || data.used) {
        setTokenValid(false);
        return;
      }

      setTokenValid(true);
    };

    validateToken();
  }, [token, event]);

  const clearFormError = useCallback(() => {
    setFormError(null);
    setIsDuplicateEmail(false);
  }, []);

  const handleSubmit = async (data: Record<string, any>) => {
    setFormError(null);
    setLastPaymentMethod(data.payment_method || null);

    let inviteId: string | null = null;

    if (token) {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('use_event_invite', { p_token: token });

      if (rpcError || !rpcResult?.[0]?.p_valid) {
        setFormError('Este link de convite é inválido ou já foi utilizado. Entre em contato com o organizador do evento para receber um novo convite.');
        return;
      }

      inviteId = rpcResult[0].p_invite_id;
    }

    const { columns, extra } = splitFieldValues(data, formFields);

    const payload: any = {
      ...columns,
      event_id: event.id,
      invite_id: inviteId,
      extra_fields: Object.keys(extra).length > 0 ? extra : null,
    };

    if (data.payment_method) {
      payload.payment_method = data.payment_method;
    }
    if (data.payment_status) {
      payload.payment_status = data.payment_status;
    }

    if (selectedLot) {
      payload.lot_id = selectedLot.id;
    }

    if (data.accept_terms && event.terms_text) {
      payload.terms_accepted_at = new Date().toISOString();
      payload.terms_version = await hashTerms(event.terms_text);
    }

    const { error: insertError } = await supabase.from('registrations').insert(payload);

    if (insertError) {
      if (insertError.message.includes('Limite de 15 inscrições')) {
        setFormError('As inscrições online para este evento estão temporariamente pausadas. Por favor, procure a organização ou a liderança da igreja para mais informações.');
      } else if (insertError.message.includes('Período de trial expirado')) {
        setFormError('As inscrições online estão temporariamente indisponíveis devido à expiração do período de trial. Procure a liderança da igreja.');
      } else if (insertError.code === '23505') {
        setFormError('Este e-mail já está inscrito neste evento.');
        setIsDuplicateEmail(true);
      } else {
        console.error('[Registration] insert error:', insertError.code, insertError.message, insertError.details);
        setFormError('Erro ao realizar inscrição. Tente novamente.');
      }
      return;
    }

    setSubmitted(true);
  };

  if (loading) return <div className="p-8 text-center">Carregando evento...</div>;

  if (token && tokenValid === null) {
    return <div className="p-8 text-center">Validando convite...</div>;
  }

  if (token && tokenValid === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Link de inscrição inválido</h1>
          <p className="text-muted-foreground">
            Link de inscrição inválido ou já utilizado. Entre em contato com o organizador.
          </p>
        </div>
      </div>
    );
  }

  if (error) return <div className="p-8 text-center text-muted-foreground">{error}</div>;

  if (submitted) {
    const showPaymentLink = lastPaymentMethod === 'external_link' && event.payment_link;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-primary">Inscrição realizada!</h1>
          <p className="text-muted-foreground">
            Você receberá confirmação no e-mail e WhatsApp informados.
          </p>
          {showPaymentLink && (
            <a href={event.payment_link} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full max-w-xs mx-auto">
                Pagar agora pelo Link
              </Button>
            </a>
          )}
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors max-md:h-11"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (blocked) {
    const messages = {
      trial_expired: {
        title: 'Inscrições temporariamente indisponíveis',
        text: 'As inscrições online para este evento estão temporariamente pausadas devido à expiração do período de trial da organização. Por favor, procure a organização ou a liderança da igreja para mais informações.',
      },
      trial_limit: {
        title: 'Limite de inscrições atingido',
        text: 'As inscrições online para este evento atingiram o limite do plano gratuito. Por favor, procure a organização ou a liderança da igreja para mais informações.',
      },
      inactive: {
        title: 'Inscrições indisponíveis',
        text: 'As inscrições online para este evento estão temporariamente indisponíveis. Por favor, procure a organização ou a liderança da igreja para mais informações.',
      },
    };
    const display = blockReason ? messages[blockReason] : messages.trial_limit;

    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
        <p className="text-muted-foreground mb-6">{event.description}</p>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <p className="text-muted-foreground">
            {display.text}
          </p>
        </div>
      </div>
    );
  }

  if (event.is_custom && formFields.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
        <p className="text-muted-foreground mb-6">{event.description}</p>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <p className="text-muted-foreground">
            Inscrições temporariamente indisponíveis. Entre em contato com a organização do evento.
          </p>
        </div>
      </div>
    );
  }

  function renderLotCard(lot: EventLot) {
    const count = lotCounts[lot.id] || 0;
    const status = getLotStatus(lot, count);
    const disabled = status !== 'active';
    const cfg = STATUS_CONFIG[status];

    return (
      <Card
        key={lot.id}
        className={`transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer hover:border-primary'
        } ${
          selectedLot?.id === lot.id ? 'border-primary bg-primary/5 ring-2 ring-primary' : ''
        }`}
        onClick={() => !disabled && setSelectedLot(lot)}
      >
        <CardContent className="flex items-start justify-between p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{lot.name}</span>
              {status !== 'active' && (
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.className}`}>
                  {cfg.label}
                </span>
              )}
              {selectedLot?.id === lot.id && <CheckCircle className="size-5 text-primary" />}
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
        </CardContent>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
        <p className="text-muted-foreground mb-6">{event.description}</p>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Selecione o lote de inscrição</h2>

          <Card
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedLot === null ? 'border-primary bg-primary/5 ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedLot(null)}
          >
            <CardContent className="flex items-start justify-between p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Inscrição Normal</span>
                  {selectedLot === null && <CheckCircle className="size-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">Preço padrão do evento, sem lote específico</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                </p>
              </div>
            </CardContent>
          </Card>

          {lots.map(renderLotCard)}

          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Continuar inscrição
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
      <p className="text-muted-foreground mb-2">{event.description}</p>
      {selectedLot ? (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex justify-between items-center">
          <div>
            <span className="text-sm font-medium text-foreground">{selectedLot.name}</span>
            {selectedLot.description && (
              <span className="text-xs text-muted-foreground ml-2">— {selectedLot.description}</span>
            )}
          </div>
          <span className="font-bold text-foreground">
            {selectedLot.price > 0 ? `R$ ${selectedLot.price.toFixed(2)}` : 'Grátis'}
          </span>
        </div>
      ) : (
        <div className="bg-muted border border-border rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">Inscrição Normal</span>
          <span className="font-bold text-foreground">
            {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
          </span>
        </div>
      )}
      <RegistrationForm
        onSubmit={handleSubmit}
        lotId={selectedLot?.id}
        lotPrice={selectedLot?.price ?? event.price ?? 0}
        paymentLink={event.payment_link}
        errorMessage={formError}
        onClearError={clearFormError}
        errorActionLabel={isDuplicateEmail ? 'Corrigir e-mail' : undefined}
        eventId={event.id}
        fields={formFields}
        customMode={event.is_custom}
        termsText={event.terms_text}
        disabledSteps={disabledSteps}
      />
    </div>
  );
}
