import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Network from 'expo-network';

import {
  cancelDownload,
  deleteModel,
  deviceRamGb,
  downloadModel,
  fitsDevice,
  installedBytes,
  isDownloaded,
  isMellowLlmAvailable,
  LOCAL_MODELS,
  saveLocalChoice,
  type LocalModel,
} from '../chat/localLlm';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';
import { Bar, Card, Chip, ToggleRow, Touchable, Txt } from './ui';

const mb = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/**
 * "Mellow offline": baixar um modelo de IA para conversar sem servidor.
 *
 * É o que mantém o chat vivo quando a API não tem token de IA, e o que permite
 * a escolha "nada sai do aparelho". O download é grande, então só começa em
 * Wi-Fi e pode ser cancelado.
 */
export function OfflineMellowCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [busy, setBusy] = useState<LocalModel['id'] | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);

  useEffect(() => () => cancelDownload(), []);

  if (!isMellowLlmAvailable()) return null;
  const ram = deviceRamGb();

  const choose = async (model: LocalModel) => {
    setError(null);
    if (!isDownloaded(model)) {
      const net = await Network.getNetworkStateAsync().catch(() => null);
      if (net?.type !== Network.NetworkStateType.WIFI) {
        setError(`Conecte-se a um Wi-Fi para baixar (${mb(model.bytes)}).`);
        return;
      }
      setBusy(model.id);
      setProgress(0);
      try {
        await downloadModel(model, setProgress);
      } catch (e) {
        setBusy(null);
        setError((e as Error).message);
        return;
      }
      setBusy(null);
    }
    actions.set({ localModel: model.id });
    await saveLocalChoice(model.id, state.privateMode).catch(() => undefined);
  };

  const remove = async (model: LocalModel) => {
    deleteModel(model);
    if (state.localModel === model.id) {
      actions.set({ localModel: null, privateMode: false });
      await saveLocalChoice(null, false).catch(() => undefined);
    }
    bump((n) => n + 1);
  };

  const togglePrivate = async () => {
    const next = !state.privateMode;
    actions.set({ privateMode: next });
    await saveLocalChoice(state.localModel, next).catch(() => undefined);
  };

  return (
    <Card radius={24} padding={18}>
      <Txt s={12} w={800} c={T.t2}>
        Mellow offline
      </Txt>
      <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
        Opcional. Um modelo de IA que roda no seu celular: o chat usa ele quando o servidor está sem IA — ou
        sempre, se você quiser que nada saia do aparelho. Sem baixar, o app continua leve e o chat funciona
        normalmente pelo servidor.
      </Txt>
      {ram != null ? (
        <Txt s={11} c={T.t3} style={{ marginTop: 6 }}>
          Este celular tem {ram.toFixed(0)} GB de RAM.
        </Txt>
      ) : null}

      <View style={{ gap: 10, marginTop: 12 }}>
        {LOCAL_MODELS.map((m) => {
          const have = isDownloaded(m);
          const active = state.localModel === m.id && have;
          const fits = fitsDevice(m);
          return (
            <View key={m.id} style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: active ? T.pri : T.bd }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt s={13.5} w={800} c={T.t1}>
                  {m.label} · {mb(m.bytes)}
                </Txt>
                {active ? (
                  <Txt s={11} w={800} c={OK}>
                    em uso
                  </Txt>
                ) : null}
              </View>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                {m.description}
              </Txt>
              {busy === m.id ? (
                <View style={{ marginTop: 10 }}>
                  <Bar pct={progress * 100} color={T.pri} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Txt s={11} c={T.t3}>
                      Baixando… {Math.round(progress * 100)}%
                    </Txt>
                    <Touchable onPress={cancelDownload} accessibilityLabel="Cancelar download">
                      <Txt s={11.5} w={800} c={DANGER}>
                        Cancelar
                      </Txt>
                    </Touchable>
                  </View>
                </View>
              ) : !fits && !have ? (
                <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 8 }}>
                  Pede {m.minRamGb} GB de RAM — não recomendado neste celular, para não deixá-lo lento.
                </Txt>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <Chip
                    label={active ? 'Selecionado' : have ? 'Usar este' : 'Baixar e usar'}
                    on={active}
                    onPress={() => {
                      if (!busy) choose(m).catch(() => undefined);
                    }}
                  />
                  {have ? (
                    <Chip
                      label={`Desinstalar · libera ${mb(installedBytes(m))}`}
                      on={false}
                      onPress={() => remove(m).catch(() => undefined)}
                    />
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {error ? (
        <Txt s={12} lh={1.45} c={DANGER} style={{ marginTop: 10 }}>
          {error}
        </Txt>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <ToggleRow
          label="Nada sai do aparelho"
          sub={
            state.localModel
              ? 'O chat responde só com o modelo do celular, mesmo com servidor disponível.'
              : 'Baixe um modelo acima para ativar.'
          }
          on={state.privateMode && state.localModel != null}
          onPress={() => {
            if (state.localModel) togglePrivate().catch(() => undefined);
          }}
        />
      </View>
    </Card>
  );
}
