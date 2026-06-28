import { useEvent } from '@/contexts/EventContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function EventSettingsPage() {
  const { event } = useEvent();
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  return (
    <div>
      <PageHeader title="Configurações" badge={event.title} action={{ label: 'Editar', to: `/app/eventos/${event.id}/editar` }} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug:</span>
              <span>{event.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={event.is_open ? 'default' : 'secondary'}>
                {event.is_open ? 'Aberto' : 'Fechado'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Início:</span>
              <span>{event.start_date ? formatDate(event.start_date) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fim:</span>
              <span>{event.end_date ? formatDate(event.end_date) : '-'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span>{event.price > 0 ? formatCurrency(event.price) : 'Grátis'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vagas:</span>
              <span>{event.max_capacity ?? 'Ilimitado'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {event.description && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {event.terms_text && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Termos e Condições</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base whitespace-pre-wrap">{event.terms_text}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          to={`/app/evento/${event.id}/inscricoes`}
          className="inline-flex items-center justify-center rounded-lg bg-card border border-border h-8 px-2.5 text-sm font-medium hover:bg-accent"
        >
          Ver inscrições
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? 'Link copiado!' : 'Copiar link de inscrição'}
        </Button>
      </div>
    </div>
  );
}
