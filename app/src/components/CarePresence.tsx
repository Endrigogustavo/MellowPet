import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, View } from 'react-native';

import { fetchCareDashboardSummary, type CaregiverLink } from '../care/careClient';
import { fetchWeeklySummary } from '../care/careUxClient';
import { checkingNudge, valenceBars, weekSummary, type DailyValence } from '../care/careWeekly';
import {
  buildWeeklyInput,
  lastCompleteWeekStart,
  parseDigest,
  serializeDigest,
  weekLabel,
  weekTotal,
  weeklyCacheKey,
} from '../care/careWeeklyDigest';
import {
  GESTURES,
  URGENCY_LABEL,
  acknowledgeRequest,
  isPaused,
  listOpenRequests,
  sendGesture,
  type CareRequest,
} from '../care/presenceClient';
import { EXTRA_ICONS } from '../data/content';
import { scheduleOnce } from '../notifications/notifications';
import { localDay } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, WARN } from '../theme/palette';
import { ActionMessage, CareLinkButton, CarePillButton } from './CareStates';
import { Icon } from './Icon';
import { Card, Touchable, Txt } from './ui';

const PLEASANT = '#55C38A';
const NEUTRAL = '#B8B3C7';
const DIFFICULT = '#E5717A';

/** Barras empilhadas por humor; a altura (apagada) mostra o volume do dia. */
export function ValenceTrend({ daily }: { daily: DailyValence[] }) {
  const { T } = useTheme();
  const bars = valenceBars(daily.slice(-7));
  const max = Math.max(1, ...bars.map((b) => b.total));
  if (bars.length === 0) {
    return (
      <Txt s={12.5} c={T.t3} style={{ marginTop: 12 }}>
        Sem leituras nos últimos dias.
      </Txt>
    );
  }
  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={bars
          .map(
            (b) =>
              `${new Date(b.at).toLocaleDateString('pt-BR', { weekday: 'long' })}: ${
                b.total === 0 ? 'sem leituras' : `${Math.round(b.difficult * 100)}% difícil, ${Math.round(b.pleasant * 100)}% agradável`
              }`
          )
          .join('; ')}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 92, marginTop: 14 }}
      >
        {bars.map((b) => {
          const height = b.total === 0 ? 6 : Math.max(18, Math.round((b.total / max) * 78));
          return (
            <View key={b.at} style={{ flex: 1, alignItems: 'center', gap: 5, justifyContent: 'flex-end', height: '100%' }}>
              <View style={{ width: '100%', height, borderRadius: 6, overflow: 'hidden', backgroundColor: T.bdL, opacity: b.total === 0 ? 0.6 : 1 }}>
                {b.total > 0 ? (
                  <>
                    <View style={{ flex: b.difficult, backgroundColor: DIFFICULT }} />
                    <View style={{ flex: b.neutral, backgroundColor: NEUTRAL }} />
                    <View style={{ flex: b.pleasant, backgroundColor: PLEASANT }} />
                  </>
                ) : null}
              </View>
              <Txt s={11} c={T.t3}>
                {new Date(b.at).toLocaleDateString('pt-BR', { weekday: 'narrow' })}
              </Txt>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          [PLEASANT, 'agradável'],
          [NEUTRAL, 'neutro'],
          [DIFFICULT, 'difícil'],
        ].map(([color, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
            <Txt s={11} c={T.t3}>
              {label}
            </Txt>
          </View>
        ))}
        <Txt s={11} c={T.t3}>
          · altura = quantidade de leituras
        </Txt>
      </View>
    </View>
  );
}

/**
 * Pedidos "preciso de você" ainda não atendidos. Fica FORA da cadeia
 * pausado/carregando/erro do painel (C1): a pausa esconde dados, não a voz
 * da pessoa. Avisa uma vez por pedido novo; falha ≠ "sem pedidos".
 */
export function CareRequestsBanner({
  link,
  name,
  refreshKey,
  onCount,
}: {
  link: CaregiverLink;
  name: string;
  refreshKey: number;
  onCount?: (n: number) => void;
}) {
  const { state } = useApp();
  const { T } = useTheme();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const notified = useRef(new Set<string>());
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  useEffect(() => {
    if (!link.cared_user_id) return;
    let alive = true;
    listOpenRequests(link.cared_user_id)
      .then((list) => {
        if (!alive) return;
        setRequests(list);
        setLoadError(false);
        onCountRef.current?.(list.length);
        for (const r of list) {
          if (notified.current.has(r.id)) continue;
          notified.current.add(r.id);
          // Aviso local (com o app aberto ou em segundo plano). O push remoto,
          // quando configurado, cobre o app fechado.
          scheduleOnce(2, 'MellowPet', `${name} pediu contato (${URGENCY_LABEL[r.urgency].toLowerCase()}).`, { kind: 'care_request' }).catch(
            () => undefined
          );
        }
      })
      .catch(() => {
        // Mantém os pedidos já mostrados; só avisa que não deu para conferir.
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [link.cared_user_id, name, refreshKey, retry]);

  if (requests.length === 0) {
    if (!loadError) return null;
    return (
      <Card radius={18} padding={13} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: WARN }}>
        <Txt s={12} lh={1.4} c={T.t2} style={{ flex: 1 }} accessibilityLiveRegion="polite">
          Não foi possível verificar se {name} pediu contato.
        </Txt>
        <CareLinkButton label="Tentar de novo" onPress={() => setRetry((n) => n + 1)} />
      </Card>
    );
  }
  const top = requests[0];
  const urgent = top.urgency === 'agora';
  const others = requests.length - 1;
  const acknowledge = () => {
    if (!state.userId || busy) return;
    setBusy(true);
    setAckError(null);
    setRequests((list) => list.filter((r) => r.id !== top.id));
    acknowledgeRequest(top.id, state.userId)
      .catch(() => {
        setRequests((list) => (list.some((r) => r.id === top.id) ? list : [top, ...list]));
        setAckError('Não foi possível marcar agora. O pedido continua aqui; tente de novo.');
      })
      .finally(() => setBusy(false));
  };
  return (
    <Card radius={22} padding={16} style={{ borderColor: urgent ? DANGER : WARN }}>
      <Txt s={11} w={800} c={urgent ? DANGER : T.t2} ls={1.1}>
        PEDIDO DE CONTATO · {URGENCY_LABEL[top.urgency].toUpperCase()}
      </Txt>
      <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 5 }} accessibilityRole="header">
        {name} pediu para falar com você
      </Txt>
      <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
        {new Date(top.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Ligue ou
        mande uma mensagem quando puder — e marque aqui quando tiver visto.
        {others > 0 ? ` Há mais ${others} pedido${others === 1 ? '' : 's'} em aberto.` : ''}
      </Txt>
      {isPaused(link) ? (
        <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 6 }}>
          O compartilhamento de dados está pausado, mas pedidos de contato continuam chegando.
        </Txt>
      ) : null}
      <CarePillButton
        label={busy ? 'Marcando…' : `Vi, vou falar com ${name}`}
        onPress={acknowledge}
        disabled={busy}
        style={{ marginTop: 12, alignSelf: 'flex-start' }}
      />
      <ActionMessage message={ackError ? { text: ackError, tone: 'error' } : null} onClose={() => setAckError(null)} />
    </Card>
  );
}

