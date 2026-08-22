import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

import { supabase, SUPABASE_CONFIGURED } from '../supabase/client';

export type AuthRole = 'user' | 'care';

export type AuthUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: AuthRole;
};

export class AuthError extends Error {}

function mapAuthError(error: SupabaseAuthError): string {
  const message = error.message.toLowerCase();
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Este email já está cadastrado.';
  }
  if (message.includes('invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu email antes de entrar.';
  }
  if (message.includes('password') && message.includes('least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.';
  }
  return 'Não foi possível continuar.';
}

async function fetchProfile(userId: string): Promise<{ displayName: string | null; role: AuthRole }> {
  const { data } = await supabase.from('profiles').select('display_name, role').eq('id', userId).single();
  const role = data?.role === 'care' ? 'care' : 'user';
  return { displayName: data?.display_name ?? null, role };
}

export async function signup(
  email: string,
  password: string,
  role: AuthRole,
  displayName?: string
): Promise<AuthUser> {
  if (!SUPABASE_CONFIGURED) throw new AuthError('Supabase não configurado neste build.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, display_name: displayName || null } },
  });
  if (error) throw new AuthError(mapAuthError(error));
  if (!data.user) throw new AuthError('Não foi possível criar a conta.');
  if (!data.session) {
    // Confirmação de email está ligada no projeto Supabase — a conta foi
    // criada, mas sem sessão ainda não há JWT válido, então RLS bloqueia
    // qualquer leitura/escrita (é por isso que "criar convite" falhava
    // silenciosamente depois de um cadastro "bem-sucedido"). Reportar isso
    // como erro em vez de fingir que logou.
    throw new AuthError(
      'Conta criada! Confirme seu email (verifique a caixa de entrada, incluindo spam) antes de entrar.'
    );
  }
  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    displayName: displayName || null,
    role,
  };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  if (!SUPABASE_CONFIGURED) throw new AuthError('Supabase não configurado neste build.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AuthError(mapAuthError(error));
  if (!data.user) throw new AuthError('Não foi possível entrar.');
  const profile = await fetchProfile(data.user.id);
  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    displayName: profile.displayName,
    role: profile.role,
  };
}

export async function loadStoredSession(): Promise<AuthUser | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const profile = await fetchProfile(user.id);
  return {
    userId: user.id,
    email: user.email ?? '',
    displayName: profile.displayName,
    role: profile.role,
  };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/** Reage a SIGNED_OUT vindo de fora de uma chamada explícita a `logout()` —
 * ex.: refresh token expirado/revogado em background. `logout()` não
 * despacha estado sozinho por isso; esse listener é o único lugar que faz. */
export function subscribeToSignOut(onSignedOut: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onSignedOut();
  });
  return () => data.subscription.unsubscribe();
}
