import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS, TAB_ICONS } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { hapticTap } from '../theme/haptics';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

const USER_TABS: [Screen, string][] = [
  ['home', 'Mellow'],
  ['tools', 'Cuidar'],
  ['routine', 'Rotina'],
  ['music', 'Sons'],
  ['dashboard', 'Padrões'],
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
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 8,
        paddingHorizontal: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        borderTopWidth: 1,
        borderTopColor: T.bdL,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        overflow: 'hidden',
      }}
    >
      <BlurView
        intensity={24}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: T.tabBg }]} />

      {tabs.map(([key, label]) => {
        const on = state.screen === key;
        return (
          <Touchable
            key={key}
            onPress={() => {
              hapticTap();
              actions.goTab(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: on ? T.priL : 'transparent',
            }}
          >
            <Icon d={TAB_ICONS[key]} size={20} color={on ? T.pri : T.t3} sw={on ? 2.1 : 1.8} />
            <Txt s={11} w={on ? 800 : 600} c={on ? T.pri : T.t3} numberOfLines={1}>
              {label}
            </Txt>
          </Touchable>
        );
      })}

      <Touchable
        onPress={() => {
          hapticTap();
          actions.go('chat');
        }}
        accessibilityRole="button"
        accessibilityLabel="Conversar com o Mellow"
        style={{
          width: 46,
          height: 46,
          marginLeft: 4,
          borderRadius: 999,
          backgroundColor: T.pri,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: T.shadow,
          shadowOpacity: isDark ? 0.28 : 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        }}
      >
        <Icon d={ICONS.chat} size={19} color={T.onPri} sw={2} />
      </Touchable>
    </View>
  );
}
