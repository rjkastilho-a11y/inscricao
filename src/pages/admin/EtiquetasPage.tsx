import { useState, useEffect, useRef } from 'react';
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
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Printer, Lock, Settings2, ChevronDown, ChevronUp, ZoomIn } from 'lucide-react';
import { useEvent } from '@/contexts/useEvent';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradeModal } from '@/components/shared/UpgradeModal';

interface LabelConfig {
  name: string;
  margemSuperior: number;
  margemLateral: number;
  larguraEtiqueta: number;
  alturaEtiqueta: number;
  passoHorizontal?: number;
  passoVertical?: number;
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
    passoHorizontal: 10.68,
    passoVertical: 3.39,
    colunas: 2,
    linhas: 7,
  },
  '6087/6187/6287': {
    name: 'Pimaco 6087/6187/6287',
    margemSuperior: 1.27,
    margemLateral: 1.45,
    larguraEtiqueta: 4.44,
    alturaEtiqueta: 1.27,
    passoHorizontal: 4.75,
    passoVertical: 1.27,
    colunas: 4,
    linhas: 20,
  },
  '6089': {
    name: 'Pimaco 6089',
    margemSuperior: 1.27,
    margemLateral: 1.45,
    larguraEtiqueta: 4.44,
    alturaEtiqueta: 1.69,
    passoHorizontal: 4.75,
    passoVertical: 1.69,
    colunas: 4,
    linhas: 15,
  },
  'A4051/A4251/A4351': {
    name: 'Pimaco A4051/A4251/A4351',
    margemSuperior: 1.07,
    margemLateral: 0.45,
    larguraEtiqueta: 3.82,
    alturaEtiqueta: 2.12,
    passoHorizontal: 4.07,
    passoVertical: 2.12,
    colunas: 5,
    linhas: 13,
  },
  'A4062/A4262/A4362': {
    name: 'Pimaco A4062/A4262/A4362',
    margemSuperior: 1.29,
    margemLateral: 0.47,
    larguraEtiqueta: 9.90,
    alturaEtiqueta: 3.39,
    passoHorizontal: 10.16,
    passoVertical: 3.39,
    colunas: 2,
    linhas: 8,
  },
  'A4063/A4263/A4363': {
    name: 'Pimaco A4063/A4263/A4363',
    margemSuperior: 1.52,
    margemLateral: 0.47,
    larguraEtiqueta: 9.90,
    alturaEtiqueta: 3.81,
    passoHorizontal: 10.16,
    passoVertical: 3.81,
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

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function EtiquetasPage() {
  const { event, eventId } = useEvent();
  const { hasAccess } = useFeatureGate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('6081/6181/6281');
  const [fontSize, setFontSize] = useState('14pt');
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [isBold, setIsBold] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [abbreviateNames, setAbbreviateNames] = useState(false);
  const [breakLines, setBreakLines] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [labels, setLabels] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [mobilePreviewWidth, setMobilePreviewWidth] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const config = PIMACO_CONFIGS[selectedModel] || PIMACO_CONFIGS['6081/6181/6281'];

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => setMobilePreviewWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleFormatLock = () => {
    if (!hasAccess) { setUpgradeOpen(true); return true; }
    return false;
  };

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Montserrat:wght@400;700&family=Archivo+Black&family=Inter:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const [prevEventId, setPrevEventId] = useState(eventId);
  if (eventId !== prevEventId) {
    setPrevEventId(eventId);
    setLabels([]);
  }

  const [prevLabels, setPrevLabels] = useState(labels);
  if (labels !== prevLabels) {
    setPrevLabels(labels);
    setSelectedIndices(new Set(labels.map((_, i) => i)));
  }

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('registrations')
      .select('full_name')
      .eq('event_id', eventId)
      .neq('payment_status', 'canceled')
      .order('full_name')
      .then(({ data }) => {
        setLabels((data || []).map((r: { full_name: string | null }) => r.full_name ?? ''));
      });
  }, [eventId]);

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

  const passoHorizontal = config.passoHorizontal ?? config.larguraEtiqueta;
  const passoVertical = config.passoVertical ?? config.alturaEtiqueta;

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${config.colunas}, ${cm(passoHorizontal)})`,
    gridTemplateRows: `repeat(${config.linhas}, ${cm(passoVertical)})`,
  };

  const fontLabel = FONT_FAMILIES.find((f) => f.value === fontFamily)?.label ?? fontFamily;
  const settingsSummary = `${config.name} • ${fontLabel} ${fontSize}`;
  const isSettingsOpen = isMobile ? settingsOpen : true;

  const A4_WIDTH_PX = (21 / 2.54) * 96;
  const sheetScale = mobilePreviewWidth > 0 ? mobilePreviewWidth / A4_WIDTH_PX : 1;

  const renderSheets = (scaled: boolean, scale: number) => {
    return Array.from({ length: sheets }, (_, s) => {
      const sheetGrid = (
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
                      className={`text-foreground leading-tight w-full ${breakLines ? 'whitespace-normal break-words' : 'truncate'} ${!selectedIndices.has(labelIdx) ? 'opacity-40' : ''}`}
                      style={{ fontSize, fontFamily, fontWeight: isBold ? '700' : '400' }}
                    >
                      {abbreviateNames ? abbreviateName(labels[labelIdx]) : labels[labelIdx]}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      );

      const sheetLabel = sheets > 1 ? (
        <p className="text-center text-xs text-muted-foreground mb-1">
          Folha {s + 1} de {sheets}
        </p>
      ) : null;

      if (scaled) {
        return (
          <div key={s}>
            {sheetLabel}
            <div className="relative w-full" style={{ aspectRatio: '210/297' }}>
              <div
                className="absolute top-0 left-0"
                style={{
                  width: '21cm',
                  height: '29.7cm',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {sheetGrid}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={s} className="mb-8" style={{ height: '29.7cm' }}>
          {sheetLabel}
          {sheetGrid}
        </div>
      );
    });
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

        <Collapsible
          open={isSettingsOpen}
          onOpenChange={setSettingsOpen}
          className="mb-6 rounded-xl border border-border bg-card shadow-sm print:hidden"
        >
          <CollapsibleTrigger
            className="flex w-full items-center gap-2 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-t-xl select-none max-md:h-11"
          >
            <Settings2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Ajustes de Impressão</span>
            <span className="ml-auto hidden sm:block text-xs text-muted-foreground truncate">
              {settingsSummary}
            </span>
            <span className="sm:hidden text-xs text-muted-foreground truncate">
              {settingsSummary}
            </span>
            {isMobile && (
              <span className="flex items-center justify-center size-8 shrink-0 rounded-lg border border-border/50">
                {settingsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </span>
            )}
          </CollapsibleTrigger>

          <CollapsiblePanel>
            <div className="flex flex-col gap-4 px-4 pb-4 pt-0">
              {/* Linha 1: Modelo | Fonte | Tamanho em grid simétrico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground shrink-0">Modelo:</span>
                  {!hasAccess && <Lock className="size-3.5 text-amber-500 shrink-0" />}
                  <Select
                    value={selectedModel}
                    onValueChange={(v) => { if (handleFormatLock()) return; setSelectedModel(v); }}
                  >
                    <SelectTrigger className="w-full max-md:h-11">
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
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Fonte:</span>
                  {!hasAccess && <Lock className="size-3.5 text-amber-500 shrink-0" />}
                  <Select
                    value={fontFamily}
                    onValueChange={(v) => { if (handleFormatLock()) return; setFontFamily(v); }}
                  >
                    <SelectTrigger className="w-full max-md:h-11">
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
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Tamanho:</span>
                  {!hasAccess && <Lock className="size-3.5 text-amber-500 shrink-0" />}
                  <Select
                    value={fontSize}
                    onValueChange={(v) => { if (handleFormatLock()) return; setFontSize(v); }}
                  >
                    <SelectTrigger className="w-full max-md:h-11">
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
              </div>
  
              {/* Linha 2: toggles de formatação em grid 2x2 no mobile / 4 colunas no desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-lg border border-border/50 hover:bg-accent max-md:h-11">
                  <Checkbox
                    id="bold"
                    checked={isBold}
                    onCheckedChange={(checked) => { if (handleFormatLock()) return; setIsBold(checked === true); }}
                  />
                  <span className="flex items-center gap-1">
                    Negrito
                    {!hasAccess && <Lock className="size-3 text-amber-500 shrink-0" />}
                  </span>
                </label>
  
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-lg border border-border/50 hover:bg-accent max-md:h-11">
                  <Checkbox
                    id="showGrid"
                    checked={showGrid}
                    onCheckedChange={(checked) => setShowGrid(checked === true)}
                  />
                  <span>Mostrar grade</span>
                </label>
  
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-lg border border-border/50 hover:bg-accent max-md:h-11">
                  <Checkbox
                    id="abbreviateNames"
                    checked={abbreviateNames}
                    onCheckedChange={(checked) => { if (handleFormatLock()) return; setAbbreviateNames(checked === true); }}
                  />
                  <span className="flex items-center gap-1">
                    Abreviar nomes
                    {!hasAccess && <Lock className="size-3 text-amber-500 shrink-0" />}
                  </span>
                </label>
  
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-lg border border-border/50 hover:bg-accent max-md:h-11">
                  <Checkbox
                    id="breakLines"
                    checked={breakLines}
                    onCheckedChange={(checked) => { if (handleFormatLock()) return; setBreakLines(checked === true); }}
                  />
                  <span className="flex items-center gap-1">
                    Quebrar linha
                    {!hasAccess && <Lock className="size-3 text-amber-500 shrink-0" />}
                  </span>
                </label>
              </div>
            </div>
          </CollapsiblePanel>
        </Collapsible>

        {/* Ação principal — Imprimir */}
        <div className="mb-6 flex justify-end">
          <Button
            onClick={() => window.print()}
            className="gap-2 w-full sm:w-auto max-md:h-11 shadow-sm"
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
        </div>

        <div className="mb-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            {selectedIndices.size} de {labels.length} etiquetas selecionadas
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto max-md:h-11"
              onClick={() => setSelectedIndices(new Set(labels.map((_, i) => i)))}
            >
              Selecionar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto max-md:h-11"
              onClick={() => setSelectedIndices(new Set())}
            >
              Desmarcar Todos
            </Button>
          </div>
        </div>
      </div>

      {/* Preview desktop — hidden on print */}
      <div className="hidden sm:block print:hidden rounded-lg border border-dashed border-border bg-muted/30 p-8 overflow-auto">
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
          {renderSheets(false, 1)}
        </div>
      </div>

      {/* Preview mobile — miniatura escalada, abre zoom ao tocar */}
      <div
        onClick={() => setZoomOpen(true)}
        className="sm:hidden print:hidden w-full overflow-hidden rounded-lg border border-border bg-muted/20 relative cursor-pointer"
      >
        <div className="p-4 pb-0 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Pré-visualização — {config.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config.colunas} × {config.linhas} = {totalLabels} etiquetas por folha
            {sheets > 1 && <span> — {sheets} folhas no total</span>}
          </p>
        </div>
        <div className="px-4 pb-4">
          <div ref={previewRef}>
            {renderSheets(true, sheetScale)}
          </div>
        </div>
        {eventId && labels.length === 0 && (
          <p className="pb-3 text-center text-xs text-muted-foreground">
            Nenhum inscrito encontrado para este evento
          </p>
        )}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm border border-border">
            <ZoomIn className="size-3.5" />
            Ampliar Folha
          </span>
        </div>
      </div>

      {/* Dialog de zoom — folha ampliada */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="w-full max-w-[calc(100%-1rem)] sm:max-w-2xl h-[90vh] grid-rows-[auto_1fr] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Visualização da Folha</DialogTitle>
            <DialogDescription>
              Toque nas etiquetas para selecionar ou desmarcar.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto">
            <div className="mx-auto" style={{ width: '21cm' }}>
              {renderSheets(false, 1)}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                        className={`leading-tight w-full ${breakLines ? 'whitespace-normal break-words' : 'truncate'}`}
                        style={{
                          fontSize,
                          fontFamily,
                          fontWeight: isBold ? '700' : '400',
                          color: '#000',
                        }}
                      >
                        {abbreviateNames ? abbreviateName(selectedLabels[nameIdx]) : selectedLabels[nameIdx]}
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

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        featureName="Personalização de Etiquetas"
      />
    </div>
  );
}
