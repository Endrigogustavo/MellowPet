import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { loadLights, normalizeUrl, saveLights, setLightForEmotion, type LightsConfig } from '../integrations/homeLights';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';
import { Field } from './Field';
import { Card, PrimaryButton, ToggleRow, Touchable, Txt } from './ui';

/** Configuração das luzes (Home Assistant / Hue). Tudo local. */
export function LightsCard() {
  const { state } = useApp();
  const { T } = useTheme();
  const [config, setConfig] = useState<LightsConfig | null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [entity, setEntity] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadLights()
      .then((c) => {
        setConfig(c);
        if (c) {
          setUrl(c.url);
          setEntity(c.entity);
        }
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    const clean = normalizeUrl(url);
    if (!clean || !entity.trim().startsWith('light.') || (!token && !config)) {
      setMsg({ ok: false, text: 'Confira o endereço (http://...), o token e a luz (light.algo).' });
      return;
    }
    const next = { url: clean, token: token || config!.token, entity: entity.trim(), enabled: true };
    try {
      await setLightForEmotion(next, state.observedExpression);
      await saveLights(next);
      setConfig(next);
      setToken('');
      setMsg({ ok: true, text: 'Conectado! A luz já mudou para o seu humor de agora.' });
    } catch (e) {
      setMsg({ ok: false, text: `Não consegui falar com o Home Assistant: ${(e as Error).message}` });
    }
  };

  return (
    <Card radius={24} padding={18}>
      <Txt s={12} w={800} c={T.t2}>
        Luzes da casa
      </Txt>
      <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
        Com o Home Assistant (que também controla Philips Hue), a luz do quarto acompanha o humor: mais quente para
        acolher, mais fria e baixa para acalmar. A conexão vai direto do celular para a sua casa.
      </Txt>
      {config ? (
        <View style={{ marginTop: 12 }}>
          <ToggleRow
            label="Luz acompanha o humor"
            sub={`${config.entity} em ${config.url}`}
            on={config.enabled}
            onPress={() => {
              const next = { ...config, enabled: !config.enabled };
              setConfig(next);
              saveLights(next).catch(() => undefined);
            }}
          />
          <Touchable
            onPress={() => {
              saveLights(null).catch(() => undefined);
              setConfig(null);
              setUrl('');
              setEntity('');
            }}
            accessibilityLabel="Desconectar luzes"
            style={{ marginTop: 8 }}
          >
            <Txt s={12.5} w={800} c={DANGER}>
              Desconectar
            </Txt>
          </Touchable>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Field label="Endereço do Home Assistant" placeholder="http://192.168.0.10:8123" value={url} onChangeText={setUrl} autoCapitalize="none" />
          <Field label="Token de acesso (longa duração)" placeholder="eyJ…" value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry />
          <Field label="Luz" placeholder="light.quarto" value={entity} onChangeText={setEntity} autoCapitalize="none" />
          <PrimaryButton label="Conectar e testar" onPress={() => save().catch(() => undefined)} />
        </View>
      )}
      {msg ? (
        <Txt s={12} lh={1.45} c={msg.ok ? OK : DANGER} style={{ marginTop: 10 }}>
          {msg.text}
        </Txt>
      ) : null}
    </Card>
  );
}
