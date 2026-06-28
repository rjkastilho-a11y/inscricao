import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard, SkeletonMobileCard, SkeletonTable } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, paymentStatusLabels, paymentMethodLabels } from '@/lib/utils';
import { Pencil, ArrowLeft, Trash2, CheckCircle, Loader2, Check, Copy, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

function formatReceipt(name: string, eventTitle: string, amount: number): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return [
    `Olá, *${name}*! 👋`,
    '',
    `Passando para confirmar o recebimento do seu pagamento no valor de *R$ ${amount.toFixed(2)}* referente à sua inscrição no evento *${eventTitle}*.`,
    '',
    '✅ *Inscrição Confirmada!*',
    `Data do registro: ${dateStr}`,
  ].join('\n');
}

interface Registration {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string;
  gender: string;
  is_christian: boolean;
  is_baptized: boolean;
  church: string;
  pastor: string;
  church_role: string;
  church_role_other: string;
  godparent: string;
  godparent_contact: string;
  pastoral_authorization: boolean;
  health_info: string;
  emergency_contact: string;
  emergency_phone: string;
  payment_method: string;
  payment_status: string;
  private_notes: string;
  created_at: string;
  lot_id: string | null;
  events: { title: string } | null;
  event_lots: { name: string; price: number } | null;
}

