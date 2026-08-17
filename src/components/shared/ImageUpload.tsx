import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      setError('Upload não configurado. Verifique as variáveis do Cloudinary.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Falha no upload da imagem');
      const data = await res.json();
      if (!data.secure_url) throw new Error('Resposta de upload inválida');
      onChange(data.secure_url);
    } catch {
      setError('Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={value} alt="Capa do evento" className="h-40 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            aria-label="Remover imagem"
            className="absolute right-2 top-2 rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted/80"
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin" />
              <span className="text-sm">Enviando imagem...</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-6" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium">Clique para fazer upload da Capa</span>
                <span className="text-xs text-muted-foreground">Recomendado: 1920x1080px (16:9)</span>
              </div>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
