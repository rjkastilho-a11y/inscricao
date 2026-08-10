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
  paymentMethodDetails?: string | null;
}

export interface ComprovanteEvent {
  pix_key?: string | null;
  bank_details?: string | null;
  payment_link?: string | null;
}

interface Props {
  data: ComprovanteData;
  qrValue: string | null;
  comprovanteRef?: Ref<HTMLDivElement>;
  event?: ComprovanteEvent | null;
}

function renderPaymentInfo(data: ComprovanteData, event?: ComprovanteEvent | null) {
  switch (data.paymentMethod) {
    case 'pix':
      return event?.pix_key
        ? { icon: '💳', title: 'PIX para pagamento', body: event.pix_key }
        : null;
    case 'external_link':
      return event?.payment_link
        ? {
            icon: '🔗',
            title: 'Pagamento online',
            body: 'Clique no link abaixo para concluir o pagamento.',
            link: event.payment_link,
          }
        : null;
    case 'cash':
      return { icon: '💵', title: 'Pagamento em Dinheiro', body: 'Efetue o pagamento na portaria do evento.' };
    case 'credit_card':
      return { icon: '💳', title: 'Pagamento presencial', body: 'Dirija-se à portaria para pagamento com cartão.' };
    case 'bank_transfer':
      return event?.bank_details
        ? { icon: '🏦', title: 'Dados para Transferência', body: event.bank_details }
        : null;
    case 'other':
      return { icon: '📝', title: 'Pagamento Pendente', body: 'Siga as instruções da organização.' };
    default:
      return null;
  }
}

export function RegistrationComprovante({ data, qrValue, comprovanteRef, event }: Props) {
  const paymentInfo =
    data.paymentStatus === 'pending' ? renderPaymentInfo(data, event) : null;

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
            <RegistrationQR value={qrValue} />
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

        {paymentInfo && (
          <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Instruções de pagamento
            </p>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-lg leading-none">{paymentInfo.icon}</span>
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-foreground">{paymentInfo.title}</p>
                {paymentInfo.body && (
                  <p className="whitespace-pre-line break-words text-foreground/80">{paymentInfo.body}</p>
                )}
                {paymentInfo.link && (
                  <a
                    href={paymentInfo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-blue-600 underline dark:text-blue-400"
                  >
                    {paymentInfo.link}
                  </a>
                )}
              </div>
            </div>
            {data.paymentMethodDetails && (
              <p className="border-t border-dashed border-amber-300 pt-2 text-xs whitespace-pre-line break-words text-foreground/70">
                Detalhe informado: {data.paymentMethodDetails}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
