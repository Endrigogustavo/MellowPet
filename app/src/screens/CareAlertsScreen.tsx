import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { createSupportAction, listCareAlerts, updateCareAlert } from '../care/careClient';
import { useCareLinks } from '../care/useCareLinks';
import type { CareAlert } from '../care/careTypes';
import { CareConfigurationInactiveError } from '../care/careErrors';
import { CareConfigurationCard } from '../components/CareConfigurationCard';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { CarePersonPicker } from '../components/CarePersonPicker';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN } from '../theme/palette';

function when(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function CareAlertsScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care');
  const [alerts, setAlerts] = useState<CareAlert[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);

  const refresh = () => {
    setAlerts(null); setError(null);
    if (!current?.cared_user_id || current.consent?.status !== 'active') return;
    listCareAlerts(current.cared_user_id).then(setAlerts).catch((reason) => setError(reason instanceof Error ? reason : new Error('Não foi possível carregar os alertas.')));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [current?.id, current?.cared_user_id, current?.consent?.status]);

  const change = async (alert: CareAlert, status: 'acknowledged' | 'resolved') => {
    if (!state.userId) return;
    try {
      await updateCareAlert(alert.id, status, state.userId);
      if (status === 'acknowledged' && current?.cared_user_id) await createSupportAction(current.cared_user_id, current.id, state.userId, 'Alerta reconhecido', alert.title);
      setAlerts((items) => items?.map((item) => item.id === alert.id ? { ...item, status } : item) ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason : new Error('Não foi possível atualizar este alerta.')); }
  };

  return <ScreenScroll>
    <ScreenTitle label="ALERTAS" title={current?.cared_name ? `Acompanhar\n${current.cared_name}` : 'Sinais para\nacompanhar'} />
    <CarePersonPicker links={links} />
    {linksLoading && links.length === 0 ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3}>Carregando conexões…</Txt></Card></Section> : linksError ? <Section top={0}><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : !current ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Conecte uma pessoa para acompanhar alertas.</Txt></Card></Section> : current.consentConfigurationInactive ? <Section top={0}><CareConfigurationCard feature="Os alertas de acompanhamento" /></Section> : current.consent?.status !== 'active' ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Alertas dependem de consentimento</Txt><Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>A pessoa acompanhada decide se deseja compartilhar alertas prolongados.</Txt></Card></Section> : error instanceof CareConfigurationInactiveError ? <Section top={0}><CareConfigurationCard feature="Os alertas de acompanhamento" /></Section> : error ? <Section top={0}><Card radius={24} padding={20} style={{ borderColor: DANGER }}><Txt s={14.5} w={800} c={DANGER}>Não foi possível carregar</Txt><Txt s={12.5} c={T.t3} style={{ marginTop: 6 }}>{error.message}</Txt><Touchable onPress={refresh} style={{ marginTop: 11 }}><Txt s={12.5} w={800} c={T.pri}>Tentar novamente</Txt></Touchable></Card></Section> : alerts === null ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3}>Carregando alertas…</Txt></Card></Section> : alerts.length === 0 ? <Section top={0}><Card radius={24} padding={21}><Txt s={15} w={800} c={OK}>Nenhum alerta registrado</Txt><Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>A ausência de alertas não resume o bem-estar da pessoa. Continue usando check-ins e o plano combinado.</Txt></Card></Section> : <Section top={0} gap={10}>{alerts.map((alert) => {
      const color = alert.severity === 'urgent' ? DANGER : alert.severity === 'attention' ? WARN : T.pri;
      return <Card key={alert.id} radius={22} padding={17} style={{ borderColor: alert.status === 'resolved' ? T.bd : color }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><View style={{ flex: 1 }}><Txt s={11} w={800} c={color} ls={1.1}>{alert.status === 'resolved' ? 'RESOLVIDO' : alert.status === 'acknowledged' ? 'EM ACOMPANHAMENTO' : 'NOVO ALERTA'}</Txt><Txt s={15} w={800} c={T.t1} style={{ marginTop: 5 }}>{alert.title}</Txt></View><Txt s={10.5} c={T.t3}>{when(alert.occurred_at)}</Txt></View><Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 8 }}>{alert.detail}</Txt><Txt s={10.5} lh={1.45} c={T.t3} style={{ marginTop: 9 }}>Um alerta descreve um padrão de sinais e não uma emergência ou diagnóstico por si só.</Txt>{alert.status === 'open' ? <View style={{ flexDirection: 'row', gap: 9, marginTop: 13 }}><Touchable onPress={() => change(alert, 'acknowledged')} style={{ paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12, backgroundColor: T.priL }}><Txt s={12} w={800} c={T.pri}>Marcar como visto</Txt></Touchable><Touchable onPress={() => actions.go('careplan')} style={{ paddingVertical: 10, paddingHorizontal: 13 }}><Txt s={12} w={800} c={T.t2}>Ver plano</Txt></Touchable></View> : alert.status === 'acknowledged' ? <Touchable onPress={() => change(alert, 'resolved')} style={{ marginTop: 13 }}><Txt s={12} w={800} c={OK}>Marcar como resolvido</Txt></Touchable> : null}</Card>;
    })}</Section>}
  </ScreenScroll>;
}
