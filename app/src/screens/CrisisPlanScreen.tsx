import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '../components/Field';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

/**
 * Plano de segurança (modelo Stanley-Brown): escrito com calma, para ser
 * lido na hora difícil, quando pensar fica pesado. Seis passos, do que a
 * pessoa faz sozinha ao que pede a outros. Fica só no aparelho.
 */
const STEPS = [
  { key: 'sinais', title: '1. Meus sinais de alerta', hint: 'Pensamentos, sensações, situações que mostram que a crise está chegando.' },
  { key: 'sozinho', title: '2. O que eu faço sozinho para me acalmar', hint: 'Respirar com o Mellow, banho, música, caminhar…' },
  { key: 'distrair', title: '3. Pessoas e lugares que me distraem', hint: 'Uma praça, a casa de alguém, um café.' },
  { key: 'pedir', title: '4. Pessoas a quem posso pedir ajuda', hint: 'Nomes e telefones.' },
  {
    key: 'profissionais',
    title: '5. Profissionais e serviços',
    hint: 'Terapeuta, CAPS da região…',
    preset: 'CVV: 188 (24h)\nSAMU: 192\nCAPS mais próximo: ',
  },
  { key: 'seguro', title: '6. Deixar o ambiente seguro', hint: 'O que afastar de perto de mim numa crise, e com quem deixar.' },
  { key: 'razao', title: 'Minha razão para seguir', hint: 'Uma pessoa, um plano, um bicho, uma frase.' },
] as const;

type Plan = Record<(typeof STEPS)[number]['key'], string>;

const KEY = (userId: string) => `mellowpet.crisisplan.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export function CrisisPlanScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const [plan, setPlan] = useState<Plan>(
    () => Object.fromEntries(STEPS.map((s) => [s.key, 'preset' in s ? s.preset : ''])) as Plan
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.userId) return;
    SecureStore.getItemAsync(KEY(state.userId))
      .then((raw) => {
        if (raw) setPlan((p) => ({ ...p, ...(JSON.parse(raw) as Partial<Plan>) }));
      })
      .catch(() => undefined);
  }, [state.userId]);

  const save = () => {
    if (!state.userId) return;
    setSaveError(null);
    SecureStore.setItemAsync(KEY(state.userId), JSON.stringify(plan))
      .then(() => setSaved(true))
      .catch(() => setSaveError('Não foi possível salvar. Tente encurtar algum campo e salve de novo.'));
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="SEGURANÇA" title={'Meu plano\nde crise'} />
      <Section top={0}>
        <Txt s={12.5} lh={1.55} c={T.t2}>
          Escreva num momento calmo. Na hora difícil, é só seguir os passos, um de cada vez. Fica só neste celular.
        </Txt>
      </Section>
      {STEPS.map((step) => (
        <Section key={step.key}>
          <Card radius={22} padding={16}>
            <Field
              label={step.title}
              placeholder={step.hint}
              value={plan[step.key]}
              onChangeText={(t) => {
                setSaved(false);
                setPlan((p) => ({ ...p, [step.key]: t.slice(0, 280) }));
              }}
              multiline
            />
          </Card>
        </Section>
      ))}
      <Section>
        <View>
          <PrimaryButton label={saved ? 'Salvo' : 'Salvar meu plano'} onPress={save} />
          {saveError ? (
            <Txt s={12} c={DANGER} center style={{ marginTop: 8 }} accessibilityRole="alert">
              {saveError}
            </Txt>
          ) : null}
          {saved ? (
            <Txt s={12} c={OK} center style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
              Ele aparece no botão de ajuda, sempre que precisar.
            </Txt>
          ) : null}
        </View>
      </Section>
    </ScreenScroll>
  );
}
