import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StressMode } from '../dev/worstCaseData';
import { useApp, useTheme } from '../state/AppContext';
import { hexA } from '../theme/palette';
import { Touchable, Txt } from './ui';

const MODES: { id: StressMode; label: string }[] = [
  { id: 'off', label: 'Dados reais' },
  { id: 'empty', label: 'Vazio' },
  { id: 'extreme', label: 'Pior caso' },
];

/**
 * Seletor de estresse (`break-ui`) visível apenas em desenvolvimento (`__DEV__`).
 * Permite inspecionar cada tela com dados normais, listas zeradas ou strings/volumes extremos.
 */
export function DevStressToggle() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  if (!__DEV__) return null;

  const active = state.stressMode !== 'off';

  const bottomOffset = Math.max(insets.bottom, 10) + 84;

  if (!open) {
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          left: 14,
          zIndex: 80,
        }}
      >
        <Touchable
          onPress={() => setOpen(true)}
          accessibilityLabel="Abrir seletor de dados de teste (Dados reais, Vazio ou Pior caso)"
          style={{
            minHeight: 44,
            minWidth: 44,
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: active ? T.pri : hexA(T.surf, 0.92),
            borderWidth: 1,
            borderColor: active ? T.pri : T.bd,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: T.shadow,
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Txt s={11.5} w={800} c={active ? T.onPri : T.t2}>
            {state.stressMode === 'empty'
              ? 'QA · Vazio'
              : state.stressMode === 'extreme'
                ? 'QA · Pior caso'
                : 'QA'}
          </Txt>
        </Touchable>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 14,
        right: 14,
        zIndex: 80,
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          padding: 5,
          borderRadius: 999,
          backgroundColor: T.surf,
          borderWidth: 1,
          borderColor: T.bd,
          shadowColor: T.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        {MODES.map((m) => {
          const sel = state.stressMode === m.id;
          return (
            <Touchable
              key={m.id}
              onPress={() => actions.setStressMode(m.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`Modo de dados: ${m.label}`}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: sel ? T.pri : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt s={12} w={800} c={sel ? T.onPri : T.t2}>
                {m.label}
              </Txt>
            </Touchable>
          );
        })}
        <Touchable
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar seletor de dados de teste"
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt s={14} w={800} c={T.t3}>
            ×
          </Txt>
        </Touchable>
      </View>
    </View>
  );
}