/**
 * Carinho mediado pelo pet: o Mellow da outra pessoa entrega. Durante a pausa
 * o servidor recusa o envio, então a interface explica em vez de oferecer (C3).
 */
export function GestureCard({ link, name }: { link: CaregiverLink; name: string }) {
  const { state } = useApp();
  const { T } = useTheme();
  const [sent, setSent] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const paused = isPaused(link);
  return (
    <Card radius={24} padding={18}>
      <Txt s={15} w={800} c={T.t1}>
        Mandar um carinho
      </Txt>
      {paused ? (
        <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
          Indisponível enquanto {name} pausa o compartilhamento. A pausa é um pedido de espaço: o carinho volta a ficar disponível
          quando ela retomar.
        </Txt>
      ) : (
        <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
          Quem entrega é o pet de {name}, com uma animação — sem cara de cobrança, sem pedir resposta.
        </Txt>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {GESTURES.map((g) => (
          <CarePillButton
            key={g.kind}
            label={busy === g.kind ? 'Enviando…' : g.label}
            disabled={busy !== null || paused}
            hint={paused ? 'Indisponível durante a pausa' : undefined}
            onPress={() => {
              if (!state.userId) return;
              setBusy(g.kind);
              setSent(null);
              sendGesture(link, state.userId, g.kind)
                .then(() => setSent({ text: `Enviado: ${g.label.toLowerCase()}.`, tone: 'ok' }))
                .catch((e: Error) => setSent({ text: e.message, tone: 'error' }))
                .finally(() => setBusy(null));
            }}
          />
        ))}
      </View>
      <ActionMessage message={sent} onClose={() => setSent(null)} />
    </Card>
  );
}

/** Resumo por regras (sem IA) — usado também como reserva do resumo por IA. */
function RuleSummary({ name, events, daily, openAlerts }: { name: string; events: number; daily: DailyValence[]; openAlerts: number }) {
  const { T } = useTheme();
  const week = weekSummary({ name, events, daily, openAlerts });
  return (
    <>
      {week.sentences.map((s) => (
        <Txt key={s} s={13.5} lh={1.55} c={T.t1} style={{ marginTop: 6 }}>
          {s}
        </Txt>
      ))}
      <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 10, fontStyle: 'italic' }}>
        {week.suggestion}
      </Txt>
    </>
  );
}

