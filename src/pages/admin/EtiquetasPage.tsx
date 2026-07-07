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
  const [showGrid, setShowGrid] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
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

  useEffect(() => {
    setSelectedIndices(new Set(labels.map((_, i) => i)));
  }, [labels]);

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const totalLabels = config.colunas * config.linhas;
  const sheets = Math.max(1, Math.ceil(labels.length / totalLabels));
  const selectedLabels = labels.filter((_, i) => selectedIndices.has(i));
  const printSheets = Math.max(1, Math.ceil(selectedLabels.length / totalLabels));

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${config.colunas}, ${cm(config.larguraEtiqueta)})`,
    gridTemplateRows: `repeat(${config.linhas}, ${cm(config.alturaEtiqueta)})`,
  };

  return (
    <div className="w-full print:bg-white">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="showGrid"
                checked={showGrid}
                onCheckedChange={(checked) => setShowGrid(checked === true)}
              />
              <label htmlFor="showGrid" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar grade
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

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selectedIndices.size} de {labels.length} etiquetas selecionadas
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIndices(new Set(labels.map((_, i) => i)))}
          >
            Selecionar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIndices(new Set())}
          >
            Desmarcar Todos
          </Button>
        </div>
      </div>

      {/* Preview — hidden on print */}
      <div className="print:hidden rounded-lg border border-dashed border-border bg-muted/30 p-8 overflow-auto">
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-muted-foreground">
            Pré-visualização — {config.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config.colunas} × {config.linhas} = {totalLabels} etiquetas por folha
            {sheets > 1 && <span> — {sheets} folhas no total</span>}
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
          className="mx-auto"
          style={{ width: '21cm', maxHeight: '80vh' }}
        >
          {Array.from({ length: sheets }, (_, s) => (
            <div key={s} className="mb-8" style={{ height: '29.7cm' }}>
              {sheets > 1 && (
                <p className="text-center text-xs text-muted-foreground mb-1">
                  Folha {s + 1} de {sheets}
                </p>
              )}
              <div
                className="etiqueta-grid"
                style={{
                  ...gridStyle,
                  marginTop: cm(config.margemSuperior),
                  marginLeft: cm(config.margemLateral),
                }}
              >
                {Array.from({ length: totalLabels }, (_, i) => {
                  const labelIdx = s * totalLabels + i;
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col items-center justify-center text-center p-1 ${showGrid ? 'border border-dashed border-border/50 rounded-sm' : ''} ${labelIdx < labels.length ? 'cursor-pointer' : ''}`}
                      style={{
                        width: cm(config.larguraEtiqueta),
                        height: cm(config.alturaEtiqueta),
                      }}
                      onClick={() => labelIdx < labels.length && toggleSelection(labelIdx)}
                    >
                      {labelIdx < labels.length ? (
                        <>
                          <div className="absolute top-0.5 left-0.5 z-10">
                            <div
                              className={`size-3 rounded-sm border flex items-center justify-center ${selectedIndices.has(labelIdx) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
                            >
                              {selectedIndices.has(labelIdx) && (
                                <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-foreground leading-tight truncate w-full ${!selectedIndices.has(labelIdx) ? 'opacity-40' : ''}`}
                            style={{ fontSize, fontFamily, fontWeight: isBold ? '700' : '400' }}
                          >
                            {labels[labelIdx]}
                          </span>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print layout — only visible on print */}
      <div className="hidden print:block print:visible print:w-full print:m-0 print:p-0 print:bg-white">
        {Array.from({ length: printSheets }, (_, s) => (
          <div
            key={s}
            style={{ pageBreakAfter: 'always' }}
          >
            <div
              className="print:grid"
              style={{
                ...gridStyle,
                marginTop: cm(config.margemSuperior),
                marginLeft: cm(config.margemLateral),
              }}
            >
              {Array.from({ length: totalLabels }, (_, i) => {
                const nameIdx = s * totalLabels + i;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center text-center p-1 ${showGrid ? 'print:border print:border-dashed print:border-gray-300 print:rounded-sm' : ''}`}
                    style={{
                      width: cm(config.larguraEtiqueta),
                      height: cm(config.alturaEtiqueta),
                    }}
                  >
                    {nameIdx < selectedLabels.length ? (
                      <span
                        className="leading-tight truncate w-full"
                        style={{
                          fontSize,
                          fontFamily,
                          fontWeight: isBold ? '700' : '400',
                          color: '#000',
                        }}
                      >
                        {selectedLabels[nameIdx]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          * {
            background: transparent !important;
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
