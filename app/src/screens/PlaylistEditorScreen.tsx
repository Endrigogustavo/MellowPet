import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { MOMENTS, type Moment } from '../data/moments';
import { createUserPlaylist, type NewTrackInput } from '../playlists/playlistClient';
import {
  addTracksToPlaylist,
  createSpotifyPlaylist,
  searchTracks,
  SpotifyApiError,
  type SpotifyTrack,
} from '../spotify/spotifyApi';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

/** ms de silêncio no teclado antes de buscar — sem isso cada letra digitada
 * viraria uma chamada à API do Spotify. */
const SEARCH_DEBOUNCE_MS = 450;

export function PlaylistEditorScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const spotify = useSpotify();

  const [moment, setMoment] = useState<Moment>(MOMENTS[0]);
  const [name, setName] = useState(MOMENTS[0].label);
  const [nameTouched, setNameTouched] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [picked, setPicked] = useState<SpotifyTrack[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectMoment = (next: Moment) => {
    setMoment(next);
    // Enquanto a pessoa não escreveu um nome próprio, o nome acompanha o
    // momento escolhido. Depois que ela edita, paramos de sobrescrever.
    if (!nameTouched) setName(next.label);
  };

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
    } catch (err) {
      setResults([]);
      setSearchError(
        err instanceof SpotifyApiError && err.status === 401
          ? 'Conecte sua conta do Spotify na aba Música para buscar faixas.'
          : err instanceof Error
            ? err.message
            : 'Não foi possível buscar agora.'
      );
    } finally {
      setSearching(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

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
    setSaving(true);
    setFormError(null);

    const tracks: NewTrackInput[] = picked.map((t) => ({
      title: t.name,
      artist: t.artist,
      spotifyUri: t.uri,
      duration: Math.round(t.duration / 1000),
    }));

    try {
      // Espelhar no Spotify é o bônus, não o requisito: se falhar (conta não
      // autorizada, rede fora), a playlist ainda é salva no MellowPet e
      // continua tocando as faixas. Só o link com a conta se perde.
      let spotifyUri: string | null = null;
      let spotifyUrl: string | null = null;
      if (spotify.authorized && picked.length > 0) {
        try {
          const created = await createSpotifyPlaylist(trimmed, `MellowPet · ${moment.sub}`);
          await addTracksToPlaylist(created.id, picked.map((t) => t.uri));
          spotifyUri = created.uri;
          spotifyUrl = created.url;
        } catch {
          setFormError('Playlist salva no MellowPet, mas não foi possível criá-la no Spotify.');
        }
      }

      await createUserPlaylist({
        userId: state.userId,
        name: trimmed,
        emotion: moment.emotion,
        why: moment.sub,
        color: moment.color,
        spotifyUri,
        spotifyUrl,
        tracks,
      });
      actions.go('music');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar a playlist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="NOVA PLAYLIST" title={'Som para um\nmomento seu'} />

      {/* momento */}
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
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 12 }}>
            {moment.sub}
          </Txt>
        </Card>
      </Section>

      {/* nome */}
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

      {/* faixas */}
      <Section>
        <Card radius={24} padding={20}>
          <Txt s={13.5} w={800} c={T.t1}>
            Faixas
          </Txt>
          {spotify.authorized ? (
            <>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                Busque no Spotify e toque para adicionar.
              </Txt>
              <Field
                value={query}
                onChangeText={setQuery}
                placeholder={`Ex.: ${moment.seed}`}
                containerStyle={{ marginTop: 12 }}
              />

              {searching ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 }}>
                  <ActivityIndicator size="small" color={T.pri} />
                  <Txt s={12} c={T.t3}>
                    Buscando…
                  </Txt>
                </View>
              ) : null}

              {searchError ? (
                <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 10 }}>
                  {searchError}
                </Txt>
              ) : null}

              <View style={{ gap: 2, marginTop: 8 }}>
                {results.map((track) => {
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
                        <Txt s={13} w={on ? 800 : 600} c={T.t1} numberOfLines={1}>
                          {track.name}
                        </Txt>
                        <Txt s={11.5} c={T.t3} numberOfLines={1} style={{ marginTop: 2 }}>
                          {track.artist}
                        </Txt>
                      </View>
                      <Icon
                        d={on ? ICONS.check : ICONS.plus}
                        size={18}
                        color={on ? OK : T.t3}
                        sw={2.2}
                      />
                    </Touchable>
                  );
                })}
              </View>
            </>
          ) : (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 8 }}>
              Conecte sua conta do Spotify na aba Música para escolher as faixas desta playlist.
            </Txt>
          )}
        </Card>
      </Section>

      {/* selecionadas */}
      {picked.length > 0 ? (
        <Section>
          <Card radius={24} padding={20}>
            <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 10 }}>
              {picked.length} {picked.length === 1 ? 'faixa escolhida' : 'faixas escolhidas'}
            </Txt>
            {picked.map((track) => (
              <View
                key={track.uri}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
              >
                <View
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: moment.color }}
                />
                <Txt s={12.5} c={T.t2} numberOfLines={1} style={{ flex: 1 }}>
                  {track.name}
                </Txt>
                <Touchable onPress={() => toggleTrack(track)} style={{ padding: 4 }}>
                  <Icon d={ICONS.close} size={15} color={T.t3} />
                </Touchable>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section>
        {formError ? (
          <Txt s={12.5} lh={1.5} c={DANGER} style={{ marginBottom: 10 }}>
            {formError}
          </Txt>
        ) : null}
        <PrimaryButton
          label={saving ? 'Salvando…' : 'Salvar playlist'}
          disabled={saving}
          onPress={save}
        />
        <Touchable
          onPress={() => actions.go('music')}
          style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 14 }}
        >
          <Txt s={13.5} w={700} c={T.t3}>
            Cancelar
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
