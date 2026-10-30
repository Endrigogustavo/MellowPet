import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Linking, View } from 'react-native';

import { listLinks, type CaregiverLink } from '../care/careClient';
import {
  GESTURES,
  URGENCY_LABEL,
  isPaused,
  markGestureSeen,
  nextUnseenGesture,
  pauseSharing,
  requestContact,
  type Gesture,
  type Urgency,
} from '../care/presenceClient';
import { stageForDays } from '../pet/growth';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, hexA } from '../theme/palette';
import { PetFace } from './PetFace';
import { Card, PrimaryButton, Touchable, Txt } from './ui';

/**
 * "Preciso de você": voz ativa de quem é acompanhado. Um toque, com o nível
 * de urgência; o cuidador recebe o pedido (e um push, quando configurado).
 */
export function NeedYouCard() {
  const { state } = useApp();
  const { T } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState<Urgency | null>(null);

  if (!state.linked || state.role === 'care') return null;

  const ask = (urgency: Urgency) => {
    if (!state.userId || busy) return;
    setBusy(true);
    setSending(urgency);
    requestContact(state.userId, urgency)
      .then(() => {
        // Honesto (C2): o pedido fica no painel dele; o aviso no celular depende
        // das notificações dele estarem ligadas.
        setResult({
          text: 'Pedido enviado. Ele aparece no painel do seu cuidador assim que ele abrir o app — e como aviso no celular, se as notificações dele estiverem ligadas.',
          ok: true,
        });
        setOpen(false);
      })
      .catch((e: Error) =>
        setResult({
          text: `${e.message} Se precisar de alguém agora, ligue direto para seu cuidador ou para o CVV (188).`,
          ok: false,
        })
      )
      .finally(() => {
        setBusy(false);
        setSending(null);
      });
  };

  return (
    <Card radius={22} padding={16}>
      {!open ? (
        <Touchable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Preciso de você: pedir contato ao cuidador">
          <Txt s={14.5} w={800} c={T.t1}>
            Preciso de você
          </Txt>
          <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
            Peça para seu cuidador falar com você. Sem explicar nada.
          </Txt>
        </Touchable>
      ) : (
        <>
          <Txt s={14.5} w={800} c={T.t1}>
            Quando você precisa?
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
              <Touchable
                key={u}
                onPress={() => ask(u)}
                disabled={busy}
                accessibilityRole="button"
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 15,
                  borderRadius: 999,
                  minHeight: 44,
                  justifyContent: 'center',
                  backgroundColor: u === 'agora' ? hexA(DANGER, 0.14) : T.priL,
                  opacity: busy && sending !== u ? 0.5 : 1,
                }}
              >
                <Txt s={13} w={800} c={u === 'agora' ? DANGER : T.pri}>
                  {sending === u ? 'Enviando…' : URGENCY_LABEL[u]}
                </Txt>
              </Touchable>
            ))}
          </View>
          <Touchable onPress={() => setOpen(false)} accessibilityRole="button" style={{ marginTop: 10 }}>
            <Txt s={12} w={800} c={T.t3}>
              Agora não
            </Txt>
          </Touchable>
        </>
      )}
      {result ? (
        <View style={{ marginTop: 10 }}>
          <Txt
            s={12}
            lh={1.45}
            c={result.ok ? T.t1 : DANGER}
            accessibilityRole={result.ok ? 'text' : 'alert'}
            accessibilityLiveRegion="polite"
          >
            {result.text}
          </Txt>
          {!result.ok ? (
            <Touchable
              onPress={() => Linking.openURL('tel:188').catch(() => undefined)}
              accessibilityRole="button"
              accessibilityLabel="Ligar para o CVV, 188"
              style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
            >
              <Txt s={12.5} w={800} c={T.pri}>
                Ligar para o CVV (188)
              </Txt>
            </Touchable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Entrega do carinho: o pet aparece feliz com o recado do cuidador. Confere
 * ao abrir a Home e a cada minuto com ela aberta.
 */
export function GestureDelivery() {
  const { state } = useApp();
  const { T } = useTheme();
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [from, setFrom] = useState('Seu cuidador');
  const pop = useRef(new Animated.Value(0)).current;

  const check = useCallback(() => {
    if (!state.userId || !state.linked || state.role === 'care') return;
    nextUnseenGesture(state.userId).then((g) => {
      if (!g) return;
      setGesture(g);
      listLinks(state.userId!, 'user')
        .then(({ links }) => {
          const link = links.find((l) => l.id === g.caregiver_link_id);
          const name = link?.caregiver_display_name?.trim() || link?.caregiver_email?.split('@')[0];
          if (name) setFrom(name);
        })
        .catch(() => undefined);
    });
  }, [state.userId, state.linked, state.role]);

  useEffect(() => {
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [check]);

  useEffect(() => {
    if (!gesture) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [gesture, pop]);

  if (!gesture) return null;
  const text = GESTURES.find((g) => g.kind === gesture.kind)?.delivered ?? 'mandou um carinho';
  const receive = () => {
    markGestureSeen(gesture.id).catch(() => undefined);
    setGesture(null);
    check();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pop }], opacity: pop }}>
      <Card radius={24} padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PetFace size={64} petType={state.petType} emotion="happy" stage={stageForDays(state.careDays)} accessory={state.habits.equipped} />
        <View style={{ flex: 1 }}>
          <Txt s={13.5} lh={1.45} w={800} c={T.t1}>
            {state.petName} trouxe um recado: {from} {text}.
          </Txt>
          <Touchable onPress={receive} accessibilityRole="button" style={{ marginTop: 8 }}>
            <Txt s={12.5} w={800} c={T.pri}>
              Receber o carinho
            </Txt>
          </Touchable>
        </View>
      </Card>
    </Animated.View>
  );
}

/** Pausar ou retomar o compartilhamento de um vínculo, sem encerrá-lo. */
export function PauseSharing({ link, onChange }: { link: CaregiverLink; onChange: () => void }) {
  const { T } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = isPaused(link);
  const run = (hours: 0 | 24 | 168) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    pauseSharing(link.id, hours)
      .then(onChange)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ marginTop: 12 }}>
      <Txt s={12} w={800} c={T.t1}>
        {paused
          ? `Compartilhamento pausado até ${new Date(link.paused_until!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
          : 'Precisa de privacidade sem desconectar?'}
      </Txt>
      <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 2 }}>
        {paused ? 'Seu cuidador vê só “compartilhamento pausado”.' : 'Pause: seu cuidador vê só “compartilhamento pausado”, e o vínculo continua.'}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {paused ? (
          <PrimaryButton label={busy ? 'Retomando…' : 'Retomar agora'} disabled={busy} onPress={() => run(0)} />
        ) : (
          ([
            [24, 'Pausar 24 h'],
            [168, 'Pausar 7 dias'],
          ] as const).map(([h, label]) => (
            <Touchable
              key={h}
              onPress={() => run(h)}
              disabled={busy}
              accessibilityRole="button"
              style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, backgroundColor: T.priL, opacity: busy ? 0.5 : 1 }}
            >
              <Txt s={12} w={800} c={T.pri}>
                {label}
              </Txt>
            </Touchable>
          ))
        )}
      </View>
      {error ? (
        <Txt s={11.5} c={DANGER} style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
