/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

type UserRole = 'super_admin' | 'admin' | 'moderator' | 'user';

interface UserRoleRow {
  role: UserRole;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  churchId: string | null;
  churchRole: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isAdmin: false,
    isSuperAdmin: false,
    churchId: null,
    churchRole: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      const user = session?.user ?? null;

      if (!user) {
        setState({ session: null, user: null, isAdmin: false, isSuperAdmin: false, churchId: null, churchRole: null, loading: false });
        return;
      }

      // Lê church_id e church_role do JWT (app_metadata) — sem query ao banco
      let churchRole = (user.app_metadata?.church_role as string) || null;
      let churchId = (user.app_metadata?.church_id as string) || null;
      let isSuperAdmin = churchRole === 'super_admin';
      let isAdmin = isSuperAdmin || churchRole === 'admin';

      // Fallback: se JWT ainda não foi populada (ex: usuário recém-criado),
      // busca de user_roles diretamente
      if (!churchRole) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role, church_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (rolesData) {
          churchRole = (rolesData as any).role || null;
          churchId = (rolesData as any).church_id || null;
          isSuperAdmin = churchRole === 'super_admin';
          isAdmin = isSuperAdmin || churchRole === 'admin';
        }
      }

      if (mounted) {
        setState({
          session,
          user,
          isAdmin,
          isSuperAdmin,
          churchId,
          churchRole,
          loading: false,
        });
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return;
      checkSession();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    setState({ session: null, user: null, isAdmin: false, isSuperAdmin: false, churchId: null, churchRole: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
