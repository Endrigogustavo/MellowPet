import { supabase } from '../supabase/client';
import type { EmotionKey } from '../data/emotions';

/** Emoções que podem receber uma playlist. 'unknown' fica de fora: não dá
 * para montar repertório para um estado que o app não conseguiu ler. */
export type PlaylistEmotion = Exclude<EmotionKey, 'unknown'>;

export type UserTrack = {
  id: string;
  title: string;
  artist: string;
  spotifyUri: string | null;
  url: string | null;
  /** Segundos. */
  duration: number;
  position: number;
};

export type UserPlaylist = {
  id: string;
  name: string;
  emotion: PlaylistEmotion;
  why: string;
  color: string;
  spotifyUri: string | null;
  spotifyUrl: string | null;
  tracks: UserTrack[];
};

type PlaylistRow = {
  id: string;
  name: string;
  emotion: string;
  why: string | null;
  color: string | null;
  spotify_uri: string | null;
  spotify_url: string | null;
  playlist_tracks: {
    id: string;
    title: string;
    artist: string | null;
    spotify_uri: string | null;
    url: string | null;
    duration: number | null;
    position: number | null;
  }[] | null;
};

const SELECT =
  'id, name, emotion, why, color, spotify_uri, spotify_url, ' +
  'playlist_tracks (id, title, artist, spotify_uri, url, duration, position)';

function toPlaylist(row: PlaylistRow): UserPlaylist {
  const tracks = (row.playlist_tracks ?? [])
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist ?? '',
      spotifyUri: t.spotify_uri,
      url: t.url,
      duration: t.duration ?? 0,
      position: t.position ?? 0,
    }))
    // O join do PostgREST não garante ordem; ordenar aqui evita a lista
    // embaralhar entre uma leitura e outra.
    .sort((a, b) => a.position - b.position);

  return {
    id: row.id,
    name: row.name,
    emotion: row.emotion as PlaylistEmotion,
    why: row.why ?? '',
    color: row.color ?? '#6C5CE7',
    spotifyUri: row.spotify_uri,
    spotifyUrl: row.spotify_url,
    tracks,
  };
}

/**
 * Lança em caso de erro em vez de devolver lista vazia.
 *
 * Engolir o erro fazia uma falha de rede parecer "você não tem playlist
 * nenhuma" — indistinguível de terem sumido. Quem chama precisa saber a
 * diferença entre "vazio" e "não deu para ler".
 */
export async function listUserPlaylists(userId: string): Promise<UserPlaylist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select(SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Não foi possível carregar suas playlists: ${error.message}`);
  if (!data) return [];
  return (data as unknown as PlaylistRow[]).map(toPlaylist);
}

export type NewTrackInput = {
  title: string;
  artist?: string;
  spotifyUri?: string | null;
  url?: string | null;
  /** Segundos. */
  duration?: number;
};

export async function createUserPlaylist(input: {
  userId: string;
  name: string;
  emotion: PlaylistEmotion;
  why?: string;
  color?: string;
  spotifyUri?: string | null;
  spotifyUrl?: string | null;
  tracks?: NewTrackInput[];
}): Promise<UserPlaylist> {
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      user_id: input.userId,
      name: input.name,
      emotion: input.emotion,
      why: input.why ?? '',
      color: input.color ?? '#6C5CE7',
      spotify_uri: input.spotifyUri ?? null,
      spotify_url: input.spotifyUrl ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível criar a playlist.');
  }

  if (input.tracks?.length) {
    await addTracks(data.id, input.tracks);
  }
  const created = await getPlaylist(data.id);
  if (!created) throw new Error('Playlist criada mas não foi possível lê-la de volta.');
  return created;
}

export async function getPlaylist(playlistId: string): Promise<UserPlaylist | null> {
  const { data, error } = await supabase.from('playlists').select(SELECT).eq('id', playlistId).single();
  if (error || !data) return null;
  return toPlaylist(data as unknown as PlaylistRow);
}

export async function addTracks(playlistId: string, tracks: NewTrackInput[]): Promise<void> {
  if (tracks.length === 0) return;
  // `position` continua de onde a playlist parou, senão faixas adicionadas
  // depois entrariam todas em 0 e a ordem viraria arbitrária.
  const { count } = await supabase
    .from('playlist_tracks')
    .select('id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId);
  const offset = count ?? 0;

  const rows = tracks.map((t, i) => ({
    playlist_id: playlistId,
    title: t.title,
    artist: t.artist ?? '',
    spotify_uri: t.spotifyUri ?? null,
    url: t.url ?? null,
    duration: t.duration ?? 0,
    position: offset + i,
  }));
  const { error } = await supabase.from('playlist_tracks').insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteUserPlaylist(playlistId: string): Promise<void> {
  // playlist_tracks tem ON DELETE CASCADE — não precisa apagar faixa a faixa.
  const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
  if (error) throw new Error(`Não foi possível apagar a playlist: ${error.message}`);
}

export async function removeTrack(trackId: string): Promise<void> {
  const { error } = await supabase.from('playlist_tracks').delete().eq('id', trackId);
  if (error) throw new Error(`Não foi possível remover a faixa: ${error.message}`);
}

/** Renomear, trocar de momento, mudar a cor. */
export async function updateUserPlaylist(
  playlistId: string,
  patch: { name?: string; emotion?: PlaylistEmotion; why?: string; color?: string }
): Promise<void> {
  const { error } = await supabase.from('playlists').update(patch).eq('id', playlistId);
  if (error) throw new Error(`Não foi possível salvar as mudanças: ${error.message}`);
}

/**
 * Reordena as faixas gravando a posição de cada uma.
 *
 * Um UPDATE por faixa, não `upsert`: o upsert faria INSERT em caso de
 * conflito ausente, e as colunas obrigatórias (playlist_id, title) não
 * estão aqui — falharia sempre. São poucas faixas, e o custo é aceitável.
 */
export async function reorderTracks(orderedTrackIds: string[]): Promise<void> {
  if (orderedTrackIds.length === 0) return;
  const results = await Promise.all(
    orderedTrackIds.map((id, position) =>
      supabase.from('playlist_tracks').update({ position }).eq('id', id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Não foi possível reordenar: ${failed.error.message}`);
}
