import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown } from 'lucide-react';

const MONTHLY_FEATURES = [
  'Eventos ilimitados',
  'Check-in digital',
  'Recibos via WhatsApp',
  'Suporte por e-mail',
];

const ANNUAL_FEATURES = [
  'Tudo do plano mensal',
  'Formulários Customizados',
  'Relatórios Avançados',
  'Importação em Lote',
  'Prioridade em atualizações',
  'Suporte prioritário WhatsApp',
];

export default function PlanPage() {
  return (
    <div>
      <PageHeader
        title="Planos"
        description="Compare os planos e desbloqueie todos os recursos exclusivos."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardHeader>
            <CardTitle>Plano Mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-bold text-foreground">R$ 59,90</span>
              <span className="text-sm text-muted-foreground ml-1">/mês</span>
            </div>
            <ul className="space-y-2">
              {MONTHLY_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>
              Assinar
            </Button>
          </CardContent>
        </Card>

        <Card className="relative bg-card backdrop-blur-md border-primary/40 shadow-lg">
          <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            MAIS VANTAJOSO
          </span>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="size-4 text-primary" />
              Plano Anual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-bold text-primary">R$ 482,50</span>
              <span className="text-sm text-muted-foreground ml-1">/ano</span>
            </div>
            <ul className="space-y-2">
              {ANNUAL_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button className="w-full" disabled>
              Assinar
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-sm text-muted-foreground max-w-3xl">
        O Plano Anual desbloqueia automaticamente todos os recursos exclusivos. O checkout
        estará disponível em breve.
      </p>
    </div>
  );
}
