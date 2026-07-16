import { supabase } from './supabase';

export interface PaymentRecord {
  id: string;
  registration_id: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  created_at: string;
}

/**
 * Recalcula paid_amount no registrations a partir da soma dos payments.
 * payment_status é controlado exclusivamente pelo admin.
 */
export async function syncPaidAmount(registrationId: string): Promise<string | null> {
  const { data, error: fetchError } = await supabase
    .from('payments')
    .select('amount')
    .eq('registration_id', registrationId)
    .eq('status', 'paid');

  if (fetchError) {
    console.error('[syncPaidAmount] Erro ao buscar pagamentos:', fetchError.message);
    return fetchError.message;
  }

  const total = data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const { error: updateError } = await supabase
    .from('registrations')
    .update({ paid_amount: total || null })
    .eq('id', registrationId);

  if (updateError) {
    console.error('[syncPaidAmount] Erro ao atualizar inscrição:', updateError.message);
    return updateError.message;
  }

  return null;
}

/**
 * Insere um pagamento no histórico e sincroniza paid_amount.
 */
export async function insertPayment(
  registrationId: string,
  amount: number,
  method: string,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('payments').insert({
    registration_id: registrationId,
    amount,
    method,
    status: 'paid',
    notes: notes || null,
  });

  if (error) return { error: error.message };

  const syncError = await syncPaidAmount(registrationId);
  if (syncError) return { error: syncError };
  return { error: null };
}

/**
 * Insere um reembolso (valor negativo) no histórico e sincroniza paid_amount.
 */
export async function insertRefund(
  registrationId: string,
  amount: number,
  method: string,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('payments').insert({
    registration_id: registrationId,
    amount: -Math.abs(amount),
    method,
    status: 'paid',
    notes: notes || `Reembolso`,
  });

  if (error) return { error: error.message };

  const syncError = await syncPaidAmount(registrationId);
  if (syncError) return { error: syncError };
  return { error: null };
}

/**
 * Exclui um pagamento do histórico e sincroniza paid_amount.
 */
export async function deletePayment(
  paymentId: string,
  registrationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);

  if (error) return { error: error.message };

  const syncError = await syncPaidAmount(registrationId);
  if (syncError) return { error: syncError };
  return { error: null };
}

/**
 * Busca histórico de pagamentos de uma inscrição.
 */
export async function fetchPayments(registrationId: string): Promise<PaymentRecord[]> {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('registration_id', registrationId)
    .order('created_at', { ascending: false });

  return (data as PaymentRecord[]) ?? [];
}
