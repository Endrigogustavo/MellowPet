import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { NowPlayingPulse } from '../components/NowPlayingPulse';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { MOMENTS, type Moment } from '../data/moments';
import {
  addTracks,
  deleteUserPlaylist,
  getPlaylist,
  removeTrack,
  reorderTracks,
  updateUserPlaylist,
  type UserPlaylist,
} from '../playlists/playlistClient';
import { searchTracks, SpotifyApiError, type SpotifyTrack } from '../spotify/spotifyApi';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, hexA } from '../theme/palette';

const SEARCH_DEBOUNCE_MS = 450;

/** Segundos → "3:04". */
function duration(seconds: number): string {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/**
 * Detalhe da playlist: as faixas, com edição completa.
 *
 * Toda mudança vai direto ao banco e recarrega — sem estado local que possa
 * divergir do servidor. É o que faz "somem ao reiniciar" deixar de existir:
 * o que está na tela é o que está gravado.
 */
export function PlaylistDetailScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const spotify = useSpotify();

  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [moment, setMoment] = useState<Moment>(MOMENTS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const playlistId = state.openPlaylistId;

  const load = useCallback(() => {
    if (!playlistId) return;
    setLoading(true);
    setError(null);
    getPlaylist(playlistId)
      .then((found) => {
        setPlaylist(found);
        if (found) {
          setName(found.name);
          setMoment(MOMENTS.find((m) => m.emotion === found.emotion) ?? MOMENTS[0]);
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar a playlist.')
      )
      .finally(() => setLoading(false));
  }, [playlistId]);

  useEffect(load, [load]);

  /* ── busca de faixas ─────────────────────────────────────────────────── */

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchTracks(term));
    } catch (e) {
      setResults([]);
      setSearchError(
        e instanceof SpotifyApiError && e.status === 401
          ? 'Conecte sua conta do Spotify na aba Música para buscar faixas.'
          : e instanceof Error
            ? e.message
            : 'Não foi possível buscar agora.'
      );
    } finally {
      setSearching(false);
    }
  }, []);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runSearch]);

  /* ── ações ───────────────────────────────────────────────────────────── */

  const run = async (action: () => Promise<void>, failMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : failMessage);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!loading) setBusy(false);
  }, [loading]);

  const addTrack = (track: SpotifyTrack) => {
    if (!playlist) return;
    run(
      () =>
        addTracks(playlist.id, [
          {
            title: track.name,
            artist: track.artist,
            spotifyUri: track.uri,
            duration: Math.round(track.duration / 1000),
          },
        ]),
      'Não foi possível adicionar a faixa.'
    );
    setQuery('');
    setResults([]);
  };

  const move = (index: number, delta: number) => {
    if (!playlist) return;
    const next = [...playlist.tracks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Otimista: a lista reordena na hora e o servidor confirma depois.
    setPlaylist({ ...playlist, tracks: next });
    run(() => reorderTracks(next.map((t) => t.id)), 'Não foi possível reordenar.');
  };

  const saveDetails = () => {
    if (!playlist) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Dê um nome para a playlist.');
      return;
    }
    run(
      () =>
        updateUserPlaylist(playlist.id, {
          name: trimmed,
          emotion: moment.emotion,
          why: moment.sub,
          color: moment.color,
        }),
      'Não foi possível salvar as mudanças.'
    ).then(() => setEditing(false));
  };

  const play = () => playFrom(0);

  /**
   * Toca a partir de uma faixa. A escolhida vai primeiro e o resto entra na
   * fila — é assim que se "pula para" uma música mantendo a playlist.
   *
   * Faixas sem `spotifyUri` (as locais em domínio público) não entram: o
   * App Remote só sabe tocar o que está no Spotify.
   */
  const playFrom = (index: number) => {
    if (!playlist) return;
    const uris = playlist.tracks
      .slice(index)
      .map((t) => t.spotifyUri)
      .filter((u): u is string => Boolean(u));
    if (uris.length === 0) {
      setError('Esta faixa não está disponível no Spotify.');
      return;
    }
    spotify.playTracks(uris, playlist.id);
  };

  /* ── render ──────────────────────────────────────────────────────────── */

  if (loading && !playlist) {
    return (
      <ScreenScroll>
        <Section top={60}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={T.pri} />
            <Txt s={13} c={T.t3}>
              Carregando a playlist…
            </Txt>
          </View>
        </Section>
      </ScreenScroll>
    );
  }

  if (!playlist) {
    return (
      <ScreenScroll>
        <ScreenTitle label="PLAYLIST" title="Não encontrada" />
        <Section top={0}>
          <Card radius={24} padding={20}>
            <Txt s={13} lh={1.5} c={T.t3}>
              {error ?? 'Essa playlist não existe mais.'}
            </Txt>
            <Touchable
              onPress={() => actions.go('music')}
              style={{
                marginTop: 14,
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: T.pri,
              }}
            >
              <Txt s={13} w={800} c="#fff">
                Voltar para Música
              </Txt>
            </Touchable>
          </Card>
        </Section>
      </ScreenScroll>
    );
  }

  const totalSeconds = playlist.tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <ScreenScroll>
      <ScreenTitle label="PLAYLIST" title={playlist.name} />

      {/* resumo + tocar */}
      <Section top={0}>
        <Card radius={24} padding={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 17,
              backgroundColor: playlist.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.playFill} size={22} color="#fff" sw={2} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={13} w={700} c={T.t1}>
              {playlist.why || 'Playlist de momento'}
            </Txt>
            <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
              {playlist.tracks.length} {playlist.tracks.length === 1 ? 'faixa' : 'faixas'}
              {totalSeconds > 0 ? ` · ${Math.round(totalSeconds / 60)} min` : ''}
            </Txt>
          </View>
          <Touchable
            onPress={play}
            disabled={playlist.tracks.length === 0}
            accessibilityLabel="Tocar playlist"
            style={{
              paddingVertical: 11,
              paddingHorizontal: 17,
              borderRadius: 999,
              backgroundColor: playlist.tracks.length === 0 ? T.bd : T.pri,
            }}
          >
            <Txt s={13} w={800} c={playlist.tracks.length === 0 ? T.t3 : '#fff'}>
              Tocar
            </Txt>
          </Touchable>
        </Card>
      </Section>

      {error ? (
        <Section top={10}>
          <View
            style={{
              flexDirection: 'row',
              gap: 9,
              padding: 13,
              borderRadius: 14,
              backgroundColor: hexA(DANGER, 0.1),
            }}
          >
            <Icon d={ICONS.alert} size={15} color={DANGER} circle sw={1.9} />
            <Txt s={12.5} lh={1.5} c={DANGER} style={{ flex: 1 }}>
              {error}
            </Txt>
          </View>
        </Section>
      ) : null}

      {/* editar nome e momento */}
      <Section top={12}>
        <Card radius={24} padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt s={13.5} w={800} c={T.t1} style={{ flex: 1 }}>
              Detalhes
            </Txt>
            <Touchable onPress={() => setEditing((v) => !v)} style={{ padding: 4 }}>
              <Txt s={12.5} w={800} c={T.pri}>
                {editing ? 'Cancelar' : 'Editar'}
              </Txt>
            </Touchable>
          </View>

          {editing ? (
            <View style={{ marginTop: 14, gap: 14 }}>
              <Field label="Nome da playlist" value={name} onChangeText={setName} />
              <View>
                <Txt s={11.5} w={800} c={T.t2} style={{ marginBottom: 9 }}>
                  Momento
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MOMENTS.map((m) => {
                    const on = m.id === moment.id;
                    return (
                      <Touchable
                        key={m.id}
                        onPress={() => setMoment(m)}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          backgroundColor: on ? m.color : T.bg,
                          borderWidth: 1,
                          borderColor: on ? m.color : T.bd,
                        }}
                      >
                        <Txt s={12.5} w={800} c={on ? '#fff' : T.t2}>
                          {m.label}
                        </Txt>
                      </Touchable>
                    );
                  })}
                </View>
              </View>
              <PrimaryButton
                label={busy ? 'Salvando…' : 'Salvar detalhes'}
                disabled={busy}
                onPress={saveDetails}
              />
            </View>
          ) : (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 8 }}>
              Toca sozinha quando o Mellow detectar: {playlist.why || 'este momento'}.
            </Txt>
          )}
        </Card>
      </Section>

      {/* faixas */}
      <Section top={12}>
        <Card radius={24} padding={20}>
          <Txt s={13.5} w={800} c={T.t1}>
            Faixas
          </Txt>

          {playlist.tracks.length === 0 ? (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 10 }}>
              Nenhuma faixa ainda. Busque abaixo para adicionar.
            </Txt>
          ) : (
            <View style={{ marginTop: 8 }}>
              {playlist.tracks.map((track, index) => {
                const isCurrent =
                  !!track.spotifyUri && track.spotifyUri === spotify.nowPlaying?.trackUri;
                const isSounding = isCurrent && spotify.nowPlaying?.isPaused === false;
                return (
                <Touchable
                  key={track.id}
                  onPress={() => playFrom(index)}
                  accessibilityLabel={'Tocar ' + track.title}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 11,
                    paddingHorizontal: isCurrent ? 10 : 0,
                    marginHorizontal: isCurrent ? -10 : 0,
                    borderRadius: isCurrent ? 14 : 0,
                    backgroundColor: isCurrent ? hexA(playlist.color, 0.14) : 'transparent',
                    borderTopWidth: isCurrent ? 0 : 1,
                    borderTopColor: T.bdL,
                  }}
                >
                  {/* A posição dá lugar ao pulso quando é a faixa da vez —
                      o mesmo espaço, sem a lista "pular" de largura. */}
                  <View style={{ width: 20, alignItems: 'center' }}>
                    {isCurrent ? (
                      <NowPlayingPulse playing={isSounding} color={playlist.color} size={16} />
                    ) : (
                      <Txt s={11} w={800} c={T.t3}>
                        {index + 1}
                      </Txt>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt
                      s={13}
                      w={isCurrent ? 800 : 700}
                      c={isCurrent ? playlist.color : T.t1}
                      numberOfLines={1}
                    >
                      {track.title}
                    </Txt>
                    <Txt s={11} c={T.t3} numberOfLines={1} style={{ marginTop: 2 }}>
                      {track.artist}
                      {track.duration ? ` · ${duration(track.duration)}` : ''}
                    </Txt>
                  </View>

                  <Touchable
                    onPress={() => move(index, -1)}
                    disabled={index === 0 || busy}
                    accessibilityLabel="Mover para cima"
                    style={{ padding: 5, opacity: index === 0 ? 0.3 : 1 }}
                  >
                    <Icon d={ICONS.chevron} size={15} color={T.t2} sw={2.2} rotate={-90} />
                  </Touchable>
                  <Touchable
                    onPress={() => move(index, 1)}
                    disabled={index === playlist.tracks.length - 1 || busy}
                    accessibilityLabel="Mover para baixo"
                    style={{
                      padding: 5,
                      opacity: index === playlist.tracks.length - 1 ? 0.3 : 1,
                    }}
                  >
                    <Icon d={ICONS.chevron} size={15} color={T.t2} sw={2.2} rotate={90} />
                  </Touchable>
                  <Touchable
                    onPress={() =>
                      run(() => removeTrack(track.id), 'Não foi possível remover a faixa.')
                    }
                    disabled={busy}
                    accessibilityLabel={'Remover ' + track.title}
                    style={{ padding: 5 }}
                  >
                    <Icon d={ICONS.trash} size={15} color={DANGER} />
                  </Touchable>
                </Touchable>
                );
              })}
            </View>
          )}

          {/* adicionar faixa */}
          {spotify.authorized ? (
            <View style={{ marginTop: 16 }}>
              <Txt s={11.5} w={800} c={T.t2} style={{ marginBottom: 9 }}>
                Adicionar faixa
              </Txt>
              <Field
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar no Spotify"
                error={searchError}
              />
              {searching ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 }}>
                  <ActivityIndicator size="small" color={T.pri} />
                  <Txt s={12} c={T.t3}>
                    Buscando…
                  </Txt>
                </View>
              ) : null}
              <View style={{ marginTop: 6 }}>
                {results.map((track) => (
                  <Touchable
                    key={track.uri}
                    onPress={() => addTrack(track)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingVertical: 11,
                      borderTopWidth: 1,
                      borderTopColor: T.bdL,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt s={13} w={600} c={T.t1} numberOfLines={1}>
                        {track.name}
                      </Txt>
                      <Txt s={11.5} c={T.t3} numberOfLines={1} style={{ marginTop: 2 }}>
                        {track.artist}
                      </Txt>
                    </View>
                    <Icon d={ICONS.plus} size={18} color={OK} sw={2.2} />
                  </Touchable>
                ))}
              </View>
            </View>
          ) : (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 16 }}>
              Conecte sua conta do Spotify na aba Música para adicionar faixas.
            </Txt>
          )}
        </Card>
      </Section>

      {/* apagar */}
      <Section top={12}>
        {confirmDelete ? (
          <Card radius={24} padding={20} style={{ backgroundColor: hexA(DANGER, 0.08) }}>
            <Txt s={13} w={800} c={T.t1}>
              Apagar “{playlist.name}”?
            </Txt>
            <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 6 }}>
              As {playlist.tracks.length} faixas vão junto. Isso não tem volta.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
              <Touchable
                onPress={() => setConfirmDelete(false)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.surf,
                }}
              >
                <Txt s={13} w={800} c={T.t2}>
                  Manter
                </Txt>
              </Touchable>
              <Touchable
                onPress={() =>
                  deleteUserPlaylist(playlist.id)
                    .then(() => actions.go('music'))
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'Não foi possível apagar.')
                    )
                }
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: DANGER,
                }}
              >
                <Txt s={13} w={800} c="#fff">
                  Apagar
                </Txt>
              </Touchable>
            </View>
          </Card>
        ) : (
          <Touchable
            onPress={() => setConfirmDelete(true)}
            style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 14 }}
          >
            <Txt s={13} w={700} c={DANGER}>
              Apagar playlist
            </Txt>
          </Touchable>
        )}

        <Touchable
          onPress={() => actions.go('music')}
          style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10 }}
        >
          <Txt s={13.5} w={700} c={T.t3}>
            Voltar
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
