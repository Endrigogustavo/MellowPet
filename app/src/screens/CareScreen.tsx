import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { fetchCareDashboardSummary, listCareAlerts, revokeCareLink, type CaregiverLink } from '../care/careClient';
import { formatFreshness, safeInsight, signalColor, signalScore } from '../care/careDashboard';
import { inviteStatus, personStatus, relevantInvite, type PersonTone } from '../care/carePanel';
import { careName, pickCurrent } from '../care/careSelection';
import type { CareAlert, CareDashboardSummary } from '../care/careTypes';
import { listMyInvites, type InviteRow } from '../care/careUxClient';
import { isPaused, listOpenRequests, registerPushToken } from '../care/presenceClient';
import { useCareLinks } from '../care/useCareLinks';
import {
  CareRequestsBanner,
  CaregiverWellbeingCard,
  GestureCard,
  PausedCard,
  ValenceTrend,
  WeeklySummaryCard,
  usePanelOpens,
  useWeeklyMode,
} from '../components/CarePresence';
import { CareLinksErrorCard } from '../components/CareLinksErrorCard';
import { ActionMessage, CareLinkButton, CarePillButton, EmptyCard, ErrorCard, LoadingCard, StaleNotice } from '../components/CareStates';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, ToggleRow, Touchable, Txt, useColumnWidth } from '../components/ui';
import { EXTRA_ICONS, ICONS } from '../data/content';
import { scheduleOnce } from '../notifications/notifications';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { DANGER, OK, WARN, hexA } from '../theme/palette';
import { updateCareWidgets } from '../widgets/widgetBridge';

const LINK_COLORS = ['#FFD166', '#74B9FF', '#A29BFE', '#55EFC4'];
const POLL_MS = 60_000;

/** Último estado conhecido de cada pessoa. Erro de atualização NÃO apaga o dado (C5). */
type PersonData = {
  summary: CareDashboardSummary | null;
  alerts: CareAlert[] | null;
  requests: number;
  error: Error | null;
  updatedAt: number | null;
  loading: boolean;
};

const EMPTY_PERSON: PersonData = { summary: null, alerts: null, requests: 0, error: null, updatedAt: null, loading: true };

/**
 * Carrega TODAS as pessoas em paralelo (resumo de 7 dias + pedidos abertos) e
 * os alertas de quem está selecionado. Cada falha fica na pessoa dela.
 */
function usePanelData(links: CaregiverLink[], currentId: string | null) {
  const [byId, setById] = useState<Record<string, PersonData>>({});
  const [tick, setTick] = useState(0);
  const linksRef = useRef(links);
  linksRef.current = links;
  const linkKey = links.map((l) => `${l.id}:${l.cared_user_id ?? ''}:${l.paused_until ?? ''}`).join('|');

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
    const current = linksRef.current;
    setById((prev) => {
      const next: Record<string, PersonData> = {};
      for (const link of current) next[link.id] = { ...(prev[link.id] ?? EMPTY_PERSON), loading: true };
      return next;
    });
    current.forEach((link) => {
      const cared = link.cared_user_id;
      if (!cared) return;
      const paused = isPaused(link);
      const jobs = Promise.allSettled([
        paused ? Promise.resolve(null) : fetchCareDashboardSummary(cared, 24 * 7),
        paused || link.id !== currentId ? Promise.resolve(null) : listCareAlerts(cared),
        listOpenRequests(cared),
      ]);
      jobs.then(([summary, alerts, requests]) => {
        setById((prev) => {
          const before = prev[link.id] ?? EMPTY_PERSON;
          const failure =
            summary.status === 'rejected' ? summary.reason : alerts.status === 'rejected' ? alerts.reason : null;
          return {
            ...prev,
            [link.id]: {
              summary: summary.status === 'fulfilled' ? summary.value : before.summary,
              alerts: alerts.status === 'fulfilled' ? (alerts.value ?? before.alerts) : before.alerts,
              requests: requests.status === 'fulfilled' ? requests.value.length : before.requests,
              error: failure ? (failure instanceof Error ? failure : new Error('Não foi possível atualizar os dados de cuidado.')) : null,
              updatedAt: failure ? before.updatedAt : Date.now(),
              loading: false,
            },
          };
        });
      });
    });
    // linkKey resume o que importa dos vínculos; o array muda de identidade a cada poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey, currentId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { byId, refresh, tick };
}

