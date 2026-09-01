import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS, TAB_ICONS } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

const USER_TABS: [Screen, string][] = [
  ['home', 'Home'],
  ['tools', 'Ferramentas'],
  ['routine', 'Rotina'],
  ['music', 'Música'],
  ['dashboard', 'Bem-estar'],
];

const CARE_TABS: [Screen, string][] = [
  ['care', 'Painel'],
  ['carealerts', 'Alertas'],
  ['dashboard', 'Dados'],
  ['agenda', 'Agenda'],
  ['caretools', 'Mais'],
];

export function TabBar() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs = state.role === 'care' ? CARE_TABS : USER_TABS;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 9,
        paddingHorizontal: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        borderTopWidth: 1,
        borderTopColor: T.bd,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        overflow: 'hidden',
      }}
    >
      <BlurView
        intensity={28}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: T.tabBg }]} />

      {tabs.map(([key, label]) => {
        const on = state.screen === key;
        return (
          <Touchable
            key={key}
            onPress={() => actions.go(key)}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: 7,
              borderRadius: 14,
            }}
          >
            <Icon d={TAB_ICONS[key]} size={21} color={on ? T.pri : T.t3} sw={1.9} />
            <Txt s={9.5} w={700} c={on ? T.pri : T.t3}>
              {label}
            </Txt>
          </Touchable>
        );
      })}

      <Touchable
        onPress={() => actions.go('chat')}
        accessibilityLabel="Conversar com o Mellow"
        style={{
          width: 46,
          height: 46,
          marginLeft: 3,
          borderRadius: 999,
          backgroundColor: T.pri,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: T.pri,
          shadowOpacity: 0.34,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Icon d={ICONS.chat} size={20} color="#fff" sw={2} />
      </Touchable>
    </View>
  );
}
