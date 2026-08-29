import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { fetchCareDashboardSummary, listCareAlerts, revokeCareLink, type CaregiverLink } from '../care/careClient';
import { useCareLinks } from '../care/useCareLinks';
import { formatFreshness, safeInsight, signalColor, signalScore } from '../care/careDashboard';
import type { CareAlert, CareDashboardSummary } from '../care/careTypes';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Touchable, Txt, useColumnWidth } from '../components/ui';
import { ICONS } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { DANGER, OK, WARN } from '../theme/palette';
import { updateCareWidgets } from '../widgets/widgetBridge';

const LINK_COLORS = ['#FFD166', '#74B9FF', '#A29BFE', '#55EFC4'];
type Loaded = { id: string; summary: CareDashboardSummary; alerts: CareAlert[] };

function linkName(link: CaregiverLink) {
  return link.cared_name?.trim() || 'Pessoa acompanhada';
}

function statusFor(link: CaregiverLink, loaded: Loaded | null) {
  if (!loaded || loaded.id !== link.id) return { text: 'carregando dados', color: WARN };
  if (loaded.summary.events === 0) return { text: 'sem registros', color: WARN };
  const score = signalScore(loaded.summary);
  return { text: score !== null && score < 40 ? 'precisa de atenção' : 'dados disponíveis', color: score !== null && score < 40 ? DANGER : OK };
}

