import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';

import { fetchCareDashboardSummary } from '../care/careClient';
import { useCareLinks } from '../care/useCareLinks';
import { formatFreshness, isKnownEmotion, safeInsight, signalColor, signalScore } from '../care/careDashboard';
import type { CareDashboardSummary } from '../care/careTypes';
import { CareConfigurationInactiveError } from '../care/careErrors';
import { CareConfigurationCard } from '../components/CareConfigurationCard';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { CarePersonPicker } from '../components/CarePersonPicker';
import { Card, ScreenTitle, Segmented, Touchable, Txt } from '../components/ui';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { EMOTIONS } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

const PERIODS = [{ label: '24h', hours: 24 }, { label: '7 dias', hours: 168 }, { label: '30 dias', hours: 720 }];

export function CareDataScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care');
  const [period, setPeriod] = useState(1);
  const [data, setData] = useState<CareDashboardSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);

  useEffect(() => {
    setData(null); setError(null);
    if (!current?.cared_user_id || current.consent?.status !== 'active') return;
    fetchCareDashboardSummary(current.cared_user_id, PERIODS[period].hours)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason : new Error('Não foi possível carregar o relatório.')));
  }, [current?.id, current?.cared_user_id, current?.consent?.status, period]);

  const score = data ? signalScore(data) : null;
  const color = signalColor(score);
  const max = Math.max(1, ...(data?.daily.map((day) => day.count) ?? []));
  const shareReport = () => {
    if (!data || !current) return;
    const top = [...data.distribution].sort((a, b) => b.count - a.count)[0];
    const topLabel = top && isKnownEmotion(top.emotion) ? EMOTIONS[top.emotion].label : 'sem predominância';
    Share.share({ message: `Resumo consentido do MellowPet — ${current.cared_name || 'Pessoa acompanhada'}\nPeríodo: ${PERIODS[period].label}\nLeituras agregadas: ${data.events}\nConfiança média: ${data.mean_confidence}%\nSinal mais frequente: ${topLabel}\n\n${safeInsight(data)}\n\nEste resumo não é diagnóstico e não inclui imagens, conversas ou eventos individuais.` }).catch(() => undefined);
  };

  return <ScreenScroll>
    <ScreenTitle label="EVOLUÇÃO" title={current?.cared_name ? `Padrões de\n${current.cared_name}` : 'Relatório\nconsentido'} />
    <CarePersonPicker links={links} />
    <Section top={0}><Segmented items={PERIODS.map((item) => item.label)} index={period} onChange={setPeriod} /></Section>
    {linksLoading && links.length === 0 ? <Section><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3}>Carregando conexões…</Txt></Card></Section> : linksError ? <Section><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : !current ? <Section><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1} accessibilityRole="summary">Conecte uma pessoa para abrir o relatório.</Txt></Card></Section> : current.consentConfigurationInactive ? <Section><CareConfigurationCard feature="O relatório consentido" /></Section> : current.consent?.status !== 'active' ? <Section><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1} accessibilityRole="summary">Aguardando consentimento</Txt><Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>O relatório aparece somente após a pessoa confirmar os limites de compartilhamento.</Txt></Card></Section> : error instanceof CareConfigurationInactiveError ? <Section><CareConfigurationCard feature="O relatório consentido" /></Section> : error ? <Section><Card radius={24} padding={20} style={{ borderColor: DANGER }}><Txt s={14.5} w={800} c={DANGER} accessibilityRole="alert" accessibilityLiveRegion="assertive">Relatório indisponível</Txt><Txt s={12.5} c={T.t3} style={{ marginTop: 6 }}>{error.message}</Txt></Card></Section> : !data ? <Section><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3} accessibilityRole="progressbar" accessibilityLabel="Carregando dados agregados" accessibilityLiveRegion="polite">Carregando dados agregados…</Txt></Card></Section> : <>
      <Section><Card radius={24} padding={19}><View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><View><Txt s={15} w={800} c={T.t1}>Resumo de sinais</Txt><Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>{formatFreshness(data.last_event_at)}</Txt></View><Txt s={29} w={800} c={color} accessibilityLabel={`Índice de sinais: ${score ?? 'indisponível'}`}>{score ?? '—'}</Txt></View><Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 12 }}>{safeInsight(data)}</Txt><Txt s={10.5} c={T.t3} style={{ marginTop: 10 }}>{data.events} leituras agregadas · confiança média {data.mean_confidence}%</Txt><Touchable onPress={shareReport} accessibilityRole="button" accessibilityLabel="Compartilhar resumo consentido" accessibilityHint="Abre as opções de compartilhamento com um resumo sem eventos individuais" style={{ marginTop: 12 }}><Txt s={12.5} w={800} c={T.pri}>Compartilhar resumo consentido</Txt></Touchable></Card></Section>
      <Section><Card radius={24} padding={19}><Txt s={14.5} w={800} c={T.t1}>Cobertura por dia</Txt><Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>Quantidade de leituras registradas — não representa atividade da pessoa.</Txt><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 118, marginTop: 16 }}>{data.daily.slice(-14).map((day) => <View key={day.at} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}><Txt s={9} c={T.t3}>{day.count}</Txt><View style={{ width: '100%', height: `${Math.max(5, Math.round(day.count / max * 76))}%`, borderRadius: 5, backgroundColor: T.pri }} /><Txt s={8.5} c={T.t3}>{new Date(day.at).toLocaleDateString('pt-BR', { day: '2-digit' })}</Txt></View>)}</View></Card></Section>
      <Section><Card radius={24} padding={19}><Txt s={14.5} w={800} c={T.t1}>Distribuição de sinais</Txt><View style={{ gap: 10, marginTop: 15 }}>{data.distribution.map((item) => { const pct = data.events ? Math.round(item.count / data.events * 100) : 0; const emotion = isKnownEmotion(item.emotion) ? EMOTIONS[item.emotion] : null; return <View key={item.emotion}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt s={12.5} c={T.t2}>{emotion?.label ?? item.emotion}</Txt><Txt s={12.5} w={800} c={T.t1}>{pct}%</Txt></View><View style={{ height: 6, borderRadius: 99, marginTop: 5, backgroundColor: T.bdL, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: emotion?.c ?? T.pri }} /></View></View>; })}</View></Card></Section>
      <Section><Card radius={24} padding={19}><Txt s={14.5} w={800} c={T.t1}>Origem dos registros</Txt><Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>Separar autorrelato de leitura observada evita transformar uma inferência em certeza.</Txt><View style={{ marginTop: 12, gap: 7 }}>{data.sources.map((item) => <View key={item.source} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt s={12.5} c={T.t2}>{item.source === 'widget_manual' ? 'Informado pela pessoa' : item.source === 'mobile_v2' || item.source === 'background_vision' ? 'Leitura observada' : item.source}</Txt><Txt s={12.5} w={800} c={T.t1}>{item.count}</Txt></View>)}</View></Card></Section>
      <Section><Txt s={11.5} lh={1.55} c={T.t3}>Os padrões são temporais e não demonstram causa. Não use esta tela para diagnóstico ou como substituto de conversa e cuidado profissional.</Txt></Section>
    </>}
  </ScreenScroll>;
}
