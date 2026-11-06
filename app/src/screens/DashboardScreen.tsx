import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Segmented, Touchable, Txt } from '../components/ui';
import { ICONS, PERIOD_LABELS, type Period } from '../data/content';
import { fetchDashboardPeriod } from '../dashboard/dashboardClient';
import { subscribeToEmotionEvents } from '../dashboard/aggregate';
import { fetchStreak } from '../dashboard/streak';
import { updateStreakWidget } from '../widgets/widgetBridge';
import { EMOTIONS, FACE_ICON } from '../data/emotions';
import { buildWorstCasePeriod } from '../dev/worstCaseData';
import { useApp, useTheme } from '../state/AppContext';
import { emotionInk, hexA, type Palette } from '../theme/palette';
import { ForecastCard } from '../components/ForecastCard';
import { HealthCard } from '../components/HealthCard';
import { AgendaCard } from '../components/AgendaCard';
import { ReportCard } from '../components/ReportCard';

const RING_C = 2 * Math.PI * 50; // 314.16
const DONUT_C = 2 * Math.PI * 45; // 282.74

function scoreColor(v: number, T: Palette) {
  return v >= 70 ? T.ok : v >= 40 ? T.warn : T.danger;
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
    let lastRefreshStartedAt = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      lastRefreshStartedAt = Date.now();
      fetchDashboardPeriod(state.userId!, state.period)
        .then((period) => {
          if (alive) setLoaded({ key, period });
        })
        .catch(() => {
          if (alive) setLoaded({ key, period: null });
        });
    };
    refresh();
    // Leitura nova chegando com a tela aberta atualiza sozinha, sem esperar
    // o usuário trocar de aba e voltar.
    const unsubscribe = subscribeToEmotionEvents(state.userId, () => {
      if (refreshTimer) return;
      const wait = Math.max(0, 60_000 - (Date.now() - lastRefreshStartedAt));
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (alive) refresh();
      }, wait);
    });
    return () => {
      alive = false;
      if (refreshTimer) clearTimeout(refreshTimer);
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

  const extremePeriod = useMemo(
    () => (state.stressMode === 'extreme' ? buildWorstCasePeriod() : null),
    [state.stressMode]
  );

  const requestKey = state.userId ? `${state.userId}:${state.period}` : null;
  const rawLoading = requestKey !== null && loaded?.key !== requestKey;
  const rawPeriod = requestKey && loaded?.key === requestKey ? loaded.period : null;

  const loading = state.stressMode === 'off' && rawLoading;
  const P =
    state.stressMode === 'empty'
      ? null
      : state.stressMode === 'extreme'
        ? extremePeriod
        : rawPeriod;

  const wbColor = P ? scoreColor(P.wb, T) : T.t3;
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
      <ScreenTitle label="Bem-estar" title="Seus padrões" />

      <Section top={0}>
        <Segmented
          items={PERIOD_LABELS}
          index={state.period}
          onChange={(period) => actions.set({ period })}
        />
      </Section>

      <View style={{ marginHorizontal: 18, marginTop: 14, gap: 12 }}>
        <ForecastCard />
        <HealthCard />
        <AgendaCard />
        <ReportCard />
      </View>

      {/* mapa do mês: check-ins e leituras, dia a dia */}
      <Section top={14}>
        <Touchable
          onPress={() => actions.go('heatmap')}
          accessibilityLabel="Abrir mapa emocional do mês"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 68,
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 22,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 3, flexShrink: 0 }}>
            {(['happy', 'neutral', 'sad', 'happy'] as const).map((k, i) => (
              <View
                key={i}
                style={{ width: 9, height: 22, borderRadius: 3, backgroundColor: EMOTIONS[k].c, opacity: 0.9 }}
              />
            ))}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={14} w={800} c={T.t1}>
              Mapa emocional
            </Txt>
            <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 2 }}>
              O mês em cores, você × a câmera, contextos e sono.
            </Txt>
          </View>
          <Icon d={ICONS.chevron} size={16} color={T.t3} sw={2} />
        </Touchable>
      </Section>

      {!P ? (
        <Section top={20}>
          <Card variant="warm" radius={24} padding={24} style={{ alignItems: 'center', gap: 10 }}>
            {loading ? (
              <ActivityIndicator size="small" color={T.pri} />
            ) : (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: T.priL,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon d={ICONS.heartOutline} size={22} color={T.pri} sw={1.9} />
              </View>
            )}
            <Txt s={15} w={800} c={T.t1} style={{ textAlign: 'center' }}>
              {loading ? 'Carregando suas leituras…' : 'Ainda em construção neste período'}
            </Txt>
            {!loading ? (
              <Txt s={12.5} lh={1.55} c={T.t2} style={{ textAlign: 'center' }}>
                Seus gráficos aparecem aqui assim que houver leituras ou registros suficientes neste recorte. Você pode começar com um check-in rápido.
              </Txt>
            ) : null}
            {!loading ? (
              <Touchable
                onPress={() => actions.go('checkin')}
                accessibilityLabel="Fazer um check-in agora"
                style={{
                  marginTop: 4,
                  minHeight: 44,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  backgroundColor: T.pri,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt s={12.5} w={800} c={T.onPri}>
                  Fazer check-in
                </Txt>
              </Touchable>
            ) : null}
          </Card>
        </Section>
      ) : (
        <>
          {/* índice geral */}
          <Section top={20}>
            <Card radius={24} padding={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ width: 104, height: 104, flexShrink: 0 }}>
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
                  <Txt s={10.5} w={700} c={T.t3}>
                    /100
                  </Txt>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
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
              <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 14 }}>
                Linha de sinais
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 76 }}>
                {dayTimeline.map(([hour, key], i) => (
                  <View
                    key={`${hour}-${i}`}
                    style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}
                  >
                    <View
                      style={{
                        width: '100%',
                        height: key === 'neutral' ? 34 : key === 'happy' ? 62 : 48,
                        borderRadius: 6,
                        backgroundColor: EMOTIONS[key].c,
                      }}
                    />
                    <Txt s={9.5} c={T.t3} numberOfLines={1}>
                      {hour}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </Section>

          {/* gatilhos: correlação de transição de emoção e horário */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={14} w={800} c={T.t1}>
                Padrões temporais
              </Txt>
              <Txt s={12} c={T.t3} style={{ marginTop: 4 }}>
                O que apareceu próximo a uma emoção difícil (correlação, não causa).
              </Txt>
              {P.triggers.length > 0 ? (
                <View style={{ marginTop: 14, gap: 10 }}>
                  {P.triggers.map((trigger, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          marginTop: 7,
                          backgroundColor: T.pri,
                          flexShrink: 0,
                        }}
                      />
                      <Txt s={12.5} lh={1.5} c={T.t2} style={{ flex: 1, minWidth: 0 }}>
                        {trigger}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt s={12.5} c={T.t3} style={{ marginTop: 14 }}>
                  Ainda não há padrões temporais com dados suficientes.
                </Txt>
              )}
            </Card>
          </Section>

          {/* leitura síntese */}
          <Section>
            <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon d={ICONS.heartOutline} size={17} color={T.pri} sw={1.9} />
                <Txt s={13} w={800} c={T.pri}>
                  Síntese do período
                </Txt>
              </View>
              <Txt s={13.5} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
                {P.insight}
              </Txt>
            </View>
          </Section>

          {/* distribuição */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 14 }}>
                Distribuição emocional
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <View style={{ flexShrink: 0 }}>
                  <Svg width={114} height={114} viewBox="0 0 120 120">
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
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
                  {donut.map((d) => (
                    <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View
                        style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: d.color, flexShrink: 0 }}
                      />
                      <Txt s={12.5} c={T.t2} style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
                        {d.name}
                      </Txt>
                      <Txt s={12.5} w={800} c={T.t1} style={{ flexShrink: 0 }}>
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
                  <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 16 }}>
                    Leituras por hora
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 112 }}>
                    {P.bars.map(([hour, value]) => (
                      <View
                        key={hour}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          alignItems: 'center',
                          gap: 6,
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Txt s={9.5} w={700} c={T.t3} numberOfLines={1}>
                          {value}
                        </Txt>
                        <View
                          style={{
                            width: '100%',
                            height: `${Math.round((value / maxBar) * 76)}%`,
                            borderTopLeftRadius: 7,
                            borderTopRightRadius: 7,
                            borderBottomLeftRadius: 3,
                            borderBottomRightRadius: 3,
                            backgroundColor: T.pri,
                          }}
                        />
                        <Txt s={9.5} c={T.t3} numberOfLines={1}>
                          {hour}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </Card>
              </Section>

              <Section style={{ flexDirection: 'row', gap: 8 }}>
                {P.peaks.map(([name, count, color, key]) => {
                  const ink = emotionInk(key, isDark);
                  return (
                    <View
                      key={name}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: 20,
                        padding: 14,
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: isDark ? hexA(color, 0.16) : EMOTIONS[key].l,
                      }}
                    >
                      <Icon d={FACE_ICON[key]} size={22} color={ink} sw={1.9} circle />
                      <Txt s={11.5} w={700} c={T.t2} numberOfLines={1}>
                        {name}
                      </Txt>
                      <Txt s={13.5} w={800} c={ink} numberOfLines={1}>
                        {count}x
                      </Txt>
                    </View>
                  );
                })}
              </Section>
            </>
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}
