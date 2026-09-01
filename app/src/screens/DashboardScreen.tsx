import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Segmented, Txt } from '../components/ui';
import { ICONS, PERIOD_LABELS, type Period } from '../data/content';
import { fetchDashboardPeriod } from '../dashboard/dashboardClient';
import { subscribeToEmotionEvents } from '../dashboard/aggregate';
import { fetchStreak } from '../dashboard/streak';
import { updateStreakWidget } from '../widgets/widgetBridge';
import { EMOTIONS, FACE_ICON } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN, hexA } from '../theme/palette';

const RING_C = 2 * Math.PI * 50; // 314.16
const DONUT_C = 2 * Math.PI * 45; // 282.74

function scoreColor(v: number) {
  return v >= 70 ? OK : v >= 40 ? WARN : DANGER;
}

export function DashboardScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();

  // null = ainda buscando ou sem leituras reais nesse recorte — a tela
  // mostra um estado vazio de verdade, nunca um exemplo fabricado.
  const [loaded, setLoaded] = useState<{ key: string; period: Period | null } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!state.userId) return;
    const key = `${state.userId}:${state.period}`;
    setLoaded(null);
    const refresh = () =>
      fetchDashboardPeriod(state.userId!, state.period)
        .then((period) => {
          if (alive) setLoaded({ key, period });
        })
        .catch(() => {
          if (alive) setLoaded({ key, period: null });
        });
    refresh();
    // Leitura nova chegando com a tela aberta atualiza sozinha, sem esperar
    // o usuário trocar de aba e voltar.
    const unsubscribe = subscribeToEmotionEvents(state.userId, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [state.userId, state.period]);

  // Widget "Sequência" — independe do recorte escolhido na tela, por isso
  // fica num efeito próprio, preso só ao usuário.
  useEffect(() => {
    if (!state.userId) return;
    fetchStreak(state.userId)
      .then(({ days, week }) => updateStreakWidget(days, week))
      .catch(() => undefined);
  }, [state.userId]);

  const requestKey = state.userId ? `${state.userId}:${state.period}` : null;
  const loading = requestKey !== null && loaded?.key !== requestKey;
  const P = requestKey && loaded?.key === requestKey ? loaded.period : null;

  const wbColor = P ? scoreColor(P.wb) : T.t3;
  const dayTimeline = P?.timeline ?? [];

  // Fatias do donut: cada uma começa onde a soma das anteriores parou.
  const donut = (P?.dist ?? []).map(([name, pct, color], i) => {
    const before = (P?.dist ?? []).slice(0, i).reduce((sum, d) => sum + d[1], 0);
    return {
      name,
      pct,
      color,
      dash: (pct / 100) * DONUT_C,
      offset: -(before / 100) * DONUT_C,
    };
  });

  const maxBar = Math.max(1, ...(P?.bars ?? []).map((b) => b[1]));

  return (
    <ScreenScroll>
      <ScreenTitle label="BEM-ESTAR" title="Seus padrões" />

      <Section top={0} style={{ marginBottom: 12 }}>
        <Segmented
          items={PERIOD_LABELS}
          index={state.period}
          onChange={(period) => actions.set({ period })}
        />
      </Section>

      {!P ? (
        <Section top={0}>
          <Card radius={24} padding={22} style={{ alignItems: 'center', gap: 8 }}>
            {loading ? (
              <ActivityIndicator size="small" color={T.pri} />
            ) : (
              <Icon d={ICONS.robot} size={26} color={T.t3} />
            )}
            <Txt s={14.5} w={800} c={T.t1} style={{ textAlign: 'center' }}>
              {loading ? 'Carregando suas leituras…' : 'Ainda não há leituras suficientes'}
            </Txt>
            {!loading ? (
              <Txt s={12.5} lh={1.55} c={T.t3} style={{ textAlign: 'center' }}>
                Seus padrões aparecem aqui assim que o Mellow tiver leituras reais registradas
                nesse período.
              </Txt>
            ) : null}
          </Card>
        </Section>
      ) : (
        <>
          {/* índice geral */}
          <Section top={0}>
            <Card radius={24} padding={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ width: 104, height: 104 }}>
                <Svg width={104} height={104} viewBox="0 0 120 120">
                  <G rotation={-90} origin="60, 60">
                    <Circle cx={60} cy={60} r={50} fill="none" stroke={T.bdL} strokeWidth={11} />
                    <Circle
                      cx={60}
                      cy={60}
                      r={50}
                      fill="none"
                      stroke={wbColor}
                      strokeWidth={11}
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C * (1 - P.wb / 100)}
                    />
                  </G>
                </Svg>
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt s={29} w={800} c={wbColor} ls={-1} lh={1}>
                    {P.wb}
                  </Txt>
                  <Txt s={10} w={700} c={T.t3}>
                    /100
                  </Txt>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Txt s={15} w={800} c={T.t1}>
                  Índice de bem-estar
                </Txt>
                <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
                  {P.events.toLocaleString('pt-BR')} leituras nas últimas {P.label}.
                </Txt>
              </View>
            </Card>
          </Section>

          {/* linha do dia */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 14 }}>
                Linha de sinais
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 76 }}>
                {dayTimeline.map(([hour, key], i) => (
                  <View
                    key={`${hour}-${i}`}
                    style={{ flex: 1, alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}
                  >
                    <View
                      style={{
                        width: '100%',
                        height: key === 'neutral' ? 34 : key === 'happy' ? 62 : 48,
                        borderRadius: 6,
                        backgroundColor: EMOTIONS[key].c,
                      }}
                    />
                    <Txt s={9.5} c={T.t3}>
                      {hour}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </Section>

          {/* gatilhos — correlação de transição de emoção e horário, ver
              triggerInsights em dashboard/aggregate.ts. */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={13.5} w={800} c={T.t1}>
                Padrões temporais
              </Txt>
              <Txt s={11.5} c={T.t3} style={{ marginTop: 4 }}>
                O que apareceu próximo a uma emoção difícil — não indica causa
              </Txt>
              {P.triggers.length > 0 ? (
                <View style={{ marginTop: 13, gap: 10 }}>
                  {P.triggers.map((trigger, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          marginTop: 6,
                          backgroundColor: T.pri,
                        }}
                      />
                      <Txt s={12.5} lh={1.5} c={T.t2} style={{ flex: 1 }}>
                        {trigger}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt s={12.5} c={T.t3} style={{ marginTop: 15 }}>
                  Ainda não há padrões temporais com dados suficientes.
                </Txt>
              )}
            </Card>
          </Section>

          {/* insight */}
          <Section>
            <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon d={ICONS.robot} size={17} color={T.pri} sw={1.9} />
                <Txt s={13} w={800} c={T.pri}>
                  Insight da IA
                </Txt>
              </View>
              <Txt s={13.5} lh={1.6} c={T.t2} style={{ marginTop: 9 }}>
                {P.insight}
              </Txt>
            </View>
          </Section>

          {/* distribuição */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 14 }}>
                Distribuição emocional
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Svg width={118} height={118} viewBox="0 0 120 120">
                  <G rotation={-90} origin="60, 60">
                    <Circle cx={60} cy={60} r={45} fill="none" stroke={T.bdL} strokeWidth={16} />
                    {donut.map((d) => (
                      <Circle
                        key={d.name}
                        cx={60}
                        cy={60}
                        r={45}
                        fill="none"
                        stroke={d.color}
                        strokeWidth={16}
                        strokeDasharray={`${d.dash} ${DONUT_C - d.dash}`}
                        strokeDashoffset={d.offset}
                      />
                    ))}
                  </G>
                </Svg>
                <View style={{ flex: 1, gap: 9 }}>
                  {donut.map((d) => (
                    <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View
                        style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: d.color }}
                      />
                      <Txt s={12.5} c={T.t2} style={{ flex: 1 }}>
                        {d.name}
                      </Txt>
                      <Txt s={12.5} w={800} c={T.t1}>
                        {d.pct}%
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </Section>

          {full ? (
            <>
              <Section>
                <Card radius={24} padding={20}>
                  <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 16 }}>
                    Leituras por hora
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 112 }}>
                    {P.bars.map(([hour, value]) => (
                      <View
                        key={hour}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          gap: 7,
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Txt s={9.5} w={700} c={T.t3}>
                          {value}
                        </Txt>
                        <View
                          style={{
                            width: '100%',
                            height: `${Math.round((value / maxBar) * 78)}%`,
                            borderTopLeftRadius: 7,
                            borderTopRightRadius: 7,
                            borderBottomLeftRadius: 3,
                            borderBottomRightRadius: 3,
                            backgroundColor: T.pri,
                          }}
                        />
                        <Txt s={9.5} c={T.t3}>
                          {hour}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </Card>
              </Section>

              <Section style={{ flexDirection: 'row', gap: 8 }}>
                {P.peaks.map(([name, count, color, key]) => (
                  <View
                    key={name}
                    style={{
                      flex: 1,
                      borderRadius: 20,
                      padding: 14,
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: isDark ? hexA(color, 0.16) : EMOTIONS[key].l,
                    }}
                  >
                    <Icon d={FACE_ICON[key]} size={22} color={color} sw={1.9} circle />
                    <Txt s={11.5} w={600} c={T.t2}>
                      {name}
                    </Txt>
                    <Txt s={13} w={800} c={color}>
                      {count}x
                    </Txt>
                  </View>
                ))}
              </Section>
            </>
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}
