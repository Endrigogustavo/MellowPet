import { getValidAccessToken } from './spotifyAuth';

/**
 * Web API do Spotify. É a única forma de criar playlist — o App Remote só
 * controla o player que já está tocando, não escreve nada na conta.
 */

const API = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type SpotifyTrack = {
  uri: string;
  name: string;
  artist: string;
  /** ms */
  duration: number;
  albumImage: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyApiError('Conecte sua conta do Spotify primeiro.', 401);

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.error?.message ?? `http_${response.status}`;
    throw new SpotifyApiError(String(detail), response.status);
  }
  return data as T;
}

function toTrack(item: any): SpotifyTrack {
  return {
    uri: item.uri,
    name: item.name,
    artist: (item.artists ?? []).map((a: any) => a.name).join(', '),
    duration: item.duration_ms ?? 0,
    albumImage: item.album?.images?.[item.album.images.length - 1]?.url ?? null,
  };
}

export async function searchTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({ q: trimmed, type: 'track', limit: String(limit) });
  const data = await request<any>(`/search?${params.toString()}`);
  return (data?.tracks?.items ?? []).map(toTrack);
}

/**
 * Sugestão automática de faixas para um momento. A API de recommendations foi
 * descontinuada para apps novos em nov/2024, então isto usa busca por gênero
 * — menos preciso, mas é o que continua disponível sem acesso estendido.
 */
export async function suggestTracksFor(seedQuery: string, limit = 15): Promise<SpotifyTrack[]> {
  return searchTracks(seedQuery, limit);
}

let cachedUserId: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const me = await request<any>('/me');
  if (!me?.id) throw new SpotifyApiError('Não foi possível identificar sua conta do Spotify.');
  cachedUserId = me.id;
  return me.id;
}

export function forgetCachedUser(): void {
  cachedUserId = null;
}

/** Cria a playlist na conta do usuário e devolve o URI dela. Privada por
 * padrão — é uma playlist de apoio emocional, não faz sentido publicar sem
 * a pessoa pedir. */
export async function createSpotifyPlaylist(
  name: string,
  description: string
): Promise<{ uri: string; id: string; url: string }> {
  const userId = await getCurrentUserId();
  const created = await request<any>(`/users/${encodeURIComponent(userId)}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!created?.uri) throw new SpotifyApiError('O Spotify não devolveu a playlist criada.');
  return { uri: created.uri, id: created.id, url: created.external_urls?.spotify ?? '' };
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  if (uris.length === 0) return;
  // O endpoint aceita no máximo 100 URIs por chamada.
  for (let i = 0; i < uris.length; i += 100) {
    await request(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }
}
