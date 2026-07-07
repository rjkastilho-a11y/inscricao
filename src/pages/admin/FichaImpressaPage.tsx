import { useEffect, useState, Fragment } from 'react';
import { useEvent } from '@/contexts/EventContext';
import { Button } from '@/components/ui/button';
import { fetchFormFields, type FormField, type FormStep, STEP_LABELS, STEP_ORDER } from '@/lib/form-fields';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Printer, Loader2 } from 'lucide-react';
import { useTrial } from '@/components/layout/ChurchGuard';

const EXCLUDED_KEYS = new Set(['accept_terms', 'pastoral_authorization', 'church_role', 'church_role_other', 'godparent', 'godparent_contact', 'cep', 'city', 'state']);

const BINARY_KEYS = new Set(['is_baptized', 'has_allergies']);

const LABEL_OVERRIDES: Record<string, string> = {
  pastor: 'Autorização do Pastor',
};

const FULL_WIDTH_KEYS = new Set([
  'full_name', 'address', 'health_info',
  'pastoral_authorization', 'description', 'private_notes',
]);

function isFullWidth(field: FormField): boolean {
  if (field.field_type === 'textarea') return true;
  if (field.field_type === 'select' && field.options && field.options.length > 3) return true;
  if (FULL_WIDTH_KEYS.has(field.field_key)) return true;
  return false;
}

function isCheckbox(field: FormField): boolean {
  return field.field_type === 'checkbox';
}

function isSelect(field: FormField): boolean {
  return field.field_type === 'select';
}

