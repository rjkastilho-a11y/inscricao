import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

export default function ChurchSettingsPage() {
  const { churchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!churchId) return;

    let cancelled = false;
    const fetchChurch = async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('name, logo_url')
        .eq('id', churchId)
        .maybeSingle();

      if (!cancelled) {
        if (error || !data) {
          toast.error('Não foi possível carregar o perfil da organização.');
        } else {
          setName(data.name || '');
          setLogoUrl(data.logo_url || '');
        }
        setLoading(false);
      }
    };

    fetchChurch();
    return () => { cancelled = true; };
  }, [churchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('O nome da organização é obrigatório.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('update_church_profile', {
      p_name: name.trim(),
      p_logo_url: logoUrl,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Erro ao salvar o perfil da organização.');
      return;
    }

    toast.success('Perfil da organização atualizado com sucesso!');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configurações da Igreja"
        description="Edite o nome e a logo exibidos no painel e no hotsite dos seus eventos."
      />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-muted-foreground" />
              Perfil da Organização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="church-name" className="text-foreground">Nome da Organização *</Label>
              <Input
                id="church-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Igreja Vida Nova"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Logo</Label>
              <ImageUpload value={logoUrl} onChange={setLogoUrl} disabled={saving} />
              <p className="text-xs text-muted-foreground">
                A logo aparece no cabeçalho público do hotsite dos seus eventos.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
