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

/**
 * Traduz o erro do Supabase para algo acionável.
 *
 * Cada mensagem diz o que aconteceu E o que fazer — "Não foi possível
 * continuar" deixa a pessoa sem saída, ainda mais numa tela de conta.
 * O fallback inclui o texto original porque um erro desconhecido sem
 * detalhe nenhum é impossível de reportar ou depurar.
 */
function mapAuthError(error: SupabaseAuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Este e-mail já tem conta. Toque em "Entrar" para acessar, ou use outro e-mail.';
  }
  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dois — a senha diferencia maiúsculas de minúsculas.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada e no spam.';
  }
  if (message.includes('password') && message.includes('least')) {
    return 'A senha é curta demais. Use pelo menos 8 caracteres, com uma letra e um número.';
  }
  if (message.includes('email rate limit') || message.includes('over_email_send_rate')) {
    return 'Muitas tentativas seguidas. Espere alguns minutos antes de tentar de novo.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Você tentou várias vezes seguidas. Aguarde um instante e tente novamente.';
  }
  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'Esse e-mail não parece válido. Confira se não faltou uma letra ou o domínio.';
  }
  if (message.includes('user not found')) {
    return 'Não encontramos conta com esse e-mail. Toque em "Criar conta" para começar.';
  }
  if (message.includes('signup') && message.includes('disabled')) {
    return 'Cadastros estão temporariamente desativados neste servidor.';
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Esse tipo de login não está habilitado neste servidor.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'O servidor demorou para responder. Tente novamente em instantes.';
  }
  return `Não foi possível continuar: ${error.message}`;
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