export default function RegistrationDetailPage() {
  const { id, eventId } = useParams<{ id: string; eventId: string }>();
  const navigate = useNavigate();
  const [reg, setReg] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amount: number;
    receipt: string;
    cleanPhone: string;
  } | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('registrations')
        .select('*, events(title), event_lots!lot_id(name, price)')
        .eq('id', id)
        .single();
      setReg(data as unknown as Registration);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleMarkAsPaid = async () => {
    setPaying(true);
    const amount = parseFloat(payAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      setPaying(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('registrations')
      .update({ payment_status: 'paid', paid_amount: amount })
      .eq('id', id);

    if (updateError) {
      toast.error('Erro ao atualizar pagamento: ' + updateError.message);
      setPaying(false);
      return;
    }

    const { data: existingEntry } = await supabase
      .from('financial_entries')
      .select('id')
      .eq('registration_id', id)
      .eq('type', 'income')
      .maybeSingle();

    const entryPayload = {
      event_id: reg!.event_id,
      registration_id: id,
      type: 'income' as const,
      category: 'registration',
      description: 'Inscrição Paga',
      amount,
      entry_date: new Date().toISOString().slice(0, 10),
    };

    const { error: finError } = existingEntry
      ? await supabase.from('financial_entries').update(entryPayload).eq('id', existingEntry.id)
      : await supabase.from('financial_entries').insert(entryPayload);

    if (finError) {
      toast.error('Erro ao registrar entrada financeira: ' + finError.message);
      setPaying(false);
      return;
    }

    setPaymentSuccess({
      amount,
      receipt: formatReceipt(reg!.full_name, reg!.events?.title || 'Evento', amount),
      cleanPhone: cleanPhone(reg!.whatsapp),
    });
    setPayAmount('');
    setPaying(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      setDeleting(false);
      return;
    }
    navigate('/app/evento/' + eventId + '/inscricoes');
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Carregando..." />
        <div className="space-y-4">
          <SkeletonCard />
          <div className="md:hidden space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonMobileCard key={i} />)}
          </div>
          <div className="hidden md:block">
            <SkeletonTable rows={3} columns={2} />
          </div>
        </div>
      </div>
    );
  }
  if (!reg) return <div className="text-muted-foreground py-16 text-center">Inscrição não encontrada.</div>;

  return (
    <div>
      <PageHeader title={reg.full_name} />
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/evento/' + eventId + '/inscricoes')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Dados Pessoais</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=0`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="E-mail" value={reg.email} />
            <Row label="WhatsApp" value={reg.whatsapp} />
            <Row label="Nascimento" value={reg.birth_date ? formatDate(reg.birth_date) : '-'} />
            <Row label="Gênero" value={reg.gender === 'M' ? 'Masculino' : reg.gender === 'F' ? 'Feminino' : '-'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Vida Cristã</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=1`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Cristão" value={reg.is_christian ? 'Sim' : 'Não'} />
            {reg.is_christian && (
              <>
                <Row label="Batizado" value={reg.is_baptized ? 'Sim' : 'Não'} />
                <Row label="Igreja" value={reg.church || '-'} />
                <Row label="Pastor" value={reg.pastor || '-'} />
                <Row label="Cargo" value={reg.church_role === 'Outro' ? reg.church_role_other : reg.church_role || '-'} />
                <Row label="Autorização pastoral" value={reg.pastoral_authorization ? 'Sim' : 'Não'} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Saúde & Emergência</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=2`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Informações de saúde" value={reg.health_info || '-'} />
            <Row label="Contato de emergência" value={reg.emergency_contact || '-'} />
            <Row label="Telefone de emergência" value={reg.emergency_phone || '-'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Pagamento</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar?step=4`)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Método" value={paymentMethodLabels[reg.payment_method] || reg.payment_method} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={reg.payment_status === 'paid' ? 'default' : 'secondary'}
                className={reg.payment_status === 'refunded' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : reg.payment_status === 'canceled' ? 'bg-muted text-muted-foreground' : ''}
              >
                {paymentStatusLabels[reg.payment_status] || reg.payment_status}
              </Badge>
            </div>
            {reg.event_lots && (
              <Row label="Lote" value={`${reg.event_lots.name}${reg.event_lots.price > 0 ? ` — R$ ${reg.event_lots.price.toFixed(2)}` : ''}`} />
            )}
            {(reg as any).paid_amount != null && (
              <Row label="Valor pago" value={`R$ ${Number((reg as any).paid_amount).toFixed(2)}`} />
            )}
            {(reg as any).refunded_amount != null && (
              <Row label="Valor reemb." value={`R$ ${Number((reg as any).refunded_amount).toFixed(2)}`} />
            )}
            {reg.payment_status !== 'paid' && (
              <Button
                size="sm"
                className="w-full mt-2 bg-emerald-600/80 text-white hover:bg-emerald-600"
                onClick={() => setPayDialogOpen(true)}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Dar Baixa
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {reg.private_notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Observações (admin)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{reg.private_notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <Button onClick={() => navigate(`/app/evento/${eventId}/inscricoes/${id}/editar`)}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Excluir
        </Button>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!open) { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); setReceiptCopied(false); }}}>
        <DialogContent>
          {!paymentSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar pagamento</DialogTitle>
                <DialogDescription>
                  Registre o valor pago por <strong>{reg?.full_name}</strong>.
                  O church_id será preenchido automaticamente pelo trigger do banco.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="pay-amount">Valor pago (R$)</Label>
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
                <Button variant="outline" onClick={() => { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); }} disabled={paying}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600/80 text-white hover:bg-emerald-600"
                  onClick={handleMarkAsPaid}
                  disabled={paying || !payAmount}
                >
                  {paying ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Registrando...</> : 'Confirmar pagamento'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="rounded-full bg-emerald-600/20 p-3">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <DialogTitle className="text-lg">Pagamento registrado com sucesso!</DialogTitle>
                    <DialogDescription className="mt-1">
                      R$ {paymentSuccess.amount.toFixed(2)} — {reg?.events?.title || 'Evento'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3">
                {reg?.whatsapp && (
                  <Button
                    className="w-full bg-[#25D366] text-white hover:bg-[#22c35e]"
                    onClick={() => {
                      window.open(
                        `https://wa.me/${paymentSuccess.cleanPhone}?text=${encodeURIComponent(paymentSuccess.receipt)}`,
                        '_blank'
                      );
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar Recibo por WhatsApp
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentSuccess.receipt);
                    setReceiptCopied(true);
                    setTimeout(() => setReceiptCopied(false), 2000);
                  }}
                >
                  {receiptCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {receiptCopied ? 'Copiado!' : 'Copiar Recibo'}
                </Button>
              </div>
              <DialogFooter className="sm:justify-center">
                <Button
                  variant="ghost"
                  onClick={() => { setPayDialogOpen(false); setPaymentSuccess(null); setPayAmount(''); setReceiptCopied(false); window.location.reload(); }}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir inscrição</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a inscrição de <strong>{reg?.full_name}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
