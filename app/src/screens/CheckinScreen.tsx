import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, View } from 'react-native';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, Chip, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import {
  CHECKIN_EMOTIONS,
  CHECKIN_TAGS,
  createCheckin,
  deleteCheckin,
  listCheckins,
  NOTE_MAX,
  type Checkin,
  type CheckinTag,
} from '../checkins/checkinClient';
import { EXTRA_ICONS, ICONS } from '../data/content';
import { EMOTIONS, FACE_ICON, type EmotionKey } from '../data/emotions';
import { bumpProfileStats } from '../profile/profileClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, hexA } from '../theme/palette';
import MellowVoice, { isVoiceAvailable } from '../../modules/mellow-voice';
import { suggestTags } from '../checkins/tagSuggest';

/** XP por check-in. Menor que alimentar (6): é reflexão, não cuidado ativo —
 * mas tem de valer alguma coisa, senão ninguém volta. */
const CHECKIN_XP = 5;

/** Janela em que a pergunta sobre o sono aparece aberta por padrão. Fora
 * dela continua disponível, só recolhida — quem faz check-in às 22h não
 * precisa ver "como dormiu?" na cara. */
const MORNING_UNTIL_HOUR = 12;

const SLEEP_LABELS = ['Péssimo', 'Ruim', 'Ok', 'Bem', 'Ótimo'];

const DAY_MS = 24 * 3_600_000;

function FaceButton({
  emotion,
  on,
  onPress,
}: {
  emotion: EmotionKey;
  on: boolean;
  onPress: () => void;
}) {
  const { T } = useTheme();
  const e = EMOTIONS[emotion];
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: on ? 1.08 : 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [on, scale]);
  return (
    <Touchable onPress={onPress} accessibilityLabel={e.label} accessibilityState={{ selected: on }}>
      <Animated.View
        style={{
          width: 88,
          alignItems: 'center',
          gap: 6,
          paddingVertical: 10,
          borderRadius: 18,
          backgroundColor: on ? hexA(e.c, 0.18) : T.bg,
          borderWidth: 1.5,
          borderColor: on ? e.c : T.bd,
          transform: [{ scale }],
        }}
      >
        <Icon
          d={[FACE_ICON[emotion], 'M9 9.5h.01', 'M15 9.5h.01']}
          size={30}
          color={on ? e.c : T.t2}
          sw={1.9}
          circle
        />
        <Txt s={11} w={800} c={on ? e.c : T.t2} numberOfLines={1}>
          {e.label}
        </Txt>
      </Animated.View>
    </Touchable>
  );
}

/** Aparece uma vez, depois de salvar: o que você disse × o que a câmera viu.
 * É o dado que a apresentação quer mostrar, então merece um momento. */
function Comparison({ checkin, onDone }: { checkin: Checkin; onDone: () => void }) {
  const { T } = useTheme();
  const said = EMOTIONS[checkin.emotion];
  const seen = checkin.detectedEmotion ? EMOTIONS[checkin.detectedEmotion] : null;
  const match = seen != null && checkin.detectedEmotion === checkin.emotion;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const Face = ({ k, tag }: { k: EmotionKey; tag: string }) => {
    const e = EMOTIONS[k];
    return (
      <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: hexA(e.c, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={[FACE_ICON[k], 'M9 9.5h.01', 'M15 9.5h.01']} size={34} color={e.c} sw={1.9} circle />
        </View>
        <Txt s={11} w={800} c={T.t3} ls={1.2}>
          {tag}
        </Txt>
        <Txt s={13} w={800} c={e.c}>
          {e.label}
        </Txt>
      </View>
    );
  };

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      <Card radius={24} padding={20}>
        <Txt s={11} w={800} c={T.t3} ls={1.6}>
          CHECK-IN SALVO
        </Txt>
        {seen ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <Face k={checkin.emotion} tag="VOCÊ DISSE" />
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: match ? hexA(OK, 0.14) : T.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon d={match ? ICONS.check : ICONS.swap} size={16} color={match ? OK : T.t3} sw={2.2} />
              </View>
              <Face k={checkin.detectedEmotion as EmotionKey} tag="O MELLOW LEU" />
            </View>
            <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 14 }}>
              {match
                ? 'Bateu. O que você sente e o que o rosto mostra estão alinhados agora.'
                : 'Diferente — e isso é normal. O rosto nem sempre acompanha o que a gente sente por dentro. Com o tempo dá para ver quando essas duas leituras se afastam.'}
            </Txt>
          </>
        ) : (
          <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 10 }}>
            Registrado como {said.label.toLowerCase()}. Não havia leitura da câmera neste momento para comparar.
          </Txt>
        )}
        <PrimaryButton label="Fechar" onPress={onDone} style={{ marginTop: 16 }} />
      </Card>
    </Animated.View>
  );
}

