import React, { useState } from 'react';
import { View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { GRANULARITY_LABEL, bucketLabel, describeHistory, historyTrend } from '../care/careHistory';
import { fetchCareHistory } from '../care/careUxClient';
import type { HistoryGranularity } from '../care/careUxTypes';
import { isPaused } from '../care/presenceClient';
import { useCareResource } from '../care/useCareResource';
import { CareGate, CareLinkButton, EmptyCard, ErrorCard, LoadingCard, StaleNotice, UnavailableNotice, useCurrentCareLink } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Segmented, Txt } from '../components/ui';
import { useApp, useTheme } from '../state/AppContext';

const PLEASANT = '#55C38A';
const NEUTRAL = '#B8B3C7';
const DIFFICULT = '#E5717A';
const ORDER: HistoryGranularity[] = ['day', 'week', 'month'];
const SUB: Record<HistoryGranularity, string> = { day: 'últimos 14 dias', week: 'últimas 12 semanas', month: 'últimos 6 meses' };

export function CareHistoryScreen() {
  const care = useCurrentCareLink();
  return (
    <ScreenScroll>
      <ScreenTitle label="HISTÓRICO" title={care.name ? `Como tem sido\npara ${care.name}` : 'Histórico\nde sinais'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para ver o histórico.">
        {(current, name) => <History key={current.id} link={current} name={name} />}
      </CareGate>
    </ScreenScroll>
  );
}

function History({ link, name }: { link: CaregiverLink; name: string }) {
  const { T } = useTheme();
  const { actions } = useApp();
  const [granularity, setGranularity] = useState<HistoryGranularity>('day');
  const cared = link.cared_user_id;
  const paused = isPaused(link);
  const history = useCareResource(cared && !paused ? `${cared}:${granularity}` : null, () => fetchCareHistory(cared!, granularity));

  if (paused) {
    return (
      <Section top={0}>
        <EmptyCard title="Compartilhamento pausado" text={`${name} pausou o compartilhamento. O histórico volta a aparecer quando ela retomar.`} />
      </Section>
    );
  }

  const buckets = history.data?.value ?? null;
  const total = buckets?.reduce((s, b) => s + b.total, 0) ?? 0;
  const max = Math.max(1, ...(buckets ?? []).map((b) => b.total));
  const trend = buckets ? historyTrend(buckets) : null;

  return (
    <>
      <Section top={0}>
        <Segmented items={ORDER.map((g) => GRANULARITY_LABEL[g])} index={ORDER.indexOf(granularity)} onChange={(i) => setGranularity(ORDER[i])} />
      </Section>
      {history.error && !buckets ? (
        <Section>
          <ErrorCard title="Não foi possível carregar o histórico" error={history.error} onRetry={history.refresh} />
        </Section>
      ) : !buckets ? (
        <Section>
          <LoadingCard text="Carregando histórico…" />
        </Section>
      ) : (
        <>
          {history.error ? (
            <Section>
              <StaleNotice at={history.updatedAt} onRetry={history.refresh} />
            </Section>
          ) : null}
          {history.data?.unavailable ? (
            <Section>
              <UnavailableNotice text="Histórico completo ainda não ativado no servidor: mostrando até 90 dias, com dias contados em horário UTC." />
            </Section>
          ) : null}
          <Section>
            <Card radius={24} padding={18}>
              <Txt s={15} w={800} c={T.t1}>
                Humor por {GRANULARITY_LABEL[granularity].toLowerCase()} · {SUB[granularity]}
              </Txt>
              {total === 0 ? (
                <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 10 }}>
                  Sem leituras neste período. Pouco dado não quer dizer que algo esteja bem ou mal — talvez valha um check-in.
                </Txt>
              ) : (
                <>
                  <View
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={describeHistory(buckets, granularity)}
                    style={{ flexDirection: 'row', alignItems: 'flex-end', gap: buckets.length > 10 ? 3 : 6, height: 130, marginTop: 14 }}
                  >
                    {buckets.map((b) => {
                      const height = b.total === 0 ? 4 : Math.max(14, Math.round((b.total / max) * 104));
                      return (
                        <View key={b.bucket} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 }}>
                          <View style={{ width: '100%', height, borderRadius: 5, overflow: 'hidden', backgroundColor: T.bdL }}>
                            {b.total > 0 ? (
                              <>
                                <View style={{ flex: b.difficult, backgroundColor: DIFFICULT }} />
                                <View style={{ flex: b.neutral, backgroundColor: NEUTRAL }} />
                                <View style={{ flex: b.pleasant, backgroundColor: PLEASANT }} />
                              </>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }} importantForAccessibility="no-hide-descendants">
                    <Txt s={11} c={T.t3}>{bucketLabel(buckets[0].bucket, granularity)}</Txt>
                    <Txt s={11} c={T.t3}>{bucketLabel(buckets[buckets.length - 1].bucket, granularity)}</Txt>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                    {[
                      [PLEASANT, 'agradável'],
                      [NEUTRAL, 'neutro'],
                      [DIFFICULT, 'difícil'],
                    ].map(([color, label]) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                        <Txt s={11} c={T.t3}>{label}</Txt>
                      </View>
                    ))}
                    <Txt s={11} c={T.t3}>· altura = quantidade de leituras</Txt>
                  </View>
                  <Txt s={12} c={T.t3} style={{ marginTop: 10 }}>
                    {total} leituras agregadas no período.
                  </Txt>
                </>
              )}
            </Card>
          </Section>
          {trend && total > 0 ? (
            <Section>
              <Card radius={22} padding={16}>
                <Txt s={13.5} w={800} c={T.t1}>Tendência</Txt>
                <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>{trend.text}</Txt>
                <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 8 }}>
                  Tendência de sinais agregados, não diagnóstico. Use como contexto para conversar.
                </Txt>
              </Card>
            </Section>
          ) : null}
          <Section>
            <CareLinkButton label="Anotar algo sobre um destes dias" onPress={() => actions.go('carenotes')} />
          </Section>
        </>
      )}
    </>
  );
}
