import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer } from 'lucide-react';
import { useEvent } from '@/contexts/EventContext';

interface LabelConfig {
  name: string;
  margemSuperior: number;
  margemLateral: number;
  larguraEtiqueta: number;
  alturaEtiqueta: number;
  colunas: number;
  linhas: number;
}

const PIMACO_CONFIGS: Record<string, LabelConfig> = {
  '6081/6181/6281': {
    name: 'Pimaco 6081/6181/6281',
    margemSuperior: 1.27,
    margemLateral: 0.40,
    larguraEtiqueta: 10.16,
    alturaEtiqueta: 2.54,
    colunas: 2,
    linhas: 10,
  },
  '6082/6182/6282': {
    name: 'Pimaco 6082/6182/6282',
    margemSuperior: 2.12,
    margemLateral: 0.40,
    larguraEtiqueta: 10.16,
    alturaEtiqueta: 3.39,
    colunas: 2,
    linhas: 7,
  },
  '6087/6187/6287': {
    name: 'Pimaco 6087/6187/6287',
    margemSuperior: 1.27,
    margemLateral: 1.45,
    larguraEtiqueta: 4.44,
    alturaEtiqueta: 1.27,
    colunas: 4,
    linhas: 20,
  },
  '6089': {
    name: 'Pimaco 6089',
    margemSuperior: 1.27,
    margemLateral: 1.45,
    larguraEtiqueta: 4.44,
    alturaEtiqueta: 1.69,
    colunas: 4,
    linhas: 15,
  },
  'A4051/A4251/A4351': {
    name: 'Pimaco A4051/A4251/A4351',
    margemSuperior: 1.07,
    margemLateral: 0.45,
    larguraEtiqueta: 3.82,
    alturaEtiqueta: 2.12,
    colunas: 5,
    linhas: 13,
  },
  'A4062/A4262/A4362': {
    name: 'Pimaco A4062/A4262/A4362',
    margemSuperior: 1.29,
    margemLateral: 0.47,
    larguraEtiqueta: 9.90,
    alturaEtiqueta: 3.39,
    colunas: 2,
    linhas: 8,
  },
  'A4063/A4263/A4363': {
    name: 'Pimaco A4063/A4263/A4363',
    margemSuperior: 1.52,
    margemLateral: 0.47,
    larguraEtiqueta: 9.90,
    alturaEtiqueta: 3.81,
    colunas: 2,
    linhas: 7,
  },
};

function cm(value: number): string {
  return `${value}cm`;
}

const FONT_SIZES = ['10pt', '12pt', '14pt', '16pt', '18pt', '20pt', '22pt', '24pt', '26pt', '28pt', '30pt'];

const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Archivo Black', value: '"Archivo Black", sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
];

export default function EtiquetasPage() {
  const { event, eventId } = useEvent();
  const [selectedModel, setSelectedModel] = useState('6081/6181/6281');
  const [fontSize, setFontSize] = useState('14pt');
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [isBold, setIsBold] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const config = PIMACO_CONFIGS[selectedModel] || PIMACO_CONFIGS['6081/6181/6281'];

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Montserrat:wght@400;700&family=Archivo+Black&family=Inter:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setLabels([]);
      return;
    }
    supabase
      .from('registrations')
      .select('full_name')
      .eq('event_id', eventId)
      .neq('payment_status', 'canceled')
      .order('full_name')
      .then(({ data }) => {
        setLabels((data || []).map((r: any) => r.full_name));
      });
  }, [eventId]);

  const totalLabels = config.colunas * config.linhas;

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${config.colunas}, ${cm(config.larguraEtiqueta)})`,
    gridTemplateRows: `repeat(${config.linhas}, ${cm(config.alturaEtiqueta)})`,
  };

  return (
    <div className="w-full">
      {/* Controls — hidden on print */}
      <div className="print:hidden">
        <PageHeader
          title="Etiquetas"
          badge={event?.title}
          description="Gere etiquetas Pimaco para impressão"
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Modelo:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PIMACO_CONFIGS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tamanho da Fonte:</span>
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fonte:</span>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bold"
                checked={isBold}
                onCheckedChange={(checked) => setIsBold(checked === true)}
              />
              <label htmlFor="bold" className="text-sm text-muted-foreground cursor-pointer">
                Negrito
              </label>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Preview — hidden on print */}
      <div className="print:hidden rounded-lg border border-dashed border-border bg-muted/30 p-8">
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-muted-foreground">
            Pré-visualização — {config.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config.colunas} × {config.linhas} = {totalLabels} etiquetas por folha
          </p>
          {!eventId && (
            <p className="text-xs text-amber-500 mt-2">
              Selecione um evento para carregar os inscritos
            </p>
          )}
          {eventId && labels.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Nenhum inscrito encontrado para este evento
            </p>
          )}
        </div>
        <div
          className="mx-auto overflow-auto"
          style={{ width: '21cm', minHeight: '29.7cm' }}
        >
          <div
            className="etiqueta-grid"
            style={{
              ...gridStyle,
              marginTop: cm(config.margemSuperior),
              marginLeft: cm(config.margemLateral),
            }}
          >
            {Array.from({ length: totalLabels }, (_, i) => (
              <div
                key={i}
                className="border border-dashed border-border/50 rounded-sm flex flex-col items-center justify-center text-center p-1"
                style={{
                  width: cm(config.larguraEtiqueta),
                  height: cm(config.alturaEtiqueta),
                }}
              >
                {i < labels.length ? (
                  <span
                    className="text-foreground leading-tight truncate w-full"
                    style={{ fontSize, fontFamily, fontWeight: isBold ? '700' : '400' }}
                  >
                    {labels[i]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print layout — only visible on print */}
      <div
        className="hidden print:block print:visible print:w-full print:m-0 print:p-0 print:break-inside-avoid"
      >
        <div
          className="print:grid"
          style={{
            ...gridStyle,
            marginTop: cm(config.margemSuperior),
            marginLeft: cm(config.margemLateral),
          }}
        >
          {Array.from({ length: totalLabels }, (_, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center text-center p-1 print:border print:border-dashed print:border-gray-300 print:rounded-sm"
              style={{
                width: cm(config.larguraEtiqueta),
                height: cm(config.alturaEtiqueta),
              }}
            >
              {i < labels.length ? (
                <span
                  className="leading-tight truncate w-full"
                  style={{
                    fontSize,
                    fontFamily,
                    fontWeight: isBold ? '700' : '400',
                    color: '#000',
                  }}
                >
                  {labels[i]}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .etiqueta-grid {
          display: grid;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
