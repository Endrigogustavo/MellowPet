import React from 'react';
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/AppContext';
import { useDockInset } from './DockInset';
import { Enter } from './ui';

/**
 * Corpo rolável padrão das telas com barra de abas.
 * Respeita safe areas reais (topo e home indicator) e reserva folga para o dock.
 */
export function ScreenScroll({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { state } = useApp();
  const insets = useSafeAreaInsets();
  const dock = useDockInset();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: Math.max(insets.bottom, 12) + 108 + (dock.height > 0 ? dock.height + 12 : 0),
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Enter seq={state.navSeq} style={style}>
        {children}
      </Enter>
    </ScrollView>
  );
}

/**
 * Bloco com margem lateral consistente (18px) e ritmo de proximidade >= 2x:
 * o espaçamento externo padrão (18px) supera o gap interno dos cartões (8px a 10px).
 */
export function Section({
  children,
  gap = 0,
  top = 18,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  top?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ marginHorizontal: 18, marginTop: top, gap }, style]}>{children}</View>;
}
