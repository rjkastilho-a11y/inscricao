import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, paymentStatusLabels, formatDate } from '@/lib/utils';
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const [eventStats, setEventStats] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: events } = await supabase.from('events').select('*');
      const { data: registrations } = await supabase.from('registrations').select('*, events(price), event_lots!lot_id(price)').neq('payment_status', 'canceled');

      if (events && registrations) {
        const stats = events.map((ev: any) => {
          const regs = registrations.filter((r: any) => r.event_id === ev.id);
          const paid = regs.filter((r: any) => r.payment_status === 'paid');
          const revenue = paid.reduce((acc: number, r: any) => acc + Number(r.event_lots?.price ?? r.events?.price ?? 0), 0);
          return {
            title: ev.title,
            total: regs.length,
            paid: paid.length,
            confirmed: regs.filter((r: any) => r.checked_in).length,
            pending: regs.filter((r: any) => r.payment_status === 'pending').length,
            revenue,
          };
        });
        setEventStats(stats);
      }
    };
    fetch();
  }, []);

  const totalRegs = eventStats.reduce((a, b) => a + b.total, 0);
  const totalPaid = eventStats.reduce((a, b) => a + b.paid, 0);
  const totalConfirmed = eventStats.reduce((a, b) => a + b.confirmed, 0);
  const totalRevenue = eventStats.reduce((a, b) => a + b.revenue, 0);

  return (
    <div>
      <PageHeader title="Relatórios" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Total Inscrições</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalRegs}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Pagos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{totalPaid}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Confirmados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-violet-600">{totalConfirmed}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Taxa Conversão</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalRegs > 0 ? Math.round((totalPaid / totalRegs) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-4 text-sm font-medium">Evento</th>
                  <th className="text-left p-4 text-sm font-medium">Inscrições</th>
                  <th className="text-left p-4 text-sm font-medium">Pagos</th>
                  <th className="text-left p-4 text-sm font-medium">Confirmados</th>
                  <th className="text-left p-4 text-sm font-medium">Pendentes</th>
                  <th className="text-left p-4 text-sm font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {eventStats.map((ev) => (
                  <tr key={ev.title} className="border-b hover:bg-muted/50">
                    <td className="p-4 text-sm font-medium">{ev.title}</td>
                    <td className="p-4 text-sm">{ev.total}</td>
                    <td className="p-4 text-sm">
                      <Badge variant="default">{ev.paid}</Badge>
                    </td>
                    <td className="p-4 text-sm">
                      <Badge variant="default" className="bg-violet-100 text-violet-700">{ev.confirmed}</Badge>
                    </td>
                    <td className="p-4 text-sm">
                      <Badge variant="secondary">{ev.pending}</Badge>
                    </td>
                    <td className="p-4 text-sm">{formatCurrency(ev.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {eventStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum dado disponível.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