export default function FichaImpressaPage() {
  const { event } = useEvent();
  const trial = useTrial();
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [watermarkUrl, setWatermarkUrl] = useState('');
  const [savingWatermark, setSavingWatermark] = useState(false);

  useEffect(() => {
    if (!event) return;
    setWatermarkUrl(event.watermark_url || '');
    setLoading(true);
    fetchFormFields(event.id, event.is_custom, (() => {
      const disabled: FormStep[] = [];
      if (event.step_personal === false) disabled.push('personal');
      if (event.step_christian_life === false) disabled.push('christian_life');
      if (event.step_health === false) disabled.push('health');
      if (event.step_emergency === false) disabled.push('emergency');
      if (event.step_other === false) disabled.push('other');
      return disabled;
    })()).then((data) => {
      setFields(data);
      setLoading(false);
    });
  }, [event]);

  const handleSaveWatermark = async () => {
    setSavingWatermark(true);
    const val = watermarkUrl.trim() || null;
    const { error } = await supabase.from('events').update({ watermark_url: val }).eq('id', event.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      setWatermarkUrl(val || '');
    }
    setSavingWatermark(false);
  };

  if (!event) return null;

  const renderFieldContent = (field: FormField) => {
    if (isSelect(field) && field.options) {
      return (
        <div className="print-select-options">
          {field.options.map((opt) => (
            <label key={opt} className="print-option">
              <span className="print-checkbox" />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    if (isCheckbox(field)) {
      if (field.options && field.options.length > 0) {
        return (
          <div className="print-select-options">
            {field.options.map((opt) => (
              <label key={opt} className="print-option">
                <span className="print-checkbox" />
                {opt}
              </label>
            ))}
          </div>
        );
      }
      if (BINARY_KEYS.has(field.field_key)) {
        return (
          <div className="print-binary-options">
            <label className="print-option">
              <span className="print-checkbox" />
              Sim
            </label>
            <label className="print-option">
              <span className="print-checkbox" />
              Não
            </label>
          </div>
        );
      }
      return (
        <div className="print-checkbox-wrapper">
          <span className="print-checkbox" />
        </div>
      );
    }
    if (field.field_type === 'textarea') {
      return <div className="print-textarea-line" />;
    }
    return <div className="print-line" />;
  };

  return (
    <div>
      <style>{`
        .print-area {
          position: relative;
          max-width: 960px;
          margin: 0 auto;
          padding: 24px 32px;
          background: hsl(var(--card));
        }
        .print-area.has-watermark::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: var(--watermark-url);
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.11;
          pointer-events: none;
          z-index: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid hsl(var(--border));
        }
        .print-header h1 {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 26px;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0 0 4px 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .print-header p {
          font-size: 14px;
          color: hsl(var(--muted-foreground));
          margin: 1px 0;
        }

        .print-section {
          margin-bottom: 24px;
        }
        .print-section h2 {
          font-size: 16px;
          font-weight: 700;
          color: hsl(var(--foreground));
          border-bottom: 1.5px solid hsl(var(--border));
          padding-bottom: 3px;
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .print-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 24px;
        }
        .print-field {
          display: flex;
          flex-direction: column;
          min-height: 32px;
        }
        .print-field.col-span-2 {
          grid-column: span 2;
        }
        .print-field-label {
          font-size: 13px;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          margin-bottom: 1px;
          letter-spacing: 0.2px;
        }
        .print-line {
          border-bottom: 1px solid hsl(var(--border));
          height: 32px;
          margin-top: 1px;
        }
        .print-textarea-line {
          border: 1px solid hsl(var(--border));
          height: 72px;
          border-radius: 1px;
          margin-top: 1px;
        }
        .print-inline-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .print-inline-field {
          flex: 1;
          min-width: 0;
        }
        .print-binary-options {
          display: flex;
          gap: 16px;
          padding: 2px 0;
        }
        .print-select-options {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          padding: 2px 0;
        }
        .print-option {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          color: hsl(var(--foreground));
          white-space: nowrap;
        }
        .print-checkbox-wrapper {
          padding: 2px 0;
        }
        .print-checkbox {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 1.5px solid hsl(var(--border));
          border-radius: 2px;
          flex-shrink: 0;
        }

        .print-address-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .print-field-address-cep {
          width: 100px;
          flex-shrink: 0;
        }
        .print-field-address-city {
          flex: 1;
          min-width: 0;
        }
        .print-field-address-state {
          width: 80px;
          flex-shrink: 0;
        }
        .print-declaration {
          border: 1px solid hsl(var(--border));
          padding: 12px 14px;
          margin-top: 10px;
        }
        .print-declaration p {
          font-size: 13px;
          line-height: 1.45;
          color: hsl(var(--foreground));
          margin: 0 0 8px 0;
          text-align: justify;
        }
        .print-declaration-obs {
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          margin-top: 8px !important;
          margin-bottom: 0 !important;
        }
        .print-signature-line {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 6px 0;
        }
        .print-signature-line .print-line {
          flex: 1;
        }
        .print-signature-line span:first-child {
          font-size: 13px;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
        }
        @media print {
          body { background: white !important; }
          @page { margin: 12mm 15mm; size: A4; }
          .no-print { display: none !important; }
          .print-area {
            padding: 0 !important;
            max-width: none !important;
            background: white !important;
          }
          .print-header { border-bottom-color: #222 !important; }
          .print-header h1 { color: #1a1a1a !important; }
          .print-header p { color: #555 !important; }
          .print-section h2 { color: #1a1a1a !important; border-bottom-color: #bbb !important; }
          .print-field-label { color: #444 !important; }
          .print-line { border-bottom-color: #666 !important; }
          .print-textarea-line { border-color: #666 !important; }
          .print-option { color: #333 !important; }
          .print-checkbox { border-color: #555 !important; }
          .print-declaration { border-color: #999 !important; }
          .print-declaration p { color: #1a1a1a !important; }
          .print-declaration-obs { color: #555 !important; }
          .print-signature-line span:first-child { color: #444 !important; }
          .print-area.has-watermark::before {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-section { page-break-inside: avoid; }
          .print-declaration { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Ficha de Inscrição Impressa</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ficha em branco com os campos configurados no formulário do evento.
              Imprima para preenchimento manual quando o inscrito não puder fazer online.
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
          <input
            type="text"
            value={watermarkUrl}
            onChange={(e) => setWatermarkUrl(e.target.value)}
            placeholder="URL da marca d'água (opcional)"
            className="flex h-9 min-w-[250px] rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button disabled={savingWatermark} onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : handleSaveWatermark}>
            {savingWatermark ? 'Salvando...' : 'Salvar'}
          </Button>
          {watermarkUrl && (
            <Button variant="outline" onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : async () => {
              setWatermarkUrl('');
              setSavingWatermark(true);
              const { error } = await supabase.from('events').update({ watermark_url: null }).eq('id', event.id);
              if (error) toast.error('Erro ao remover: ' + error.message);
              setSavingWatermark(false);
            }}>
              Remover
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {watermarkUrl ? 'Marca d\'água ativa' : 'Sem marca d\'água'}
          </span>
        </div>
      </div>

      <div
        className={`print-area${watermarkUrl ? ' has-watermark' : ''}`}
        style={watermarkUrl ? ({ '--watermark-url': `url('${watermarkUrl}')` } as React.CSSProperties) : undefined}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="print-header">
            <h1>{event.title}</h1>
            {event.start_date && <p>Data: {formatDate(event.start_date)}{event.end_date ? ` a ${formatDate(event.end_date)}` : ''}</p>}
            {event.location && <p>Local: {event.location}</p>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando campos do formulário...
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum campo de formulário configurado para este evento.
            </div>
        ) : (
          <>
            {STEP_ORDER.map((step) => {
              const stepFields = fields.filter((f) => f.step === step && !EXCLUDED_KEYS.has(f.field_key) && f.field_key !== 'allergy_description');
              if (stepFields.length === 0) return null;
              return (
                <div key={step} className="print-section">
                  <h2>{STEP_LABELS[step]}</h2>
                  <div className="print-fields-grid">
                    {stepFields.map((field) => {
                      if (field.field_key === 'has_allergies') {
                        const descField = fields.find(f => f.field_key === 'allergy_description' && f.step === step);
                        return (
                          <div key={field.id} className="print-field col-span-2">
                            <span className="print-field-label">
                              {field.label}
                              {field.required && <span className="text-destructive ml-0.5">*</span>}
                            </span>
                            <div className="print-inline-row">
                              <div className="print-binary-options">
                                <label className="print-option">
                                  <span className="print-checkbox" />
                                  Sim
                                </label>
                                <label className="print-option">
                                  <span className="print-checkbox" />
                                  Não
                                </label>
                              </div>
                              {descField && (
                                <div className="print-inline-field">
                                  <span className="print-field-label">
                                    {descField.label}
                                    {descField.required && <span className="text-destructive ml-0.5">*</span>}
                                  </span>
                                  <div className="print-line" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (field.field_key === 'dietary_restrictions') {
                        return (
                          <div key={field.id} className="print-field col-span-2">
                            <span className="print-field-label">
                              {field.label}
                              {field.required && <span className="text-destructive ml-0.5">*</span>}
                            </span>
                            <div className="print-inline-row">
                              <div className="print-binary-options">
                                <label className="print-option">
                                  <span className="print-checkbox" />
                                  Sim
                                </label>
                                <label className="print-option">
                                  <span className="print-checkbox" />
                                  Não
                                </label>
                              </div>
                              <div className="print-inline-field">
                                <span className="print-field-label">Descreva as Restrições</span>
                                <div className="print-line" />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (field.field_key === 'address') {
                        return (
                          <Fragment key="address-group">
                            <div className="col-span-2 print-address-row">
                              <div className="print-field print-field-address-cep">
                                <span className="print-field-label">CEP</span>
                                <div className="print-line" />
                              </div>
                              <div className="print-field print-field-address-city">
                                <span className="print-field-label">Cidade</span>
                                <div className="print-line" />
                              </div>
                              <div className="print-field print-field-address-state">
                                <span className="print-field-label">Estado</span>
                                <div className="print-line" />
                              </div>
                            </div>
                            <div
                              key={field.id}
                              className="print-field col-span-2"
                            >
                              <span className="print-field-label">
                                {LABEL_OVERRIDES[field.field_key] ?? field.label}
                                {field.required && <span className="text-destructive ml-0.5">*</span>}
                              </span>
                              {renderFieldContent(field)}
                            </div>
                          </Fragment>
                        );
                      }
                      return (
                        <div
                          key={field.id}
                          className={`print-field${isFullWidth(field) ? ' col-span-2' : ''}`}
                        >
                          <span className="print-field-label">
                            {LABEL_OVERRIDES[field.field_key] ?? field.label}
                            {field.required && <span className="text-destructive ml-0.5">*</span>}
                          </span>
                          {renderFieldContent(field)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {(fields.filter((f) => f.field_key === 'godparent' || f.field_key === 'godparent_contact').length > 0) && (
              <div key="godparent-section" className="print-section">
                <h2>Padrinho/Madrinha</h2>
                <div className="print-fields-grid">
                  {fields.filter((f) => f.field_key === 'godparent' || f.field_key === 'godparent_contact').map((field) => (
                    <div key={field.id} className="print-field">
                      <span className="print-field-label">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </span>
                      <div className="print-line" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!event.is_custom && (
              <div className="print-declaration">
                <p>
                  DECLARO QUE AS INFORMAÇÕES ACIMA SÃO VERÍDICAS E QUE ME COMPROMETO
                  A ACATAR AS SOLICITAÇÕES FEITAS DURANTE O RIE PARA O BOM ANDAMENTO
                  DO MESMO E PARA QUE EU POSSA ALCANÇAR O OBJETIVO PELO QUAL IREI PARTICIPAR.
                </p>

                <div className="print-signature-line">
                  <span>Assinatura:</span>
                  <div className="print-line" />
                </div>

                <div className="print-signature-line">
                  <span>Local:</span>
                  <div className="print-line" />
                  <span>Data:</span>
                  <div className="print-line" style={{ width: 120, flex: 'none' }} />
                </div>

                <p className="print-declaration-obs">
                  OBS: SE FOR MEMBRO DE OUTRA IGREJA, É INDISPENSÁVEL A ASSINATURA DE
                  SEU PASTOR. SEM ELA VOCÊ NÃO ESTÁ AUTORIZADO A PARTICIPAR.
                </p>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
