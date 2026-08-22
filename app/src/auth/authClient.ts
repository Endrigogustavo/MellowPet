import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';
const TOKEN_KEY = 'mellowpet.auth.token';
const USER_KEY = 'mellowpet.auth.user';

export type AuthRole = 'user' | 'care';

export type AuthUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: AuthRole;
};

export class AuthError extends Error {}

type AuthApiResponse = {
  token: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: AuthRole;
};

async function postJson(path: string, body: unknown): Promise<AuthApiResponse> {
  if (!API_BASE_URL) {
    throw new AuthError('API não configurada neste build (EXPO_PUBLIC_API_BASE_URL ausente).');
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : null),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Não foi possível falar com o servidor. Verifique sua conexão.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data && (data.detail || data.error)) || 'Falha na autenticação.';
    throw new AuthError(typeof detail === 'string' ? detail : 'Falha na autenticação.');
  }
  return data as AuthApiResponse;
}

async function persist(data: AuthApiResponse): Promise<AuthUser> {
  const user: AuthUser = {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
  };
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  return user;
}

export async function signup(
  email: string,
  password: string,
  role: AuthRole,
  displayName?: string
): Promise<AuthUser> {
  const data = await postJson('/api/v1/auth/signup', {
    email,
    password,
    role,
    display_name: displayName || null,
  });
  return persist(data);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await postJson('/api/v1/auth/login', { email, password });
  return persist(data);
}

export async function loadStoredSession(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
