import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  ALL_DIFFICULT,
  EMOTION_LABEL,
  MIN_READINGS_RANGE,
  WINDOW_RANGE,
  WINDOW_STEP,
  clampRule,
  describeAlertRule,
  formatWindow,
  sensitivityHint,
  validateAlertRule,
  type AlertRuleInput,
} from '../care/careAlertRules';
import type { CaregiverLink } from '../care/careClient';
import { fetchAlertRule, saveAlertRule } from '../care/careUxClient';
import { DEFAULT_ALERT_RULE } from '../care/careUxTypes';
import { useCareResource } from '../care/useCareResource';
import {
  ActionMessage,
  CareGate,
  CareLinkButton,
  CarePillButton,
  ErrorCard,
  LoadingCard,
  UnavailableNotice,
  useCurrentCareLink,
} from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, ToggleRow, Touchable, Txt } from '../components/ui';
import { useTheme } from '../state/AppContext';

export function CareAlertRulesScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="REGRAS DE ALERTA" title={care.name ? `Quando avisar\nsobre ${care.name}` : 'Quando\navisar'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para ajustar os alertas.">
        {(current) => <RuleForm key={current.id} link={current} />}
      </CareGate>
    </ScreenScroll>
  );
}

function Stepper({
  label,
  value,
  display,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  value: string;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
}) {
  const { T } = useTheme();
  const btn = (text: string, onPress: () => void, disabled: boolean, a11y: string) => (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: T.priL, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Txt s={20} w={800} c={T.pri}>
        {text}
      </Txt>
    </Touchable>
  );
  return (
    <View style={{ marginTop: 14 }} accessible={false}>
      <Txt s={12} w={800} c={T.t2}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
        {btn('−', onMinus, minusDisabled, `Diminuir ${label.toLowerCase()}`)}
        <Txt s={16} w={800} c={T.t1} style={{ minWidth: 110, textAlign: 'center' }} accessibilityLabel={`${label}: ${value}`} accessibilityLiveRegion="polite">
          {display}
        </Txt>
        {btn('+', onPlus, plusDisabled, `Aumentar ${label.toLowerCase()}`)}
      </View>
    </View>
  );
}

function RuleForm({ link }: { link: CaregiverLink }) {
  const { T } = useTheme();
  const loaded = useCareResource(link.id, () => fetchAlertRule(link.id));
  const [rule, setRule] = useState<AlertRuleInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  // Preenche só uma vez: um refresh depois não apaga o que está sendo editado.
  useEffect(() => {
    if (!loaded.data || rule) return;
    const { caregiver_link_id: _ignored, ...input } = loaded.data.value.rule;
    setRule(input);
  }, [loaded.data, rule]);

  if (loaded.error && !loaded.data) {
    return (
      <Section top={0}>
        <ErrorCard title="Não foi possível carregar a regra" error={loaded.error} onRetry={loaded.refresh} />
      </Section>
    );
  }
  if (!loaded.data || !rule) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando regra…" />
      </Section>
    );
  }
  const unavailable = loaded.data.unavailable;
  const update = (patch: Partial<AlertRuleInput>) => {
    setMessage(null);
    setRule(clampRule({ ...rule, ...patch }));
  };
  const hint = sensitivityHint(rule, DEFAULT_ALERT_RULE);
  const invalid = validateAlertRule(rule);

  const save = async () => {
    if (saving || unavailable) return;
    if (invalid) {
      setMessage({ text: invalid, tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveAlertRule({ caregiver_link_id: link.id, ...rule });
      setMessage({ text: 'Regra salva. Vale para os próximos sinais.', tone: 'ok' });
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Não foi possível salvar.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {unavailable ? (
        <Section top={0}>
          <UnavailableNotice text={`Regras personalizadas ainda não foram ativadas no servidor. Por enquanto vale a regra padrão: ${describeAlertRule(DEFAULT_ALERT_RULE).toLowerCase()}`} />
        </Section>
      ) : null}
      <Section top={unavailable ? 10 : 0}>
        <Card radius={24} padding={18} style={{ borderColor: T.pri }}>
          <Txt s={11} w={800} c={T.pri} ls={1.1}>
            A REGRA, EM UMA FRASE
          </Txt>
          <Txt s={15} lh={1.5} w={800} c={T.t1} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
            {describeAlertRule(rule)}
          </Txt>
          {hint && rule.enabled ? (
            <Txt s={12} lh={1.45} c={T.t2} style={{ marginTop: 6 }}>
              {hint}
            </Txt>
          ) : null}
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 8 }}>
            Uma “leitura difícil” é um sinal agregado de tristeza, raiva, medo ou aversão — não um diagnóstico. No máximo um alerta a cada 6 horas.
          </Txt>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <ToggleRow
            label="Alertas automáticos"
            sub="Desligar não afeta os pedidos “Preciso de você”, que continuam chegando."
            on={rule.enabled}
            onPress={() => update({ enabled: !rule.enabled })}
          />
          {rule.enabled ? (
            <>
              <Stepper
                label="Leituras difíceis"
                value={`${rule.min_readings}`}
                display={`${rule.min_readings} leituras`}
                onMinus={() => update({ min_readings: rule.min_readings - 1 })}
                onPlus={() => update({ min_readings: rule.min_readings + 1 })}
                minusDisabled={rule.min_readings <= MIN_READINGS_RANGE[0]}
                plusDisabled={rule.min_readings >= MIN_READINGS_RANGE[1]}
              />
              <Stepper
                label="Dentro de"
                value={formatWindow(rule.window_minutes)}
                display={formatWindow(rule.window_minutes)}
                onMinus={() => update({ window_minutes: rule.window_minutes - WINDOW_STEP })}
                onPlus={() => update({ window_minutes: rule.window_minutes + WINDOW_STEP })}
                minusDisabled={rule.window_minutes <= WINDOW_RANGE[0]}
                plusDisabled={rule.window_minutes >= WINDOW_RANGE[1]}
              />
              <Txt s={12} w={800} c={T.t2} style={{ marginTop: 16 }}>
                Contam como difíceis
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {ALL_DIFFICULT.map((emotion) => {
                  const on = rule.emotions.includes(emotion);
                  return (
                    <CarePillButton
                      key={emotion}
                      label={EMOTION_LABEL[emotion]}
                      selected={on}
                      onPress={() => update({ emotions: on ? rule.emotions.filter((e) => e !== emotion) : [...rule.emotions, emotion] })}
                    />
                  );
                })}
              </View>
            </>
          ) : null}
          <PrimaryButton
            label={saving ? 'Salvando…' : 'Salvar regra'}
            disabled={saving || unavailable}
            onPress={save}
            style={{ marginTop: 18 }}
          />
          <ActionMessage message={message} onClose={() => setMessage(null)} />
          <CareLinkButton
            label="Voltar ao padrão (3 em 90 minutos)"
            tone="muted"
            onPress={() => update({ ...DEFAULT_ALERT_RULE })}
            style={{ marginTop: 4 }}
          />
        </Card>
      </Section>
    </>
  );
}
