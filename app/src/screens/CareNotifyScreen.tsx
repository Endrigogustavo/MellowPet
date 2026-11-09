import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { quietSummary, shiftTime } from '../care/careNotifyPrefs';
import { fetchNotificationPrefs, saveNotificationPrefs } from '../care/careUxClient';
import { DEFAULT_NOTIFICATION_PREFS, type CareNotificationPrefs } from '../care/careUxTypes';
import { useCareResource } from '../care/useCareResource';
import {
  ActionMessage,
  CareGate,
  ErrorCard,
  LoadingCard,
  UnavailableNotice,
  useCurrentCareLink,
} from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, ToggleRow, Touchable, Txt } from '../components/ui';
import { useTheme } from '../state/AppContext';

type Prefs = Omit<CareNotificationPrefs, 'caregiver_link_id'>;

export function CareNotifyScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="NOTIFICAÇÕES" title={care.name ? `Avisos sobre\n${care.name}` : 'Seus\navisos'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para ajustar os avisos.">
        {(current) => <NotifyForm key={current.id} link={current} />}
      </CareGate>
    </ScreenScroll>
  );
}

function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { T } = useTheme();
  const btn = (text: string, delta: number, a11y: string) => (
    <Touchable
      onPress={() => onChange(shiftTime(value, delta))}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: T.priL, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt s={20} w={800} c={T.pri}>
        {text}
      </Txt>
    </Touchable>
  );
  return (
    <View style={{ flex: 1, minWidth: 150 }}>
      <Txt s={12} w={800} c={T.t2}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {btn('−', -30, `${label}: 30 minutos mais cedo`)}
        <Txt s={16} w={800} c={T.t1} style={{ minWidth: 52, textAlign: 'center' }} accessibilityLabel={`${label}: ${value}`} accessibilityLiveRegion="polite">
          {value}
        </Txt>
        {btn('+', 30, `${label}: 30 minutos mais tarde`)}
      </View>
    </View>
  );
}

function NotifyForm({ link }: { link: CaregiverLink }) {
  const { T } = useTheme();
  const loaded = useCareResource(link.id, () => fetchNotificationPrefs(link.id));
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    if (!loaded.data || prefs) return;
    const { caregiver_link_id: _ignored, ...rest } = loaded.data.value;
    setPrefs(rest);
  }, [loaded.data, prefs]);

  if (loaded.error && !loaded.data) {
    return (
      <Section top={0}>
        <ErrorCard title="Não foi possível carregar suas preferências" error={loaded.error} onRetry={loaded.refresh} />
      </Section>
    );
  }
  if (!loaded.data || !prefs) {
    return (
      <Section top={0}>
        <LoadingCard text="Carregando preferências…" />
      </Section>
    );
  }
  const unavailable = loaded.data.unavailable;
  const quietOn = !!prefs.quiet_start && !!prefs.quiet_end;
  const set = (patch: Partial<Prefs>) => {
    setMessage(null);
    setPrefs({ ...prefs, ...patch });
  };

  const save = async () => {
    if (saving || unavailable) return;
    if (quietOn && prefs.quiet_start === prefs.quiet_end) {
      setMessage({ text: 'Escolha horários diferentes para o início e o fim do silêncio.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveNotificationPrefs({ caregiver_link_id: link.id, ...prefs });
      setMessage({ text: 'Preferências salvas.', tone: 'ok' });
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
          <UnavailableNotice text="Preferências por pessoa ainda não foram ativadas no servidor. Por enquanto, todos os avisos chegam a qualquer hora." />
        </Section>
      ) : null}
      <Section top={unavailable ? 10 : 0}>
        <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
          <ToggleRow
            label="Pedidos de contato"
            sub="Quando a pessoa tocar em “Preciso de você”. Recomendado manter ligado."
            on={prefs.push_requests}
            onPress={() => set({ push_requests: !prefs.push_requests })}
          />
          <ToggleRow
            label="Alertas de sinais"
            sub="Quando a regra de alerta for atingida. O texto do aviso é neutro, sem detalhes."
            on={prefs.push_alerts}
            onPress={() => set({ push_alerts: !prefs.push_alerts })}
            divider
          />
          <ToggleRow
            label="Resumo semanal"
            sub="Um aviso por semana lembrando de ver o resumo."
            on={prefs.weekly_digest}
            onPress={() => set({ weekly_digest: !prefs.weekly_digest })}
            divider
          />
        </Card>
      </Section>
      <Section>
        <Card radius={24} padding={18}>
          <ToggleRow
            label="Silêncio noturno"
            sub="Segura os avisos à noite para você descansar."
            on={quietOn}
            onPress={() =>
              set(
                quietOn
                  ? { quiet_start: null, quiet_end: null }
                  : { quiet_start: DEFAULT_NOTIFICATION_PREFS.quiet_start, quiet_end: DEFAULT_NOTIFICATION_PREFS.quiet_end }
              )
            }
          />
          {quietOn ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
              <TimeStepper label="Começa" value={prefs.quiet_start!} onChange={(v) => set({ quiet_start: v })} />
              <TimeStepper label="Termina" value={prefs.quiet_end!} onChange={(v) => set({ quiet_end: v })} />
            </View>
          ) : null}
          <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 12 }}>
            {quietSummary(prefs.quiet_start, prefs.quiet_end)}
          </Txt>
          <PrimaryButton label={saving ? 'Salvando…' : 'Salvar preferências'} disabled={saving || unavailable} onPress={save} style={{ marginTop: 16 }} />
          <ActionMessage message={message} onClose={() => setMessage(null)} />
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 10 }}>
            Os avisos também dependem da permissão de notificações do aparelho.
          </Txt>
        </Card>
      </Section>
    </>
  );
}
