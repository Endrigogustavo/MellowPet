import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { listLinks, type CaregiverLink } from '../care/careClient';
import { fetchDashboardPeriod } from '../dashboard/dashboardClient';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Touchable, Txt, useColumnWidth } from '../components/ui';
import { NumberedList } from './ToolsScreen';
import {
  CARE_BRIEFING,
  CARE_PEOPLE,
  CARE_QUICK,
  CARE_TREND,
  CARE_TREND_DAYS,
  ICONS,
  type CarePerson,
} from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { DANGER, OK, WARN, hexA } from '../theme/palette';

function scoreColor(v: number) {
  return v >= 70 ? OK : v >= 40 ? WARN : DANGER;
}

const LINK_COLORS = ['#FFD166', '#74B9FF', '#A29BFE', '#55EFC4'];

export function CareScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();
  const quickWidth = useColumnWidth(2, 8);

  // Sem vínculo real de cuidador ainda, a tela cai para o exemplo — em vez
  // de aparecer vazia para quem só está explorando o app.
  const [links, setLinks] = useState<CaregiverLink[] | null>(null);
  useEffect(() => {
    if (!state.userId) return;
    listLinks(state.userId, 'care')
      .then((res) => setLinks(res.links))
      .catch(() => setLinks(null));
  }, [state.userId]);

  const realPeople: CarePerson[] | null = links && links.length > 0
    ? links.map((link, i) => ({
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
      }))
    : null;
  const people = realPeople ?? CARE_PEOPLE;

  const cur = people.find((p) => p.id === state.person) ?? people[0];
  const [live, setLive] = useState<{ personId: string; wb: number; ai: string } | null>(null);
  useEffect(() => {
    if (!realPeople || !cur.id) return;
    let alive = true;
    fetchDashboardPeriod(cur.id, 0)
      .then((period) => {
        if (alive && period) setLive({ personId: cur.id, wb: period.wb, ai: period.insight });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.id]);
  const currentLive = live?.personId === cur.id ? live : null;
  const wb = currentLive?.wb ?? cur.wb;
  const ai = currentLive?.ai ?? cur.ai;
  const curColor = scoreColor(wb);

  const linkLabel = realPeople ? 'Conectado' : 'Nenhum vínculo real ainda';
  const linkColor = realPeople ? OK : T.t3;

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

      {/* resumo do dia */}
      <Section top={0} style={{ marginBottom: 12 }}>
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: T.priL }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon d={ICONS.robot} size={16} color={T.pri} sw={1.9} />
            <Txt s={12.5} w={800} c={T.pri}>
              Resumo do dia
            </Txt>
          </View>
          <Txt s={13.5} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
            {CARE_BRIEFING}
          </Txt>
        </View>
      </Section>

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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 7,
              height: 74,
              marginTop: 16,
            }}
          >
            {CARE_TREND.map((v, i) => (
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
                  {CARE_TREND_DAYS[i]}
                </Txt>
              </View>
            ))}
          </View>
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
          <View style={{ marginTop: 14 }}>
            <NumberedList items={cur.plan} bg={T.surf} />
          </View>
        </View>
      </Section>

      {/* alertas recentes */}
      {full ? (
        <Section>
          <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
            <Txt s={13.5} w={800} c={T.t1} style={{ paddingTop: 14, paddingBottom: 6 }}>
              Alertas recentes
            </Txt>
            {cur.alerts.map(([text, when, color]) => (
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
            ))}
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
    </ScreenScroll>
  );
}
