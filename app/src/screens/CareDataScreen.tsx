import React, { useState } from 'react';
import { Share, View } from 'react-native';

import { fetchCareDashboardSummary } from '../care/careClient';
import { formatFreshness, isKnownEmotion, safeInsight, signalColor, signalScore } from '../care/careDashboard';
import { useCareResource } from '../care/useCareResource';
import { CareGate, ErrorCard, LoadingCard, useCurrentCareLink } from '../components/CareStates';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Segmented, Touchable, Txt } from '../components/ui';
import { EMOTIONS } from '../data/emotions';
import { useTheme } from '../state/AppContext';

const PERIODS = [
  { label: '24h', hours: 24 },
  { label: '7 dias', hours: 168 },
  { label: '30 dias', hours: 720 },
];

function sourceLabel(source: string) {
  if (source === 'widget_manual' || source === 'checkin') return 'Informado pela pessoa';
  if (source === 'mobile_v2' || source === 'background_vision') return 'Leitura observada';
  return 'Outra origem';
}

export function CareDataScreen() {
  const { T } = useTheme();
  const care = useCurrentCareLink();
  const [period, setPeriod] = useState(1);
  const cared = care.current?.cared_user_id ?? null;
  const report = useCareResource(cared ? `${cared}:${period}` : null, () =>
    fetchCareDashboardSummary(cared!, PERIODS[period].hours)
  );
  const data = report.data;
  const score = data ? signalScore(data) : null;
  const color = signalColor(score);
  const max = Math.max(1, ...(data?.daily.map((day) => day.count) ?? []));

  const shareReport = () => {
    if (!data || !care.name) return;
    const top = [...data.distribution].sort((a, b) => b.count - a.count)[0];
    const topLabel = top && isKnownEmotion(top.emotion) ? EMOTIONS[top.emotion].label : 'sem predominância';
    Share.share({
      message: `Resumo de cuidado do MellowPet — ${care.name}\nPeríodo: ${PERIODS[period].label}\nLeituras agregadas: ${data.events}\nConfiança média: ${data.mean_confidence}%\nSinal mais frequente: ${topLabel}\n\n${safeInsight(data)}\n\nEste resumo não é diagnóstico e não inclui imagens, conversas ou eventos individuais.`,
    }).catch(() => undefined);
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="EVOLUÇÃO" title={care.name ? `Padrões de\n${care.name}` : 'Relatório de\ncuidado'} />
      <CareGate care={care} emptyText="Conecte uma pessoa para abrir o relatório.">
        {() => (
          <>
            <Section top={0}>
              <Segmented items={PERIODS.map((item) => item.label)} index={period} onChange={setPeriod} />
            </Section>
            {report.error ? (
              <Section>
                <ErrorCard title="Relatório indisponível" error={report.error} onRetry={report.refresh} />
              </Section>
            ) : !data ? (
              <Section>
                <LoadingCard text="Carregando dados agregados…" />
              </Section>
            ) : (
              <>
                <Section>
                  <Card radius={24} padding={19}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Txt s={15} w={800} c={T.t1}>
                          Resumo de sinais
                        </Txt>
                        <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                          {formatFreshness(data.last_event_at)}
                        </Txt>
                      </View>
                      <Txt s={29} w={800} c={color} accessibilityLabel={`Índice de sinais: ${score ?? 'indisponível'}`}>
                        {score ?? '—'}
                      </Txt>
                    </View>
                    <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 12 }}>
                      {safeInsight(data)}
                    </Txt>
                    <Txt s={10.5} c={T.t3} style={{ marginTop: 10 }}>
                      {data.events} leituras agregadas · confiança média {data.mean_confidence}%
                    </Txt>
                    {data.events > 0 ? (
                      <Touchable onPress={shareReport} accessibilityRole="button" style={{ marginTop: 12 }}>
                        <Txt s={12.5} w={800} c={T.pri}>
                          Compartilhar resumo de cuidado
                        </Txt>
                      </Touchable>
                    ) : null}
                  </Card>
                </Section>

                <Section>
                  <Card radius={24} padding={19}>
                    <Txt s={14.5} w={800} c={T.t1}>
                      Cobertura por dia
                    </Txt>
                    <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                      Quantidade de leituras registradas — não representa atividade da pessoa.
                    </Txt>
                    {data.daily.length === 0 ? (
                      <Txt s={12.5} c={T.t3} style={{ marginTop: 12 }}>
                        Sem leituras neste período.
                      </Txt>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 118, marginTop: 16 }}>
                        {data.daily.slice(-14).map((day) => (
                          <View key={day.at} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
                            <Txt s={9} c={T.t3}>
                              {day.count}
                            </Txt>
                            <View
                              style={{
                                width: '100%',
                                height: `${Math.max(5, Math.round((day.count / max) * 76))}%`,
                                borderRadius: 5,
                                backgroundColor: T.pri,
                              }}
                            />
                            <Txt s={8.5} c={T.t3}>
                              {new Date(day.at).toLocaleDateString('pt-BR', { day: '2-digit' })}
                            </Txt>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </Section>

                <Section>
                  <Card radius={24} padding={19}>
                    <Txt s={14.5} w={800} c={T.t1}>
                      Distribuição de sinais
                    </Txt>
                    {data.distribution.length === 0 ? (
                      <Txt s={12.5} c={T.t3} style={{ marginTop: 12 }}>
                        Sem sinais neste período.
                      </Txt>
                    ) : (
                      <View style={{ gap: 10, marginTop: 15 }}>
                        {data.distribution.map((item) => {
                          const pct = data.events ? Math.round((item.count / data.events) * 100) : 0;
                          const emotion = isKnownEmotion(item.emotion) ? EMOTIONS[item.emotion] : null;
                          return (
                            <View key={item.emotion}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Txt s={12.5} c={T.t2}>
                                  {emotion?.label ?? 'Outro sinal'}
                                </Txt>
                                <Txt s={12.5} w={800} c={T.t1}>
                                  {pct}%
                                </Txt>
                              </View>
                              <View style={{ height: 6, borderRadius: 99, marginTop: 5, backgroundColor: T.bdL, overflow: 'hidden' }}>
                                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: emotion?.c ?? T.pri }} />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Card>
                </Section>

                <Section>
                  <Card radius={24} padding={19}>
                    <Txt s={14.5} w={800} c={T.t1}>
                      Origem dos registros
                    </Txt>
                    <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
                      Separar autorrelato de leitura observada evita transformar uma inferência em certeza.
                    </Txt>
                    {data.sources.length === 0 ? (
                      <Txt s={12.5} c={T.t3} style={{ marginTop: 12 }}>
                        Sem registros neste período.
                      </Txt>
                    ) : (
                      <View style={{ marginTop: 12, gap: 7 }}>
                        {data.sources.map((item) => (
                          <View key={item.source} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Txt s={12.5} c={T.t2}>
                              {sourceLabel(item.source)}
                            </Txt>
                            <Txt s={12.5} w={800} c={T.t1}>
                              {item.count}
                            </Txt>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </Section>

                <Section>
                  <Txt s={11.5} lh={1.55} c={T.t3}>
                    Os padrões são temporais e não demonstram causa. Não use esta tela para diagnóstico ou como substituto de
                    conversa e cuidado profissional.
                  </Txt>
                </Section>
              </>
            )}
          </>
        )}
      </CareGate>
    </ScreenScroll>
  );
}
