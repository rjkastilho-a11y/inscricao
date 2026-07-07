import { useState } from 'react';
import type { PaymentRecord } from '@/lib/payments';
import { deletePayment } from '@/lib/payments';
import { paymentMethodLabels } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  payments: PaymentRecord[];
  registrationId: string;
  onRefresh: () => void;
  paidAmount?: number | null;
  paymentMethod?: string;
}

export function PaymentHistory({ payments, registrationId, onRefresh, paidAmount, paymentMethod }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PaymentRecord | null>(null);

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);

    const { error } = await deletePayment(confirmDelete.id, registrationId);
    if (error) {
      toast.error('Erro ao excluir pagamento: ' + error);
      setDeletingId(null);
      setConfirmDelete(null);
      return;
    }

    toast.success('Pagamento excluído.');
    setDeletingId(null);
    setConfirmDelete(null);
    onRefresh();
  };

  if (payments.length === 0) {
    if (paidAmount && Number(paidAmount) > 0) {
      return (
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="bg-emerald-600/80 text-white">
                  R$ {Number(paidAmount).toFixed(2)}
                </Badge>
                <span className="text-muted-foreground">
                  {paymentMethodLabels[paymentMethod || 'pix'] || paymentMethod || 'PIX'}
                </span>
                <span className="text-muted-foreground truncate">— Registro legado</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm font-medium">
            <span>Total pago</span>
            <span className="text-emerald-600">R$ {Number(paidAmount).toFixed(2)}</span>
          </div>
        </div>
      );
    }
    return (
      <p className="text-sm text-muted-foreground mt-2">
        Nenhum pagamento registrado.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {payments.map((p) => {
        const isNegative = Number(p.amount) < 0;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={isNegative ? 'destructive' : 'default'}
                  className={isNegative ? '' : 'bg-emerald-600/80 text-white'}
                >
                  {isNegative ? '- ' : ''}R$ {Math.abs(Number(p.amount)).toFixed(2)}
                </Badge>
                <span className="text-muted-foreground">
                  {paymentMethodLabels[p.method] || p.method}
                </span>
                {p.notes && (
                  <span className="text-muted-foreground truncate">— {p.notes}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(p)}
              disabled={deletingId === p.id}
            >
              {deletingId === p.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm font-medium">
        <span>Total pago</span>
        <span className={totalPaid >= 0 ? 'text-emerald-600' : 'text-destructive'}>
          R$ {totalPaid.toFixed(2)}
        </span>
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pagamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este pagamento de{' '}
              <strong>
                R$ {confirmDelete ? Math.abs(Number(confirmDelete.amount)).toFixed(2) : '0.00'}
              </strong>
              ? O valor total pago será recalculado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={deletingId === confirmDelete?.id} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingId === confirmDelete?.id}
            >
              {deletingId === confirmDelete?.id && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
