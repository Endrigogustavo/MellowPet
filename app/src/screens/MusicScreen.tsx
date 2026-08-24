import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useMusic } from '../audio/MusicPlayer';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Toggle, Touchable, Txt } from '../components/ui';
import { EMO_PLAYLIST, ICONS, MUSIC_RULES, PLAYLISTS, playlistMeta, type Playlist } from '../data/content';
import { FACE_ICON } from '../data/emotions';
import { deleteUserPlaylist, listUserPlaylists, type UserPlaylist } from '../playlists/playlistClient';
import { useSpotify } from '../spotify/spotifyClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, hexA } from '../theme/palette';

export function MusicScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full, emo, emoColor, emoLight } = useTheme();
  const music = useMusic();
  const spotify = useSpotify();

  const [mine, setMine] = useState<UserPlaylist[]>([]);
  const reload = useCallback(() => {
    if (!state.userId) return;
    listUserPlaylists(state.userId).then(setMine);
  }, [state.userId]);
  // `navSeq` muda toda vez que a navegação acontece — recarrega ao voltar do
  // editor sem precisar de um evento próprio de "playlist criada".
  useEffect(reload, [reload, state.navSeq]);

  /** A playlist que a própria pessoa montou para este sentimento tem
   * prioridade sobre a curadoria embutida: o repertório dela acolhe mais. */
  const mineForEmotion = mine.find((p) => p.emotion === state.observedExpression) ?? null;
  const suggested =
    PLAYLISTS.find((p) => p.id === EMO_PLAYLIST[state.observedExpression]) ?? PLAYLISTS[0];
  const currentId = spotify.connected
    ? (PLAYLISTS.find((p) => p.spotifyUri === spotify.currentUri)?.id ?? null)
    : (music.playlist?.id ?? null);

  /** Com Spotify conectado, toca de verdade a playlist real; senão cai no
   * player local de Chopin em domínio público, como sempre foi. */
  const playPlaylist = (p: Playlist) => {
    if (spotify.connected) spotify.playUri(p.spotifyUri);
    else music.start(p.id);
  };

  const togglePlaylist = (p: Playlist) => {
    if (!spotify.connected) {
      music.toggle(p.id);
      return;
    }
    if (p.spotifyUri !== spotify.currentUri) {
      spotify.playUri(p.spotifyUri);
    } else if (spotify.nowPlaying?.isPaused) {
      spotify.resume();
    } else {
      spotify.pause();
    }
  };

  /** Playlist espelhada na conta toca pelo URI dela (o Spotify cuida da
   * ordem); a que só existe aqui toca faixa a faixa via fila. */
  const playUserPlaylist = (p: UserPlaylist) => {
    const uris = p.tracks.map((t) => t.spotifyUri).filter((u): u is string => Boolean(u));
    if (p.spotifyUri) spotify.playUri(p.spotifyUri);
    else if (uris.length > 0) spotify.playTracks(uris, p.id);
  };

  const removeMine = (p: UserPlaylist) => {
    setMine((prev) => prev.filter((x) => x.id !== p.id));
    deleteUserPlaylist(p.id).catch(reload);
  };

  const isSounding = (p: Playlist) =>
    spotify.connected
      ? p.spotifyUri === spotify.currentUri && spotify.nowPlaying?.isPaused === false
      : p.id === currentId && music.isPlaying;

  return (
    <ScreenScroll>
      <ScreenTitle label="MÚSICA" title={'Som para o\nseu momento'} />

      {/* conexão com o Spotify */}
      <Section top={0} style={{ marginBottom: 10 }}>
        <Card
          radius={20}
          padding={15}
          style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: 'rgba(29,185,84,.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.spotify} size={19} color="#1DB954" circle />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={13.5} w={800} c={T.t1}>
              Spotify
            </Txt>
            <Txt s={11.5} c={spotify.error ? DANGER : T.t3} numberOfLines={3} style={{ marginTop: 2 }}>
              {spotify.error
                ? spotify.error
                : spotify.connected
                  ? (spotify.nowPlaying?.trackName ?? 'Conectado')
                  : spotify.authorized
                    ? 'Conta autorizada — toque para tocar aqui'
                    : 'Conecte para criar e tocar playlists da sua conta'}
            </Txt>
          </View>
          <Touchable
            onPress={spotify.connected || spotify.authorized ? spotify.disconnect : spotify.connect}
            disabled={spotify.connecting}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderRadius: 999,
              backgroundColor: spotify.authorized ? T.bg : '#1DB954',
              opacity: spotify.connecting ? 0.6 : 1,
            }}
          >
            <Txt s={12} w={800} c={spotify.authorized ? T.t2 : '#fff'}>
              {spotify.connecting
                ? 'Conectando…'
                : spotify.authorized
                  ? 'Desconectar'
                  : 'Conectar Spotify'}
            </Txt>
          </Touchable>
        </Card>
      </Section>

      {/* sugestão pela emoção */}
      <Section top={0}>
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: emoLight,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: T.surf,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              d={FACE_ICON[state.observedExpression]}
              size={21}
              color={emoColor}
              sw={1.9}
              circle
            />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={11.5} c={T.t3}>
              Você está {emo.label.toLowerCase()} - recomendo
            </Txt>
            <Txt s={15.5} w={800} c={T.t1} style={{ marginTop: 2 }}>
              {mineForEmotion?.name ?? suggested.name}
            </Txt>
            {mineForEmotion ? (
              <Txt s={11} w={700} c={emoColor} style={{ marginTop: 2 }}>
                sua playlist
              </Txt>
            ) : null}
          </View>
          <Touchable
            onPress={() =>
              mineForEmotion ? playUserPlaylist(mineForEmotion) : playPlaylist(suggested)
            }
            style={{
              paddingVertical: 11,
              paddingHorizontal: 18,
              borderRadius: 999,
              backgroundColor: T.pri,
            }}
          >
            <Txt s={13} w={800} c="#fff">
              Tocar
            </Txt>
          </Touchable>
        </View>
      </Section>

      {/* playlists da pessoa */}
      <Section top={12}>
        <Card radius={24} padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt s={13.5} w={800} c={T.t1}>
                Suas playlists
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                Montadas por você para cada momento — tocam sozinhas quando o
                sentimento aparece.
              </Txt>
            </View>
          </View>

          {mine.length > 0 ? (
            <View style={{ marginTop: 14, gap: 2 }}>
              {mine.map((p) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: T.bdL,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      backgroundColor: p.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon d={ICONS.playFill} size={15} color="#fff" sw={2} filled />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt s={13.5} w={700} c={T.t1} numberOfLines={1}>
                      {p.name}
                    </Txt>
                    <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
                      {p.why} · {p.tracks.length}{' '}
                      {p.tracks.length === 1 ? 'faixa' : 'faixas'}
                    </Txt>
                  </View>
                  <Touchable
                    onPress={() => playUserPlaylist(p)}
                    accessibilityLabel={'Tocar ' + p.name}
                    style={{ padding: 6 }}
                  >
                    <Icon d={ICONS.playFill} size={16} color={T.t1} sw={2} filled />
                  </Touchable>
                  <Touchable
                    onPress={() => removeMine(p)}
                    accessibilityLabel={'Apagar ' + p.name}
                    style={{ padding: 6 }}
                  >
                    <Icon d={ICONS.trash} size={15} color={DANGER} />
                  </Touchable>
                </View>
              ))}
            </View>
          ) : (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 12 }}>
              Você ainda não montou nenhuma. Uma playlist sua costuma acolher mais
              do que uma sugestão genérica.
            </Txt>
          )}

          <Touchable
            onPress={() => actions.go('playlisteditor')}
            style={{
              marginTop: 14,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: T.priL,
            }}
          >
            <Icon d={ICONS.plus} size={16} color={T.pri} sw={2.2} />
            <Txt s={13} w={800} c={T.pri}>
              Criar playlist de momento
            </Txt>
          </Touchable>

          {spotify.authorized ? (
            <Touchable
              onPress={() => actions.go('spotifyimport')}
              style={{
                marginTop: 8,
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: T.bg,
                borderWidth: 1,
                borderColor: T.bd,
              }}
            >
              <Icon d={ICONS.spotify} size={15} color="#1DB954" />
              <Txt s={13} w={800} c={T.t1}>
                Importar do Spotify
              </Txt>
            </Touchable>
          ) : null}
        </Card>
      </Section>

      {/* lista de playlists */}
      <Section top={12} gap={9}>
        {PLAYLISTS.map((p) => {
          const on = p.id === currentId;
          const sounding = isSounding(p);
          const meta = playlistMeta(p);
          return (
            <View
              key={p.id}
              style={{
                borderRadius: 20,
                padding: 15,
                backgroundColor: on ? hexA(p.c, isDark ? 0.2 : 0.13) : T.surf,
                borderWidth: 1,
                borderColor: on ? p.c : T.bd,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 15,
                    backgroundColor: p.c,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    d={sounding ? ICONS.pause : ICONS.playFill}
                    size={19}
                    color="#fff"
                    sw={2}
                    filled={!sounding}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt s={14.5} w={800} c={T.t1}>
                    {p.name}
                  </Txt>
                  <Txt s={11.5} c={T.t2} style={{ marginTop: 3 }}>
                    {p.why}
                  </Txt>
                  <Txt s={11} c={T.t3} style={{ marginTop: 3 }}>
                    {meta.count} faixas · {meta.minutes} min
                  </Txt>
                </View>
                <Touchable
                  onPress={() => togglePlaylist(p)}
                  accessibilityLabel={(sounding ? 'Pausar ' : 'Tocar ') + p.name}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: T.bd,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    d={sounding ? ICONS.pause : ICONS.playFill}
                    size={16}
                    color={T.t1}
                    sw={2}
                    filled={!sounding}
                  />
                </Touchable>
              </View>

              {/* faixa tocando agora */}
              {on && spotify.connected ? (
                <View style={{ marginTop: 12, gap: 4 }}>
                  <Txt s={12} w={700} c={T.t1} numberOfLines={1}>
                    {spotify.nowPlaying?.trackName ?? 'Carregando…'}
                  </Txt>
                  <Txt s={11} c={T.t3} numberOfLines={1}>
                    {spotify.nowPlaying?.artistName ?? ''}
                  </Txt>
                  <Txt s={10.5} c={T.t3} style={{ marginTop: 4 }}>
                    Tocando no Spotify
                  </Txt>
                </View>
              ) : null}
              {on && !spotify.connected ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {p.tracks.map((t, i) => {
                    const current = i === music.index;
                    return (
                      <View
                        key={t.url}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: current ? p.c : T.bd,
                          }}
                        />
                        <Txt
                          s={12}
                          w={current ? 700 : 400}
                          c={current ? T.t1 : T.t3}
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
                          {t.title}
                        </Txt>
                        <Txt s={11} c={T.t3}>
                          {Math.floor(t.duration / 60)}:
                          {String(t.duration % 60).padStart(2, '0')}
                        </Txt>
                      </View>
                    );
                  })}
                  <Txt s={10.5} c={T.t3} style={{ marginTop: 2 }}>
                    Chopin · gravações da Musopen em domínio público
                  </Txt>
                </View>
              ) : null}
            </View>
          );
        })}
      </Section>

      {/* regras de reprodução automática */}
      {full ? (
        <Section top={12}>
          <Card radius={22} padding={18} style={{ paddingVertical: 6 }}>
            <Txt s={13.5} w={800} c={T.t1} style={{ paddingTop: 14, paddingBottom: 4 }}>
              Tocar sozinho quando…
            </Txt>
            {MUSIC_RULES.map(([key, when, then]) => (
              <View
                key={key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderTopColor: T.bdL,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt s={13.5} w={700} c={T.t1}>
                    {when}
                  </Txt>
                  <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                    toca {then}
                  </Txt>
                </View>
                <Toggle
                  on={!!state.rules[key]}
                  onPress={() =>
                    actions.set((s) => ({ rules: { ...s.rules, [key]: !s.rules[key] } }))
                  }
                />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </ScreenScroll>
  );
}
