import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard, SkeletonMobileCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useEvent } from '@/contexts/EventContext';
import { Printer, Loader2, CalendarDays, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Registrant {
  full_name: string;
  gender: string | null;
}

function SectionPage({ title, registrants, total, eventName, eventDate }: {
  title: string;
  registrants: Registrant[];
  total: number;
  eventName: string;
  eventDate: string | null;
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

      <div className="flex border border-border rounded-lg mb-6 divide-x divide-border">
        <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>Data: {eventDate ? formatDate(eventDate) : '-'}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Total de inscritos: {total}</span>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">{title} ({registrants.length})</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-border bg-muted px-3 py-2 text-left text-foreground font-bold">Nº</th>
            <th className="border border-border bg-muted px-3 py-2 text-left text-foreground font-bold">Nome</th>
            <th className="w-48 border border-border bg-muted px-3 py-2 text-left text-foreground font-bold">Visto</th>
          </tr>
        </thead>
        <tbody>
          {registrants.map((r, i) => (
            <tr key={i}>
              <td className="border border-border px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
              <td className="border border-border px-3 py-2 text-foreground">{r.full_name}</td>
              <td className="border border-border px-3 py-2" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FrequenciaPage() {
  const { event, eventId, loading: eventLoading } = useEvent();
  const [men, setMen] = useState<Registrant[]>([]);
  const [women, setWomen] = useState<Registrant[]>([]);
  const [unknown, setUnknown] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);

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
    ['Homens', men],
    ['Mulheres', women],
    ['Geral', unknown],
  ] as const).filter(([, arr]) => arr.length > 0);

  const total = men.length + women.length + unknown.length;
  const eventName = event?.title || 'Evento';
  const eventDate = event?.start_date ?? null;

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

      <div className="print:hidden mb-6">
        <PageHeader title="Lista de Presença" badge={event?.title} />
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
      </div>

      {sections.map(([title, registrants], idx) => (
        <div key={title}>
          {idx > 0 && (
            <div className="print:hidden border-t-2 border-dashed border-muted-foreground/30 my-8 py-2 text-center text-xs text-muted-foreground">
              — Quebra de página —
            </div>
          )}
          <SectionPage
            title={title}
            registrants={registrants}
            total={total}
            eventName={eventName}
            eventDate={eventDate}
          />
        </div>
      ))}

      {total === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhuma inscrição encontrada.</div>
      )}
    </div>
  );
}
