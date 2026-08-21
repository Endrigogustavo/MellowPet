import React from 'react';
import { View } from 'react-native';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { ScreenTitle, Touchable, Txt } from '../components/ui';
import { GUIDE, ICONS, INTEGRATIONS } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { hexA } from '../theme/palette';

export function GuideScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="GUIA" title={'Como usar\no MellowPet'} />

      {/* tour interativo */}
      <Section top={0}>
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: T.priL,
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
            <Icon d={ICONS.help} size={20} color={T.pri} sw={1.9} circle />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={14.5} w={800} c={T.t1}>
              Tour interativo
            </Txt>
            <Txt s={11.5} c={T.t2} style={{ marginTop: 2 }}>
              Pop-ups guiando você pelo app
            </Txt>
          </View>
          <Touchable
            onPress={() =>
              actions.set((s) => ({ screen: 'home', coach: 0, navSeq: s.navSeq + 1 }))
            }
            style={{
              paddingVertical: 11,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: T.pri,
            }}
          >
            <Txt s={12.5} w={800} c="#fff">
              Iniciar
            </Txt>
          </Touchable>
        </View>
      </Section>

      {/* cartões do guia */}
      <Section top={12} gap={9}>
        {GUIDE.map(([title, text, target, icon]) => (
          <Touchable
            key={title}
            onPress={() => actions.go(target as Screen)}
            style={{
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              borderRadius: 20,
              padding: 15,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 13,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: T.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={icon} size={19} color={T.pri} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={14} w={800} c={T.t1}>
                {title}
              </Txt>
              <Txt s={12} lh={1.55} c={T.t2} style={{ marginTop: 4 }}>
                {text}
              </Txt>
            </View>
          </Touchable>
        ))}
      </Section>

      {/* integrações */}
      <Section top={14}>
        <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 10 }}>
          Integrações
        </Txt>
        <View style={{ gap: 8 }}>
          {INTEGRATIONS.map(([id, name, sub, color, icon]) => {
            const connected = id === 'spotify' && state.spotify;
            return (
              <Touchable
                key={id}
                onPress={() =>
                  id === 'spotify' ? actions.set((s) => ({ spotify: !s.spotify })) : undefined
                }
                style={{
                  borderRadius: 18,
                  padding: 13,
                  paddingHorizontal: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: connected ? hexA(color, 0.16) : T.surf,
                  borderWidth: 1,
                  borderColor: connected ? color : T.bd,
                }}
              >
                <Icon d={icon} size={20} color={color} />
                <View style={{ flex: 1 }}>
                  <Txt s={13.5} w={800} c={T.t1}>
                    {name}
                  </Txt>
                  <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
                    {sub}
                  </Txt>
                </View>
                <Txt s={11.5} w={800} c={connected ? color : T.t3}>
                  {connected ? 'Conectado' : 'Conectar'}
                </Txt>
              </Touchable>
            );
          })}
        </View>
      </Section>
    </ScreenScroll>
  );
}