function toneColor(tone: PersonTone, neutral: string) {
  return tone === 'danger' ? DANGER : tone === 'attention' ? WARN : tone === 'ok' ? OK : neutral;
}

export function CareScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const quickWidth = useColumnWidth(2, 8);
  const { links, loading: linksLoading, error: linksError, refresh: refreshLinks } = useCareLinks(state.userId, 'care', POLL_MS);
  const [revoking, setRevoking] = useState(false);
  const [linkActionError, setLinkActionError] = useState<string | null>(null);
  const [weekly, setWeekly] = useWeeklyMode();
  const opens = usePanelOpens();
  const seenAlerts = useRef<Set<string> | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [invitesError, setInvitesError] = useState(false);

  // Push remoto (quando o projeto EAS estiver configurado).
  useEffect(() => {
    if (state.userId) registerPushToken(state.userId).catch(() => undefined);
  }, [state.userId]);

  const current = useMemo(() => pickCurrent(links, state.person), [links, state.person]);
  const linkName = useCallback((link: CaregiverLink) => careName(link, links), [links]);
  const { byId, refresh, tick } = usePanelData(links, current?.id ?? null);

  // Status do convite pendente (aguardando / aceito / expirado).
  const linksCount = links.length;
  useEffect(() => {
    if (!state.userId) return;
    let alive = true;
    listMyInvites(state.userId)
      .then((rows) => {
        if (!alive) return;
        setInvites(rows);
        setInvitesError(false);
      })
      .catch(() => {
        if (alive) setInvitesError(true);
      });
    return () => {
      alive = false;
    };
  }, [state.userId, linksCount]);
  const invite = invites ? relevantInvite(invites) : null;

  const currentData = current ? byId[current.id] ?? EMPTY_PERSON : null;
  const paused = current ? isPaused(current) : false;
  const summary = currentData?.summary ?? null;
  const score = summary ? signalScore(summary) : null;
  const scoreColor = signalColor(score);
  const activeAlerts = useMemo(() => currentData?.alerts?.filter((alert) => alert.status !== 'resolved') ?? [], [currentData?.alerts]);

  // Alerta novo desde a última olhada: aviso local com texto neutro.
  useEffect(() => {
    if (!currentData?.alerts) return;
    const open = currentData.alerts.filter((a) => a.status === 'open').map((a) => a.id);
    if (seenAlerts.current && open.some((id) => !seenAlerts.current!.has(id))) {
      scheduleOnce(2, 'MellowPet', 'Há um novo sinal para acompanhar.', { kind: 'care_alert' }).catch(() => undefined);
    }
    seenAlerts.current = new Set(open);
  }, [currentData?.alerts]);

  useEffect(() => {
    seenAlerts.current = null;
  }, [current?.id]);

  // Widget: texto neutro (a tela inicial do aparelho fica à vista de terceiros).
  useEffect(() => {
    // Sem vínculo ou com o compartilhamento pausado, o widget não mostra ninguém.
    if (!current || paused) {
      updateCareWidgets({ people: [], alert: null, checkin: null });
      return;
    }
    if (!summary) return;
    updateCareWidgets({
      people: [{ name: linkName(current), state: score !== null && score < 40 ? 'precisa de atenção' : 'dados disponíveis', wellbeing: score ?? 0 }],
      alert: null,
      alertCount: activeAlerts.length,
      checkin: null,
    });
  }, [current, paused, summary, score, activeAlerts.length, linkName]);

  const endCareRelationship = () => {
    if (!current || revoking) return;
    Alert.alert(
      `Encerrar acompanhamento de ${linkName(current)}?`,
      'Seu acesso aos dados de cuidado termina agora e não dá para desfazer: para voltar, será preciso um convite novo. O histórico operacional do vínculo é preservado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
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

  const quick: [string, string, Screen][] = [
    ['Alertas', `${activeAlerts.length} ativo${activeAlerts.length === 1 ? '' : 's'}`, 'carealerts'],
    ['Histórico', 'Dia, semana e mês', 'carehistory'],
    ['Anotações', 'Suas notas por dia', 'carenotes'],
    ['Agenda', 'Check-ins e compromissos', 'agenda'],
    ['Plano', 'Sinais e próximos passos', 'careplan'],
    ['Relatório', 'Cobertura e origem', 'dashboard'],
  ];

  return (
    <ScreenScroll>
      <View style={{ paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt s={11} w={800} c={T.t3} ls={1.6}>
            MODO CUIDADOR
          </Txt>
          <Txt s={25} w={800} c={T.t1} ls={-0.8} lh={1.1} style={{ marginTop: 4 }} accessibilityRole="header">
            Acompanhar com cuidado
          </Txt>
        </View>
        <Touchable
          onPress={() => actions.go('settings')}
          accessibilityRole="button"
          accessibilityLabel="Conta e ajustes"
          style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon d={ICONS.sliders} size={18} color={T.t1} />
        </Touchable>
      </View>

      {linksLoading && links.length === 0 ? (
        <Section top={0}>
          <LoadingCard text="Carregando conexões…" />
        </Section>
      ) : linksError && links.length === 0 ? (
        <Section top={0}>
          <CareLinksErrorCard error={linksError} onRetry={refreshLinks} />
        </Section>
      ) : links.length === 0 ? (
        <Section top={0} gap={10}>
          <EmptyCard
            title="Você ainda não acompanha ninguém"
            text="Gere um convite em Mais e envie para a pessoa. Antes de aceitar, ela vê o que será compartilhado — e pode pausar ou encerrar quando quiser."
            action={{ label: invite ? 'Ver convite' : 'Gerar convite', onPress: () => actions.go('caretools') }}
          />
          <InviteLine invite={invite} failed={invitesError} />
        </Section>
      ) : (
        <>
          {linksError ? (
            <Section top={0} style={{ marginBottom: 10 }}>
              <StaleNotice at={null} onRetry={refreshLinks} />
            </Section>
          ) : null}

          {/* Cartões de TODAS as pessoas, com o estado recente de cada uma. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 9 }}>
            {links.map((link, index) => {
              const selected = link.id === current?.id;
              const data = byId[link.id] ?? EMPTY_PERSON;
              const s = data.summary;
              const status = personStatus({
                paused: isPaused(link),
                loading: data.loading && !s,
                failed: !!data.error && !s,
                events: s ? s.events : null,
                score: s ? signalScore(s) : null,
                lastEventAt: s?.last_event_at ?? null,
                openRequests: data.requests,
                openAlerts: link.id === current?.id ? activeAlerts.length : 0,
              });
              const name = linkName(link);
              return (
                <Touchable
                  key={link.id}
                  onPress={() => actions.set({ person: link.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}: ${status.text}`}
                  accessibilityHint="Mostra o painel desta pessoa"
                  accessibilityState={{ selected }}
                  style={{
                    width: links.length === 1 ? undefined : 156,
                    minWidth: links.length === 1 ? 240 : undefined,
                    borderRadius: 20,
                    padding: 13,
                    backgroundColor: selected ? T.priL : T.surf,
                    borderWidth: 1,
                    borderColor: status.tone === 'danger' ? DANGER : selected ? T.pri : T.bd,
                  }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: LINK_COLORS[index % LINK_COLORS.length], alignItems: 'center', justifyContent: 'center' }}>
                    <Txt s={15} w={800} c="#2A1B31">
                      {name[0]}
                    </Txt>
                  </View>
                  <Txt s={13} w={800} c={T.t1} numberOfLines={1} style={{ marginTop: 8 }}>
                    {name}
                  </Txt>
                  <Txt s={11.5} w={800} c={toneColor(status.tone, T.t3)} numberOfLines={2} style={{ marginTop: 2 }}>
                    {status.text}
                  </Txt>
                </Touchable>
              );
            })}
          </ScrollView>

          {invite && inviteStatus(invite).kind !== 'accepted' ? (
            <Section top={10}>
              <InviteLine invite={invite} failed={false} />
            </Section>
          ) : null}

          {current && currentData ? (
            <>
              {/* C1: o pedido de contato aparece sempre — pausado, carregando ou com erro. */}
              <Section>
                <CareRequestsBanner link={current} name={linkName(current)} refreshKey={tick} />
              </Section>

              {paused ? (
                <Section>
                  <PausedCard name={linkName(current)} until={current.paused_until!} />
                </Section>
              ) : !summary && currentData.error ? (
                <Section>
                  <ErrorCard title="Não foi possível carregar os dados" error={currentData.error} onRetry={refresh} />
                </Section>
              ) : !summary ? (
                <Section>
                  <LoadingCard text="Atualizando dados de cuidado…" />
                </Section>
              ) : (
                <>
                  {currentData.error ? (
                    <Section>
                      <StaleNotice at={currentData.updatedAt} onRetry={refresh} />
                    </Section>
                  ) : null}
                  {activeAlerts.length > 0 ? (
                    <Section>
                      <Touchable
                        onPress={() => actions.go('carealerts')}
                        accessibilityRole="button"
                        accessibilityLabel={`Atenção necessária: ${activeAlerts[0].title}`}
                        accessibilityHint="Abre os alertas e o plano combinado"
                        style={{ borderRadius: 22, padding: 17, backgroundColor: hexA(DANGER, 0.11), borderWidth: 1, borderColor: hexA(DANGER, 0.28) }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Icon d={EXTRA_ICONS.warning} size={14} color={DANGER} sw={2} />
                          <Txt s={11} w={800} c={DANGER} ls={1.2}>
                            ATENÇÃO NECESSÁRIA
                          </Txt>
                        </View>
                        <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 5 }}>
                          {activeAlerts[0].title}
                        </Txt>
                        <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
                          {activeAlerts[0].detail}
                        </Txt>
                        <Txt s={12} w={800} c={DANGER} style={{ marginTop: 10 }}>
                          Ver alertas e plano combinado
                        </Txt>
                      </Touchable>
                    </Section>
                  ) : null}
                  {!weekly ? (
                    <>
                      <Section>
                        <Card radius={24} padding={18}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Txt s={15} w={800} c={T.t1}>
                                Resumo de sinais
                              </Txt>
                              <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                                {formatFreshness(summary.last_event_at)}
                              </Txt>
                            </View>
                            <Txt s={24} w={800} c={scoreColor} accessibilityLabel={score === null ? 'Índice indisponível: poucas leituras' : `Índice ${score} de 100`}>
                              {score ?? '—'}
                            </Txt>
                          </View>
                          <View style={{ marginTop: 12 }}>
                            <Bar pct={score ?? 0} color={scoreColor} height={7} />
                          </View>
                          <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 12 }}>
                            {safeInsight(summary)}
                          </Txt>
                          <Txt s={11.5} c={T.t3} style={{ marginTop: 10 }}>
                            {summary.events} leituras agregadas · confiança média {summary.mean_confidence}%
                          </Txt>
                        </Card>
                      </Section>
                      <Section>
                        <Card radius={24} padding={18}>
                          <Txt s={15} w={800} c={T.t1}>
                            Como foram os últimos 7 dias
                          </Txt>
                          <ValenceTrend daily={summary.daily} />
                          <CareLinkButton
                            label="Ver histórico por dia, semana e mês"
                            onPress={() => actions.go('carehistory')}
                            style={{ marginTop: 6 }}
                          />
                        </Card>
                      </Section>
                    </>
                  ) : null}
                  <Section>
                    <WeeklySummaryCard link={current} name={linkName(current)} openAlerts={activeAlerts.length} />
                  </Section>
                </>
              )}

              {/* C3: na pausa o carinho aparece indisponível, com explicação. */}
              <Section>
                <GestureCard link={current} name={linkName(current)} />
              </Section>
              <Section style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {quick.map(([title, sub, screen]) => (
                  <Touchable
                    key={title}
                    onPress={() => actions.go(screen)}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}: ${sub}`}
                    style={{ width: quickWidth, minHeight: 64, borderRadius: 18, padding: 13, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd }}
                  >
                    <Txt s={13} w={800} c={T.t1}>
                      {title}
                    </Txt>
                    <Txt s={11.5} lh={1.35} c={T.t3} style={{ marginTop: 3 }}>
                      {sub}
                    </Txt>
                  </Touchable>
                ))}
              </Section>
              <Section>
                <CaregiverWellbeingCard opens={opens} />
              </Section>
              <Section>
                <Card radius={24} padding={18}>
                  <ToggleRow
                    label="Só o resumo da semana"
                    sub={
                      weekly
                        ? 'O painel mostra a semana em poucas frases. Alertas e pedidos continuam aparecendo na hora.'
                        : 'Em vez do painel ao vivo, veja só o resumo da semana — menos ansiedade para os dois lados.'
                    }
                    on={weekly}
                    onPress={() => setWeekly(!weekly)}
                  />
                </Card>
              </Section>
              <Section top={4}>
                <Txt s={11.5} lh={1.55} c={T.t3}>
                  Os sinais apresentados são agregados. Eles servem para orientar uma conversa, não para diagnosticar ou vigiar silenciosamente.
                </Txt>
              </Section>

              {/* C6: ação destrutiva no fim, na zona de perigo, com confirmação. */}
              <Section top={22}>
                <Card radius={20} padding={16} style={{ borderColor: hexA(DANGER, 0.35) }}>
                  <Txt s={11} w={800} c={DANGER} ls={1.2}>
                    ZONA DE PERIGO
                  </Txt>
                  <Txt s={13.5} w={800} c={T.t1} style={{ marginTop: 6 }}>
                    Encerrar acompanhamento de {linkName(current)}
                  </Txt>
                  <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                    Interrompe seu acesso aos dados agora. Não dá para desfazer: para voltar, só com um convite novo. O histórico operacional é preservado.
                  </Txt>
                  <CarePillButton
                    label={revoking ? 'Encerrando…' : 'Encerrar acompanhamento'}
                    onPress={endCareRelationship}
                    disabled={revoking}
                    danger
                    hint="Pede confirmação antes de encerrar"
                    style={{ alignSelf: 'flex-start', marginTop: 12 }}
                  />
                  <ActionMessage
                    message={linkActionError ? { text: linkActionError, tone: 'error' } : null}
                    onClose={() => setLinkActionError(null)}
                  />
                </Card>
              </Section>
            </>
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}

/** Status do convite pendente no painel (aguardando / aceito / expirado). */
function InviteLine({ invite, failed }: { invite: InviteRow | null; failed: boolean }) {
  const { actions } = useApp();
  const { T } = useTheme();
  if (failed) {
    return (
      <Txt s={12} lh={1.45} c={T.t3}>
        Não foi possível verificar o status do seu convite agora.
      </Txt>
    );
  }
  if (!invite) return null;
  const status = inviteStatus(invite);
  const color = status.kind === 'accepted' ? OK : status.kind === 'expired' ? WARN : T.t2;
  return (
    <Card radius={18} padding={13} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt s={12.5} w={800} c={T.t1}>
          Convite {invite.invite_code}
          {invite.cared_name ? ` · ${invite.cared_name}` : ''}
        </Txt>
        <Txt s={12} lh={1.4} c={color} style={{ marginTop: 2 }}>
          {status.text}
        </Txt>
      </View>
      <CareLinkButton label={status.kind === 'expired' ? 'Gerar novo' : 'Abrir'} onPress={() => actions.go('caretools')} />
    </Card>
  );
}
