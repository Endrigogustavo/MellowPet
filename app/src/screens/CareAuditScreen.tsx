import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { listCareAuditEntries } from '../care/careClient';
import { auditActionLabel } from '../care/careAudit';
import type { CareAuditEntry } from '../care/careTypes';
import { useCareLinks } from '../care/useCareLinks';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { CarePersonPicker } from '../components/CarePersonPicker';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

function when(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CareAuditScreen() {
  const { state } = useApp();
  const { T } = useTheme();
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care');
  const [entries, setEntries] = useState<CareAuditEntry[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const current = useMemo(() => links.find((link) => link.id === state.person) ?? links[0], [links, state.person]);

  const refresh = () => {
    setEntries(null);
    setError(null);
    if (!current?.cared_user_id) return;
    listCareAuditEntries(current.cared_user_id)
      .then(setEntries)
      .catch((reason) => setError(reason instanceof Error ? reason : new Error('Não foi possível carregar o histórico de cuidado.')));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.cared_user_id]);

  return <ScreenScroll>
    <ScreenTitle label="HISTÓRICO" title={current?.cared_name ? `Cuidado de\n${current.cared_name}` : 'Histórico de\ncuidado'} />
    <CarePersonPicker links={links} />
    {linksLoading && links.length === 0 ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3}>Carregando conexões…</Txt></Card></Section> : linksError ? <Section top={0}><CareLinksErrorCard error={linksError} onRetry={refreshLinks} /></Section> : !current ? <Section top={0}><Card radius={24} padding={20}><Txt s={14.5} w={800} c={T.t1}>Conecte uma pessoa para consultar o histórico.</Txt></Card></Section> : error ? <Section top={0}><Card radius={24} padding={20} style={{ borderColor: DANGER }}><Txt s={14.5} w={800} c={DANGER}>Não foi possível carregar</Txt><Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>{error.message}</Txt><Touchable onPress={refresh} style={{ alignSelf: 'flex-start', marginTop: 12 }}><Txt s={12.5} w={800} c={T.pri}>Tentar novamente</Txt></Touchable></Card></Section> : entries === null ? <Section top={0}><Card radius={24} padding={22} style={{ alignItems: 'center', gap: 9 }}><ActivityIndicator color={T.pri} /><Txt s={13} c={T.t3}>Carregando histórico…</Txt></Card></Section> : <>
      <Section top={0}><Card radius={24} padding={18}><Txt s={11} w={800} c={T.pri} ls={1.1}>REGISTRO OPERACIONAL</Txt><Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>Aqui aparecem apenas a categoria e o horário das alterações. Conteúdo de notas, check-ins, alertas, respostas, sinais e evidências não é exibido.</Txt></Card></Section>
      {entries.length === 0 ? <Section><Card radius={24} padding={21}><Txt s={15} w={800} c={OK}>Nenhuma alteração registrada</Txt><Txt s={12.5} lh={1.55} c={T.t3} style={{ marginTop: 6 }}>Quando houver uma alteração importante, ela aparecerá aqui sem expor o conteúdo do cuidado.</Txt></Card></Section> : <Section gap={10}>{entries.map((entry) => <Card key={entry.id} radius={20} padding={16}><Txt s={14} w={800} c={T.t1}>{auditActionLabel(entry.action)}</Txt><Txt s={11.5} c={T.t3} style={{ marginTop: 5 }}>{when(entry.created_at)}</Txt></Card>)}</Section>}
    </>}
  </ScreenScroll>;
}
