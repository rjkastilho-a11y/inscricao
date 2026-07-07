import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventSchema, type EventFormData, type LotFormData } from '@/lib/validations';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { copyDefaultFields } from '@/lib/form-fields';

interface LotWithId extends LotFormData {
  id?: string;
}

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { churchId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [lots, setLots] = useState<LotWithId[]>([]);
  const [stepPersonal, setStepPersonal] = useState(true);
  const [stepChristianLife, setStepChristianLife] = useState(true);
  const [stepHealth, setStepHealth] = useState(true);
  const [stepEmergency, setStepEmergency] = useState(true);
  const [stepOther, setStepOther] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const [originalSlug, setOriginalSlug] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: { is_open: false, price: 0 },
  });

  const slug = form.watch('slug');

  const checkSlug = async (value: string) => {
    if (!value || value.length < 3 || value === originalSlug) return;
    setSlugChecking(true);
    setSlugError(null);
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('slug', value)
      .eq('church_id', churchId)
      .is('deleted_at', null)
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

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      if (data) {
        setOriginalSlug(data.slug);
        form.reset({
          title: data.title,
          slug: data.slug,
          description: data.description || '',
          start_date: data.start_date ? data.start_date.slice(0, 10) : '',
          end_date: data.end_date ? data.end_date.slice(0, 10) : '',
          location: data.location || '',
          is_open: data.is_open,
          max_capacity: data.max_capacity ?? undefined,
          price: data.price,
          cover_url: data.cover_url || '',
          terms_text: data.terms_text || '',
          terms_enabled: data.terms_enabled ?? true,
          payment_link: data.payment_link || '',
        });
        setStepPersonal(data.step_personal ?? true);
        setStepChristianLife(data.step_christian_life ?? true);
        setStepHealth(data.step_health ?? true);
        setStepEmergency(data.step_emergency ?? true);
        setStepOther(data.step_other ?? true);
        setIsCustom(data.is_custom ?? false);
      }

      const { data: lotsData } = await supabase
        .from('event_lots')
        .select('*')
        .eq('event_id', id)
        .order('start_date', { ascending: true });

      if (lotsData) {
        setLots(lotsData.map((lot: any) => ({
          id: lot.id,
          name: lot.name,
          description: lot.description || '',
          price: lot.price,
          start_date: lot.start_date ? lot.start_date.slice(0, 10) : '',
          end_date: lot.end_date ? lot.end_date.slice(0, 10) : '',
          max_capacity: lot.max_capacity ?? undefined,
        })));
      }

      setFetching(false);
    };
    fetch();
  }, [id, form]);

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
    
    // Detect if switching from non-custom to custom
    const wasCustom = isCustom;
    
    const cleanData = {
      ...Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)
      ),
      step_personal: stepPersonal,
      step_christian_life: stepChristianLife,
      step_health: stepHealth,
      step_emergency: stepEmergency,
      step_other: stepOther,
      is_custom: isCustom,
    };
    const { error } = await supabase.from('events').update(cleanData).eq('id', id);
    if (error) {
      if (error.code === '23505') {
        toast.error('Este slug já está em uso. Por favor, altere o título ou slug.');
      } else {
        toast.error('Erro ao atualizar: ' + error.message);
      }
      setIsLoading(false);
      return;
    }

    // Copy default fields when switching from non-custom to custom
    if (!wasCustom && isCustom) {
      await copyDefaultFields(id!);
    }

    const existingIds = new Set(lots.filter(l => l.id).map(l => l.id!));
    const { data: currentLots } = await supabase
      .from('event_lots')
      .select('id')
      .eq('event_id', id);

    if (currentLots) {
      const toDelete = currentLots
        .filter(cl => !existingIds.has(cl.id))
        .map(cl => cl.id);
      if (toDelete.length > 0) {
        await supabase.from('event_lots').delete().in('id', toDelete);
      }
    }

    for (const lot of lots) {
      const lotData = {
        name: lot.name,
        description: lot.description || null,
        price: lot.price,
        start_date: lot.start_date,
        end_date: lot.end_date,
        max_capacity: lot.max_capacity || null,
      };

      if (lot.id) {
        await supabase.from('event_lots').update(lotData).eq('id', lot.id);
      } else {
        await supabase.from('event_lots').insert({ ...lotData, event_id: id });
      }
    }

    navigate(`/app/eventos/${id}`);
  };

  if (fetching) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <PageHeader title="Editar Evento" />
      <Card className="max-w-2xl bg-card backdrop-blur-md border-border shadow-lg">
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-foreground">Título *</Label>
              <Input id="title" {...form.register('title')} />
            </div>
            <div>
              <Label htmlFor="slug" className="text-foreground">Slug *</Label>
              <div className="relative">
                <Input id="slug" {...form.register('slug')} />
                {slugChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {slugError && (
                <p className="text-sm text-destructive mt-1">{slugError}</p>
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
            <div>
              <Label htmlFor="payment_link" className="text-foreground">Link de pagamento (opcional)</Label>
              <Input id="payment_link" type="url" placeholder="https://..." {...form.register('payment_link')} />
              <p className="text-xs text-muted-foreground mt-1">URL para página de pagamento externa (MercadoPago, Stripe, etc.)</p>
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
              <Label className="text-foreground font-semibold">Tipo de Formulário</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Escolha entre o formulário padrão ou crie um formulário personalizado.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCustom}
                  onChange={(e) => setIsCustom(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-sm">Formulário Personalizado</span>
              </label>
            </div>

            {!isCustom && (
              <div className="border-t border-border pt-4 mt-6">
                <Label className="text-foreground font-semibold">Etapas do formulário</Label>
                <p className="text-sm text-muted-foreground mt-1 mb-2">
                  Selecione quais etapas do formulário padrão devem aparecer para o participante.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepPersonal}
                      onChange={(e) => setStepPersonal(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Dados Pessoais</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepChristianLife}
                      onChange={(e) => setStepChristianLife(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Vida Cristã</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepHealth}
                      onChange={(e) => setStepHealth(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Saúde</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepEmergency}
                      onChange={(e) => setStepEmergency(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Emergência</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepOther}
                      onChange={(e) => setStepOther(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Outros...</span>
                  </label>
                </div>
              </div>
            )}

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
              {lots.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nenhum lote criado. O valor padrão do evento será usado.</p>
              )}
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
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button type="button" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={() => navigate(`/app/eventos/${id}`)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