export function CareScreen() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();
  const quickWidth = useColumnWidth(2, 8);
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care', 60_000);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [linkActionError, setLinkActionError] = useState<string | null>(null);

  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);
  const refreshCurrent = () => {
    if (!current?.cared_user_id) return;
    setError(null);
    Promise.all([fetchCareDashboardSummary(current.cared_user_id, 24 * 7), listCareAlerts(current.cared_user_id)])
      .then(([summary, alerts]) => setLoaded({ id: current.id, summary, alerts }))
      .catch((reason) => {
        setLoaded(null);
        setError(reason instanceof Error ? reason : new Error('Não foi possível atualizar os dados de cuidado.'));
      });
  };

  const endCareRelationship = () => {
    if (!current || revoking) return;
    Alert.alert(
      `Encerrar acompanhamento de ${linkName(current)}?`,
      'O acesso aos dados de cuidado é interrompido agora. O histórico operacional do vínculo é preservado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar acompanhamento',
          style: 'destructive',
          onPress: () => {
            setRevoking(true);
            setLinkActionError(null);
            revokeCareLink(current.id)
              .then(() => refreshLinks())
              .catch((reason) => {
                setLinkActionError(reason instanceof Error ? reason.message : 'Não foi possível encerrar o acompanhamento.');
              })
              .finally(() => setRevoking(false));
          },
        },
      ]
    );
  };

  useEffect(() => {
    setLoaded(null);
    refreshCurrent();
    const id = setInterval(refreshCurrent, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.cared_user_id]);

  const currentData = loaded?.id === current?.id ? loaded : null;
  const score = currentData ? signalScore(currentData.summary) : null;
  const scoreColor = signalColor(score);
  const activeAlerts = currentData?.alerts.filter((alert) => alert.status !== 'resolved') ?? [];

  useEffect(() => {
    if (!current || !currentData) return;
    updateCareWidgets({
      people: [{ name: linkName(current), state: statusFor(current, currentData).text, wellbeing: score ?? 0 }],
      alert: activeAlerts[0] ? { title: activeAlerts[0].title, sub: activeAlerts[0].detail } : null,
      checkin: null,
    });
  }, [current, currentData, score, activeAlerts]);

  return <ScreenScroll>
    <View style={{ paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}><Txt s={10.5} w={800} c={T.t3} ls={1.6}>MODO CUIDADOR</Txt><Txt s={25} w={800} c={T.t1} ls={-0.8} lh={1.1} style={{ marginTop: 4 }}>Acompanhar com cuidado</Txt></View>
      <Touchable onPress={actions.toggleTheme} accessibilityRole="button" accessibilityLabel="Alternar tema" accessibilityHint="Muda entre os temas claro e escuro" style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd, alignItems: 'center', justifyContent: 'center' }}><Icon d={isDark ? ICONS.moon : ICONS.sun} size={18} color={T.t1} /></Touchable>
    </View>
    {linksLoading && links.length === 0 ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3} accessibilityRole="progressbar" accessibilityLabel="Carregando conexões de cuidado" accessibilityLiveRegion="polite">Carregando conexões…</Txt></Card></Section> : linksError ? <Section top={0}><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : links.length === 0 ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><Icon d={ICONS.people} size={28} color={T.t3} /><Txt s={15} w={800} c={T.t1} center accessibilityRole="summary">Você ainda não acompanha ninguém</Txt><Txt s={12.5} lh={1.55} c={T.t3} center>Gere um convite em Recursos. O acesso integral começa quando a pessoa aceitar.</Txt><Touchable onPress={() => actions.go('caretools')} accessibilityRole="button" accessibilityLabel="Abrir recursos de cuidador" accessibilityHint="Abre os recursos para criar um convite" style={{ marginTop: 5, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: T.priL }}><Txt s={12.5} w={800} c={T.pri}>Abrir recursos</Txt></Touchable></Card></Section> : <>
      <Section top={0} style={{ flexDirection: 'row', gap: 9 }}>{links.map((link, index) => {
        const selected = link.id === current?.id;
        const status = statusFor(link, loaded);
        const color = LINK_COLORS[index % LINK_COLORS.length];
        return <Touchable key={link.id} onPress={() => actions.set({ person: link.id })} accessibilityRole="button" accessibilityLabel={`${linkName(link)}: ${status.text}`} accessibilityHint="Seleciona a pessoa acompanhada" accessibilityState={{ selected }} style={{ flex: 1, minWidth: 0, borderRadius: 20, padding: 13, backgroundColor: selected ? T.priL : T.surf, borderWidth: 1, borderColor: selected ? T.pri : T.bd }}><View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Txt s={15} w={800} c="#2A1B31">{linkName(link)[0]}</Txt></View><Txt s={13} w={800} c={T.t1} numberOfLines={1} style={{ marginTop: 8 }}>{linkName(link)}</Txt><Txt s={10.5} w={800} c={status.color} numberOfLines={1} style={{ marginTop: 2 }}>{status.text}</Txt></Touchable>;
      })}</Section>
      {linkActionError ? <Section top={10}><Card radius={18} padding={14} style={{ borderColor: DANGER }}><Txt s={12.5} w={800} c={DANGER} accessibilityRole="alert" accessibilityLiveRegion="assertive">{linkActionError}</Txt><Touchable onPress={() => setLinkActionError(null)} accessibilityRole="button" accessibilityLabel="Fechar mensagem de erro" style={{ marginTop: 8 }}><Txt s={11.5} w={800} c={T.pri}>Entendi</Txt></Touchable></Card></Section> : null}
      {current ? <Section top={10}><Card radius={18} padding={14}><Txt s={12.5} w={800} c={T.t1}>Encerrar acompanhamento</Txt><Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>Interrompe imediatamente seu acesso aos dados de {linkName(current)}. O histórico operacional é preservado.</Txt><Touchable onPress={endCareRelationship} disabled={revoking} accessibilityRole="button" accessibilityLabel={`Encerrar acompanhamento de ${linkName(current)}`} accessibilityHint="Interrompe seu acesso aos dados de cuidado dessa pessoa" style={{ alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 10 }}><Txt s={11.5} w={800} c={DANGER}>{revoking ? 'Encerrando…' : 'Encerrar acompanhamento'}</Txt></Touchable></Card></Section> : null}
      {error ? <Section><Card radius={24} padding={19} style={{ borderColor: DANGER }}><Txt s={14.5} w={800} c={DANGER} accessibilityRole="alert" accessibilityLiveRegion="assertive">Não foi possível carregar os dados</Txt><Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>{error.message}</Txt><Touchable onPress={refreshCurrent} accessibilityRole="button" accessibilityLabel="Tentar carregar os dados novamente" style={{ marginTop: 12 }}><Txt s={12.5} w={800} c={T.pri}>Tentar novamente</Txt></Touchable></Card></Section> : !currentData ? <Section><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3} accessibilityRole="progressbar" accessibilityLabel="Atualizando dados de cuidado" accessibilityLiveRegion="polite">Atualizando dados de cuidado…</Txt></Card></Section> : <>
        {activeAlerts.length > 0 ? <Section><Touchable onPress={() => actions.go('carealerts')} accessibilityRole="button" accessibilityLabel={`Atenção necessária: ${activeAlerts[0].title}`} accessibilityHint="Abre os alertas e o plano combinado" style={{ borderRadius: 22, padding: 17, backgroundColor: 'rgba(239,68,68,.11)', borderWidth: 1, borderColor: 'rgba(239,68,68,.28)' }}><Txt s={11} w={800} c={DANGER} ls={1.2}>ATENÇÃO NECESSÁRIA</Txt><Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 5 }}>{activeAlerts[0].title}</Txt><Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>{activeAlerts[0].detail}</Txt><Txt s={11.5} w={800} c={DANGER} style={{ marginTop: 10 }}>Ver alertas e plano combinado</Txt></Touchable></Section> : null}
        <Section><Card radius={24} padding={18}><View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><View><Txt s={15} w={800} c={T.t1}>Resumo de sinais</Txt><Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>{formatFreshness(currentData.summary.last_event_at)}</Txt></View><Txt s={24} w={800} c={scoreColor}>{score ?? '—'}</Txt></View><View style={{ marginTop: 12 }}><Bar pct={score ?? 0} color={scoreColor} height={7} /></View><Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 12 }}>{safeInsight(currentData.summary)}</Txt><Txt s={10.5} c={T.t3} style={{ marginTop: 10 }}>{currentData.summary.events} leituras agregadas · confiança média {currentData.summary.mean_confidence}%</Txt></Card></Section>
        <Section><Card radius={24} padding={18}><View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><Txt s={15} w={800} c={T.t1}>Tendência dos últimos 7 dias</Txt><Txt s={11.5} w={800} c={T.pri}>Ver evolução</Txt></View><View accessible accessibilityRole="image" accessibilityLabel={`Tendência dos últimos 7 dias: ${currentData.summary.daily.slice(-7).map((day) => `${new Date(day.at).toLocaleDateString('pt-BR', { weekday: 'long' })}, ${day.count} leituras`).join('; ') || 'sem leituras'}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 74, marginTop: 14 }}>{currentData.summary.daily.slice(-7).map((day, index) => { const h = Math.max(10, Math.min(68, day.count * 10)); return <View key={day.at} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}><View style={{ width: '100%', height: h, borderRadius: 6, backgroundColor: index === currentData.summary.daily.slice(-7).length - 1 ? T.pri : T.priL }} /><Txt s={9} c={T.t3}>{new Date(day.at).toLocaleDateString('pt-BR', { weekday: 'narrow' })}</Txt></View>; })}</View><Touchable onPress={() => actions.go('dashboard')} accessibilityRole="button" accessibilityLabel="Abrir relatório completo" accessibilityHint="Mostra a evolução e a cobertura dos sinais agregados" style={{ marginTop: 11 }}><Txt s={12.5} w={800} c={T.pri}>Abrir relatório completo</Txt></Touchable></Card></Section>
        <Section style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['Alertas', `${activeAlerts.length} ativo${activeAlerts.length === 1 ? '' : 's'}`, 'carealerts'], ['Check-in', 'Combinar próximo contato', 'agenda'], ['Plano', 'Sinais e próximos passos', 'careplan'], ['Relatório', 'Tendências e cobertura', 'dashboard']].map(([title, sub, screen]) => <Touchable key={title} onPress={() => actions.go(screen as Screen)} accessibilityRole="button" accessibilityLabel={`${title}: ${sub}`} style={{ width: quickWidth, borderRadius: 18, padding: 13, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd }}><Txt s={13} w={800} c={T.t1}>{title}</Txt><Txt s={10.5} lh={1.35} c={T.t3} style={{ marginTop: 3 }}>{sub}</Txt></Touchable>)}</Section>
        <Section top={4}><Txt s={11.5} lh={1.55} c={T.t3}>Os sinais apresentados são agregados. Eles servem para orientar uma conversa, não para diagnosticar ou vigiar silenciosamente.</Txt></Section>
      </>}
    </>}
  </ScreenScroll>;
}
