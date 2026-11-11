import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';

import { Icon } from '../components/Icon';
import { MellowMark } from '../components/PetFace';
import { PetStage } from '../components/PetStage';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Enter, LinkButton, PrimaryButton, Touchable, Txt } from '../components/ui';
import { FACE_ICON, INTENSITY } from '../data/emotions';
import { ICONS } from '../data/content';
import { bumpProfileStats, levelFromXp } from '../profile/profileClient';
import { AffectCircle } from '../components/AffectCircle';
import { GrowthCeremony } from '../components/GrowthCeremony';
import { NudgeCard } from '../components/NudgeCard';
import { RitualCard } from '../components/RitualCard';
import { ACCESSORIES, TRAIT_LABEL, TRAIT_LINE, personality } from '../pet/habits';
import { growthProgress, localDay, STAGE_LABEL } from '../pet/growth';
import { MEALS_PER_DAY, mealsLeft } from '../pet/feeding';
import { useApp, useTheme } from '../state/AppContext';
import { hapticTap } from '../theme/haptics';
import { DivergenceCard } from '../components/DivergenceCard';
import { GestureDelivery, NeedYouCard } from '../components/CaredPresence';

/** Botão redondo de 44px do cabeçalho. */
function HeaderButton({ d, onPress, label }: { d: string; onPress: () => void; label: string }) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        backgroundColor: T.surf,
        borderWidth: 1,
        borderColor: T.bd,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon d={d} size={19} color={T.t1} />
    </Touchable>
  );
}

/** Cartão de métrica: rótulo calmo em caixa normal, número grande, legenda. */
function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const { T } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 0 }} radius={20} padding={14}>
      <Txt s={11.5} w={700} c={T.t3} numberOfLines={1}>
        {label}
      </Txt>
      <Txt s={21} w={800} c={color} style={{ marginTop: 4 }} numberOfLines={1}>
        {value}
      </Txt>
      <Txt s={11.5} c={T.t2} style={{ marginTop: 2 }} numberOfLines={1}>
        {sub}
      </Txt>
    </Card>
  );
}

/** Ação de cuidado (alimentar, brincar, descansar). */
function CareAction({
  d,
  label,
  onPress,
  sub,
  dim,
}: {
  d: string;
  label: string;
  onPress: () => void;
  /** Linha extra (ex.: refeições restantes). */
  sub?: string;
  /** Visualmente apagado quando a ação não rende mais hoje. */
  dim?: boolean;
}) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={{
        opacity: dim ? 0.78 : 1,
        flex: 1,
        minHeight: 70,
        minWidth: 0,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 20,
        backgroundColor: T.surf,
        borderWidth: 1,
        borderColor: T.bd,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      <Icon d={d} size={20} color={T.pri} />
      <Txt s={12} w={700} c={T.t1} numberOfLines={1}>
        {label}
      </Txt>
      {sub ? (
        <Txt numberOfLines={1} adjustsFontSizeToFit s={11} c={T.t3}>
          {sub}
        </Txt>
      ) : null}
    </Touchable>
  );
}

