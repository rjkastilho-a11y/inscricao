import { cn } from '@/lib/utils';

export function MapPreview({ address, className }: { address: string; className?: string }) {
  if (!address?.trim()) return null;

  return (
    <div className="mt-2 flex w-full justify-center">
      <iframe
        title="Preview do endereço no Google Maps"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`}
        className={cn('h-32 w-full max-w-xl rounded-lg border border-border', className)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