export function CheckinScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();

  const [emotion, setEmotion] = useState<EmotionKey | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<CheckinTag[]>([]);
  const [sleep, setSleep] = useState<number | null>(null);
  const [sleepOpen, setSleepOpen] = useState(new Date().getHours() < MORNING_UNTIL_HOUR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<Checkin | null>(null);
  const voiceOk = useMemo(() => isVoiceAvailable(), []);
  const suggested = useMemo(() => suggestTags(note, tags), [note, tags]);
  // Diário por voz: o ditado do sistema devolve só o texto, que entra na nota.
  const dictate = () => {
    MellowVoice?.listen('Como foi o seu dia?')
      .then((text) => {
        if (text) setNote((prev) => `${prev ? `${prev} ` : ''}${text}`.slice(0, NOTE_MAX));
      })
      .catch(() => undefined);
  };

  const [recent, setRecent] = useState<Checkin[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const hasReading = state.signalStatus === 'ready' && state.observedExpression !== 'unknown';
  const reading = hasReading ? EMOTIONS[state.observedExpression] : null;

  const reload = useCallback(() => {
    if (!state.userId) return;
    setLoadingRecent(true);
    setRecentError(null);
    listCheckins(state.userId, Date.now() - 7 * DAY_MS)
      .then(setRecent)
      .catch((e: Error) => setRecentError(e.message))
      .finally(() => setLoadingRecent(false));
  }, [state.userId]);

  useEffect(reload, [reload]);

  const toggleTag = (t: CheckinTag) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const save = async () => {
    if (!emotion || !state.userId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCheckin(state.userId, {
        emotion,
        note,
        tags,
        sleepQuality: sleep,
        detectedEmotion: hasReading ? state.observedExpression : null,
        detectedConfidence: hasReading ? state.signalConfidence : null,
      });
      setJustSaved(created);
      actions.markCare();
      actions.habit('checkin');
      actions.learnFromCheckin(created.emotion, created.detectedEmotion);
      setRecent((prev) => [created, ...prev]);
      actions.set((s) => ({ xp: s.xp + CHECKIN_XP }));
      bumpProfileStats({ xp: CHECKIN_XP }).then((stats) => {
        if (stats) actions.set(stats);
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setJustSaved(null);
    setEmotion(null);
    setNote('');
    setTags([]);
    setSleep(null);
  };

  const removeNow = async (c: Checkin) => {
    setRecent((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await deleteCheckin(c.id);
    } catch (e) {
      setRecentError((e as Error).message);
      reload();
    }
  };
  // Apagar é definitivo (não existe editar): pede confirmação.
  const remove = (c: Checkin) =>
    Alert.alert('Apagar este check-in?', 'Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeNow(c).catch(() => undefined) },
    ]);

  const when = useMemo(
    () => (iso: string) => {
      const d = new Date(iso);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (sameDay) return `hoje ${hm}`;
      return `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
    },
    []
  );

  return (
    <ScreenScroll>
      <ScreenTitle label="DIÁRIO" title={'Como você\nestá agora?'} />

      {justSaved ? (
        <Section top={0}>
          <Comparison checkin={justSaved} onDone={reset} />
        </Section>
      ) : (
        <>
          {/* leitura atual da câmera — contexto, não sugestão */}
          {reading ? (
            <Section top={0}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: hexA(reading.c, 0.12),
                }}
              >
                <Icon
                  d={[FACE_ICON[state.observedExpression], 'M9 9.5h.01', 'M15 9.5h.01']}
                  size={22}
                  color={reading.c}
                  sw={1.9}
                  circle
                />
                <Txt s={12} lh={1.45} c={T.t2} style={{ flex: 1 }}>
                  O Mellow está lendo <Txt s={12} w={800} c={reading.c}>{reading.label.toLowerCase()}</Txt> no seu rosto.
                  Diga o que você sente de verdade — não precisa bater.
                </Txt>
              </View>
            </Section>
          ) : null}

          {/* emoção */}
          <Section top={reading ? 12 : 0}>
            <Card radius={24} padding={20}>
              <Txt s={13.5} w={800} c={T.t1}>
                Eu me sinto…
              </Txt>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 14,
                  justifyContent: 'center',
                }}
              >
                {CHECKIN_EMOTIONS.map((k) => (
                  <FaceButton key={k} emotion={k} on={emotion === k} onPress={() => setEmotion(k)} />
                ))}
              </View>
            </Card>
          </Section>

          {/* contexto */}
          <Section>
            <Card radius={24} padding={20}>
              <Txt s={13.5} w={800} c={T.t1}>
                Tem a ver com…
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                Opcional. Com o tempo, o app mostra quais contextos costumam vir com cada sentimento.
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {CHECKIN_TAGS.map(([key, label]) => (
                  <Chip key={key} label={label} on={tags.includes(key)} onPress={() => toggleTag(key)} />
                ))}
              </View>
            </Card>
          </Section>

          {/* sono */}
          <Section>
            <Card radius={24} padding={20}>
              <Touchable
                onPress={() => setSleepOpen((o) => !o)}
                accessibilityLabel={sleepOpen ? 'Recolher pergunta sobre o sono' : 'Responder sobre o sono'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Txt s={13.5} w={800} c={T.t1}>
                    Como você dormiu?
                  </Txt>
                  <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                    {sleep != null ? SLEEP_LABELS[sleep - 1] : 'Opcional. Cruzado com o humor do dia.'}
                  </Txt>
                </View>
                <Icon d={ICONS.chevron} size={16} color={T.t3} sw={2} rotate={sleepOpen ? 90 : 0} />
              </Touchable>
              {sleepOpen ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  {SLEEP_LABELS.map((label, i) => {
                    const v = i + 1;
                    const on = sleep === v;
                    return (
                      <Touchable
                        key={v}
                        onPress={() => setSleep(on ? null : v)}
                        accessibilityLabel={`Sono: ${label}`}
                        accessibilityState={{ selected: on }}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderRadius: 14,
                          backgroundColor: on ? T.pri : T.bg,
                          borderWidth: 1,
                          borderColor: on ? T.pri : T.bd,
                        }}
                      >
                        <Txt s={15} w={800} c={on ? T.onPri : T.t1}>
                          {v}
                        </Txt>
                        <Txt numberOfLines={1} adjustsFontSizeToFit s={11} w={700} c={on ? T.onPri : T.t3} style={{ marginTop: 2 }}>
                          {label}
                        </Txt>
                      </Touchable>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          </Section>

          {/* nota */}
          <Section>
            <Card radius={24} padding={20}>
              <Field
                label="Quer anotar algo?"
                placeholder="Uma frase basta."
                value={note}
                onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
                multiline
                maxLength={NOTE_MAX}
                hint={`${note.length}/${NOTE_MAX}`}
              />
              {voiceOk ? (
                <Touchable
                  onPress={dictate}
                  accessibilityLabel="Ditar o diário por voz"
                  style={{
                    marginTop: 10,
                    alignSelf: 'flex-start',
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: T.priL,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon d={EXTRA_ICONS.mic} size={15} color={T.pri} sw={2} />
                    <Txt s={12.5} w={800} c={T.pri}>
                      Ditar
                    </Txt>
                  </View>
                </Touchable>
              ) : null}
              {suggested.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Txt s={11.5} c={T.t3} style={{ marginBottom: 6 }}>
                    Parece ter a ver com — toque para marcar:
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {suggested.map((t) => (
                      <Chip
                        key={t}
                        label={`+ ${CHECKIN_TAGS.find(([k]) => k === t)?.[1] ?? t}`}
                        on={false}
                        onPress={() => toggleTag(t)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>
          </Section>

          <Section>
            {error ? (
              <Txt
                s={12.5}
                lh={1.5}
                c={DANGER}
                style={{ marginBottom: 10 }}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Txt>
            ) : null}
            <PrimaryButton
              label="Registrar"
              onPress={save}
              loading={saving}
              disabled={!emotion}
              accessibilityHint={!emotion ? 'Escolha antes como você se sente' : undefined}
            />
            {!emotion ? (
              <Txt s={11.5} c={T.t3} style={{ marginTop: 8, textAlign: 'center' }}>
                Escolha como se sente para registrar.
              </Txt>
            ) : null}
          </Section>
        </>
      )}

      {/* últimos 7 dias */}
      <Section top={28}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Txt s={13.5} w={800} c={T.t1}>
            Últimos 7 dias
          </Txt>
          <Touchable onPress={() => actions.go('heatmap')} accessibilityLabel="Abrir mapa emocional">
            <Txt s={12} w={800} c={T.pri}>
              Ver o mês
            </Txt>
          </Touchable>
        </View>
        {recentError ? (
          <Txt
            s={12}
            lh={1.45}
            c={DANGER}
            style={{ marginTop: 8 }}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {recentError}
          </Txt>
        ) : null}
        {loadingRecent ? (
          <ActivityIndicator color={T.pri} style={{ marginTop: 16 }} />
        ) : recent.length === 0 ? (
          <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 8 }}>
            Nenhum check-in ainda. O primeiro é o que começa a história.
          </Txt>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {recent.map((c) => {
              const e = EMOTIONS[c.emotion];
              const seen = c.detectedEmotion ? EMOTIONS[c.detectedEmotion] : null;
              const match = c.detectedEmotion === c.emotion;
              return (
                <Card key={c.id} radius={18} padding={12} style={{ paddingHorizontal: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: hexA(e.c, 0.16),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon d={[FACE_ICON[c.emotion], 'M9 9.5h.01', 'M15 9.5h.01']} size={20} color={e.c} sw={1.9} circle />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Txt s={13} w={800} c={T.t1}>
                          {e.label}
                        </Txt>
                        <Txt s={11} c={T.t3}>
                          {when(c.createdAt)}
                        </Txt>
                      </View>
                      {seen ? (
                        <Txt s={11} c={match ? OK : T.t3} style={{ marginTop: 2 }}>
                          {match ? 'câmera concordou' : `câmera leu ${seen.label.toLowerCase()}`}
                        </Txt>
                      ) : null}
                      {c.note ? (
                        <Txt s={12} lh={1.45} c={T.t2} style={{ marginTop: 4 }} numberOfLines={2}>
                          {c.note}
                        </Txt>
                      ) : null}
                      {c.tags.length > 0 || c.sleepQuality != null ? (
                        <Txt s={11} c={T.t3} style={{ marginTop: 4 }} numberOfLines={1}>
                          {[
                            ...c.tags.map((t) => CHECKIN_TAGS.find(([k]) => k === t)?.[1] ?? t),
                            ...(c.sleepQuality != null ? [`sono ${SLEEP_LABELS[c.sleepQuality - 1].toLowerCase()}`] : []),
                          ].join(' · ')}
                        </Txt>
                      ) : null}
                    </View>
                    <Touchable
                      onPress={() => remove(c)}
                      accessibilityLabel={`Apagar check-in de ${when(c.createdAt)}`}
                      style={{ width: 44, height: 44, margin: -8, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon d={ICONS.trash} size={15} color={T.t3} sw={1.8} />
                    </Touchable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Section>
    </ScreenScroll>
  );
}
