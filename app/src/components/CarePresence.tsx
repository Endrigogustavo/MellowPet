import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, View } from 'react-native';

import type { CaregiverLink } from '../care/careClient';
import { checkingNudge, valenceBars, weekSummary, type DailyValence } from '../care/careWeekly';
import {
  GESTURES,
  URGENCY_LABEL,
  acknowledgeRequest,
  listOpenRequests,
  sendGesture,
  type CareRequest,
} from '../care/presenceClient';
import { EXTRA_ICONS } from '../data/content';
import { scheduleOnce } from '../notifications/notifications';
import { localDay } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN } from '../theme/palette';
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
              <Txt s={9} c={T.t3}>
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
            <Txt s={10.5} c={T.t3}>
              {label}
            </Txt>
          </View>
        ))}
        <Txt s={10.5} c={T.t3}>
          · altura = quantidade de leituras
        </Txt>
      </View>
    </View>
  );
}

/** Pedidos "preciso de você" ainda não atendidos. Avisa uma vez por pedido novo. */
export function CareRequestsBanner({ link, name, refreshKey }: { link: CaregiverLink; name: string; refreshKey: number }) {
  const { state } = useApp();
  const { T } = useTheme();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    if (!link.cared_user_id) return;
    let alive = true;
    listOpenRequests(link.cared_user_id).then((list) => {
      if (!alive) return;
      setRequests(list);
      for (const r of list) {
        if (notified.current.has(r.id)) continue;
        notified.current.add(r.id);
        // Aviso local (com o app aberto ou em segundo plano). O push remoto,
        // quando configurado, cobre o app fechado.
        scheduleOnce(2, 'MellowPet', `${name} pediu contato (${URGENCY_LABEL[r.urgency].toLowerCase()}).`, { kind: 'care_request' }).catch(
          () => undefined
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [link.cared_user_id, name, refreshKey]);

  if (requests.length === 0) return null;
  const top = requests[0];
  const urgent = top.urgency === 'agora';
  return (
    <Card radius={22} padding={16} style={{ borderColor: urgent ? DANGER : WARN }}>
      <Txt s={11} w={800} c={urgent ? DANGER : WARN} ls={1.1}>
        PEDIDO DE CONTATO · {URGENCY_LABEL[top.urgency].toUpperCase()}
      </Txt>
      <Txt s={14.5} w={800} c={T.t1} style={{ marginTop: 5 }}>
        {name} pediu para falar com você
      </Txt>
      <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
        {new Date(top.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Ligue ou
        mande uma mensagem quando puder — e marque aqui para ela saber que você viu.
      </Txt>
      <Touchable
        onPress={() => {
          if (!state.userId) return;
          setRequests((list) => list.filter((r) => r.id !== top.id));
          acknowledgeRequest(top.id, state.userId).catch(() => setRequests(requests));
        }}
        accessibilityRole="button"
        style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.priL }}
      >
        <Txt s={12.5} w={800} c={T.pri}>
          Vi, vou falar com {name}
        </Txt>
      </Touchable>
    </Card>
  );
}

/** Carinho mediado pelo pet: o Mellow da outra pessoa entrega. */
export function GestureCard({ link, name }: { link: CaregiverLink; name: string }) {
  const { state } = useApp();
  const { T } = useTheme();
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card radius={24} padding={18}>
      <Txt s={15} w={800} c={T.t1}>
        Mandar um carinho
      </Txt>
      <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
        Quem entrega é o pet de {name}, com uma animação — sem cara de cobrança, sem pedir resposta.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {GESTURES.map((g) => (
          <Touchable
            key={g.kind}
            disabled={busy}
            onPress={() => {
              if (!state.userId) return;
              setBusy(true);
              sendGesture(link, state.userId, g.kind)
                .then(() => setSent(`Enviado: ${g.label.toLowerCase()}.`))
                .catch((e: Error) => setSent(e.message))
                .finally(() => setBusy(false));
            }}
            accessibilityRole="button"
            style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, backgroundColor: T.priL, opacity: busy ? 0.5 : 1 }}
          >
            <Txt s={12.5} w={800} c={T.pri}>
              {g.label}
            </Txt>
          </Touchable>
        ))}
      </View>
      {sent ? (
        <Txt s={12} c={T.t2} style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
          {sent}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Resumo da semana em 3 frases (modo "menos monitoramento"). */
export function WeeklySummaryCard({ name, events, daily, openAlerts }: { name: string; events: number; daily: DailyValence[]; openAlerts: number }) {
  const { T } = useTheme();
  const week = weekSummary({ name, events, daily, openAlerts });
  return (
    <Card radius={24} padding={18}>
      <Txt s={11} w={800} c={T.pri} ls={1.1}>
        RESUMO DA SEMANA
      </Txt>
      {week.sentences.map((s) => (
        <Txt key={s} s={13.5} lh={1.55} c={T.t1} style={{ marginTop: 6 }}>
          {s}
        </Txt>
      ))}
      <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 10, fontStyle: 'italic' }}>
        {week.suggestion}
      </Txt>
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
            <Txt s={12} w={800} c={feeling === f ? '#fff' : T.t2}>
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
      <Txt s={11.5} c={OK} style={{ marginTop: 8 }}>
        Você ainda pode mandar um carinho.
      </Txt>
    </Card>
  );
}
