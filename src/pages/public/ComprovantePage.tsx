import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { RegistrationComprovante } from '@/components/registration/RegistrationComprovante';
import { buildCheckinUrl } from '@/lib/checkin';

interface ComprovanteData {
  reg_id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  payment_method: string;
  payment_status: string;
  paid_amount: number | null;
  event_title: string;
  event_slug: string;
  event_price: number;
  checkin_token: string | null;
  lot_name: string | null;
  lot_price: number | null;
}

export default function ComprovantePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const regId = searchParams.get('reg');

  const [data, setData] = useState<ComprovanteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!slug || !regId) {
        setError('Link de comprovante inválido.');
        setLoading(false);
        return;
      }
      const { data: res, error } = await supabase.rpc('get_comprovante', {
        p_event_slug: slug,
        p_registration_id: regId,
      });
      if (error || !res || res.length === 0) {
        setError('Comprovante não encontrado. Verifique o link com o organizador do evento.');
        setLoading(false);
        return;
      }
      setData(res[0] as ComprovanteData);
      setLoading(false);
    };
    fetch();
  }, [slug, regId]);

  if (loading) return <div className="p-8 text-center">Carregando comprovante...</div>;

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Comprovante não encontrado</h1>
          <p className="text-muted-foreground max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  const checkinUrl = data.checkin_token
    ? buildCheckinUrl(data.event_slug, data.checkin_token, data.reg_id)
    : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Comprovante de inscrição</h1>
          <p className="text-sm text-muted-foreground">
            Este é o comprovante da sua inscrição. Guarde ou imprima este documento.
          </p>
        </div>
        <RegistrationComprovante
          data={{
            fullName: data.full_name,
            email: data.email,
            whatsapp: data.whatsapp,
            eventTitle: data.event_title,
            lotName: data.lot_name,
            value: data.lot_price ?? data.event_price ?? 0,
            paymentMethod: data.payment_method,
            paymentStatus: data.payment_status,
          }}
          qrValue={checkinUrl}
        />
        <Button variant="outline" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir / Salvar comprovante
        </Button>
      </div>
    </div>
  );
}
