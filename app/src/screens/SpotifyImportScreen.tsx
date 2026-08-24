import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { MOMENTS, type Moment } from '../data/moments';
import { createUserPlaylist, type NewTrackInput } from '../playlists/playlistClient';
import {
  getMyPlaylists,
  getPlaylistTracks,
  getSavedTracks,
  SpotifyApiError,
  type SpotifyOwnPlaylist,
  type SpotifyTrack,
} from '../spotify/spotifyApi';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

/** Pseudo-playlist: "Músicas curtidas" não é uma playlist de verdade no
 * Spotify, mas é onde a maioria das pessoas guarda o próprio gosto. */
const LIKED_ID = '__liked__';

type Source = { id: string; name: string };

/**
 * Importa uma playlist (ou as curtidas) que a pessoa já tem no Spotify para
 * dentro de um momento do MellowPet — diferente do editor, que monta uma
 * playlist nova buscando faixa por faixa. Aqui o repertório já existe; só
 * falta dizer para qual sentimento ele serve.
 */
export function SpotifyImportScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const spotify = useSpotify();

  const [playlists, setPlaylists] = useState<SpotifyOwnPlaylist[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [source, setSource] = useState<Source | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [picked, setPicked] = useState<SpotifyTrack[]>([]);

  const [moment, setMoment] = useState<Moment>(MOMENTS[0]);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadList = useCallback(() => {
    if (!spotify.authorized) return;
    setLoadingList(true);
    setListError(null);
    getMyPlaylists()
      .then(setPlaylists)
      .catch((err) => {
        setListError(
          err instanceof SpotifyApiError
            ? err.message
            : 'Não foi possível listar suas playlists do Spotify.'
        );
      })
      .finally(() => setLoadingList(false));
  }, [spotify.authorized]);

  useEffect(loadList, [loadList]);

  const openSource = (next: Source) => {
    setSource(next);
    setName(next.name);
    setNameTouched(false);
    setTracks([]);
    setPicked([]);
    setTracksError(null);
    setLoadingTracks(true);
    const load = next.id === LIKED_ID ? getSavedTracks() : getPlaylistTracks(next.id);
    load
      .then((found) => {
        setTracks(found);
        setPicked(found);
      })
      .catch((err) => {
        setTracksError(
          err instanceof SpotifyApiError ? err.message : 'Não foi possível carregar as faixas.'
        );
      })
      .finally(() => setLoadingTracks(false));
  };

  const closeSource = () => {
    setSource(null);
    setFormError(null);
  };

  const selectMoment = (next: Moment) => {
    setMoment(next);
    if (!nameTouched && source) setName(source.name);
  };

  const toggleTrack = (track: SpotifyTrack) => {
    setPicked((prev) =>
      prev.some((t) => t.uri === track.uri)
        ? prev.filter((t) => t.uri !== track.uri)
        : [...prev, track]
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Dê um nome para a playlist.');
      return;
    }
    if (!state.userId) {
      setFormError('Entre na sua conta para salvar playlists.');
      return;
    }
    if (picked.length === 0) {
      setFormError('Escolha ao menos uma faixa.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const importedTracks: NewTrackInput[] = picked.map((t) => ({
      title: t.name,
      artist: t.artist,
      spotifyUri: t.uri,
      duration: Math.round(t.duration / 1000),
    }));
    try {
      await createUserPlaylist({
        userId: state.userId,
        name: trimmed,
        emotion: moment.emotion,
        why: moment.sub,
        color: moment.color,
        tracks: importedTracks,
      });
      actions.go('music');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar a playlist.');
    } finally {
      setSaving(false);
    }
  };

  if (!spotify.authorized) {
    return (
      <ScreenScroll>
        <ScreenTitle label="IMPORTAR DO SPOTIFY" title={'Traga o que\nvocê já tem'} />
        <Section top={0}>
          <Card radius={24} padding={20}>
            <Txt s={13} lh={1.5} c={T.t3}>
              Conecte sua conta do Spotify na aba Música antes de importar suas playlists e
              músicas curtidas.
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
                Ir para Música
              </Txt>
            </Touchable>
          </Card>
        </Section>
      </ScreenScroll>
    );
  }

  if (!source) {
    return (
      <ScreenScroll>
        <ScreenTitle label="IMPORTAR DO SPOTIFY" title={'Traga o que\nvocê já tem'} />
        <Section top={0}>
          <Card radius={24} padding={20}>
            <Txt s={13.5} w={800} c={T.t1}>
              Escolha a origem
            </Txt>
            <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
              Importe uma playlist (ou suas curtidas) e amarre a um momento — sem precisar
              buscar faixa por faixa.
            </Txt>

            {loadingList ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }}>
                <ActivityIndicator size="small" color={T.pri} />
                <Txt s={12} c={T.t3}>
                  Carregando suas playlists…
                </Txt>
              </View>
            ) : null}

            {listError ? (
              <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 12 }}>
                {listError}
              </Txt>
            ) : null}

            {!loadingList ? (
              <View style={{ marginTop: 12, gap: 2 }}>
                <Touchable
                  onPress={() => openSource({ id: LIKED_ID, name: 'Músicas curtidas' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: T.bdL,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      backgroundColor: '#1DB954',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon d={ICONS.spotify} size={15} color="#fff" />
                  </View>
                  <Txt s={13.5} w={700} c={T.t1} style={{ flex: 1 }}>
                    Músicas curtidas
                  </Txt>
                  <Icon d={ICONS.chevron} size={16} color={T.t3} sw={2} />
                </Touchable>

                {playlists.map((p) => (
                  <Touchable
                    key={p.id}
                    onPress={() => openSource({ id: p.id, name: p.name })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: T.bdL,
                    }}
                  >
                    {p.image ? (
                      <Image
                        source={{ uri: p.image }}
                        style={{ width: 34, height: 34, borderRadius: 12 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          backgroundColor: T.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon d={ICONS.playFill} size={14} color={T.t3} filled />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Txt s={13.5} w={700} c={T.t1} numberOfLines={1}>
                        {p.name}
                      </Txt>
                      <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                        {p.trackCount} {p.trackCount === 1 ? 'faixa' : 'faixas'}
                      </Txt>
                    </View>
                    <Icon d={ICONS.chevron} size={16} color={T.t3} sw={2} />
                  </Touchable>
                ))}

                {playlists.length === 0 && !listError ? (
                  <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
                    Nenhuma playlist própria encontrada na sua conta.
                  </Txt>
                ) : null}
              </View>
            ) : null}
          </Card>
        </Section>

        <Section>
          <Touchable
            onPress={() => actions.go('music')}
            style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 14 }}
          >
            <Txt s={13.5} w={700} c={T.t3}>
              Voltar
            </Txt>
          </Touchable>
        </Section>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <ScreenTitle label="IMPORTAR DO SPOTIFY" title={source.name} />

      <Section top={0}>
        <Card radius={24} padding={20}>
          <Txt s={13.5} w={800} c={T.t1}>
            Para qual momento?
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            O Mellow toca essa playlist sozinho quando detectar esse sentimento.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {MOMENTS.map((m) => {
              const on = m.id === moment.id;
              return (
                <Touchable
                  key={m.id}
                  onPress={() => selectMoment(m)}
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
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={20}>
          <Field
            label="Nome da playlist"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setNameTouched(true);
            }}
            placeholder="Ex.: Meu refúgio"
          />
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={20}>
          <Txt s={13.5} w={800} c={T.t1}>
            Faixas ({picked.length}/{tracks.length})
          </Txt>

          {loadingTracks ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 }}>
              <ActivityIndicator size="small" color={T.pri} />
              <Txt s={12} c={T.t3}>
                Carregando faixas…
              </Txt>
            </View>
          ) : null}

          {tracksError ? (
            <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 10 }}>
              {tracksError}
            </Txt>
          ) : null}

          <View style={{ gap: 2, marginTop: 8 }}>
            {tracks.map((track) => {
              const on = picked.some((t) => t.uri === track.uri);
              return (
                <Touchable
                  key={track.uri}
                  onPress={() => toggleTrack(track)}
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
                    <Txt s={13} w={on ? 800 : 600} c={on ? T.t1 : T.t3} numberOfLines={1}>
                      {track.name}
                    </Txt>
                    <Txt s={11.5} c={T.t3} numberOfLines={1} style={{ marginTop: 2 }}>
                      {track.artist}
                    </Txt>
                  </View>
                  <Icon d={on ? ICONS.check : ICONS.plus} size={18} color={on ? OK : T.t3} sw={2.2} />
                </Touchable>
              );
            })}
          </View>
        </Card>
      </Section>

      <Section>
        {formError ? (
          <Txt s={12.5} lh={1.5} c={DANGER} style={{ marginBottom: 10 }}>
            {formError}
          </Txt>
        ) : null}
        <PrimaryButton
          label={saving ? 'Salvando…' : `Importar ${picked.length} ${picked.length === 1 ? 'faixa' : 'faixas'}`}
          disabled={saving || picked.length === 0}
          onPress={save}
        />
        <Touchable
          onPress={closeSource}
          style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 14 }}
        >
          <Txt s={13.5} w={700} c={T.t3}>
            Escolher outra origem
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
