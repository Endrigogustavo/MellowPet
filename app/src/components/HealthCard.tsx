import React, { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import MellowHealth, { type HealthDay } from '../../modules/mellow-health';
import { listDetectedEvents } from '../checkins/checkinClient';
import { dayMoodScores, healthInsights, type HealthInsight } from '../insights/integrations';
import { useApp, useTheme } from '../state/AppContext';
import { Card, PrimaryButton, Txt } from './ui';

const DAYS = 21;

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Sono e passos do Health Connect cruzados com o humor. Só leitura; o
 * cruzamento acontece no aparelho e nada disso vai para o servidor.
 */
export function HealthCard() {
  const { state } = useApp();
  const { T } = useTheme();
  const [phase, setPhase] = useState<'checking' | 'unavailable' | 'needs_update' | 'ask' | 'ready'>('checking');
  const [days, setDays] = useState<HealthDay[]>([]);
  const [insights, setInsights] = useState<HealthInsight[]>([]);

  const userId = state.userId;
  const load = useCallback(async () => {
    if (!MellowHealth || !userId) return;
    const d = await MellowHealth.readDays(DAYS);
    setDays(d);
    const events = await listDetectedEvents(userId, Date.now() - DAYS * 24 * 3600 * 1000).catch(() => []);
    const mood = dayMoodScores(events.map((e) => ({ emotion: e.emotion, day: dayKey(e.created_at) })));
    setInsights(healthInsights(d, mood));
    setPhase('ready');
  }, [userId]);

  useEffect(() => {
    if (!MellowHealth) {
      setPhase('unavailable');
      return;
    }
    const status = MellowHealth.status();
    if (status !== 'ok') {
      setPhase(status);
      return;
    }
    MellowHealth.hasPermissions()
      .then((ok) => (ok ? load() : setPhase('ask')))
      .catch(() => setPhase('ask'));
  }, [load]);

  if (phase === 'checking' || phase === 'unavailable') return null;

  const recent = days.slice(-7);
  const sleepDays = recent.filter((d) => d.sleepMinutes);
  const stepDays = recent.filter((d) => d.steps);
  const avgSleep = sleepDays.length ? sleepDays.reduce((a, d) => a + (d.sleepMinutes ?? 0), 0) / sleepDays.length : null;
  const avgSteps = stepDays.length ? stepDays.reduce((a, d) => a + (d.steps ?? 0), 0) / stepDays.length : null;

  return (
    <Card radius={22} padding={16}>
      <Txt s={12} w={800} c={T.t2}>
        Sono, passos e humor
      </Txt>
      {phase === 'needs_update' ? (
        <>
          <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
            Para cruzar seu sono e seus passos com o humor, instale ou atualize o Health Connect.
          </Txt>
          <PrimaryButton
            label="Abrir na Play Store"
            onPress={() => {
              Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => undefined);
            }}
            style={{ marginTop: 12 }}
          />
        </>
      ) : phase === 'ask' ? (
        <>
          <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
            O Mellow pode ler (só ler) sono e passos que seu relógio ou outros apps já registram no Health Connect, e
            mostrar como eles se relacionam com o seu humor. Fica tudo no celular.
          </Txt>
          <PrimaryButton
            label="Conectar Health Connect"
            onPress={() => {
              MellowHealth?.requestPermissions()
                .then((ok) => (ok ? load() : undefined))
                .catch(() => undefined);
            }}
            style={{ marginTop: 12 }}
          />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
            <View>
              <Txt s={20} w={800} c={T.t1}>
                {avgSleep ? `${Math.floor(avgSleep / 60)}h${String(Math.round(avgSleep % 60)).padStart(2, '0')}` : '—'}
              </Txt>
              <Txt s={11} c={T.t3}>
                sono médio (7 dias)
              </Txt>
            </View>
            <View>
              <Txt s={20} w={800} c={T.t1}>
                {avgSteps ? Math.round(avgSteps).toLocaleString('pt-BR') : '—'}
              </Txt>
              <Txt s={11} c={T.t3}>
                passos por dia
              </Txt>
            </View>
          </View>
          {insights.length > 0 ? (
            insights.map((i) => (
              <Txt key={i.metric} s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 10 }}>
                {i.text} ({i.days} dias)
              </Txt>
            ))
          ) : (
            <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 10 }}>
              Ainda sem relação clara entre sono, passos e humor — com mais dias de dados ela aparece (ou não, e tudo
              bem).
            </Txt>
          )}
        </>
      )}
    </Card>
  );
}
