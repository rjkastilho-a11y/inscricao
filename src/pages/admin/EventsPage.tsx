import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Trash2, Pencil, ExternalLink, Copy, Check, ArrowUpDown } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useTrial } from '@/components/layout/ChurchGuard';

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

type SortKey = 'title' | 'start_date' | 'price';
type SortDir = 'asc' | 'desc';
type EventFilter = 'all' | 'active' | 'closed';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('start_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<EventFilter>('active');
  const trial = useTrial();
  const navigate = useNavigate();

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar eventos:', error);
    }
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc('soft_delete_event', { p_event_id: deleteTarget.id });
    if (error) {
      toast.error('Erro ao excluir evento: ' + error.message);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchEvents();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...events].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'title') return a.title.localeCompare(b.title) * dir;
    if (sortKey === 'price') return (a.price - b.price) * dir;
    return ((a.start_date || '') < (b.start_date || '') ? -1 : 1) * dir;
  });

  const filtered = sorted.filter((event) => {
    if (filter === 'active') return event.is_open;
    if (filter === 'closed') return !event.is_open;
    return true;
  });

  const FILTER_OPTIONS: { key: EventFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Em andamento' },
    { key: 'closed', label: 'Encerrados' },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Eventos" />
        <div className="grid gap-4 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="hidden md:block">
          <div className="flex gap-2 mb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 w-24 rounded-lg bg-muted/70 animate-pulse" />
            ))}
          </div>
          <SkeletonTable rows={4} columns={7} />
        </div>
      </div>
    );
  }

  const SortHeader = ({ field, label }: { field: SortKey; label: string }) => (
    <th
      className="p-4 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn(
          'size-3 transition-opacity',
          sortKey === field ? 'opacity-100' : 'opacity-30'
        )} />
      </div>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Eventos"
        description={filtered.length > 0
          ? `${filtered.length} ${filter === 'all' ? `evento${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}` : filter === 'active' ? 'em andamento' : 'encerrado'}`
          : undefined
        }
        action={{
          label: 'Novo evento',
          to: '/app/eventos/novo',
          onClick: trial?.isTrialExceeded ? () => trial.openUpgrade() : undefined,
        }}
      />

      {events.length === 0 && (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Crie seu primeiro evento para começar a gerenciar inscrições."
          action={{
            label: 'Criar primeiro evento',
            to: '/app/eventos/novo',
            onClick: trial?.isTrialExceeded ? () => trial.openUpgrade() : undefined,
          }}
        />
      )}

      {events.length > 0 && (
        <div className="mb-4 flex gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              variant={filter === opt.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Cards: mobile ── */}
      <div className="grid gap-4 md:hidden">
        {filtered.map((event) => (
          <Card key={event.id} className="bg-card backdrop-blur-md border-border shadow-lg flex flex-col min-h-[220px]">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg font-semibold text-foreground">
                  {event.title}
                </CardTitle>
                <Badge variant={event.is_open ? 'default' : 'secondary'} className="shrink-0">
                  {event.is_open ? 'Aberto' : 'Fechado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-base">
              {event.start_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início:</span>
                  <span className="text-foreground">{formatDate(event.start_date)}</span>
                </div>
              )}
              {event.end_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fim:</span>
                  <span className="text-foreground">{formatDate(event.end_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="text-foreground">{event.price > 0 ? formatCurrency(event.price) : 'Grátis'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vagas:</span>
                <span className="text-foreground">{event.max_capacity ?? 'Ilimitado'}</span>
              </div>
            </CardContent>
            <div className="flex items-center gap-2 border-t border-border p-3">
              <Link
                to={`/app/evento/${event.id}/dashboard`}
                className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Acessar
              </Link>
              <Link
                to={`/app/eventos/${event.id}/editar`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'bg-card border-border')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="bg-card border-border"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}`);
                  setCopiedId(event.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
              >
                {copiedId === event.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-card border-border text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabela: desktop ── */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent">
              <SortHeader field="title" label="Evento" />
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              <SortHeader field="start_date" label="Início" />
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Fim</th>
              <SortHeader field="price" label="Valor" />
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Vagas</th>
              <th className="p-4 text-right text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr key={event.id} className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/app/evento/${event.id}/dashboard`)}>
                <td className="p-4 text-base font-medium text-foreground">{event.title}</td>
                <td className="p-4">
                  <Badge variant={event.is_open ? 'default' : 'secondary'}>
                    {event.is_open ? 'Aberto' : 'Fechado'}
                  </Badge>
                </td>
                <td className="p-4 text-base text-muted-foreground">
                  {event.start_date ? formatDate(event.start_date) : '-'}
                </td>
                <td className="p-4 text-base text-muted-foreground">
                  {event.end_date ? formatDate(event.end_date) : '-'}
                </td>
                <td className="p-4 text-base text-foreground">
                  {event.price > 0 ? formatCurrency(event.price) : 'Grátis'}
                </td>
                <td className="p-4 text-base text-muted-foreground">
                  {event.max_capacity ?? '∞'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Tooltip content="Acessar">
                      <Link
                        to={`/app/evento/${event.id}/dashboard`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-muted-foreground hover:text-foreground')}
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Tooltip>
                    <Tooltip content="Editar">
                      <Link
                        to={`/app/eventos/${event.id}/editar`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-muted-foreground hover:text-foreground')}
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                    </Tooltip>
                    <Tooltip content="Copiar link">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}`);
                          setCopiedId(event.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === event.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </Button>
                    </Tooltip>
                    <Tooltip content="Excluir">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(event)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir evento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o evento <strong>{deleteTarget?.title}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
