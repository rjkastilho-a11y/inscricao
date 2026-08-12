import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard, SkeletonMobileCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEvent } from '@/contexts/useEvent';
import { Check, Printer, CalendarDays, Users, User, LayoutList, List } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

type PrintMode = 'todas' | 'homens' | 'mulheres' | 'geral';

interface Registrant {
  full_name: string;
  gender: string | null;
}

function SectionPage({ title, registrants, total, eventName, eventDate, hideTitle }: {
  title: string;
  registrants: Registrant[];
  total: number;
  eventName: string;
  eventDate: string | null;
  hideTitle?: boolean;
}) {
  return (
    <div className="print-section">
      <div className="text-center mb-8 space-y-1">
        <p className="text-lg uppercase tracking-widest font-medium">
          <span className="text-foreground">Kairós</span>{' '}
          <span className="text-primary">Events</span>
        </p>
        <p className="text-xl uppercase font-semibold text-foreground">
          LISTA DE PRESENÇA
        </p>
        <h1 className="text-2xl font-bold text-foreground">{eventName}</h1>
      </div>

      <div className="flex flex-col sm:flex-row border border-border rounded-lg mb-6 divide-y sm:divide-y-0 sm:divide-x print:flex-row print:divide-y-0 print:divide-x divide-border">
        <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>Data: {eventDate ? formatDate(eventDate) : '-'}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span>Total de inscritos: {total}</span>
        </div>
      </div>

      {!hideTitle && <h2 className="text-lg font-semibold mb-4">{title} ({registrants.length})</h2>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm mb-8 print:border-none print:shadow-none print:bg-transparent print:mb-4 print:overflow-visible">
        <table className="w-full border-collapse text-sm sm:text-base">
          <thead>
            <tr>
              <th className="w-8 sm:w-auto print:w-auto border border-border bg-muted px-1.5 sm:px-3 print:px-3 py-2 text-left text-foreground font-bold">Nº</th>
              <th className="border border-border bg-muted px-3 py-2 text-left text-foreground font-bold">Nome</th>
              <th className="w-16 sm:w-48 print:w-48 border border-border bg-muted px-1.5 sm:px-3 print:px-3 py-2 text-left text-foreground font-bold">Visto</th>
            </tr>
          </thead>
          <tbody>
            {registrants.map((r, i) => (
              <tr key={i}>
                <td className="border border-border px-1.5 sm:px-3 print:px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
                <td className="border border-border px-3 py-2 text-foreground min-w-0 break-words">{r.full_name}</td>
                <td className="border border-border px-1.5 sm:px-3 print:px-3 py-2" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FrequenciaPage() {
  const { event, eventId, loading: eventLoading } = useEvent();
  const [men, setMen] = useState<Registrant[]>([]);
  const [women, setWomen] = useState<Registrant[]>([]);
  const [unknown, setUnknown] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode>('todas');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('full_name, gender')
        .eq('event_id', eventId)
        .neq('payment_status', 'canceled')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[FrequenciaPage] Erro na query:', error);
      }
      if (data) {
        setMen(data.filter((r) => r.gender === 'M'));
        setWomen(data.filter((r) => r.gender === 'F'));
        setUnknown(data.filter((r) => r.gender !== 'M' && r.gender !== 'F'));
      }
      setLoading(false);
    };
    fetch();
  }, [eventId]);

  if (loading || eventLoading) {
    return (
      <div>
        <PageHeader title="Frequência" badge={event?.title} />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="md:hidden space-y-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonMobileCard key={i} />)}
        </div>
      </div>
    );
  }

  const sections = ([
    ['Homens', men, 'homens'],
    ['Mulheres', women, 'mulheres'],
    ['Geral', unknown, 'geral'],
  ] as const).filter(([, arr]) => arr.length > 0);

  const allRegistrants = [...men, ...women, ...unknown].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'pt-BR', { sensitivity: 'base' })
  );

  const total = men.length + women.length + unknown.length;
  const eventName = event?.title || 'Evento';
  const eventDate = event?.start_date ?? null;

  const printOptions: { mode: PrintMode; title: string; description: string; icon: typeof User }[] = [
    { mode: 'homens', title: 'Homens', description: 'Apenas a lista masculina.', icon: User },
    { mode: 'mulheres', title: 'Mulheres', description: 'Apenas a lista feminina.', icon: Users },
    { mode: 'geral', title: 'Geral', description: 'Apenas a lista geral.', icon: LayoutList },
    { mode: 'todas', title: 'Todos Juntos', description: 'Todos os inscritos em uma única lista.', icon: List },
  ];

  const handleConfirmPrint = () => {
    setPrintDialogOpen(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode('todas'), 300);
    }, 300);
  };

  return (
    <div className="print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            background: transparent !important;
            color: #000 !important;
          }
          .print-section { page-break-after: always; break-after: page; }
          .print-section:last-child { page-break-after: auto; break-after: auto; }
        }
        .print-section {
          display: block;
        }
      `}</style>

      <div className="print:hidden mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <PageHeader title="Lista de Presença" badge={event?.title} />
        </div>
        <Button onClick={() => setPrintDialogOpen(true)} className="w-full sm:w-auto max-md:h-11 shadow-sm shrink-0">
          <Printer className="size-4 mr-2" /> Imprimir
        </Button>
      </div>

      {sections.map(([title, registrants, mode]) => (
        <div
          key={title}
          className={cn('hidden', printMode === mode ? 'print:block' : 'print:hidden')}
        >
          <SectionPage
            title={title}
            registrants={registrants}
            total={total}
            eventName={eventName}
            eventDate={eventDate}
          />
        </div>
      ))}

      <div className={cn('block', printMode === 'todas' ? '' : 'print:hidden')}>
        <SectionPage
          title="Todos Juntos"
          registrants={allRegistrants}
          total={total}
          eventName={eventName}
          eventDate={eventDate}
          hideTitle
        />
      </div>

      {total === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhuma inscrição encontrada.</div>
      )}

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opções de Impressão</DialogTitle>
            <DialogDescription>
              Escolha quais listas serão impressas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            {printOptions.map(({ mode, title, description, icon: Icon }) => {
              const active = printMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPrintMode(mode)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'border-border bg-transparent hover:bg-muted/50'
                  )}
                  aria-pressed={active}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
                      {title}
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPrint}>
              <Printer className="mr-1 size-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
