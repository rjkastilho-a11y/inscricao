import type { Ref } from 'react';
import { RegistrationQR } from '@/components/registration/RegistrationQR';
import { paymentMethodLabels, paymentStatusLabels } from '@/lib/utils';

export interface ComprovanteData {
  fullName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  eventTitle: string;
  lotName?: string | null;
  value: number;
  paymentMethod: string;
  paymentStatus: string;
}

interface Props {
  data: ComprovanteData;
  qrValue: string | null;
  comprovanteRef?: Ref<HTMLDivElement>;
}

export function RegistrationComprovante({ data, qrValue, comprovanteRef }: Props) {
  return (
    <>
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .comprovante, .comprovante * { visibility: visible; }
          .comprovante { position: absolute; left: 0; top: 0; width: 100%; }
        }
        .comprovante-capture, .comprovante-capture * {
          background-color: #fff !important;
          color: #111 !important;
        }
      `}</style>
      <div ref={comprovanteRef} className="comprovante rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
        {qrValue && (
          <div className="flex justify-center">
            <RegistrationQR
              value={qrValue}
              caption="Apresente este QR na portaria para fazer o check-in."
            />
          </div>
        )}
        <div className="space-y-2 text-sm">
          {data.fullName && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Nome</span>
              <span className="font-medium text-right">{data.fullName}</span>
            </div>
          )}
          {data.email && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">E-mail</span>
              <span className="font-medium text-right break-all">{data.email}</span>
            </div>
          )}
          {data.whatsapp && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">WhatsApp</span>
              <span className="font-medium text-right">{data.whatsapp}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Evento</span>
            <span className="font-medium text-right">{data.eventTitle}</span>
          </div>
          {data.lotName && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Lote</span>
              <span className="font-medium text-right">{data.lotName}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Valor</span>
            <span className="font-medium text-right">
              {data.value > 0 ? `R$ ${data.value.toFixed(2)}` : 'Grátis'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Pagamento</span>
            <span className="font-medium text-right">
              {paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Status</span>
            <span className="font-medium text-right">
              {paymentStatusLabels[data.paymentStatus] ?? data.paymentStatus}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