export function HomeScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full, emo, emoColor, emoInk, emoLight } = useTheme();

  const [intLabel, intColor] = INTENSITY[emo.intensity];
  const left = mealsLeft(state.meals, localDay());
  const [fedNotice, setFedNotice] = useState(false);
  const [showReadingWhy, setShowReadingWhy] = useState(false);
  // O widget tentou alimentar além do limite: mostra o mesmo aviso aqui.
  useEffect(() => {
    if (!state.fedFull) return;
    setFedNotice(true);
    actions.set({ fedFull: false });
  }, [state.fedFull, actions]);
  useEffect(() => {
    if (!fedNotice) return;
    const t = setTimeout(() => setFedNotice(false), 4000);
    return () => clearTimeout(t);
  }, [fedNotice]);
  const confPct = Math.round(state.signalConfidence * 100);
  const qualityPct = Math.round(state.qualityScore * 100);
  const hasReliableReading = state.signalStatus === 'ready';
  const signalLabel =
    state.visionMode === 'demo'
      ? 'modo demonstração'
      : hasReliableReading
        ? 'leitura local ativa'
        : 'leitura indisponível';
  const streakLabel =
    state.streak >= 60
      ? `${Math.floor(state.streak / 60)}m ${state.streak % 60}s`
      : `${state.streak}s`;

  // Otimista na UI, reconciliado com o valor real assim que a chamada volta
  // — nível é sempre derivado de xp (levelFromXp), nunca um contador à parte.
  const bumpCare = (delta: { fed?: number; played?: number; xp: number }, patch: Partial<typeof state>) => {
    actions.markCare();
    actions.set((s) => ({
      fed: s.fed + (delta.fed ?? 0),
      played: s.played + (delta.played ?? 0),
      xp: s.xp + delta.xp,
      streak: 0,
      ...patch,
    }));
    if (state.userId) {
      bumpProfileStats(delta).then((stats) => {
        if (stats) actions.set(stats);
        // null = a chamada no servidor falhou (RLS, função ausente etc.) — o
        // incremento otimista acima fica só na tela e some ao reabrir o app.
        // Sem verificação silenciosa aqui: senão o bug nunca aparece no log.
        else if (__DEV__) console.warn('bumpProfileStats falhou — xp não foi persistido no servidor.');
      });
    }
  };

  // Balançar o celular conta como "brincar" — mesmo efeito do botão, com um
  // cooldown pra não disparar em loop enquanto a pessoa continua balançando.
  const lastShakeAtRef = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(120);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > 2.2 && now - lastShakeAtRef.current > 1500) {
        lastShakeAtRef.current = now;
        actions.triggerPetAction('play');
        bumpCare({ played: 1, xp: 4 }, { petMood: 'happy' });
        actions.pet();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modePill = (on: boolean) => ({
    flex: 1,
    minHeight: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: on ? T.surf : 'transparent',
    borderWidth: on ? 1 : 0,
    borderColor: T.bd,
  });

  return (
    <ScreenScroll>
      {/* cabeçalho */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingHorizontal: 18,
          paddingBottom: 14,
        }}
      >
        <Touchable
          onPress={() => actions.go('vision')}
          accessibilityLabel={`Abrir sessão de leitura visual (${signalLabel})`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            minWidth: 0,
            minHeight: 48,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MellowMark size={30} color={T.pri} faceColor={T.surf} petType={state.petType} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={22} w={800} c={T.t1} ls={-0.4} numberOfLines={1}>
              {state.petName}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.ok }} />
              <Txt s={12} c={T.t3} numberOfLines={1}>
                {signalLabel}
              </Txt>
            </View>
          </View>
        </Touchable>
        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          <HeaderButton
            d={isDark ? ICONS.moon : ICONS.sun}
            onPress={actions.toggleTheme}
            label="Alternar tema"
          />
          <HeaderButton d={ICONS.help} onPress={() => actions.go('guide')} label="Guia" />
          <HeaderButton d={ICONS.sliders} onPress={() => actions.go('settings')} label="Ajustes" />
        </View>
      </View>

      {/* modo foco / respiração */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          marginHorizontal: 18,
          marginBottom: 6,
          padding: 5,
          backgroundColor: T.surfWarm,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: T.bdL,
        }}
      >
        <Touchable
          onPress={() => {
            hapticTap();
            actions.set((s) => ({ focus: !s.focus, breathing: false }));
          }}
          accessibilityRole="switch"
          accessibilityLabel="Modo foco"
          accessibilityState={{ checked: state.focus }}
          style={modePill(state.focus)}
        >
          <Icon d={ICONS.focus} size={17} color={state.focus ? T.pri : T.t2} circle />
          <Txt s={13} w={700} c={state.focus ? T.pri : T.t2} numberOfLines={1}>
            Modo foco
          </Txt>
        </Touchable>
        <Touchable
          onPress={() => {
            hapticTap();
            if (!state.breathing) {
              actions.markCare();
              actions.habit('breath');
            }
            actions.set((s) => ({ breathing: !s.breathing, breathTick: 0, focus: false }));
          }}
          accessibilityRole="switch"
          accessibilityLabel="Respiração guiada"
          accessibilityState={{ checked: state.breathing }}
          style={modePill(state.breathing)}
        >
          <Icon d={ICONS.heart} size={17} color={state.breathing ? T.pri : T.t2} />
          <Txt s={13} w={700} c={state.breathing ? T.pri : T.t2} numberOfLines={1}>
            Respiração
          </Txt>
        </Touchable>
      </View>

      <PetStage />
      <NudgeCard />
      {state.inviteNotice ? (
        <Section top={10}>
          <Card radius={18} padding={14}>
            <Txt s={12.5} lh={1.45} c={T.t2} accessibilityLiveRegion="polite">
              {state.inviteNotice}
            </Txt>
            <LinkButton
              label={state.pairCode.trim() ? 'Ver o convite' : 'Entendi'}
              onPress={() => {
                const hasInvite = state.pairCode.trim().length > 0;
                actions.set({ inviteNotice: null });
                if (hasInvite) actions.go('acceptinvite');
              }}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            />
          </Card>
        </Section>
      ) : null}
      <View style={{ marginHorizontal: 18, gap: 10 }}>
        <GestureDelivery />
        <RitualCard />
        <NeedYouCard />
        <DivergenceCard />
      </View>
      {state.unlockEvent ? (
        <Section top={12}>
          <Card radius={22} padding={16}>
            <Txt s={14.5} w={800} c={T.t1}>
              {state.petName} ganhou: {ACCESSORIES.find((a) => a.id === state.unlockEvent)?.label}
            </Txt>
            <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 4 }}>
              Prêmio pela constância de vocês. Quer vestir agora?
            </Txt>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <PrimaryButton
                label="Vestir"
                onPress={() => {
                  if (state.unlockEvent) actions.equip(state.unlockEvent);
                  actions.set({ unlockEvent: null });
                }}
                style={{ flex: 1 }}
              />
              <LinkButton label="Depois" color={T.t2} onPress={() => actions.set({ unlockEvent: null })} />
            </View>
          </Card>
        </Section>
      ) : null}
      {state.growthEvent ? (
        <GrowthCeremony stage={state.growthEvent} onDone={() => actions.set({ growthEvent: null })} />
      ) : null}

      {/* conexão com cuidador */}
      {!state.linked && !state.dismissedCards.includes('caregiver_connect') ? (
        <Section top={8}>
          <View style={{ padding: 16, borderRadius: 22, backgroundColor: T.priL }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  backgroundColor: T.surf,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon d={ICONS.people} size={17} color={T.pri} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt s={13.5} w={800} c={T.t1}>
                  Conecte um cuidador
                </Txt>
                <Txt s={12} lh={1.45} c={T.t2} style={{ marginTop: 3 }}>
                  Alguém te enviou um código de convite? Adicione em Ajustes quando quiser.
                </Txt>
              </View>
              <Touchable
                onPress={() => actions.dismissCard('caregiver_connect')}
                accessibilityLabel="Fechar aviso de cuidador"
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <Icon d={ICONS.close} size={16} color={T.t3} />
              </Touchable>
            </View>
            <Touchable
              onPress={() => actions.go('settings')}
              style={{
                marginTop: 12,
                minHeight: 46,
                paddingVertical: 11,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: T.pri,
              }}
            >
              <Txt s={13} w={800} c={T.onPri}>
                Ir para Ajustes
              </Txt>
            </Touchable>
          </View>
        </Section>
      ) : null}

      {state.feedback !== null ? (
        <Section top={12}>
          <View style={{ padding: 13, paddingHorizontal: 16, borderRadius: 18, backgroundColor: emoLight }}>
            <Txt s={12.5} lh={1.5} c={T.t2} accessibilityLiveRegion="polite">
              {state.feedback === 'yes'
                ? 'Obrigado. A leitura reforça um pouco o que acertou no seu rosto.'
                : state.feedback === 'no'
                  ? 'Anotado. A leitura fica um pouco mais exigente com essa emoção no seu rosto.'
                  : 'Tudo bem não ter certeza. Nenhuma correção foi presumida.'}
            </Txt>
          </View>
        </Section>
      ) : null}

      {/* alimentar / brincar / descansar */}
      <Section top={14} style={{ flexDirection: 'row', gap: 8 }}>
        <CareAction
          d={ICONS.feed}
          label="Alimentar"
          sub={left > 0 ? `${left} de ${MEALS_PER_DAY} hoje` : 'satisfeito hoje'}
          dim={left === 0}
          onPress={() => {
            if (left > 0 && actions.feed()) {
              actions.triggerPetAction('feed');
              actions.markCare();
              return;
            }
            // Limite atingido: impossibilita de comer mais e balança a cabeça dizendo não
            hapticTap(state.toggles.haptics !== false);
            actions.triggerPetAction('refuse');
            setFedNotice(true);
          }}
        />
        <CareAction
          d={ICONS.play}
          label="Brincar"
          onPress={() => {
            hapticTap(state.toggles.haptics !== false);
            actions.habit('play');
            actions.triggerPetAction('play');
            bumpCare({ played: 1, xp: 4 }, { petMood: 'happy' });
          }}
        />
        <CareAction
          d={ICONS.rest}
          label="Descansar"
          onPress={() => {
            hapticTap(state.toggles.haptics !== false);
            actions.habit('rest');
            bumpCare({ xp: 3 }, { petMood: 'neutral', breathing: true, breathTick: 0, petAction: null });
          }}
        />
      </Section>
      {fedNotice ? (
        <Section top={8}>
          <Txt s={12} lh={1.45} c={T.t2} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {state.petName} já fez as {MEALS_PER_DAY} refeições de hoje e está de barriguinha cheia. Brincar e descansar continuam valendo!
          </Txt>
        </Section>
      ) : null}

      {/* nível e vínculo */}
      <Section>
        <Card radius={22} padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <Txt s={13} w={800} c={T.t1}>
              Nível {levelFromXp(state.xp)}
            </Txt>
            <Txt s={11.5} c={T.t3}>
              {state.xp % 100}/100 para o próximo nível
            </Txt>
          </View>
          <View style={{ marginTop: 8 }}>
            <Bar pct={state.xp % 100} color={emoColor} />
          </View>
          {/* crescimento: dias de cuidado, não tempo de tela */}
          {(() => {
            const g = growthProgress(state.careDays);
            return (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.bdL }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <Txt s={13} w={800} c={T.t1} numberOfLines={1} style={{ flexShrink: 1, minWidth: 0 }}>
                    {state.petName} · {STAGE_LABEL[g.stage]}
                  </Txt>
                  <Txt s={11.5} c={T.t3} style={{ flexShrink: 0 }}>
                    {g.next
                      ? `${g.remaining} ${g.remaining === 1 ? 'dia' : 'dias'} para ${STAGE_LABEL[g.next].toLowerCase()}`
                      : 'crescido'}
                  </Txt>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Bar pct={g.fraction * 100} color={T.pri} />
                </View>
              </View>
            );
          })()}
          {(() => {
            const traits = personality(state.habits);
            return traits ? (
              <Txt s={12} lh={1.5} c={T.t2} style={{ marginTop: 10 }}>
                {state.petName} é {traits.map((t) => TRAIT_LABEL[t]).join(' e ')}: {TRAIT_LINE[traits[0]]}
              </Txt>
            ) : null;
          })()}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Touchable
              onPress={() => actions.go('wardrobe')}
              accessibilityLabel="Abrir guarda-roupa"
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: T.surfWarm,
                borderWidth: 1,
                borderColor: T.bdL,
                justifyContent: 'center',
              }}
            >
              <Txt s={12.5} w={800} c={T.pri}>
                Guarda-roupa
              </Txt>
            </Touchable>
            <Touchable
              onPress={() => actions.go('lullaby')}
              accessibilityLabel={`Ninar ${state.petName}`}
              style={{
                minHeight: 44,
                maxWidth: '100%',
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: T.surfWarm,
                borderWidth: 1,
                borderColor: T.bdL,
                justifyContent: 'center',
              }}
            >
              <Txt s={12.5} w={800} c={T.pri} numberOfLines={1}>
                Ninar {state.petName}
              </Txt>
            </Touchable>
          </View>
        </Card>
      </Section>

      {/* leitura da emoção */}
      <Section>
        <View style={{ padding: 16, borderRadius: 22, backgroundColor: emoLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 15,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon
                d={[FACE_ICON[state.observedExpression], 'M9 9.5h.01', 'M15 9.5h.01']}
                size={22}
                color={emoInk}
                sw={1.9}
                circle
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <Txt s={17} w={800} c={T.t1}>
                  {emo.label}
                </Txt>
                <Txt s={12} c={T.t2} cap>
                  {emo.variant}
                </Txt>
              </View>
              <View style={{ marginTop: 8 }}>
                <Bar pct={confPct} color={emoColor} height={5} />
              </View>
              <Txt s={12} w={700} c={emoInk} style={{ marginTop: 5 }}>
                {hasReliableReading ? `${confPct}% de confiança do sinal` : 'Sem leitura confiável'}
              </Txt>
            </View>
          </View>

          <Txt s={14} lh={1.6} c={T.t2} style={{ marginTop: 12 }}>
            {emo.msg}
          </Txt>

          {/* por que o Mellow leu isso: recolhido por padrão, abre ao tocar no círculo com "?" */}
          {hasReliableReading ? (
            <View style={{ marginTop: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: T.bd }}>
              <Touchable
                onPress={() => {
                  hapticTap();
                  setShowReadingWhy((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showReadingWhy }}
                accessibilityLabel={
                  showReadingWhy
                    ? 'Ocultar por que o Mellow leu isso'
                    : 'Ver por que o Mellow leu isso'
                }
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                  paddingRight: 8,
                }}
              >
                <Txt s={12.5} w={800} c={T.t2}>
                  Por que o Mellow leu isso
                </Txt>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    backgroundColor: showReadingWhy ? T.pri : T.surf,
                    borderWidth: 1,
                    borderColor: showReadingWhy ? T.pri : T.bd,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt s={10.5} w={800} lh={1} c={showReadingWhy ? T.onPri : T.pri}>
                    ?
                  </Txt>
                </View>
              </Touchable>

              {showReadingWhy ? (
                <Enter seq={1}>
                  {state.readingEvidence.length > 0 ? (
                    <View style={{ marginTop: 6 }}>
                      <View style={{ gap: 8 }}>
                        {state.readingEvidence.map((signal) => (
                          <View key={signal.label}>
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: 8,
                              }}
                            >
                              <Txt s={12.5} w={700} c={T.t1} style={{ flex: 1, minWidth: 0 }}>
                                {signal.label}
                              </Txt>
                              <Txt s={11.5} c={T.t3}>
                                {Math.round(signal.strength * 100)}%
                              </Txt>
                            </View>
                            <View style={{ marginTop: 4 }}>
                              <Bar pct={signal.strength * 100} color={emoColor} height={4} />
                            </View>
                          </View>
                        ))}
                      </View>
                      <Txt s={11.5} lh={1.45} c={T.t2} style={{ marginTop: 10 }}>
                        É o que o rosto mostrou, não o que você sente. Testa franzida também pode ser concentração.
                      </Txt>
                    </View>
                  ) : null}

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 14,
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: T.bd,
                    }}
                  >
                    <Txt s={12} w={700} c={T.t2} style={{ flex: 1, minWidth: 0 }}>
                      Essa leitura combinou com o que você percebeu agora?
                    </Txt>
                    <Touchable
                      onPress={() => {
                        hapticTap();
                        actions.giveFeedback('yes');
                      }}
                      accessibilityLabel="Leitura correta"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        backgroundColor: T.surf,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon d={ICONS.check} size={17} color={T.ok} sw={2.1} />
                    </Touchable>
                    <Touchable
                      onPress={() => {
                        hapticTap();
                        actions.giveFeedback('no');
                      }}
                      accessibilityLabel="Leitura incorreta"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        backgroundColor: T.surf,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon d={ICONS.close} size={17} color={T.danger} sw={2.1} />
                    </Touchable>
                    <Touchable
                      onPress={() => {
                        hapticTap();
                        actions.giveFeedback('unsure');
                      }}
                      accessibilityLabel="Não tenho certeza sobre a leitura"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        backgroundColor: T.surf,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Txt s={15} w={800} c={T.t2}>
                        ?
                      </Txt>
                    </Touchable>
                  </View>
                </Enter>
              ) : null}
            </View>
          ) : null}
        </View>
      </Section>

      {/* check-in: o que você sente, não o que o rosto mostra */}
      <Section>
        <Touchable
          onPress={() => actions.go('checkin')}
          accessibilityLabel="Fazer check-in de como você está"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 68,
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 22,
            backgroundColor: T.surf,
            borderWidth: 1,
            borderColor: T.bd,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon d={ICONS.smile} size={20} color={T.pri} sw={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt s={14} w={800} c={T.t1}>
              E por dentro, como você está?
            </Txt>
            <Txt s={12} lh={1.45} c={T.t3} style={{ marginTop: 2 }}>
              Registre em segundos e compare com o que o Mellow leu.
            </Txt>
          </View>
          <Icon d={ICONS.chevron} size={16} color={T.t3} sw={2} />
        </Touchable>
      </Section>

      <Section style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Intensidade visual" value={intLabel} sub="expressão observada" color={isDark ? T.t1 : intColor} />
        <Stat label="Duração" value={streakLabel} sub="mesma leitura" color={emoInk} />
      </Section>

      {full ? (
        <>
          <Section style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label="Qualidade" value={`${qualityPct}%`} sub="sinal da câmera" color={T.ok} />
            <Stat
              label="Origem"
              value={state.visionMode === 'demo' ? 'Demo' : 'Local'}
              sub="nenhuma imagem enviada"
              color={T.t1}
            />
          </Section>

          {state.affect ? (
            <Section>
              <Card>
                <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 8 }}>
                  Humor no círculo
                </Txt>
                <AffectCircle affect={state.affect} />
              </Card>
            </Section>
          ) : null}

          <Section>
            <Card>
              <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 12 }}>
                Leitura detalhada
              </Txt>
              <View style={{ gap: 10 }}>
                {emo.scores.map(([name, pct]) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt s={12} c={T.t2} style={{ width: 78 }} numberOfLines={1}>
                      {name}
                    </Txt>
                    <View style={{ flex: 1 }}>
                      <Bar pct={pct} color={emoColor} />
                    </View>
                    <Txt s={12} c={T.t3} style={{ width: 38, textAlign: 'right' }}>
                      {pct}%
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </Section>

          <Section>
            <View style={{ borderRadius: 22, padding: 16, backgroundColor: T.priL }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Icon d={ICONS.note} size={15} color={T.pri} sw={1.9} />
                <Txt s={12.5} w={800} c={T.pri}>
                  Para o seu momento
                </Txt>
              </View>
              <Txt s={13.5} lh={1.55} c={T.t2} style={{ marginTop: 7 }}>
                {emo.music}
              </Txt>
            </View>
          </Section>

          <Section>
            <Card variant="warm" radius={20} padding={15} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Icon d={ICONS.heartOutline} size={17} color={T.pri} sw={1.9} />
              <Txt s={12.5} lh={1.55} c={T.t2} style={{ flex: 1, minWidth: 0 }}>
                {emo.tip}
              </Txt>
            </Card>
          </Section>
        </>
      ) : null}
    </ScreenScroll>
  );
}
