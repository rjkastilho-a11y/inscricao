import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { user_id } = JSON.parse(event.body || '{}');

    if (!user_id || typeof user_id !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'user_id is required' }) };
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) {
      console.error('Erro ao deletar auth user:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('delete-auth-user error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
