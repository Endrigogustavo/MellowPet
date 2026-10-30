import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { LOCAL_MODELS, isDownloaded, saveLocalChoice } from '../chat/localLlm';
import { useApp, useTheme } from '../state/AppContext';
import { EXTRA_ICONS } from '../data/content';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

/**
 * Qual "cérebro" responde no chat. "Nuvem" vai ao servidor (e usa o modelo do
 * aparelho como reserva se o servidor estiver sem IA); "Leve"/"Melhor" forçam
 * o modelo no aparelho — nada sai do celular. Modelos só aparecem depois de
 * baixados (Ajustes → Mellow offline).
 */
export function ChatModelPicker() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  // Checa o disco uma vez por abertura do chat (download acontece em Ajustes).
  const downloaded = useMemo(() => LOCAL_MODELS.filter(isDownloaded), []);
  if (downloaded.length === 0) return null;

  const cloud = !state.privateMode;
  const choose = (modelId: (typeof LOCAL_MODELS)[number]['id'] | null) => {
    const privateMode = modelId !== null;
    const localModel = modelId ?? state.localModel ?? downloaded[0].id;
    actions.set({ privateMode, localModel });
    saveLocalChoice(localModel, privateMode).catch(() => undefined);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: T.bd }}
    >
      <ModelChip icon={EXTRA_ICONS.cloud} label="Nuvem" on={cloud} onPress={() => choose(null)} />
      {downloaded.map((m) => (
        <ModelChip
          key={m.id}
          icon={EXTRA_ICONS.phone}
          label={m.label}
          on={!cloud && state.localModel === m.id}
          onPress={() => choose(m.id)}
        />
      ))}
    </ScrollView>
  );
}

function ModelChip({ icon, label, on, onPress }: { icon: string; label: string; on: boolean; onPress: () => void }) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={`Responder com ${label}`}
      accessibilityState={{ selected: on }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: on ? T.pri : T.chipBd,
        backgroundColor: on ? T.pri : T.chipBg,
      }}
    >
      <Icon d={icon} size={15} color={on ? T.onPri : T.t2} sw={1.9} />
      <Txt s={12.5} w={700} c={on ? T.onPri : T.t2}>
        {label}
      </Txt>
    </Touchable>
  );
}
