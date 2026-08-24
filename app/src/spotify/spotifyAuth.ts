import { Linking } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * OAuth do Spotify no fluxo Authorization Code + PKCE.
 *
 * PKCE existe justamente para apps que não conseguem guardar segredo: o
 * client_secret nunca entra aqui (ficaria extraível do APK). Em vez dele, o
 * app sorteia um `code_verifier` por tentativa, manda só o hash na ida e o
 * valor original na troca por token — quem interceptar o `code` no meio do
 * caminho não consegue trocá-lo sem o verifier.
 *
 * O App Remote (controle de playback) exige que o usuário já tenha autorizado
 * o app explicitamente. Sem passar por aqui primeiro, `connect()` falha com
 * "Explicit user authorization is required to use Spotify".
 */

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
export const SPOTIFY_REDIRECT_URI = 'mellowpet://spotify-callback';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TOKEN_STORAGE_KEY = 'mellowpet.spotify.tokens.v2';
const VERIFIER_STORAGE_KEY = 'mellowpet.spotify.pkce_verifier.v1';

/**
 * `app-remote-control` e `streaming` cobrem o playback; os de playlist são o
 * que permite criar as playlists de momento dentro da conta da pessoa.
 * `user-read-private` só serve para descobrir o id do usuário, que a Web API
 * exige para criar playlist.
 */
const SCOPES = [
  'app-remote-control',
  'streaming',
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-read',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
].join(' ');

export const SPOTIFY_CLIENT_CONFIGURED = Boolean(CLIENT_ID);

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms em que o access token expira. */
  expiresAt: number;
};

export class SpotifyAuthError extends Error {}

/** base64 padrão → base64url (sem padding), como o RFC 7636 exige. */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 na mão em vez de `btoa`: o global existe no Hermes moderno mas não
 * em todo runtime que o Expo pode usar, e uma falha aqui só apareceria no
 * meio do login. São poucas linhas e tira a dependência da dúvida. */
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

async function createVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(64);
  return toBase64Url(bytesToBase64(bytes));
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return toBase64Url(digest);
}

export async function loadTokens(): Promise<SpotifyTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SpotifyTokens>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

async function saveTokens(tokens: SpotifyTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
  await SecureStore.deleteItemAsync(VERIFIER_STORAGE_KEY);
}

/** Abre o consentimento do Spotify no navegador. A sessão só se completa
 * quando o deep link volta — ver `completeSpotifyAuth`. */
export async function beginSpotifyAuth(): Promise<void> {
  if (!CLIENT_ID) throw new SpotifyAuthError('EXPO_PUBLIC_SPOTIFY_CLIENT_ID não definido neste build.');
  const verifier = await createVerifier();
  // Precisa sobreviver ao app ir pra segundo plano enquanto o navegador está
  // aberto — o Android pode matar o processo nesse intervalo.
  await SecureStore.setItemAsync(VERIFIER_STORAGE_KEY, verifier);
  const challenge = await challengeFor(verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });
  await Linking.openURL(`${AUTHORIZE_URL}?${params.toString()}`);
}

async function exchange(body: Record<string, string>): Promise<SpotifyTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    const detail = data?.error_description || data?.error || `http_${response.status}`;
    throw new SpotifyAuthError(String(detail));
  }
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    // 60s de folga: evita usar um token que expira no meio do request.
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000,
  };
  await saveTokens(tokens);
  return tokens;
}

/** Recebe a URL do deep link de volta. Devolve `null` se não for o callback
 * do Spotify — o mesmo listener trata o retorno do Google. */
export async function completeSpotifyAuth(url: string): Promise<SpotifyTokens | null> {
  if (!url.startsWith(SPOTIFY_REDIRECT_URI)) return null;
  const query = url.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);

  const error = params.get('error');
  if (error) {
    await SecureStore.deleteItemAsync(VERIFIER_STORAGE_KEY);
    throw new SpotifyAuthError(
      error === 'access_denied' ? 'Autorização cancelada.' : `Spotify recusou: ${error}`
    );
  }

  const code = params.get('code');
  if (!code) return null;

  const verifier = await SecureStore.getItemAsync(VERIFIER_STORAGE_KEY);
  if (!verifier) throw new SpotifyAuthError('Sessão de autorização expirou. Tente conectar de novo.');

  const tokens = await exchange({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  await SecureStore.deleteItemAsync(VERIFIER_STORAGE_KEY);
  return tokens;
}

/** Token válido pra usar na Web API, renovando quando necessário. `null`
 * quando não há sessão — quem chama decide se pede pra conectar. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt) return tokens.accessToken;
  if (!tokens.refreshToken) {
    await clearTokens();
    return null;
  }
  try {
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: CLIENT_ID,
    });
    return refreshed.accessToken;
  } catch {
    // Refresh revogado do lado do Spotify: some com a sessão local em vez de
    // ficar tentando renovar em loop a cada chamada.
    await clearTokens();
    return null;
  }
}
