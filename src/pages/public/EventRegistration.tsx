import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom';
import { toPng } from 'html-to-image';
import * as Sentry from '@sentry/react';
import { supabase } from '@/lib/supabase';
import { RegistrationForm } from '@/components/registration/RegistrationForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Printer, Download, MapPin, ExternalLink, CalendarDays, MessageCircle, Building2 } from 'lucide-react';
import { fetchFormFields, splitFieldValues } from '@/lib/form-fields';
import type { FormField, FormStep } from '@/lib/form-fields';
import { RegistrationComprovante } from '@/components/registration/RegistrationComprovante';
import { buildCheckinUrl } from '@/lib/checkin';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

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
  if (now < new Date(lot.start_date + 'T12:00:00')) return 'upcoming';
  if (now > new Date(lot.end_date + 'T12:00:00')) return 'expired';
  return 'active';
}

const STATUS_CONFIG: Record<LotStatus, { label: string; className: string }> = {
  upcoming: { label: 'Em breve', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  expired: { label: 'Encerrado', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  full: { label: 'Lote Cheio', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  active: { label: '', className: '' },
};

interface EventRegistrationProps {
  directForm?: boolean;
}

export default function EventRegistration({ directForm }: EventRegistrationProps) {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const location = useLocation();
  const searchParamsURL = new URLSearchParams(location.search);
  const hasToken = !!searchParamsURL.get('token');
  const isDirectForm = !!directForm || location.pathname.endsWith('/inscricao');
  const { user, loading: authLoading } = useAuth();

  const readInviteToken = (): string | null => {
    if (urlToken) return urlToken;
    try {
      if (typeof window !== 'undefined') {
        return window.sessionStorage.getItem(`invite_token_${slug}`) || null;
      }
    } catch (e) {
      console.warn('[DIAGNÓSTICO] Session storage não acessível:', e);
    }
    return null;
  };

  const [inviteToken] = useState<string | null>(readInviteToken);

  useEffect(() => {
    if (!urlToken) return;
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`invite_token_${slug}`, urlToken);
      }
    } catch (e) {
      console.warn('[DIAGNÓSTICO] Session storage não acessível (set):', e);
    }
  }, [urlToken, slug]);

  useEffect(() => {
    if (!isDirectForm && hasToken) {
      window.location.replace(`/e/${slug}/inscricao${location.search}`);
    }
  }, [isDirectForm, hasToken, slug, location.search]);

  console.log('[DIAGNÓSTICO] URL:', window.location.href, '| Token da URL:', urlToken, '| Persistido:', inviteToken);

  const [event, setEvent] = useState<any>(null);
  const [lots, setLots] = useState<EventLot[]>([]);
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});
  const [selectedLot, setSelectedLot] = useState<EventLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<'trial_expired' | 'trial_limit' | 'inactive' | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(inviteToken ? null : true);
  // O formulário sempre inicia fechado para forçar a passagem pela seleção de lotes
  const [showForm, setShowForm] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [disabledSteps, setDisabledSteps] = useState<FormStep[]>([]);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const [submittedRegId, setSubmittedRegId] = useState<string | null>(null);
  const [checkinToken, setCheckinToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const comprovanteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!event?.start_date) return;

    const target = new Date(`${event.start_date}T00:00:00`).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event?.start_date]);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events_public_view')
        .select('*')
        .eq('slug', slug)
        .or('is_published.eq.true,is_open.eq.true')
        .single();

      if (error) {
        setError('Evento não encontrado ou inscrições encerradas.');
        setLoading(false);
        return;
      }

      if (data.end_date && new Date(data.end_date + 'T12:00:00') < new Date()) {
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
    if (!inviteToken || !event) return;

    const validateToken = async () => {
      const { data, error } = await supabase
        .from('event_invites')
        .select('id, used')
        .eq('token', inviteToken)
        .eq('event_id', event.id)
        .maybeSingle();

      if (error || !data || data.used) {
        setTokenValid(false);
        return;
      }

      setTokenValid(true);
    };

    validateToken();
  }, [inviteToken, event]);

  const clearFormError = useCallback(() => {
    setFormError(null);
    setIsDuplicateEmail(false);
  }, []);

  const handleSubmit = async (data: Record<string, any>) => {
    if (!event?.is_published) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      let inviteId: string | null = null;

      if (inviteToken) {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('use_event_invite', { p_token: inviteToken });

        if (rpcError || !rpcResult?.[0]?.p_valid) {
          setFormError('Este link de convite é inválido ou já foi utilizado. Entre em contato com o organizador do evento para receber um novo convite.');
          return;
        }

        inviteId = rpcResult[0].p_invite_id;
        console.log('[DIAGNÓSTICO] Invite ID obtido:', inviteId);
      }

      const { columns, extra } = splitFieldValues(data, formFields);

      const payload: any = {
        ...columns,
        event_id: event.id,
        invite_id: inviteId,
        origin: inviteId ? 'invite' : 'public',
        extra_fields: Object.keys(extra).length > 0 ? extra : null,
      };
      console.log('[DIAGNÓSTICO] Payload final de inscrição:', payload);

      if (data.payment_method) {
        payload.payment_method = data.payment_method;
      }
      if (data.payment_method === 'other' && data.payment_method_details) {
        payload.payment_method_details = data.payment_method_details;
      }
      if (data.payment_status) {
        payload.payment_status = data.payment_status;
      }

      if (selectedLot) {
        payload.lot_id = selectedLot.id;
      }

      if (columns.accept_terms && event.terms_text) {
        payload.terms_accepted_at = new Date().toISOString();
        try {
          payload.terms_version = await hashTerms(event.terms_text);
        } catch (err) {
          console.warn('[Registration] falha ao gerar hash dos termos:', err);
        }
      }

      const isTransientError = (e: { code?: string; message?: string; status?: number } | null): boolean => {
        if (!e) return false;
        if (!e.code || e.code === 'PGRST301') return true;
        if (e.status && e.status >= 500) return true;
        const msg = (e.message || '').toLowerCase();
        return msg.includes('fetch failed') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('aborted');
      };

      const attemptInsert = async () => {
        const { error: insertError } = await supabase
          .from('registrations')
          .insert(payload);
        return insertError;
      };

      let insertError = await attemptInsert();

      if (insertError && isTransientError(insertError)) {
        console.warn('[Registration] falha transiente no insert, tentando novamente...', insertError.message);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        insertError = await attemptInsert();
      }

      if (insertError) {
        Sentry.captureMessage('Inscrição pública falhou', {
          extra: {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            slug,
            eventId: event.id,
          },
        });

        if (insertError.message.includes('Limite de 5 inscrições')) {
          setFormError('Limite de inscrições atingido para este e-mail. Tente novamente em alguns minutos.');
        } else if (insertError.message.includes('Limite de 15 inscrições')) {
          setFormError('As inscrições online para este evento estão temporariamente pausadas. Por favor, procure a organização ou a liderança da igreja para mais informações.');
        } else if (insertError.message.includes('Período de trial expirado')) {
          setFormError('As inscrições online estão temporariamente indisponíveis devido à expiração do período de trial. Procure a liderança da igreja.');
        } else if (insertError.code === '23505') {
          setFormError('Este e-mail já está inscrito neste evento.');
          setIsDuplicateEmail(true);
        } else {
          console.error('[Registration] insert error:', insertError.code, insertError.message, insertError.details);
          setFormError(
            insertError.message
              ? `Erro ao realizar inscrição. Tente novamente. (${insertError.code || 'erro'}: ${insertError.message})`
              : 'Erro ao realizar inscrição. Tente novamente.'
          );
        }
        return;
      }

      let insertedRegId: string | null = null;
      if (payload.email) {
        try {
          const { data: fetchedRegId } = await supabase.rpc('get_registration_id_by_email', {
            p_event_id: event.id,
            p_email: payload.email,
          });
          insertedRegId = fetchedRegId ?? null;
        } catch (err) {
          console.warn('[Registration] falha ao recuperar id da inscrição:', err);
        }
      }

      setSubmittedData(data);
      setSubmittedRegId(insertedRegId);

      let resolvedCheckinToken = event.checkin_token ?? null;
      if (!resolvedCheckinToken && insertedRegId) {
        try {
          const { data: compData, error: compError } = await supabase.rpc('get_comprovante', {
            p_event_slug: slug,
            p_registration_id: insertedRegId,
          });
          if (compError) {
            console.error('[Registration] erro ao garantir token de check-in:', compError.message);
          } else {
            resolvedCheckinToken = compData?.[0]?.checkin_token ?? null;
          }
        } catch (err) {
          console.error('[Registration] erro ao garantir token de check-in:', err);
        }
      }
      setCheckinToken(resolvedCheckinToken);
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(`invite_token_${slug}`);
        }
      } catch (e) {
        console.warn('[DIAGNÓSTICO] Session storage não acessível (remove):', e);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[Registration] erro inesperado na submissão:', err);
      Sentry.captureException(err);
      setFormError('Erro ao realizar inscrição. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveComprovante = async () => {
    const node = comprovanteRef.current;
    if (!node) return;
    try {
      node.classList.add('comprovante-capture');
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      node.classList.remove('comprovante-capture');
      const a = document.createElement('a');
      const safeName = (submittedData?.full_name || 'inscricao')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      a.href = dataUrl;
      a.download = `comprovante-${safeName}.png`;
      a.click();
    } catch {
      node.classList.remove('comprovante-capture');
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando evento...</div>;

  if (inviteToken && tokenValid === null) {
    return <div className="p-8 text-center">Validando convite...</div>;
  }

  if (inviteToken && tokenValid === false) {
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

  const isPreview = !!event && !event.is_published && !!user;
  const canRegister = !!event?.is_open && !!event?.is_published;
  const displayTitle = event.hotsite_title?.trim() || event.title;

  const themeStyles = {
    orange: { bg: 'bg-[#F5821F]', accent: 'bg-[#EF4B67]', text: 'text-[#F5821F]', selected: 'border-[#F5821F] bg-[#F5821F]/5 ring-[#F5821F]', hover: 'hover:border-[#F5821F]', btn: 'bg-[#F5821F] text-white' },
    purple: { bg: 'bg-[#7E22CE]', accent: 'bg-[#EC4899]', text: 'text-[#7E22CE]', selected: 'border-[#7E22CE] bg-[#7E22CE]/5 ring-[#7E22CE]', hover: 'hover:border-[#7E22CE]', btn: 'bg-[#7E22CE] text-white' },
    blue:   { bg: 'bg-[#1D4ED8]', accent: 'bg-[#06B6D4]', text: 'text-[#1D4ED8]', selected: 'border-[#1D4ED8] bg-[#1D4ED8]/5 ring-[#1D4ED8]', hover: 'hover:border-[#1D4ED8]', btn: 'bg-[#1D4ED8] text-white' },
    green:  { bg: 'bg-[#15803D]', accent: 'bg-[#EAB308]', text: 'text-[#15803D]', selected: 'border-[#15803D] bg-[#15803D]/5 ring-[#15803D]', hover: 'hover:border-[#15803D]', btn: 'bg-[#15803D] text-white' },
  };
  const currentTheme = themeStyles[(event?.theme_color as keyof typeof themeStyles)] || themeStyles.orange;

  // ═══════════════════════════════════════════════════════
  // MODO FORMULÁRIO DIRETO — rota /e/:slug/inscricao
  // ═══════════════════════════════════════════════════════
  if (isDirectForm) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        {isPreview && (
          <div className="fixed inset-x-0 top-0 z-[60] h-8 flex items-center justify-center bg-amber-400 text-sm font-bold text-black">
            Modo Preview (Não Publicado)
          </div>
        )}

        <header className={cn(
          'fixed inset-x-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/50',
          isPreview ? 'top-8' : 'top-0'
        )}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <span className="flex min-w-0 items-center font-semibold text-white">
              {event.display_organizer_logo ? (
                <img src={event.display_organizer_logo} alt={`Logo de ${event.display_organizer_name}`} className="mr-2 h-8 w-8 rounded-full object-cover" />
              ) : (
                <Building2 className="mr-2 h-5 w-5 shrink-0 text-zinc-200" />
              )}
              <span className="truncate">{event.display_organizer_name}</span>
            </span>
            <Link to={`/e/${slug}`} className="text-xs tracking-widest text-zinc-200 transition-colors hover:text-white">
              VER EVENTO
            </Link>
          </div>
        </header>

        <main className={cn('flex flex-1 flex-col pt-20', isPreview && 'pt-28')}>
          <div className="mx-auto max-w-2xl px-4 py-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">{displayTitle}</h1>
          </div>

          {blocked ? (
            <div className="mx-auto max-w-2xl px-4 py-8 text-center">
              <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
                <p className="text-muted-foreground">
                  {blockReason === 'trial_expired'
                    ? 'As inscrições online estão temporariamente indisponíveis devido à expiração do período de trial.'
                    : blockReason === 'inactive'
                    ? 'As inscrições online estão temporariamente indisponíveis.'
                    : 'As inscrições online atingiram o limite do plano gratuito.'}
                </p>
              </div>
            </div>
          ) : event.is_custom && formFields.length === 0 ? (
            <div className="mx-auto max-w-2xl px-4 py-8 text-center">
              <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
                <p className="text-muted-foreground">
                  Inscrições temporariamente indisponíveis. Entre em contato com a organização do evento.
                </p>
              </div>
            </div>
          ) : !canRegister ? (
            <div className="mx-auto max-w-2xl px-4 py-8 text-center">
              <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
                <p className="text-muted-foreground">Inscrições não disponíveis no momento</p>
              </div>
            </div>
          ) : (
            <section className="flex-1 bg-[#2A2A2A] px-6 py-12 text-white">
              <div className="mx-auto max-w-2xl">
                {!showForm ? (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Selecione o lote de inscrição</h2>
                    <Card
                      className={`cursor-pointer transition-all bg-[#383838] ring-white/20 text-white ${
                        selectedLot === null ? `${currentTheme.selected} ring-2` : `${currentTheme.hover}`
                      }`}
                      onClick={() => setSelectedLot(null)}
                    >
                      <CardContent className="flex items-start justify-between p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium text-muted-foreground">Inscrição Normal</span>
                            {selectedLot === null && <CheckCircle className={`size-5 ${currentTheme.text}`} />}
                          </div>
                          <p className="text-xs text-zinc-400">Preço padrão do evento, sem lote específico</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    {lots.map(renderLotCard)}
                    <button
                      disabled={!canRegister}
                      onClick={() => setShowForm(true)}
                      className={`w-full rounded-lg ${currentTheme.bg} text-white h-12 px-4 py-2 text-lg font-extrabold uppercase tracking-wide transition-opacity hover:opacity-90`}
                    >
                      Faça sua Inscrição
                    </button>
                  </div>
                ) : (
                  <div>
                    {selectedLot ? (
                      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/20 bg-[#383838] p-3">
                        <div>
                          <span className="text-sm font-medium text-white">{selectedLot.name}</span>
                          {selectedLot.description && (
                            <span className="ml-2 text-xs text-zinc-400">— {selectedLot.description}</span>
                          )}
                        </div>
                        <span className="font-bold text-white">
                          {selectedLot.price > 0 ? `R$ ${selectedLot.price.toFixed(2)}` : 'Grátis'}
                        </span>
                      </div>
                    ) : (
                      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/20 bg-[#383838] p-3">
                        <span className="text-sm font-medium text-white">Inscrição Normal</span>
                        <span className="font-bold text-white">
                          {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                        </span>
                      </div>
                    )}
                    <RegistrationForm
                      onSubmit={handleSubmit}
                      isLoading={isSubmitting}
                      lotId={selectedLot?.id}
                      lotPrice={selectedLot?.price ?? event.price ?? 0}
                      paymentLink={event.payment_link}
                      allowedPaymentMethods={event.allowed_payment_methods}
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
                )}
              </div>
            </section>
          )}
        </main>

        <footer className="w-full bg-[#000000] border-t border-white/10 py-8 px-4 text-center">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center space-y-3 font-sans">
            <a href="https://usekairosevents.vercel.app" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-all group cursor-pointer shadow-sm">
              <div className="flex items-center gap-1.5 border-r border-zinc-700 pr-3">
                <img src="/screenshots/Icone.png" alt="Icone Kairós" className="h-5 w-auto object-contain" />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black tracking-tight text-white">KAIRÓS</span>
                  <span className="text-sm font-black tracking-tight text-[#F5821F]">EVENTS</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                Crie seu evento <ExternalLink className="size-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </span>
            </a>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest pt-1">
              © {new Date().getFullYear()} Kairós Events. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MODO HOTSITE — rota /e/:slug
  // ═══════════════════════════════════════════════════════
  if (event && !event.is_published && !authLoading && !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Evento Indisponível</h1>
          <p className="text-muted-foreground">
            A página deste evento ainda não foi publicada ou encontra-se indisponível no momento.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const value = selectedLot?.price ?? event.price ?? 0;
    const paymentMethod = submittedData?.payment_method ?? 'pix';
    const paymentStatus = submittedData?.payment_status ?? 'pending';
    const checkinUrl =
      checkinToken && submittedRegId
        ? buildCheckinUrl(slug ?? '', checkinToken, submittedRegId)
        : null;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-2">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Inscrição realizada!</h1>
            <p className="text-sm text-muted-foreground">
              Sua inscrição foi registrada com sucesso. Guarde ou imprima este comprovante.
            </p>
          </div>

          <RegistrationComprovante
            data={{
              fullName: submittedData?.full_name,
              email: submittedData?.email,
              whatsapp: submittedData?.whatsapp,
              eventTitle: displayTitle,
              lotName: selectedLot?.name,
              value,
              paymentMethod,
              paymentStatus,
              paymentMethodDetails: submittedData?.payment_method_details,
            }}
            qrValue={checkinUrl}
            comprovanteRef={comprovanteRef}
            event={event}
          />

          <div className="space-y-2 print:hidden">
            <Button variant="outline" className="w-full" onClick={handleSaveComprovante}>
              <Download className="h-4 w-4 mr-2" />
              Salvar no dispositivo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / Salvar comprovante
            </Button>
            <Link
              to="/"
              className="block w-full text-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Voltar ao início
            </Link>
          </div>
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
        <h1 className="text-2xl font-bold mb-1">{displayTitle}</h1>
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
        <h1 className="text-2xl font-bold mb-1">{displayTitle}</h1>
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
        className={`transition-all bg-[#383838] ring-white/20 text-white ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : `cursor-pointer ${currentTheme.hover}`
        } ${
          selectedLot?.id === lot.id ? `${currentTheme.selected} ring-2` : ''
        }`}
        onClick={() => !disabled && setSelectedLot(lot)}
      >
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="min-w-0 truncate text-base font-medium text-muted-foreground">{lot.name}</span>
              {status !== 'active' && (
                <span className={`shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.className}`}>
                  {cfg.label}
                </span>
              )}
              {selectedLot?.id === lot.id && <CheckCircle className={`size-5 shrink-0 ${currentTheme.text}`} />}
            </div>
            {lot.description && (
              <p className="text-sm text-zinc-300">{lot.description}</p>
            )}
            <p className="text-xs text-zinc-400">
              {new Date(lot.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(lot.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              {lot.max_capacity !== null && ` · ${count}/${lot.max_capacity} vagas`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-white">
              {lot.price > 0 ? `R$ ${lot.price.toFixed(2)}` : 'Grátis'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ctaLabel = event.cta_text?.trim() ? event.cta_text : 'Garantir Inscrição';

  const scrollToSobre = () => {
    document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToInscricao = () => {
    document.getElementById('inscricao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const mapUrl = event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
    : null;

  const cleanPhone = event.organizer_whatsapp ? event.organizer_whatsapp.replace(/\D/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá! Gostaria de tirar dúvidas sobre o evento ${displayTitle}`)}`
    : null;

  const startDate = event.start_date ? new Date(event.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const endDate = event.end_date ? new Date(event.end_date + 'T12:00:00').toLocaleDateString('pt-BR') : '';

  const isFullBleed = event.hero_layout === 'full' && !!event.cover_url;
  const heroPt = isPreview ? 'pt-40' : 'pt-32';

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* BANNER PREVIEW */}
      {isPreview && (
        <div className="fixed inset-x-0 top-0 z-[60] h-8 flex items-center justify-center bg-amber-400 text-sm font-bold text-black">
          Modo Preview (Não Publicado)
        </div>
      )}
      {/* HEADER FIXO */}
      <header className={cn(
        'fixed inset-x-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/50 transition-all',
        isPreview ? 'top-8' : 'top-0'
      )}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <span className="flex min-w-0 items-center font-semibold text-white">
            {event.display_organizer_logo ? (
              <img
                src={event.display_organizer_logo}
                alt={`Logo de ${event.display_organizer_name}`}
                className="mr-2 h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <Building2 className="mr-2 h-5 w-5 shrink-0 text-zinc-200" />
            )}
            <span className="truncate">{event.display_organizer_name}</span>
          </span>
          <nav className="hidden md:flex items-center gap-8">
            {event.show_about !== false && event.description && (
              <button
                type="button"
                onClick={scrollToSobre}
                className="text-xs tracking-widest text-zinc-200 transition-colors hover:text-white"
              >
                SOBRE
              </button>
            )}
          </nav>
          {event.show_registration !== false && (
            <button
              type="button"
              onClick={scrollToInscricao}
              className={`hidden md:inline-flex shrink-0 ${currentTheme.btn} rounded-full px-6 py-2 font-bold transition-all hover:scale-105`}
            >
              INSCRIÇÕES
            </button>
          )}
        </div>
      </header>

      {/* HERO */}
      <section
        className={
          isFullBleed
            ? `relative flex flex-col items-center justify-center pb-20 px-4 text-center text-white min-h-[80svh] ${heroPt}`
            : `bg-black flex flex-col justify-center pb-20 px-4 text-center text-white min-h-[80svh] ${heroPt}`
        }
      >
        {isFullBleed && (
          <div className="absolute inset-0 z-0">
            <img src={event.cover_url} alt="Capa" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-black/75" />
          </div>
        )}

        <div className={isFullBleed ? 'relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center' : ''}>
          <h1 className="mx-auto max-w-3xl text-[clamp(2.5rem,5vw,4rem)] font-black leading-tight tracking-tight">
            {displayTitle}
          </h1>

          {event.subtitle && (
            <p className="mt-6 text-[1.25rem] font-medium leading-relaxed text-zinc-200/90 max-w-2xl text-center">
              {event.subtitle}
            </p>
          )}

          {!isFullBleed && event.cover_url && (
            <img
              src={event.cover_url}
              alt={displayTitle}
              className="mx-auto my-6 max-w-md md:max-w-xl w-full rounded-2xl border border-white/10 shadow-2xl aspect-video object-cover object-center max-h-[400px]"
            />
          )}

          <div className={`mx-auto mt-8 h-1 w-16 rounded-full ${currentTheme.accent}`} />

          {event.start_date && (
            <p className="mt-4 flex items-center justify-center gap-2 text-xl md:text-2xl font-semibold text-white/80">
              <CalendarDays className="size-5" />
              <span>
                {startDate}
                {endDate && endDate !== startDate ? ` a ${endDate}` : ''}
              </span>
            </p>
          )}

          {event.show_registration !== false ? (
            canRegister ? (
              <button
                type="button"
                onClick={scrollToInscricao}
                className={`mt-8 inline-flex w-full sm:w-auto max-w-sm items-center justify-center gap-2 rounded-full ${currentTheme.bg} px-4 sm:px-8 py-3 text-sm sm:text-base md:text-lg font-extrabold uppercase tracking-wide text-white min-h-12 transition-opacity hover:opacity-90`}
              >
                {ctaLabel}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="mt-8 inline-flex w-full sm:w-auto max-w-sm items-center justify-center gap-2 rounded-full bg-white/20 px-4 sm:px-8 py-3 text-sm sm:text-base md:text-lg font-extrabold uppercase tracking-wide text-white/60 min-h-12 cursor-not-allowed"
              >
                INSCRIÇÕES ENCERRADAS
              </button>
            )
          ) : waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full sm:w-auto max-w-sm items-center justify-center gap-2 rounded-full bg-green-600 hover:bg-green-700 text-white px-4 sm:px-8 py-3 text-sm sm:text-base md:text-lg font-extrabold uppercase tracking-wide min-h-12 transition-all"
            >
              <MessageCircle className="size-5" />
              FALAR COM O ORGANIZADOR
            </a>
          ) : null}

          {timeLeft.d === 0 && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0 ? (
            <p className="mt-10 text-lg font-semibold text-white/60">EVENTO INICIADO/ENCERRADO</p>
          ) : (
            <div className="mt-10 flex items-center justify-center gap-6 md:gap-10">
              {[
                { value: timeLeft.d, label: 'Dias' },
                { value: timeLeft.h, label: 'Horas' },
                { value: timeLeft.m, label: 'Min' },
                { value: timeLeft.s, label: 'Seg' },
              ].map((block) => (
                <div key={block.label} className="flex flex-col items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md px-3 py-2">
                  <span className="text-4xl font-bold text-white md:text-5xl">
                    {String(block.value).padStart(2, '0')}
                  </span>
                  <span className="text-xs uppercase text-white/60">{block.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SOBRE */}
      {event.show_about !== false && event.description && (
        <section
          id="sobre"
          className={`scroll-mt-20 px-6 py-24 text-center text-white ${currentTheme.bg}`}
        >
          <h2 className="text-2xl font-bold uppercase tracking-wide md:text-3xl">Sobre</h2>
          <div className={`mx-auto mt-3 h-1 w-12 rounded-full ${currentTheme.accent}`} />
          <p className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap text-center text-base md:text-[1.125rem] leading-relaxed text-white/90">{event.description}</p>
        </section>
      )}

      {/* LOCAL */}
      {event.show_location !== false && (event.location || event.location_name) && (
        <section className="w-full bg-white py-24 px-6 text-center">
          <h2 className="text-sm uppercase tracking-widest text-zinc-600 mb-4">
            Local
          </h2>
          <div className={`mx-auto mb-8 h-1 w-16 rounded-full ${currentTheme.accent}`} />

          <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 mb-2">
              <MapPin className="size-8" />
            </div>
            {event.location_name ? (
              <>
                <p className="text-xl md:text-2xl font-bold text-zinc-900 leading-relaxed">
                  {event.location_name}
                </p>
                {event.location && (
                  <p className="flex items-center justify-center gap-1.5 text-base text-zinc-600">
                    <MapPin className="size-4 shrink-0" />
                    <span className="leading-relaxed">{event.location}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xl md:text-2xl font-bold text-zinc-900 leading-relaxed">
                {event.location}
              </p>
            )}

            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-zinc-200 px-6 py-3 text-sm font-bold uppercase tracking-wide text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                Abrir no Mapa <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* INSCRIÇÕES */}
      {event.show_registration !== false && (
      <section id="inscricao" className="scroll-mt-20 bg-[#2A2A2A] px-6 py-24 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wide md:text-3xl">Inscrições</h2>
          <div className={`mx-auto mt-3 h-1 w-12 rounded-full ${currentTheme.accent}`} />
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          {!canRegister ? (
            <div className="rounded-xl border border-white/20 bg-[#383838] p-8 text-center shadow-sm">
              <p className="text-zinc-300">Inscrições não disponíveis no momento</p>
            </div>
          ) : !showForm ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Selecione o lote de inscrição</h2>

              <Card
                className={`cursor-pointer transition-all bg-[#383838] ring-white/20 text-white ${
                  selectedLot === null ? `${currentTheme.selected} ring-2` : `${currentTheme.hover}`
                }`}
                onClick={() => setSelectedLot(null)}
              >
                <CardContent className="flex items-start justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-muted-foreground">Inscrição Normal</span>
                      {selectedLot === null && <CheckCircle className={`size-5 ${currentTheme.text}`} />}
                    </div>
                    <p className="text-xs text-zinc-400">Preço padrão do evento, sem lote específico</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {lots.map(renderLotCard)}

              <button
                disabled={!canRegister}
                onClick={() => setShowForm(true)}
                className={`w-full rounded-lg ${currentTheme.bg} text-white h-12 px-4 py-2 text-lg font-extrabold uppercase tracking-wide transition-opacity hover:opacity-90 ${
                  !canRegister ? 'cursor-not-allowed opacity-50 hover:opacity-50' : ''
                }`}
              >
                Faça sua Inscrição
              </button>
            </div>
          ) : (
            <div>
              {selectedLot ? (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-white/20 bg-[#383838] p-3">
                  <div>
                    <span className="text-sm font-medium text-white">{selectedLot.name}</span>
                    {selectedLot.description && (
                      <span className="ml-2 text-xs text-zinc-400">— {selectedLot.description}</span>
                    )}
                  </div>
                  <span className="font-bold text-white">
                    {selectedLot.price > 0 ? `R$ ${selectedLot.price.toFixed(2)}` : 'Grátis'}
                  </span>
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-white/20 bg-[#383838] p-3">
                  <span className="text-sm font-medium text-white">Inscrição Normal</span>
                  <span className="font-bold text-white">
                    {event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                  </span>
                </div>
              )}
              <RegistrationForm
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
                lotId={selectedLot?.id}
                lotPrice={selectedLot?.price ?? event.price ?? 0}
                paymentLink={event.payment_link}
                allowedPaymentMethods={event.allowed_payment_methods}
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
          )}
        </div>
      </section>
      )}

      {/* CONTATO */}
      {waUrl && (
        <section className="mx-auto my-12 max-w-5xl px-4">
          <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-[#F0F0F0] px-6 py-10 text-center md:flex-row md:text-left">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Ficou com alguma dúvida sobre o evento?</h2>
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-green-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800"
            >
              <MessageCircle className="size-4" />
              Falar no WhatsApp
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="w-full bg-[#000000] border-t border-white/10 py-12 px-4 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center space-y-5 font-sans">
          <a
            href="https://usekairosevents.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-all group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-1.5 border-r border-zinc-700 pr-3">
              <img src="/screenshots/Icone.png" alt="Icone Kairós" className="h-5 w-auto object-contain" />
              <div className="flex items-center gap-1">
                <span className="text-sm font-black tracking-tight text-white">KAIRÓS</span>
                <span className="text-sm font-black tracking-tight text-[#F5821F]">EVENTS</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors flex items-center gap-1.5">
              Crie seu evento <ExternalLink className="size-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </span>
          </a>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            Plataforma inteligente para gestão de eventos, inscrições e secretaria de igrejas.
          </p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest pt-2">
            © {new Date().getFullYear()} Kairós Events. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
