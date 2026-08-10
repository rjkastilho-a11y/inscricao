import QRCode from 'react-qr-code';
import { Ticket } from 'lucide-react';

interface Props {
  value: string;
  size?: number;
}

export function RegistrationQR({ value, size = 140 }: Props) {
  return (
    <div className="relative flex flex-col items-center justify-center p-6 md:p-8 mt-6 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5">
      <h3 className="text-xl font-bold flex items-center gap-2 mb-3">
        <Ticket className="size-6 text-primary" />
        INGRESSO DE ENTRADA
      </h3>
      <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-bold mb-5 flex items-center gap-2 border border-amber-200">
        ⚠️ Este QR Code NÃO é um PIX
      </div>
      <div className="rounded-lg bg-white p-3 ring-1 ring-border">
        <QRCode value={value} size={size} fgColor="#000000" bgColor="#ffffff" />
      </div>
      <p className="text-sm text-center text-muted-foreground mt-5 font-medium max-w-[250px]">
        Apresente este código na portaria do evento para fazer o seu check-in.
      </p>
    </div>
  );
}
