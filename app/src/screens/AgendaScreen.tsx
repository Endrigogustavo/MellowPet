import React from 'react';
import { View } from 'react-native';

import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { AGENDA, TEAM } from '../data/content';
import { useTheme } from '../state/AppContext';
import { hexA } from '../theme/palette';

export function AgendaScreen() {
  const { T, isDark } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="AGENDA" title={'O que vem\npela frente'} />

      <Section top={0}>
        <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
          {AGENDA.map(([when, title, sub, color]) => (
            <View
              key={title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                paddingVertical: 15,
                borderTopWidth: 1,
                borderTopColor: T.bdL,
              }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: color,
                  marginTop: 6,
                }}
              />
              <View style={{ flex: 1 }}>
                <Txt s={11} w={800} c={T.t3} ls={0.6} caps>
                  {when}
                </Txt>
                <Txt s={14} w={700} c={T.t1} style={{ marginTop: 4 }}>
                  {title}
                </Txt>
                <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                  {sub}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 14 }}>
            Equipe de cuidado
          </Txt>
          <View style={{ gap: 13 }}>
            {TEAM.map(([name, role, initial, color]) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    backgroundColor: hexA(color, isDark ? 0.3 : 0.2),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt s={14} w={800} c={isDark ? '#FAF6F2' : '#2A1B31'}>
                    {initial}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt s={13.5} w={700} c={T.t1}>
                    {name}
                  </Txt>
                  <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
                    {role}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
          <Touchable
            style={{
              marginTop: 15,
              paddingVertical: 13,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: T.priL,
            }}
          >
            <Txt s={13.5} w={800} c={T.pri}>
              + Convidar profissional
            </Txt>
          </Touchable>
        </Card>
      </Section>
    </ScreenScroll>
  );
}
