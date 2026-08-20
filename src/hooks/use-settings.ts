import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface CreateAdminInput {
  email: string;
  password: string;
}

/**
 * Cria um novo usuário admin.
 *
 * ⚠️ USO EXCLUSIVO PARA DESENVOLVIMENTO LOCAL.
 *
 * Este hook usa supabase.auth.signUp() + insert manual em user_roles.
 * Esse fluxo funciona apenas no ambiente local porque o RLS permite
 * que o próprio usuário recém-criado insira sua role.
 *
 * EM PRODUÇÃO:
 * - auth.admin.createUser() exige service_role_key (não exposta ao cliente).
 * - Crie uma Supabase Edge Function que:
 *     1. Valide se o caller tem role 'admin'
 *     2. Use service_role_key (via environment variable da Edge Function)
 *        para criar o usuário e atribuir a role
 *
 * Fluxo atual (local apenas):
 * 1. Chama supabase.auth.signUp() para criar o usuário
 * 2. Insere em user_roles: { user_id: novoId, role: 'admin' }
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: CreateAdminInput) => {
      // Passo 1: criar usuário via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // Passo 2: atribuir role admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'admin',
        });

      if (roleError) {
        // Se falhar ao atribuir role, tentamos limpar o usuário criado
        // (apenas para manter consistência — em produção use Edge Function)
        throw roleError;
      }

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    },
  });
}