type DigestState =
  | { kind: 'loading' }
  | { kind: 'ai'; text: string; daily: DailyValence[]; events: number }
  | { kind: 'rules'; daily: DailyValence[]; events: number; reason: 'no_ai' | 'offline' | 'few' }
  | { kind: 'error' };

/**
 * Resumo da última semana completa. Pede à IA (/care/weekly) só agregados
 * diários, guarda o texto no aparelho por vínculo + semana e cai no resumo por
 * regras quando não há IA, rede ou dados. Nunca é diagnóstico.
 */
export function WeeklySummaryCard({ link, name, openAlerts }: { link: CaregiverLink; name: string; openAlerts: number }) {
  const { T } = useTheme();
  const weekStart = lastCompleteWeekStart();
  const [state, setState] = useState<DigestState>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);
  const paused = isPaused(link);
  const cared = link.cared_user_id;
  const relationship = link.relationship;

  useEffect(() => {
    if (!cared || paused) return undefined;
    let alive = true;
    setState({ kind: 'loading' });
    const cacheKey = weeklyCacheKey(link.id, weekStart);
    (async () => {
      const summary = await fetchCareDashboardSummary(cared, 24 * 15);
      const input = buildWeeklyInput(summary.daily, weekStart, openAlerts, relationship);
      const weekDaily: DailyValence[] = input.days.map((d) => ({ at: d.day, count: d.total, pleasant: d.pleasant, neutral: d.neutral, difficult: d.difficult }));
      const events = weekTotal(input);
      if (!alive) return;
      if (events < 3) {
        setState({ kind: 'rules', daily: weekDaily, events, reason: 'few' });
        return;
      }
      const cached = parseDigest(await SecureStore.getItemAsync(cacheKey).catch(() => null), weekStart);
      if (cached) {
        if (alive) setState({ kind: 'ai', text: cached.text, daily: weekDaily, events });
        return;
      }
      try {
        const output = await fetchWeeklySummary(input);
        if (!alive) return;
        if (!output.text) {
          setState({ kind: 'rules', daily: weekDaily, events, reason: 'no_ai' });
          return;
        }
        const raw = serializeDigest(weekStart, output);
        if (raw) SecureStore.setItemAsync(cacheKey, raw).catch(() => undefined);
        setState({ kind: 'ai', text: output.text, daily: weekDaily, events });
      } catch {
        if (alive) setState({ kind: 'rules', daily: weekDaily, events, reason: 'offline' });
      }
    })().catch(() => {
      if (alive) setState({ kind: 'error' });
    });
    return () => {
      alive = false;
    };
    // openAlerts muda com o polling; não refaz a chamada por isso (o cache é por semana).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cared, link.id, paused, weekStart, relationship, retry]);

  return (
    <Card radius={24} padding={18}>
      <Txt s={11} w={800} c={T.pri} ls={1.1}>
        RESUMO DA SEMANA · {weekLabel(weekStart)}
      </Txt>
      {paused ? (
        <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 6 }}>
          Sem resumo enquanto o compartilhamento está pausado.
        </Txt>
      ) : state.kind === 'loading' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <ActivityIndicator color={T.pri} />
          <Txt s={12.5} c={T.t3} accessibilityLiveRegion="polite">
            Preparando o resumo…
          </Txt>
        </View>
      ) : state.kind === 'error' ? (
        <View style={{ marginTop: 6 }}>
          <Txt s={12.5} lh={1.5} c={T.t2} accessibilityRole="alert">
            Não foi possível montar o resumo agora.
          </Txt>
          <CareLinkButton label="Tentar de novo" onPress={() => setRetry((n) => n + 1)} />
        </View>
      ) : state.kind === 'ai' ? (
        <>
          <Txt s={13.5} lh={1.6} c={T.t1} style={{ marginTop: 8 }}>
            {state.text}
          </Txt>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 10 }}>
            Resumo gerado por IA a partir de contagens diárias, não é diagnóstico. Use como ponto de partida para conversar.
          </Txt>
        </>
      ) : (
        <>
          <RuleSummary name={name} events={state.events} daily={state.daily} openAlerts={openAlerts} />
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 10 }}>
            {state.reason === 'offline'
              ? 'Resumo automático por regras (sem conexão com a IA agora). Não é diagnóstico.'
              : 'Resumo automático por regras, não é diagnóstico.'}
          </Txt>
        </>
      )}
    </Card>
  );
}

