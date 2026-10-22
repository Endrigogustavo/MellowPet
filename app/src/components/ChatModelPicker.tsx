import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { LOCAL_MODELS, isDownloaded, saveLocalChoice } from '../chat/localLlm';
import { useApp, useTheme } from '../state/AppContext';
import { Chip } from './ui';

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
      <Chip label="☁️ Nuvem" on={cloud} variant="solid" onPress={() => choose(null)} />
      {downloaded.map((m) => (
        <Chip
          key={m.id}
          label={`📱 ${m.label}`}
          on={!cloud && state.localModel === m.id}
          variant="solid"
          onPress={() => choose(m.id)}
        />
      ))}
    </ScrollView>
  );
}
