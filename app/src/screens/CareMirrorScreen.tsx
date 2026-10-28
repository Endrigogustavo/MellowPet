import React from 'react';
import { View } from 'react-native';

import { fetchCareDashboardSummary, listCareAlerts } from '../care/careClient';
import { formatFreshness, safeInsight, signalColor, signalScore } from '../care/careDashboard';
import { useCareResource } from '../care/useCareResource';
import { ValenceTrend } from '../components/CarePresence';
import { ErrorCard, LoadingCard } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, ScreenTitle, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';

/**
 * "O que meu cuidador vê": a mesma consulta e o mesmo texto do painel do
 * cuidador, com os seus próprios dados. Transparência total — nada aparece
 * para o cuidador que você não possa ver aqui primeiro.
 */
export function CareMirrorScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const userId = state.userId;
  const view = useCareResource(userId, async () => {
    const [summary, alerts] = await Promise.all([fetchCareDashboardSummary(userId!, 24 * 7), listCareAlerts(userId!)]);
    return { summary, alerts: alerts.filter((a) => a.status !== 'resolved') };
  });

  return (
    <ScreenScroll>
      <ScreenTitle label="TRANSPARÊNCIA" title={'O que meu\ncuidador vê'} />
      <Section top={0}>
        <Txt s={12.5} lh={1.55} c={T.t2}>
          Exatamente o painel do seu cuidador, com os mesmos números e o mesmo texto. Ele não vê suas conversas, fotos,
          anotações de check-in nem leituras uma a uma.
        </Txt>
      </Section>
      {view.error ? (
        <Section>
          <ErrorCard title="Não foi possível montar a prévia" error={view.error} onRetry={view.refresh} />
        </Section>
      ) : !view.data ? (
        <Section>
          <LoadingCard text="Montando a prévia…" />
        </Section>
      ) : (
        (() => {
          const { summary, alerts } = view.data;
          const score = signalScore(summary);
          const color = signalColor(score);
          return (
            <>
              <Section>
                <Card radius={24} padding={18}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt s={15} w={800} c={T.t1}>
                        Resumo de sinais
                      </Txt>
                      <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                        {formatFreshness(summary.last_event_at)}
                      </Txt>
                    </View>
                    <Txt s={24} w={800} c={color}>
                      {score ?? '—'}
                    </Txt>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Bar pct={score ?? 0} color={color} height={7} />
                  </View>
                  <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 12 }}>
                    {safeInsight(summary)}
                  </Txt>
                </Card>
              </Section>
              <Section>
                <Card radius={24} padding={18}>
                  <Txt s={15} w={800} c={T.t1}>
                    Como foram os últimos 7 dias
                  </Txt>
                  <ValenceTrend daily={summary.daily} />
                </Card>
              </Section>
              <Section>
                <Card radius={24} padding={18}>
                  <Txt s={15} w={800} c={T.t1}>
                    Alertas abertos: {alerts.length}
                  </Txt>
                  <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
                    {alerts.length === 0
                      ? 'Nenhum alerta aparece para seu cuidador agora.'
                      : 'Seu cuidador vê o título destes alertas: ' + alerts.map((a) => `“${a.title}”`).join(', ') + '.'}
                  </Txt>
                </Card>
              </Section>
            </>
          );
        })()
      )}
    </ScreenScroll>
  );
}
