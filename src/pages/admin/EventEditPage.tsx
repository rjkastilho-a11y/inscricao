import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventSchema, type EventFormData, type LotFormData } from '@/lib/validations';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Copy, Check, ExternalLink, LayoutDashboard, Globe, CreditCard } from 'lucide-react';
import { copyDefaultFields } from '@/lib/form-fields';
import { copyToClipboard } from '@/lib/clipboard';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { MapPreview } from '@/components/shared/MapPreview';
import { getAvailableSlug, checkSlugAvailability } from '@/lib/slug';

const formatWhatsAppMask = (value: string) => {
  if (!value) return '';
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);

  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
  }
  return v;
};

interface LotWithId extends LotFormData {
  id?: string;
}

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [lots, setLots] = useState<LotWithId[]>([]);
  const [stepPersonal, setStepPersonal] = useState(true);
  const [stepChristianLife, setStepChristianLife] = useState(true);
  const [stepHealth, setStepHealth] = useState(true);
  const [stepEmergency, setStepEmergency] = useState(true);
  const [stepOther, setStepOther] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [originalSlug, setOriginalSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loadedTitle, setLoadedTitle] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: { is_open: false, price: 0 },
  });

  const slug = form.watch('slug');
  const title = form.watch('title');
  const currentLayout = form.watch('hero_layout');

  const checkSlug = async (value: string) => {
    if (!value || value.length < 3 || value === originalSlug) return;
    setSlugChecking(true);
    setSlugError(null);
    const available = await checkSlugAvailability(value, id);
    if (!available) {
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
    if (!slugManuallyEdited && title && title !== loadedTitle) {
      let cancelled = false;
      getAvailableSlug(title, id).then((generated) => {
        if (!cancelled) {
          form.setValue('slug', generated, { shouldValidate: true, shouldDirty: true });
        }
      });
      return () => { cancelled = true; };
    }
  }, [title, loadedTitle, slugManuallyEdited, id]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      if (data) {
        setOriginalSlug(data.slug);
        setLoadedTitle(data.title);
        form.reset({
          title: data.title,
          slug: data.slug,
          description: data.description || '',
          start_date: data.start_date ? data.start_date.slice(0, 10) : '',
          end_date: data.end_date ? data.end_date.slice(0, 10) : '',
          location: data.location || '',
          location_name: data.location_name || '',
          subtitle: data.subtitle || '',
          hotsite_title: data.hotsite_title || '',
          is_open: data.is_open,
          is_published: data.is_published ?? false,
          cta_text: data.cta_text || 'Garantir Inscrição',
          theme_color: data.theme_color || 'orange',
          organizer_name: data.organizer_name || '',
          organizer_logo_url: data.organizer_logo_url || '',
          organizer_whatsapp: data.organizer_whatsapp || '',
          max_capacity: data.max_capacity ?? undefined,
          price: data.price,
          cover_url: data.cover_url || '',
          hero_layout: data.hero_layout || 'contained',
          terms_text: data.terms_text || '',
          terms_enabled: data.terms_enabled ?? true,
          show_location: data.show_location ?? true,
          show_about: data.show_about ?? true,
          show_registration: data.show_registration ?? true,
          payment_link: data.payment_link || '',
          allowed_payment_methods: data.allowed_payment_methods ?? ['pix', 'credit_card', 'cash', 'bank_transfer', 'other'],
          pix_key: data.pix_key || '',
          bank_details: data.bank_details || '',
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
      organizer_name: ((data.organizer_name as string) || '').trim() || null,
      organizer_logo_url: ((data.organizer_logo_url as string) || '') || null,
      location_name: ((data.location_name as string) || '').trim() || null,
      subtitle: ((data.subtitle as string) || '').trim() || null,
      hotsite_title: ((data.hotsite_title as string) || '').trim() || null,
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
      <div className="max-w-5xl mx-auto pb-12">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Tabs defaultValue="dados-gerais">
            <TabsList className="flex w-full overflow-x-auto no-scrollbar">
              <TabsTrigger value="dados-gerais">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dados Gerais
              </TabsTrigger>
              <TabsTrigger value="hotsite">
                <Globe className="w-4 h-4 mr-2" /> Hotsite
              </TabsTrigger>
              <TabsTrigger value="pagamentos-lotes">
                <CreditCard className="w-4 h-4 mr-2" /> Pagamentos e Lotes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados-gerais" keepMounted>
              <Card className="bg-card backdrop-blur-md border-border shadow-sm">
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-foreground">Título *</Label>
                      <Input id="title" {...form.register('title')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug" className="text-foreground">Slug *</Label>
                      <div className="relative">
                        <Input
                          id="slug"
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
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtitle" className="text-foreground">Subtítulo</Label>
                    <Input id="subtitle" placeholder="Ex: Um fim de semana inesquecível para despertar seu propósito." {...form.register('subtitle')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-foreground">Descrição</Label>
                    <Textarea id="description" rows={3} {...form.register('description')} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="text-foreground">Data de início</Label>
                      <Input id="start_date" type="date" {...form.register('start_date')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date" className="text-foreground">Data de fim</Label>
                      <Input id="end_date" type="date" {...form.register('end_date')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="location_name" className="text-foreground">Nome do Local</Label>
                        <Input id="location_name" placeholder="Ex: Igreja Matriz" {...form.register('location_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location" className="text-foreground">Endereço Completo</Label>
                        <Input id="location" placeholder="Ex: Av. Principal, 100, Centro – SP" {...form.register('location')} />
                        <p className="text-xs text-muted-foreground mt-1">Alimenta o mapa no hotsite.</p>
                      </div>
                    </div>
                    <div>
                      {form.watch('show_location') !== false ? (
                        <MapPreview address={form.watch('location') || ''} className="h-full min-h-[240px] w-full" />
                      ) : (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          Localização oculta no hotsite.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_capacity" className="text-foreground">Vagas</Label>
                    <Input id="max_capacity" type="number" {...form.register('max_capacity')} />
                  </div>
                   <div className="rounded-lg border border-border">
                     <CardHeader className="p-4 pb-4 border-b">
                       <CardTitle className="text-base font-semibold">Exibição no Hotsite</CardTitle>
                       <CardDescription className="text-xs">Controle quais seções aparecem na página pública.</CardDescription>
                     </CardHeader>
                     <CardContent className="px-4 pt-4 pb-4 space-y-4">
                       <div className="flex items-center justify-between gap-4">
                         <div className="space-y-1">
                           <Label htmlFor="show_location" className="text-foreground">Exibir localização e mapa</Label>
                           <p className="text-sm text-muted-foreground">
                             Quando desativado, o endereço e o mapa ficam ocultos na página pública.
                           </p>
                         </div>
                         <Switch
                           checked={form.watch('show_location') ?? true}
                           onCheckedChange={(v) => form.setValue('show_location', !!v, { shouldDirty: true })}
                         />
                       </div>
                       <div className="flex items-center justify-between gap-4">
                         <div className="space-y-1">
                           <Label htmlFor="show_about" className="text-foreground">Exibir seção "Sobre o Evento"</Label>
                           <p className="text-sm text-muted-foreground">
                             Quando desativado, a seção de apresentação fica oculta.
                           </p>
                         </div>
                         <Switch
                           checked={form.watch('show_about') ?? true}
                           onCheckedChange={(v) => form.setValue('show_about', !!v, { shouldDirty: true })}
                         />
                       </div>
                       <div className="flex items-center justify-between gap-4">
                         <div className="space-y-1">
                           <Label htmlFor="show_registration" className="text-foreground">Exibir seção de "Inscrições"</Label>
                           <p className="text-sm text-muted-foreground">
                             Quando desativado, a seção de inscrição e o botão do herói ficam ocultos.
                           </p>
                         </div>
                         <Switch
                           checked={form.watch('show_registration') ?? true}
                           onCheckedChange={(v) => form.setValue('show_registration', !!v, { shouldDirty: true })}
                         />
                       </div>
                     </CardContent>
                   </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="hotsite" keepMounted>
              <Card className="bg-card backdrop-blur-md border-border shadow-sm">
                <CardContent className="p-6 space-y-8">
                  <h3 className="text-base font-semibold text-foreground">Hotsite (Página Pública)</h3>
                  <div className="space-y-2">
                    <Label htmlFor="hotsite_title" className="text-foreground">Nome do Hotsite (Opcional)</Label>
                    <Input id="hotsite_title" placeholder="Ex: Encontro de Jovens 2026" {...form.register('hotsite_title')} />
                    <p className="text-xs text-muted-foreground mt-1">Se deixado em branco, usaremos o título principal do evento.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem de Capa do Hotsite</Label>
                    <ImageUpload
                      value={form.watch('cover_url')}
                      onChange={(url) => form.setValue('cover_url', url, { shouldDirty: true, shouldValidate: true })}
                    />
                    <p className="text-[0.8rem] text-muted-foreground">A imagem será otimizada automaticamente. O formato ideal é Widescreen (16:9). Imagens em outros formatos serão ajustadas para encaixar no layout.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estilo de Exibição da Capa</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: 'contained', label: 'Padrão (Contida no Centro)' },
                        { value: 'full', label: 'Tela Cheia (Imagem no Fundo)' },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
                        >
                          <input type="radio" value={opt.value} className="hidden" {...form.register('hero_layout')} />
                          <span className="text-sm text-foreground cursor-pointer">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define como a imagem de capa aparece no topo da página pública.
                    </p>
                    <div className="mt-3 rounded-lg bg-blue-50/50 p-3 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30">
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        {currentLayout === 'full'
                          ? "💡 Tamanho ideal: 1920x1080px. A imagem cobrirá todo o fundo. Mantenha os elementos importantes no centro, pois as laterais serão cortadas em celulares."
                          : "💡 Tamanho ideal: 1920x1080px (16:9). A imagem será exibida por inteiro, centralizada e sem cortes."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="cta_text" className="text-foreground">Texto do Botão principal</Label>
                      <Input id="cta_text" placeholder="Ex: Garantir Inscrição" {...form.register('cta_text')} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Texto exibido no botão de ação principal do hotsite.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organizer_name" className="text-foreground">Nome do Organizador / Ministério (Opcional)</Label>
                      <Input
                        id="organizer_name"
                        placeholder="Ex: Ministério de Jovens"
                        {...form.register('organizer_name')}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Se vazio, o hotsite exibe o nome global da igreja.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Logo do Evento / Ministério (Opcional)</Label>
                    <ImageUpload
                      value={form.watch('organizer_logo_url') || ''}
                      onChange={(url) => form.setValue('organizer_logo_url', url, { shouldDirty: true, shouldValidate: true })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Se vazio, o hotsite exibe a logo global da igreja.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground font-semibold">Cor do Hotsite</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Escolha a cor de destaque da seção "Sobre" e dos acentos visuais da página pública.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { value: 'orange', label: 'Laranja', color: '#F5821F' },
                        { value: 'purple', label: 'Púrpura', color: '#7E22CE' },
                        { value: 'blue', label: 'Azul', color: '#1D4ED8' },
                        { value: 'green', label: 'Verde', color: '#15803D' },
                      ].map((theme) => (
                        <label
                          key={theme.value}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
                        >
                          <input type="radio" value={theme.value} className="hidden" {...form.register('theme_color')} />
                          <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: theme.color }} />
                          <span className="text-sm text-foreground cursor-pointer">{theme.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizer_whatsapp" className="text-foreground">WhatsApp de Contato (Dúvidas do Evento)</Label>
                    <Input
                      id="organizer_whatsapp"
                      placeholder="Ex: (21) 99999-9999"
                      inputMode="tel"
                      value={form.watch('organizer_whatsapp') || ''}
                      onChange={(e) => form.setValue('organizer_whatsapp', formatWhatsAppMask(e.target.value), { shouldValidate: true, shouldDirty: true })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Se preenchido, exibirá um botão 'Falar no WhatsApp' para os participantes tirarem dúvidas no rodapé da página pública.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor="is_published" className="text-foreground">Publicar hotsite</Label>
                      <p className="text-sm text-muted-foreground">
                        Quando ativo, qualquer pessoa com o link poderá ver o hotsite.
                      </p>
                    </div>
                    <Switch
                      checked={form.watch('is_published') ?? false}
                      onCheckedChange={(v) => form.setValue('is_published', v, { shouldDirty: true })}
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">Link público</p>
                    {!(form.watch('is_published') ?? false) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Link só será visível ao público após publicar.
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground break-all">{`${window.location.origin}/e/${slug}`}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await copyToClipboard(`${window.location.origin}/e/${slug}`);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copied ? 'Link copiado!' : 'Copiar Link'}
                      </Button>
                      <a
                        href={`${window.location.origin}/e/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-lg bg-card border border-border h-8 px-2.5 text-sm font-medium hover:bg-accent"
                      >
                        Abrir no navegador <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </div>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="pagamentos-lotes" keepMounted>
              <Card className="bg-card backdrop-blur-md border-border shadow-sm">
                <CardContent className="p-6 space-y-8">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_open"
                      checked={form.watch('is_open')}
                      onCheckedChange={(v) => form.setValue('is_open', !!v)}
                    />
                    <Label htmlFor="is_open" className="text-foreground">Evento aberto para inscrições</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-foreground">Valor padrão (R$)</Label>
                    <Input id="price" type="number" step="0.01" {...form.register('price')} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <Label className="text-foreground font-semibold">Lotes do Evento</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addLot}>
                        <Plus className="h-4 w-4 mr-1" /> Adicionar Lote
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">
                      Os lotes permitem criar períodos com valores diferenciados. O lote ativo (dentro da validade) será usado no cálculo do valor da inscrição.
                    </p>
                    {lots.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">Nenhum lote criado. O valor padrão do evento será usado.</p>
                    )}
                    {lots.map((lot, index) => (
                      <div key={index} className="border border-border rounded-lg p-4 mb-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Lote {index + 1}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 max-md:h-11 max-md:w-11 text-destructive" onClick={() => removeLot(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nome *</Label>
                            <Input value={lot.name} onChange={(e) => updateLot(index, 'name', e.target.value)} placeholder="1º Lote" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input type="number" step="0.01" value={lot.price} onChange={(e) => updateLot(index, 'price', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0,00" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Descrição</Label>
                          <Input value={lot.description || ''} onChange={(e) => updateLot(index, 'description', e.target.value)} placeholder="Desconto antecipado" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Início da validade *</Label>
                            <Input type="date" value={lot.start_date} onChange={(e) => updateLot(index, 'start_date', e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Fim da validade *</Label>
                            <Input type="date" value={lot.end_date} onChange={(e) => updateLot(index, 'end_date', e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Capacidade máxima</Label>
                          <Input type="number" value={lot.max_capacity ?? ''} onChange={(e) => updateLot(index, 'max_capacity', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Ilimitado" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
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
                    <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label className="text-foreground font-semibold">Métodos de pagamento aceitos</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Selecione quais formas de pagamento os participantes poderão escolher na inscrição.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { value: 'pix', label: 'PIX' },
                        { value: 'credit_card', label: 'Cartão de crédito' },
                        { value: 'cash', label: 'Dinheiro' },
                        { value: 'bank_transfer', label: 'Transferência' },
                        { value: 'external_link', label: 'Link de pagamento' },
                        { value: 'other', label: 'Outro' },
                      ].map((method) => (
                        <label
                          key={method.value}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
                        >
                          <Checkbox
                            value={method.value}
                            checked={(form.watch('allowed_payment_methods') || []).includes(method.value)}
                            onCheckedChange={(checked) => {
                              const current = form.watch('allowed_payment_methods') || [];
                              form.setValue(
                                'allowed_payment_methods',
                                checked
                                  ? [...current, method.value]
                                  : current.filter((v) => v !== method.value),
                                { shouldDirty: true }
                              );
                            }}
                          />
                          <span className="text-sm text-foreground cursor-pointer">{method.label}</span>
                        </label>
                      ))}
                    </div>
                    {(form.watch('allowed_payment_methods') || []).includes('pix') && (
                      <div className="mt-6 space-y-2">
                        <Label htmlFor="pix_key" className="text-foreground">Chave PIX</Label>
                        <Input id="pix_key" placeholder="CPF, e-mail, telefone ou chave aleatória" {...form.register('pix_key')} />
                        <p className="text-xs text-muted-foreground mt-1">Exibida na tela de sucesso para pagamento via PIX.</p>
                      </div>
                    )}
                    {(form.watch('allowed_payment_methods') || []).includes('bank_transfer') && (
                      <div className="mt-6 space-y-2">
                        <Label htmlFor="bank_details" className="text-foreground">Dados para transferência</Label>
                        <Textarea id="bank_details" rows={3} placeholder="Banco, agência, conta, titular..." {...form.register('bank_details')} />
                        <p className="text-xs text-muted-foreground mt-1">Exibidos na tela de sucesso para pagamento por transferência.</p>
                      </div>
                    )}
                    {(form.watch('allowed_payment_methods') || []).includes('external_link') && (
                      <div className="mt-6 space-y-2">
                        <Label htmlFor="payment_link" className="text-foreground">Link de pagamento</Label>
                        <Input id="payment_link" type="url" placeholder="https://..." {...form.register('payment_link')} />
                        <p className="text-xs text-muted-foreground mt-1">URL para página de pagamento externa (MercadoPago, Stripe, etc.)</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
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
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button type="button" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" onClick={() => navigate(`/app/eventos/${id}`)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
