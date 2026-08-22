import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { listLinks, type CaregiverLink } from '../care/careClient';
import { fetchDashboardPeriod, fetchWeeklyTrend } from '../dashboard/dashboardClient';
import { subscribeToEmotionEvents } from '../dashboard/aggregate';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Touchable, Txt, useColumnWidth } from '../components/ui';
import { NumberedList } from './ToolsScreen';
import { CARE_QUICK, ICONS, type CarePerson } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { DANGER, OK, WARN, hexA } from '../theme/palette';

function scoreColor(v: number) {
  return v >= 70 ? OK : v >= 40 ? WARN : DANGER;
}

const LINK_COLORS = ['#FFD166', '#74B9FF', '#A29BFE', '#55EFC4'];
// getDay(): 0=Dom,1=Seg,2=Ter,3=Qua,4=Qui,5=Sex,6=Sáb
const WEEKDAY_INITIAL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function lastSevenDayLabels(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return WEEKDAY_INITIAL[date.getDay()];
  });
}

export function CareScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();
  const quickWidth = useColumnWidth(2, 8);

  const [links, setLinks] = useState<CaregiverLink[] | null>(null);
  useEffect(() => {
    if (!state.userId) return;
    listLinks(state.userId, 'care')
      .then((res) => setLinks(res.links))
      .catch(() => setLinks([]));
  }, [state.userId]);

  const people: CarePerson[] = (links ?? []).map((link, i) => ({
    id: link.cared_user_id ?? link.invite_code,
    name: link.cared_name || 'Pessoa cuidada',
    rel: link.relationship || '',
    color: LINK_COLORS[i % LINK_COLORS.length],
    status: 'estável' as const,
    last: '',
    wb: 50,
    ai: 'Ainda reunindo leituras suficientes para um insight.',
    plan: [],
    alerts: [],
  }));

  const cur = people.find((p) => p.id === state.person) ?? people[0];
  const [live, setLive] = useState<{ personId: string; wb: number; ai: string; trend: number[] } | null>(null);
  useEffect(() => {
    if (!cur?.id) return;
    let alive = true;
    const refresh = () => {
      fetchDashboardPeriod(cur.id, 0)
        .then((period) => {
          if (!alive) return;
          setLive((prev) => ({
            personId: cur.id,
            wb: period?.wb ?? prev?.wb ?? 50,
            ai: period?.insight ?? 'Ainda sem leituras suficientes para um insight.',
            trend: prev?.personId === cur.id ? prev.trend : [],
          }));
        })
        .catch(() => undefined);
      fetchWeeklyTrend(cur.id).then((trend) => {
        if (alive) setLive((prev) => (prev?.personId === cur.id ? { ...prev, trend } : { personId: cur.id, wb: 50, ai: '', trend }));
      });
    };
    refresh();
    const unsubscribe = subscribeToEmotionEvents(cur.id, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [cur?.id]);
  const currentLive = cur && live?.personId === cur.id ? live : null;
  const wb = currentLive?.wb ?? cur?.wb ?? 50;
  const ai = currentLive?.ai ?? cur?.ai ?? '';
  const trend = currentLive?.trend ?? [];
  const trendDays = lastSevenDayLabels();
  const curColor = scoreColor(wb);

  const linkLabel = people.length > 0 ? 'Conectado' : 'Ninguém conectado ainda';
  const linkColor = people.length > 0 ? OK : T.t3;

  return (
    <ScreenScroll>
      {/* cabeçalho */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt s={17} w={800} c={T.pri}>
              {(state.email || 'C').charAt(0).toUpperCase()}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={10.5} w={800} c={T.t3} ls={1.6}>
              MODO CUIDADOR
            </Txt>
            <Txt s={20} w={800} c={T.t1} ls={-0.5} lh={1.1} style={{ marginTop: 3 }} numberOfLines={1}>
              Olá, {state.email || 'cuidador(a)'}
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Touchable
            onPress={actions.toggleTheme}
            accessibilityLabel="Alternar tema"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={isDark ? ICONS.moon : ICONS.sun} size={18} color={T.t1} />
          </Touchable>
          <Touchable
            onPress={() => actions.setRole('user')}
            accessibilityLabel="Voltar ao modo pessoal"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.swap} size={18} color={T.t1} />
          </Touchable>
        </View>
      </View>

      {/* atalhos */}
      <Section top={0} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {CARE_QUICK.map(([title, sub, icon, target]) => (
          <Touchable
            key={title}
            onPress={() => actions.go(target as Screen)}
            style={{
              width: quickWidth,
              borderRadius: 18,
              padding: 13,
              paddingHorizontal: 14,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon d={icon} size={18} color={T.pri} />
            <View style={{ flex: 1 }}>
              <Txt s={12.5} w={800} c={T.t1} lh={1.2}>
                {title}
              </Txt>
              <Txt s={10.5} c={T.t3} style={{ marginTop: 3 }}>
                {sub}
              </Txt>
            </View>
          </Touchable>
        ))}
      </Section>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Txt s={11} w={800} c={T.t3} ls={1.8}>
          ACOMPANHANDO
        </Txt>
        <Txt s={11} w={800} c={linkColor}>
          {linkLabel}
        </Txt>
      </View>

      {people.length === 0 ? (
        <Section top={0}>
          <Card radius={24} padding={22} style={{ alignItems: 'center', gap: 8 }}>
            <Icon d={ICONS.robot} size={26} color={T.t3} />
            <Txt s={14.5} w={800} c={T.t1} style={{ textAlign: 'center' }}>
              Você ainda não está acompanhando ninguém
            </Txt>
            <Txt s={12.5} lh={1.55} c={T.t3} style={{ textAlign: 'center' }}>
              Gere um código de convite em &ldquo;Recursos&rdquo; e envie para a pessoa que você
              cuida. Assim que ela aceitar, o acompanhamento aparece aqui.
            </Txt>
          </Card>
        </Section>
      ) : (
        <>
          {/* pessoas acompanhadas */}
          <Section top={0} style={{ flexDirection: 'row', gap: 9 }}>
            {people.map((p) => {
              const on = p.id === state.person;
              return (
                <Touchable
                  key={p.id}
                  onPress={() => actions.set({ person: p.id })}
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    padding: 14,
                    gap: 9,
                    backgroundColor: on ? hexA(p.color, isDark ? 0.22 : 0.14) : T.surf,
                    borderWidth: 1,
                    borderColor: on ? p.color : T.bd,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: p.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt s={15} w={800} c="#2A1B31">
                        {p.name[0]}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt s={14.5} w={800} c={T.t1}>
                        {p.name}
                      </Txt>
                      <Txt s={11} c={T.t3}>
                        {p.rel}
                      </Txt>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Txt s={12.5} w={800} c={p.status === 'estável' ? OK : WARN} cap>
                      {p.status}
                    </Txt>
                    <Txt s={11} c={T.t3}>
                      · {p.last}
                    </Txt>
                  </View>
                </Touchable>
              );
            })}
          </Section>

          {/* bem-estar da pessoa selecionada */}
          <Section>
            <Card radius={24} padding={18}>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <Txt s={15} w={800} c={T.t1}>
                  {cur.name} · bem-estar
                </Txt>
                <Txt s={22} w={800} c={curColor}>
                  {wb}
                </Txt>
              </View>
              <View style={{ marginTop: 10 }}>
                <Bar pct={wb} color={curColor} height={7} />
              </View>
              {trend.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 7,
                    height: 74,
                    marginTop: 16,
                  }}
                >
                  {trend.map((v, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 6,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <View
                        style={{
                          width: '100%',
                          height: `${v}%`,
                          borderTopLeftRadius: 6,
                          borderTopRightRadius: 6,
                          borderBottomLeftRadius: 3,
                          borderBottomRightRadius: 3,
                          backgroundColor: v >= 70 ? OK : v >= 55 ? T.pri : WARN,
                        }}
                      />
                      <Txt s={9.5} c={T.t3}>
                        {trendDays[i]}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt s={12} c={T.t3} style={{ marginTop: 14 }}>
                  Ainda sem histórico de 7 dias.
                </Txt>
              )}
            </Card>
          </Section>

          {/* leitura da IA */}
          <Section>
            <View style={{ borderRadius: 24, padding: 18, backgroundColor: T.priL }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon d={ICONS.robot} size={17} color={T.pri} sw={1.9} />
                <Txt s={13} w={800} c={T.pri}>
                  Leitura da IA
                </Txt>
              </View>
              <Txt s={13.5} lh={1.6} c={T.t2} style={{ marginTop: 9 }}>
                {ai}
              </Txt>
              {cur.plan.length > 0 ? (
                <View style={{ marginTop: 14 }}>
                  <NumberedList items={cur.plan} bg={T.surf} />
                </View>
              ) : null}
            </View>
          </Section>

          {/* alertas recentes */}
          {full ? (
            <Section>
              <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
                <Txt s={13.5} w={800} c={T.t1} style={{ paddingTop: 14, paddingBottom: 6 }}>
                  Alertas recentes
                </Txt>
                {cur.alerts.length === 0 ? (
                  <Txt s={12} c={T.t3} style={{ paddingBottom: 14 }}>
                    Nenhum alerta recente.
                  </Txt>
                ) : (
                  cur.alerts.map(([text, when, color]) => (
                    <View
                      key={text}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 11,
                        paddingVertical: 13,
                        borderTopWidth: 1,
                        borderTopColor: T.bdL,
                      }}
                    >
                      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                      <Txt s={13} c={T.t1} style={{ flex: 1 }}>
                        {text}
                      </Txt>
                      <Txt s={11} c={T.t3}>
                        {when}
                      </Txt>
                    </View>
                  ))
                )}
              </Card>
            </Section>
          ) : null}

          <Section top={12}>
            <View
              style={{
                padding: 15,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: T.bd,
              }}
            >
              <Txt s={12} lh={1.55} c={T.t3}>
                {cur.name} vê o que você vê. A supervisão é combinada — nunca silenciosa.
              </Txt>
            </View>
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}
