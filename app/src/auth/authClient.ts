import { Linking } from 'react-native';
import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

import { supabase, SUPABASE_CONFIGURED } from '../supabase/client';

// Precisa bater com "scheme" no app.json e com a Redirect URL cadastrada no
// provedor Google, no console do Supabase (Authentication → URL Configuration
// → Redirect URLs).
export const OAUTH_REDIRECT_URL = 'mellowpet://login-callback';

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

/** Abre o navegador do sistema no fluxo OAuth do Google. A sessão só é
 * concluída quando o redirect volta pro app — ver `completeOAuthRedirect`. */
export async function loginWithGoogle(): Promise<void> {
  if (!SUPABASE_CONFIGURED) throw new AuthError('Supabase não configurado neste build.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    // skipBrowserRedirect: no RN não existe redirect automático de página;
    // sem isto o SDK assume ambiente web e devolve `data.url` vazio.
    options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw new AuthError(mapAuthError(error));
  if (!data.url) throw new AuthError('Não foi possível iniciar o login com Google.');
  await Linking.openURL(data.url);
}

/** Chamado com a URL de deep link recebida de volta do navegador. Devolve
 * `null` para qualquer URL que não seja o nosso próprio callback OAuth. */
export async function completeOAuthRedirect(url: string): Promise<AuthUser | null> {
  if (!url.startsWith(OAUTH_REDIRECT_URL)) return null;
  const fragment = url.split('#')[1];
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw new AuthError(mapAuthError(error));
  if (!data.user) throw new AuthError('Não foi possível concluir o login com Google.');
  const profile = await fetchProfile(data.user.id);
  return {
    userId: data.user.id,
    email: data.user.email ?? '',
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