const MODE_KEY = 'mellowpet.care.weekly.v1';
const OPENS_KEY = 'mellowpet.care.opens.v1';

/** Preferência "resumo semanal" do cuidador, deste aparelho. */
export function useWeeklyMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY)
      .then((v) => setOn(v === 'on'))
      .catch(() => undefined);
  }, []);
  const set = (next: boolean) => {
    setOn(next);
    SecureStore.setItemAsync(MODE_KEY, next ? 'on' : 'off').catch(() => undefined);
  };
  return [on, set];
}

/** Conta aberturas do painel no dia (cuidado com o excesso de checagem). */
export function usePanelOpens(): number {
  const [opens, setOpens] = useState(0);
  useEffect(() => {
    const today = localDay();
    SecureStore.getItemAsync(OPENS_KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as { day: string; n: number }) : null;
        const n = saved?.day === today ? saved.n + 1 : 1;
        setOpens(n);
        return SecureStore.setItemAsync(OPENS_KEY, JSON.stringify({ day: today, n }));
      })
      .catch(() => undefined);
  }, []);
  return opens;
}

/** Bem-estar de quem cuida: aviso de checagem + respiração de 1 minuto + check-in. */
export function CaregiverWellbeingCard({ opens }: { opens: number }) {
  const { T } = useTheme();
  const nudge = checkingNudge(opens);
  const [breathing, setBreathing] = useState(false);
  const [feeling, setFeeling] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!breathing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(4000),
        Animated.timing(scale, { toValue: 0.6, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    const stop = setTimeout(() => setBreathing(false), 60_000);
    return () => {
      loop.stop();
      clearTimeout(stop);
    };
  }, [breathing, scale]);

  return (
    <Card radius={24} padding={18}>
      <Txt s={15} w={800} c={T.t1}>
        E você, como está?
      </Txt>
      {nudge ? (
        <Txt s={12.5} lh={1.5} c={WARN} style={{ marginTop: 6 }}>
          {nudge}
        </Txt>
      ) : (
        <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
          Cuidar cansa. Um minuto para você também conta como cuidado.
        </Txt>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {['Bem', 'Cansado(a)', 'Sobrecarregado(a)'].map((f) => (
          <Touchable
            key={f}
            onPress={() => setFeeling(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: feeling === f }}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: feeling === f ? T.pri : T.chipBg }}
          >
            <Txt s={12} w={800} c={feeling === f ? T.onPri : T.t2}>
              {f}
            </Txt>
          </Touchable>
        ))}
      </View>
      {feeling === 'Sobrecarregado(a)' ? (
        <Touchable onPress={() => Linking.openURL('tel:188').catch(() => undefined)} accessibilityRole="button" style={{ marginTop: 10 }}>
          <Txt s={12} lh={1.45} c={T.t2}>
            Quem cuida também pode pedir ajuda. O CVV (188) atende você também, 24h. <Txt s={12} w={800} c={T.pri}>Ligar</Txt>
          </Txt>
        </Touchable>
      ) : feeling === 'Cansado(a)' ? (
        <Txt s={12} lh={1.45} c={T.t2} style={{ marginTop: 10 }}>
          Tudo bem fechar o painel por hoje. Alertas importantes continuam chegando.
        </Txt>
      ) : null}
      {breathing ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Animated.View style={{ width: 110, height: 110, borderRadius: 999, backgroundColor: T.priL, transform: [{ scale }] }} />
          <Txt s={12} c={T.t2} style={{ marginTop: 10 }}>
            Inspire enquanto cresce · segure · solte enquanto diminui
          </Txt>
        </View>
      ) : (
        <Touchable onPress={() => setBreathing(true)} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Txt s={12.5} w={800} c={T.pri}>
            Respirar 1 minuto
          </Txt>
        </Touchable>
      )}
    </Card>
  );
}

/** O que o cuidador vê quando a pessoa pausou o compartilhamento. */
export function PausedCard({ name, until }: { name: string; until: string }) {
  const { T } = useTheme();
  return (
    <Card radius={24} padding={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon d={EXTRA_ICONS.cloud} size={18} color={T.t3} />
        <Txt s={15} w={800} c={T.t1}>
          Compartilhamento pausado
        </Txt>
      </View>
      <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
        {name} pausou o compartilhamento até{' '}
        {new Date(until).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Isso é um pedido de
        privacidade, não de afastamento — o vínculo continua e volta sozinho.
      </Txt>
      <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 8 }}>
        Se {name} pedir contato, o pedido aparece aqui mesmo durante a pausa. Dados, resumo e carinho voltam quando ela retomar.
      </Txt>
    </Card>
  );
}
