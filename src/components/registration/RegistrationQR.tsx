import QRCode from 'react-qr-code';

interface Props {
  value: string;
  size?: number;
  caption?: string;
}

export function RegistrationQR({ value, size = 140, caption }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg bg-white p-3 ring-1 ring-border">
        <QRCode value={value} size={size} fgColor="#000000" bgColor="#ffffff" />
      </div>
      {caption && (
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">{caption}</p>
      )}
    </div>
  );
}
