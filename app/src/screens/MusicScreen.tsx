import React from 'react';
import { View } from 'react-native';

import { useMusic } from '../audio/MusicPlayer';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Toggle, Touchable, Txt } from '../components/ui';
import { EMO_PLAYLIST, ICONS, MUSIC_RULES, PLAYLISTS, playlistMeta } from '../data/content';
import { FACE_ICON } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { hexA } from '../theme/palette';

export function MusicScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full, emo, emoColor, emoLight } = useTheme();
  const music = useMusic();

  const suggested =
    PLAYLISTS.find((p) => p.id === EMO_PLAYLIST[state.observedExpression]) ?? PLAYLISTS[0];
  const currentId = music.playlist?.id ?? null;

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
            <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
              Toca as playlists que você escolher
            </Txt>
          </View>
          <Touchable
            onPress={() => actions.set((s) => ({ spotify: !s.spotify }))}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderRadius: 999,
              backgroundColor: state.spotify ? T.bg : '#1DB954',
            }}
          >
            <Txt s={12} w={800} c={state.spotify ? T.t2 : '#fff'}>
              {state.spotify ? 'Desconectar' : 'Conectar Spotify'}
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
              {suggested.name}
            </Txt>
          </View>
          <Touchable
            onPress={() => music.start(suggested.id)}
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

      {/* lista de playlists */}
      <Section top={12} gap={9}>
        {PLAYLISTS.map((p) => {
          const on = p.id === currentId;
          const sounding = on && music.isPlaying;
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
                  onPress={() => music.toggle(p.id)}
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

              {/* faixas da playlist tocando */}
              {on ? (
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
