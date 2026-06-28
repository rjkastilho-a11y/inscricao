import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET não configurado');
    return false;
  }
  if (!signature) return false;

  const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 1. Verificar assinatura do webhook
  const signature = event.headers['x-webhook-signature'] || event.headers['x-hub-signature-256'];
  if (!verifySignature(event.body || '', signature)) {
    console.error('Webhook signature inválida');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    // 2. Webhook de confirmação de pagamento
    if (payload.type === 'payment.confirmed') {
      const { registration_id, amount, method } = payload.data || {};

      if (!registration_id) {
        return { statusCode: 400, body: 'Missing registration_id' };
      }

      // 3. Rate limit por registration_id
      const { data: rateOk } = await supabaseAdmin
        .rpc('check_webhook_rate_limit', { p_registration_id: registration_id });

      if (rateOk === false) {
        console.warn('Rate limit excedido para registration:', registration_id);
        return { statusCode: 429, body: 'Too Many Requests' };
      }

      // 4. Processar pagamento via RPC atômico (sem race condition)
      const { data: result, error: rpcError } = await supabaseAdmin
        .rpc('process_webhook_payment', {
          p_registration_id: registration_id,
          p_amount: amount || 0,
          p_method: method || 'pix',
        });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        return { statusCode: 500, body: 'Internal Server Error' };
      }

      const status = result?.status || 500;
      const body = result?.error
        ? JSON.stringify({ error: result.error })
        : JSON.stringify({ ok: true, duplicate: result?.duplicate || false });

      return { statusCode: status, body };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Webhook error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
