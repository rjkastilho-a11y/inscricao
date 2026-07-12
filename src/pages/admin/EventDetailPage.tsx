import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { copyToClipboard } from '@/lib/clipboard';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import GestaoConvites from '@/components/GestaoConvites';

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  is_open: boolean;
  max_capacity: number;
  price: number;
  cover_url: string;
  created_at: string;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      setAllEvents(events || []);

      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      setEvent(data);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Carregando..." />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  if (!event) return <div className="text-muted-foreground">Evento não encontrado.</div>;

  return (
    <div>
      <PageHeader title={event.title} action={{ label: 'Editar', to: `/app/eventos/${id}/editar` }} />

      <div className="mb-4">
        <Select value={id} onValueChange={(value) => navigate(`/app/eventos/${value}`)}>
          <SelectTrigger className="w-full md:max-w-md bg-card backdrop-blur-md border-border">
            <SelectValue>
              {(value) => value ? (allEvents.find(e => e.id === value)?.title || value) : "Selecione um evento..."}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allEvents.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-foreground">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug:</span>
              <span className="text-foreground">{event.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={event.is_open ? 'default' : 'secondary'}>
                {event.is_open ? 'Aberto' : 'Fechado'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Início:</span>
              <span className="text-foreground">{event.start_date ? formatDate(event.start_date) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fim:</span>
              <span className="text-foreground">{event.end_date ? formatDate(event.end_date) : '-'}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-foreground">Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="text-foreground">{event.price > 0 ? formatCurrency(event.price) : 'Grátis'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vagas:</span>
              <span className="text-foreground">{event.max_capacity ?? 'Ilimitado'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {event.description && (
        <Card className="mt-4 bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-foreground">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap text-foreground">{event.description}</p>
          </CardContent>
        </Card>
      )}
      <div className="mt-4 flex gap-2">
        <Link
          to={`/app/evento/${event.id}/inscricoes`}
          className="inline-flex items-center justify-center rounded-lg bg-card backdrop-blur-md border border-border h-8 px-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Ver inscrições
        </Link>
        <Button
          variant="outline"
          className="bg-card backdrop-blur-md border-border"
          onClick={async () => {
            await copyToClipboard(`${window.location.origin}/e/${event.slug}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? 'Link copiado!' : 'Copiar link de inscrição'}
        </Button>
      </div>

      <div className="mt-6">
        <GestaoConvites eventId={event.id} eventSlug={event.slug} eventTitle={event.title} eventIsOpen={event.is_open} />
      </div>
    </div>
  );
}
