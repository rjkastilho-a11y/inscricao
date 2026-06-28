import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventSchema, type LotFormData } from '@/lib/validations';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTrial } from '@/components/layout/ChurchGuard';


const DEFAULT_TERMS = `Termo de Inscrição e Uso de Imagem

1. Aceitação dos Termos
Ao se inscrever no evento, você declara que leu, compreendeu e concorda em cumprir estes Termos e Condições. Caso não concorde com qualquer cláusula, não clique no aceite e não prossiga com a sua inscrição.

2. Política de Reembolso e Destinação de Recursos
Ao confirmar sua inscrição, você declara estar ciente de que não haverá devolução ou reembolso de valores pagos. Todos os recursos arrecadados são integralmente direcionados, em caráter imediato, para o custeio operacional, infraestrutura, materiais e compromissos firmados para a realização do evento.

3. Autorização de Uso de Imagem e Voz
Você autoriza, de forma gratuita, irrevogável e definitiva, o uso de sua imagem e voz em fotos, vídeos e quaisquer materiais audiovisuais captados durante o evento. Esta autorização permite que o organizador utilize este material para fins de divulgação, publicação em redes sociais, sites institucionais e materiais de comunicação, em território nacional ou internacional, sem limite de tempo, visando a promoção das atividades da organização.

4. Responsabilidade do Inscrito
Você se declara responsável pela veracidade das informações fornecidas no ato da inscrição. A organização não se responsabiliza por dados incorretos que impossibilitem a comunicação de informações vitais sobre o evento.

5. LGPD e Tratamento de Dados
Seus dados pessoais serão tratados para fins de organização do evento, credenciamento e comunicação oficial. Estamos comprometidos com a Lei Geral de Proteção de Dados (Lei 13.709/2018), garantindo que suas informações não serão compartilhadas com terceiros para fins estranhos à realização deste evento.

6. Foro
Fica eleito o Foro da Comarca indicada pelo organizador para dirimir quaisquer dúvidas oriundas deste instrumento.`;

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function EventNewPage() {
  const navigate = useNavigate();
  const trial = useTrial();
  const [isLoading, setIsLoading] = useState(false);
  const [lots, setLots] = useState<LotFormData[]>([]);
  const [formType, setFormType] = useState<'default' | 'custom'>('default');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: { is_open: false, price: 0, terms_text: DEFAULT_TERMS, terms_enabled: true },
  });

  const title = form.watch('title');
  const slug = form.watch('slug');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (!slugManuallyEdited && title) {
      const generated = slugify(title);
      form.setValue('slug', generated);
    }
  }, [title, slugManuallyEdited]);

  const checkSlug = async (value: string) => {
    if (!value || value.length < 3) return;
    setSlugChecking(true);
    setSlugError(null);
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('slug', value)
      .maybeSingle();
    if (data) {
      setSlugError('Este slug já está em uso. Altere o título ou slug.');
    }
    setSlugChecking(false);
  };

  useEffect(() => {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(() => checkSlug(slug), 500);
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  }, [slug]);

  const addLot = () => {
    setLots([...lots, { name: '', description: '', price: 0, start_date: '', end_date: '', max_capacity: undefined }]);
  };

  const updateLot = (index: number, field: keyof LotFormData, value: any) => {
    const updated = lots.map((lot, i) =>
      i === index ? { ...lot, [field]: value } : lot
    );
    setLots(updated);
  };

  const removeLot = (index: number) => {
    setLots(lots.filter((_, i) => i !== index));
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (slugError) return;

    setIsLoading(true);
    const cleanData: Record<string, unknown> = {
      ...Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)
      ),
      is_custom: formType === 'custom',
    };
    const { data: eventData, error } = await supabase.from('events').insert(cleanData).select().single();
    if (error) {
      if (error.code === '23505') {
        toast.error('Este slug já está em uso. Por favor, altere o título ou o slug.');
      } else {
        toast.error('Erro ao criar evento: ' + error.message);
      }
      setIsLoading(false);
      return;
    }

    if (lots.length > 0) {
      const lotsToInsert = lots.map((lot) => ({
        event_id: eventData.id,
        name: lot.name,
        description: lot.description || null,
        price: lot.price,
        start_date: lot.start_date,
        end_date: lot.end_date,
        max_capacity: lot.max_capacity || null,
      }));
      const { error: lotsError } = await supabase.from('event_lots').insert(lotsToInsert);
      if (lotsError) {
        toast.error('Erro ao criar lotes: ' + lotsError.message);
        setIsLoading(false);
        return;
      }
    }

    navigate('/app/eventos');
  };

  if (trial?.isTrialExceeded) {
    return (
      <div>
        <PageHeader title="Novo Evento" />
        <Card className="max-w-2xl bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Seu período de avaliação expirou.</p>
            <Button onClick={() => trial.openUpgrade()}>Fazer upgrade do plano</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Novo Evento" />
      <Card className="max-w-2xl bg-card backdrop-blur-md border-border shadow-lg">
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-foreground">Título *</Label>
              <Input id="title" {...form.register('title')} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="slug" className="text-foreground">Slug *</Label>
              <div className="relative">
                <Input
                  id="slug"
                  placeholder="meu-evento"
                  {...form.register('slug', {
                    onChange: () => setSlugManuallyEdited(true),
                  })}
                />
                {slugChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {slugError && (
                <p className="text-sm text-destructive mt-1">{slugError}</p>
              )}
              {form.formState.errors.slug && !slugError && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.slug.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description" className="text-foreground">Descrição</Label>
              <Textarea id="description" rows={3} {...form.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date" className="text-foreground">Data de início</Label>
                <Input id="start_date" type="date" {...form.register('start_date')} />
              </div>
              <div>
                <Label htmlFor="end_date" className="text-foreground">Data de fim</Label>
                <Input id="end_date" type="date" {...form.register('end_date')} />
              </div>
            </div>
            <div>
              <Label htmlFor="location" className="text-foreground">Local</Label>
              <Input id="location" {...form.register('location')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price" className="text-foreground">Valor padrão (R$)</Label>
                <Input id="price" type="number" step="0.01" {...form.register('price')} />
              </div>
              <div>
                <Label htmlFor="max_capacity" className="text-foreground">Vagas</Label>
                <Input id="max_capacity" type="number" {...form.register('max_capacity')} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_open"
                checked={form.watch('is_open')}
                onCheckedChange={(v) => form.setValue('is_open', !!v)}
              />
              <Label htmlFor="is_open" className="text-foreground">Evento aberto para inscrições</Label>
            </div>

            <div className="border-t border-border pt-4 mt-6">
              <Label htmlFor="terms_text" className="text-foreground font-semibold">Termos e Condições</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Texto exibido no formulário de inscrição. O participante deve aceitar antes de se inscrever.
              </p>
              <Textarea
                id="terms_text"
                rows={6}
                placeholder="Ex: Ao se inscrever, declaro que li e aceito os termos e condições deste evento..."
                {...form.register('terms_text')}
                defaultValue={DEFAULT_TERMS}
              />
              <div className="flex items-center space-x-2 mt-3">
                <Checkbox
                  id="terms_enabled"
                  checked={form.watch('terms_enabled')}
                  onCheckedChange={(v) => form.setValue('terms_enabled', !!v)}
                />
                <Label htmlFor="terms_enabled" className="text-sm text-foreground">
                  Exigir aceite dos termos no formulário de inscrição
                </Label>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-6">
              <div className="mb-4">
                <Label className="text-foreground font-semibold">Formulário de inscrição</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha entre o formulário padrão ou crie campos personalizados.
                </p>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'default'}
                      onChange={() => setFormType('default')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Padrão</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formType"
                      checked={formType === 'custom'}
                      onChange={() => setFormType('custom')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Personalizado</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-foreground font-semibold">Lotes do Evento</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLot}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Lote
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Os lotes permitem criar períodos com valores diferenciados. O lote ativo (dentro da validade) será usado no cálculo do valor da inscrição.
              </p>
              {lots.map((lot, index) => (
                <div key={index} className="border border-border rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Lote {index + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLot(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome *</Label>
                      <Input value={lot.name} onChange={(e) => updateLot(index, 'name', e.target.value)} placeholder="1º Lote" />
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input type="number" step="0.01" value={lot.price} onChange={(e) => updateLot(index, 'price', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input value={lot.description || ''} onChange={(e) => updateLot(index, 'description', e.target.value)} placeholder="Desconto antecipado" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Início da validade *</Label>
                      <Input type="date" value={lot.start_date} onChange={(e) => updateLot(index, 'start_date', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Fim da validade *</Label>
                      <Input type="date" value={lot.end_date} onChange={(e) => updateLot(index, 'end_date', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Capacidade máxima</Label>
                    <Input type="number" value={lot.max_capacity ?? ''} onChange={(e) => updateLot(index, 'max_capacity', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ilimitado" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Criar evento'}
              </Button>
              <Button type="button" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={() => navigate('/app/eventos')}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
