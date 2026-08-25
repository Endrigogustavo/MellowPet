import React from 'react';
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/AppContext';
import { useDockInset } from './DockInset';
import { Enter } from './ui';

/**
 * Corpo rolável padrão das telas com barra de abas.
 * Reproduz o `padding: 70px 0 108px` do design usando as safe areas reais.
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
  // O mini-player flutua sobre o conteúdo; sem este espaço as últimas linhas
  // ficam embaixo dele e o toque vai para o dock.
  const dock = useDockInset();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 104 + (dock.height > 0 ? dock.height + 8 : 0),
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

/** Bloco com a margem lateral de 16px usada em quase todos os cartões. */
export function Section({
  children,
  gap = 0,
  top = 10,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  top?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginHorizontal: 16, marginTop: top, gap }, style]}>{children}</View>
  );
}
