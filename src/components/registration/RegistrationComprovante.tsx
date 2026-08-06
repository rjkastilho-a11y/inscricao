import type { Ref } from 'react';
import { RegistrationQR } from '@/components/registration/RegistrationQR';

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
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Evento</span>
            <span className="font-medium text-right">{data.eventTitle}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Valor</span>
            <span className="font-medium text-right">
              {data.value > 0 ? `R$ ${data.value.toFixed(2)}` : 'Grátis'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
