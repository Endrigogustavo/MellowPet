import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, PrimaryButton, ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import {
  CHECKIN_TAGS,
  listCheckins,
  listDetectedEvents,
  type Checkin,
  type DetectedRow,
} from '../checkins/checkinClient';
import {
  dailyMoods,
  dayKey,
  emotionLabel,
  MIN_SAMPLES,
  perceptionAgreement,
  sleepPattern,
  tagPatterns,
  type DayMood,
} from '../checkins/checkinInsights';
import { ICONS } from '../data/content';
import { EMOTIONS, FACE_ICON, type EmotionKey } from '../data/emotions';
import { buildWorstCaseCheckins } from '../dev/worstCaseData';
import { useApp, useTheme } from '../state/AppContext';
import { emotionInk, hexA } from '../theme/palette';

/** Quanto histórico carregar de uma vez. Três meses cobre a navegação sem
 * uma chamada por mês; mais que isso é peso sem uso. */
const HISTORY_DAYS = 92;
const DAY_MS = 24 * 3_600_000;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const LEGEND: EmotionKey[] = ['happy', 'neutral', 'surprised', 'sad', 'fearful', 'angry', 'disgusted'];

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function DayCell({
  date,
  mood,
  size,
  selected,
  isToday,
  onPress,
}: {
  date: Date;
  mood: DayMood | undefined;
  size: number;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const { T, isDark } = useTheme();
  const color = mood ? EMOTIONS[mood.emotion].c : null;
  const ink = mood ? emotionInk(mood.emotion, isDark) : T.t2;
  // Leitura declarada (check-in) tem preenchimento mais presente e borda sutil da emoção.
  const bg = color
    ? hexA(color, mood!.source === 'checkin' ? (isDark ? 0.28 : 0.34) : isDark ? 0.12 : 0.16)
    : T.surfWarm;
  const fg = mood && mood.source === 'checkin' ? ink : T.t2;
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={`${date.getDate()} de ${MONTHS[date.getMonth()]}${mood ? `, ${emotionLabel(mood.emotion)}` : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : isToday ? 1.5 : mood?.source === 'checkin' ? 1 : 0,
        borderColor: selected ? T.t1 : isToday ? T.pri : color ? hexA(color, 0.7) : 'transparent',
      }}
    >
      <Txt s={12} w={800} c={fg}>
        {date.getDate()}
      </Txt>
    </Touchable>
  );
}

export function HeatmapScreen() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();

  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(dayKey(today));

  const [rawCheckins, setCheckins] = useState<Checkin[]>([]);
  const [rawDetected, setDetected] = useState<DetectedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!state.userId) return;
    setLoading(true);
    setError(null);
    const since = Date.now() - HISTORY_DAYS * DAY_MS;
    Promise.all([listCheckins(state.userId, since), listDetectedEvents(state.userId, since)])
      .then(([c, d]) => {
        setCheckins(c);
        setDetected(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [state.userId]);

  useEffect(load, [load]);

  const checkins = useMemo<Checkin[]>(() => {
    if (state.stressMode === 'empty') return [];
    if (state.stressMode === 'extreme') return buildWorstCaseCheckins();
    return rawCheckins;
  }, [rawCheckins, state.stressMode]);

  const detected = useMemo(() => {
    if (state.stressMode === 'empty') return [];
    return rawDetected;
  }, [rawDetected, state.stressMode]);

  const moods = useMemo(() => dailyMoods(checkins, detected), [checkins, detected]);
  const agreement = useMemo(() => perceptionAgreement(checkins), [checkins]);
  const tags = useMemo(() => tagPatterns(checkins), [checkins]);
  const sleep = useMemo(() => sleepPattern(checkins), [checkins]);

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const cell = useColumnWidth(7, 6, 16 + 20);

  const earliest = new Date(Date.now() - HISTORY_DAYS * DAY_MS);
  const canGoBack = cursor.y > earliest.getFullYear() || (cursor.y === earliest.getFullYear() && cursor.m > earliest.getMonth());
  const canGoForward = cursor.y < today.getFullYear() || (cursor.y === today.getFullYear() && cursor.m < today.getMonth());
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const selectedCheckins = selected ? checkins.filter((c) => dayKey(c.createdAt) === selected) : [];
  const selectedMood = selected ? moods.get(selected) : undefined;
  const daysWithData = cells.filter((d) => d && moods.has(dayKey(d))).length;

  const empty = !loading && checkins.length === 0 && detected.length === 0;

  return (
    <ScreenScroll>
      <ScreenTitle label="Mapa emocional" title={'Seu mês\nem cores'} />

      {error ? (
        <Section top={0}>
          <Card radius={20} padding={16} style={{ backgroundColor: hexA(T.danger, 0.1) }}>
            <Txt s={12.5} lh={1.5} c={T.danger}>
              {error}
            </Txt>
            <PrimaryButton label="Tentar de novo" onPress={load} style={{ marginTop: 12 }} />
          </Card>
        </Section>
      ) : null}

      {/* calendário */}
      <Section top={error ? 12 : 0}>
        <Card radius={24} padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Touchable
              onPress={() => shift(-1)}
              disabled={!canGoBack}
              accessibilityLabel="Mês anterior"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: T.surfWarm,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canGoBack ? 1 : 0.35,
              }}
            >
              <Icon d={ICONS.chevron} size={16} color={T.t1} sw={2.2} rotate={180} />
            </Touchable>
            <View style={{ alignItems: 'center' }}>
              <Txt s={15} w={800} c={T.t1}>
                {MONTHS[cursor.m]} {cursor.y}
              </Txt>
              <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
                {loading && state.stressMode === 'off'
                  ? 'carregando…'
                  : `${daysWithData} ${daysWithData === 1 ? 'dia' : 'dias'} com registro`}
              </Txt>
            </View>
            <Touchable
              onPress={() => shift(1)}
              disabled={!canGoForward}
              accessibilityLabel="Próximo mês"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: T.surfWarm,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canGoForward ? 1 : 0.35,
              }}
            >
              <Icon d={ICONS.chevron} size={16} color={T.t1} sw={2.2} />
            </Touchable>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={{ width: cell, alignItems: 'center' }}>
                <Txt numberOfLines={1} adjustsFontSizeToFit s={11} w={700} c={T.t3}>
                  {w}
                </Txt>
              </View>
            ))}
          </View>

          {loading && state.stressMode === 'off' ? (
            <ActivityIndicator color={T.pri} style={{ marginVertical: 40 }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {cells.map((d, i) =>
                d ? (
                  <DayCell
                    key={i}
                    date={d}
                    mood={moods.get(dayKey(d))}
                    size={cell}
                    selected={selected === dayKey(d)}
                    isToday={dayKey(d) === dayKey(today)}
                    onPress={() => setSelected(dayKey(d))}
                  />
                ) : (
                  <View key={i} style={{ width: cell, height: cell }} />
                )
              )}
            </View>
          )}

          {/* legenda */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {LEGEND.map((k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: EMOTIONS[k].c }} />
                <Txt s={11} c={T.t2}>
                  {EMOTIONS[k].label}
                </Txt>
              </View>
            ))}
          </View>
          <Txt s={11} lh={1.45} c={T.t3} style={{ marginTop: 8 }}>
            Com borda e tom mais vivo: você registrou. Mais suave: só a câmera observou.
          </Txt>
        </Card>
      </Section>

      {/* dia selecionado */}
      {selected && (selectedMood || selectedCheckins.length > 0) ? (
        <Section>
          <Card radius={22} padding={18}>
            <Txt s={12} w={700} c={T.t3}>
              Dia {selected.split('-').reverse().slice(0, 2).join('/')}
            </Txt>
            {selectedCheckins.length === 0 && selectedMood ? (
              <Txt s={13} lh={1.5} c={T.t2} style={{ marginTop: 8 }}>
                Nenhum check-in nesse dia. A câmera leu principalmente{' '}
                <Txt s={13} w={800} c={emotionInk(selectedMood.emotion, isDark)}>
                  {emotionLabel(selectedMood.emotion)}
                </Txt>{' '}
                em {selectedMood.count} {selectedMood.count === 1 ? 'leitura' : 'leituras'}.
              </Txt>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {selectedCheckins.map((c) => {
                  const e = EMOTIONS[c.emotion];
                  const d = new Date(c.createdAt);
                  return (
                    <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <Icon
                        d={[FACE_ICON[c.emotion], 'M9 9.5h.01', 'M15 9.5h.01']}
                        size={22}
                        color={emotionInk(c.emotion, isDark)}
                        sw={1.9}
                        circle
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt s={13} w={800} c={T.t1}>
                          {e.label}{' '}
                          <Txt s={11.5} c={T.t3}>
                            {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                          </Txt>
                        </Txt>
                        {c.note ? (
                          <Txt s={12.5} lh={1.45} c={T.t2} style={{ marginTop: 2 }}>
                            {c.note}
                          </Txt>
                        ) : null}
                        {c.tags.length > 0 ? (
                          <Txt s={11} c={T.t3} style={{ marginTop: 3 }}>
                            {c.tags.map((t) => CHECKIN_TAGS.find(([k]) => k === t)?.[1] ?? t).join(', ')}
                          </Txt>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </Section>
      ) : null}

      {empty && (state.stressMode !== 'off' || !loading) ? (
        <Section>
          <Card variant="warm" radius={22} padding={20} style={{ alignItems: 'center', gap: 10 }}>
            <Txt s={14} w={800} c={T.t1} center>
              Seu mapa vai ganhando cor aos poucos
            </Txt>
            <Txt s={12.5} lh={1.5} c={T.t2} center>
              Cada check-in preenche um dia do mês e ajuda a enxergar seus ritmos com calma.
            </Txt>
            <PrimaryButton label="Fazer check-in" onPress={() => actions.go('checkin')} style={{ alignSelf: 'stretch' }} />
          </Card>
        </Section>
      ) : null}

      {/* autopercepção × detecção */}
      <Section top={24}>
        <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 8 }}>
          Você e a câmera
        </Txt>
        <Card radius={22} padding={18}>
          {agreement.rate == null ? (
            <Txt s={12.5} lh={1.5} c={T.t3}>
              São necessários pelo menos {MIN_SAMPLES} check-ins feitos com a câmera ativa para comparar. Até agora:{' '}
              {agreement.compared}.
            </Txt>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Txt s={30} w={800} c={agreement.rate >= 60 ? T.ok : T.pri}>
                  {agreement.rate}%
                </Txt>
                <Txt s={12.5} c={T.t2} style={{ flex: 1 }}>
                  das vezes o que você disse bateu com o que o rosto mostrava ({agreement.agreed} de {agreement.compared}).
                </Txt>
              </View>
              <View style={{ marginTop: 10 }}>
                <Bar pct={agreement.rate} color={agreement.rate >= 60 ? T.ok : T.pri} height={6} />
              </View>
              {agreement.mismatches.length > 0 ? (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Txt s={12} w={700} c={T.t3}>
                    Quando diverge
                  </Txt>
                  {agreement.mismatches.map((m) => (
                    <Txt key={`${m.said}${m.seen}`} s={12.5} lh={1.45} c={T.t2}>
                      Você disse{' '}
                      <Txt s={12.5} w={800} c={emotionInk(m.said, isDark)}>
                        {emotionLabel(m.said)}
                      </Txt>
                      , a câmera leu{' '}
                      <Txt s={12.5} w={800} c={emotionInk(m.seen, isDark)}>
                        {emotionLabel(m.seen)}
                      </Txt>{' '}
                      ({m.count}x)
                    </Txt>
                  ))}
                </View>
              ) : null}
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 12 }}>
                O rosto mostra uma parte; o que você sente é a outra. Divergir faz parte.
              </Txt>
            </>
          )}
        </Card>
      </Section>

      {/* gatilhos */}
      <Section top={20}>
        <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 8 }}>
          Contextos e sentimentos
        </Txt>
        <Card radius={22} padding={18}>
          {tags.length === 0 ? (
            <Txt s={12.5} lh={1.5} c={T.t3}>
              Marque contextos nos check-ins. Com {MIN_SAMPLES} ou mais em um mesmo contexto, aparece aqui o que costuma vir junto.
            </Txt>
          ) : (
            <View style={{ gap: 14 }}>
              {tags.map((t) => (
                <View key={t.tag}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Txt s={13} w={800} c={T.t1}>
                      {t.label}
                    </Txt>
                    <Txt s={11.5} c={T.t3}>
                      {t.total} {t.total === 1 ? 'vez' : 'vezes'}
                    </Txt>
                  </View>
                  <Txt s={12.5} lh={1.45} c={T.t2} style={{ marginTop: 2 }}>
                    {t.top.share}% das vezes veio com{' '}
                    <Txt s={12.5} w={800} c={emotionInk(t.top.emotion, isDark)}>
                      {emotionLabel(t.top.emotion)}
                    </Txt>
                  </Txt>
                  <View style={{ marginTop: 6 }}>
                    <Bar pct={t.negativeShare} color={t.negativeShare >= 50 ? T.danger : T.ok} height={5} />
                  </View>
                  <Txt s={11} c={T.t3} style={{ marginTop: 3 }}>
                    {t.negativeShare}% de sentimentos difíceis
                  </Txt>
                </View>
              ))}
              <Txt s={11.5} lh={1.45} c={T.t3}>
                Isto aponta coincidência, útil para observar com calma antes de tirar conclusões.
              </Txt>
            </View>
          )}
        </Card>
      </Section>

      {/* sono */}
      <Section top={20} style={{ marginBottom: 8 }}>
        <Txt s={14} w={800} c={T.t1} style={{ marginBottom: 8 }}>
          Sono e humor
        </Txt>
        <Card radius={22} padding={18}>
          {!sleep ? (
            <Txt s={12.5} lh={1.5} c={T.t3}>
              Responda “como você dormiu?” nos check-ins. Com {MIN_SAMPLES} noites boas e {MIN_SAMPLES} ruins, dá para comparar.
            </Txt>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(
                [
                  ['Dormiu bem', sleep.good, T.ok],
                  ['Dormiu mal', sleep.bad, T.danger],
                ] as const
              ).map(([label, s, color]) => (
                <View key={label} style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: hexA(color, 0.1) }}>
                  <Txt s={11.5} w={800} c={T.t2}>
                    {label}
                  </Txt>
                  <Txt s={26} w={800} c={color} style={{ marginTop: 4 }}>
                    {s.negativeShare}%
                  </Txt>
                  <Txt s={11.5} lh={1.4} c={T.t2}>
                    de sentimentos difíceis ({s.n} {s.n === 1 ? 'noite' : 'noites'})
                  </Txt>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Section>
    </ScreenScroll>
  );
}
