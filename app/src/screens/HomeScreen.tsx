import React from 'react';
import { View } from 'react-native';

import { Icon } from '../components/Icon';
import { MellowMark } from '../components/PetFace';
import { PetStage } from '../components/PetStage';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Bar, Card, Touchable, Txt } from '../components/ui';
import { FACE_ICON, INTENSITY } from '../data/emotions';
import { ICONS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';
import { OK } from '../theme/palette';

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
      }}
    >
      <Icon d={d} size={19} color={T.t1} />
    </Touchable>
  );
}

/** Cartão de métrica: rótulo em caixa alta, número grande, legenda. */
function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const { T } = useTheme();
  return (
    <Card style={{ flex: 1 }} radius={20} padding={14}>
      <Txt s={10} w={800} c={T.t3} ls={0.7} caps>
        {label}
      </Txt>
      <Txt s={21} w={800} c={color} style={{ marginTop: 5 }}>
        {value}
      </Txt>
      <Txt s={11.5} c={T.t2} style={{ marginTop: 2 }}>
        {sub}
      </Txt>
    </Card>
  );
}

/** Ação de cuidado (alimentar, brincar, descansar). */
function CareAction({ d, label, onPress }: { d: string; label: string; onPress: () => void }) {
  const { T } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: T.surf,
        borderWidth: 1,
        borderColor: T.bd,
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Icon d={d} size={19} color={T.pri} />
      <Txt s={11} w={700} c={T.t2}>
        {label}
      </Txt>
    </Touchable>
  );
}

export function HomeScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full, emo, emoColor, emoLight } = useTheme();

  const [intLabel, intColor] = INTENSITY[emo.intensity];
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

  const modePill = (on: boolean) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: on ? T.priL : T.bg,
  });

  return (
    <ScreenScroll>
      {/* cabeçalho */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MellowMark size={26} color={T.pri} faceColor={T.surf} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={22} w={800} c={T.t1} ls={-0.5} numberOfLines={1}>
              {state.petName}
            </Txt>
            <Touchable
              onPress={() => actions.go('vision')}
              accessibilityLabel="Abrir sessão de leitura visual"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: OK }} />
              <Txt s={12} c={T.t3}>
                {signalLabel}
              </Txt>
            </Touchable>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
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
          gap: 8,
          marginHorizontal: 16,
          marginBottom: 4,
          padding: 6,
          backgroundColor: T.surf,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: T.bd,
        }}
      >
        <Touchable
          onPress={() => actions.set((s) => ({ focus: !s.focus, breathing: false }))}
          style={modePill(state.focus)}
        >
          <Icon d={ICONS.focus} size={17} color={state.focus ? T.pri : T.t2} circle />
          <Txt s={13} w={600} c={state.focus ? T.pri : T.t2}>
            Modo foco
          </Txt>
        </Touchable>
        <Touchable
          onPress={() =>
            actions.set((s) => ({ breathing: !s.breathing, breathTick: 0, focus: false }))
          }
          style={modePill(state.breathing)}
        >
          <Icon d={ICONS.heart} size={17} color={state.breathing ? T.pri : T.t2} />
          <Txt s={13} w={600} c={state.breathing ? T.pri : T.t2}>
            Respiração
          </Txt>
        </Touchable>
      </View>

      <PetStage />

      {/* convite de vínculo */}
      {state.pairPending && !state.linked ? (
        <Section top={2}>
          <View style={{ padding: 16, borderRadius: 20, backgroundColor: T.priL }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  backgroundColor: T.surf,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt s={15} w={800} c={T.pri}>
                  M
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt s={13} w={800} c={T.t1}>
                  Marina quer te acompanhar
                </Txt>
                <Txt s={11.5} lh={1.45} c={T.t2} style={{ marginTop: 3 }}>
                  Ela verá sinais faciais agregados e alertas consentidos — nunca as conversas.
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Touchable
                onPress={() => actions.set({ linked: false, pairPending: false })}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.surf,
                }}
              >
                <Txt s={13} w={700} c={T.t2}>
                  Agora não
                </Txt>
              </Touchable>
              <Touchable
                onPress={() => actions.set({ linked: true, pairPending: false })}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.pri,
                }}
              >
                <Txt s={13} w={800} c="#fff">
                  Aceitar
                </Txt>
              </Touchable>
            </View>
          </View>
        </Section>
      ) : null}

      {state.feedback !== null ? (
        <Section>
          <View style={{ padding: 12, paddingHorizontal: 15, borderRadius: 16, backgroundColor: emoLight }}>
            <Txt s={12.5} c={T.t2}>
              {state.feedback === 'yes'
                ? 'Obrigado — essa confirmação entra na avaliação da leitura.'
                : state.feedback === 'no'
                  ? 'Anotado. A correção será avaliada antes de qualquer ajuste no modelo.'
                  : 'Tudo bem não ter certeza. Nenhuma correção foi presumida.'}
            </Txt>
          </View>
        </Section>
      ) : null}

      {/* alimentar / brincar / descansar */}
      <Section style={{ flexDirection: 'row', gap: 8 }}>
        <CareAction
          d={ICONS.feed}
          label="Alimentar"
          onPress={() =>
            actions.set((s) => ({
              fed: s.fed + 1,
              xp: Math.min(100, s.xp + 6),
              petMood: 'happy',
              streak: 0,
            }))
          }
        />
        <CareAction
          d={ICONS.play}
          label="Brincar"
          onPress={() =>
            actions.set((s) => ({
              played: s.played + 1,
              xp: Math.min(100, s.xp + 4),
              petMood: 'surprised',
              streak: 0,
            }))
          }
        />
        <CareAction
          d={ICONS.rest}
          label="Descansar"
          onPress={() =>
            actions.set((s) => ({
              xp: Math.min(100, s.xp + 3),
              petMood: 'neutral',
              streak: 0,
              breathing: true,
              breathTick: 0,
            }))
          }
        />
      </Section>

      {/* nível e vínculo */}
      <Section>
        <Card radius={18} padding={13} style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt s={12.5} w={800} c={T.t1}>
              Nível {state.level}
            </Txt>
            <Txt s={11.5} c={T.t3}>
              {state.xp}/100 de vínculo
            </Txt>
          </View>
          <View style={{ marginTop: 8 }}>
            <Bar pct={state.xp} color={emoColor} />
          </View>
        </Card>
      </Section>

      {/* leitura da emoção */}
      <Section>
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: emoLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                d={[FACE_ICON[state.observedExpression], 'M9 9.5h.01', 'M15 9.5h.01']}
                size={22}
                color={emoColor}
                sw={1.9}
                circle
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Txt s={17} w={800} c={T.t1}>
                  {emo.label}
                </Txt>
                <Txt s={12} c={T.t3} cap>
                  {emo.variant}
                </Txt>
              </View>
              <View style={{ marginTop: 8 }}>
                <Bar pct={confPct} color={emoColor} height={5} />
              </View>
              <Txt s={12} w={700} c={emoColor} style={{ marginTop: 5 }}>
                {hasReliableReading ? `${confPct}% de confiança do sinal` : 'Sem leitura confiável'}
              </Txt>
            </View>
          </View>

          <Txt s={14} lh={1.6} c={T.t2} style={{ marginTop: 12 }}>
            {emo.msg}
          </Txt>

          {hasReliableReading ? <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 13,
              paddingTop: 13,
              borderTopWidth: 1,
              borderTopColor: T.bd,
            }}
          >
            <Txt s={12} w={700} c={T.t2} style={{ flex: 1 }}>
              Essa leitura combinou com o que você percebeu agora?
            </Txt>
            <Touchable
              onPress={() => actions.set({ feedback: 'yes' })}
              accessibilityLabel="Leitura correta"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={ICONS.check} size={16} color={OK} sw={2} />
            </Touchable>
            <Touchable
              onPress={() => actions.set({ feedback: 'no' })}
              accessibilityLabel="Leitura incorreta"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={ICONS.close} size={16} color="#EF4444" sw={2} />
            </Touchable>
            <Touchable
              onPress={() => actions.set({ feedback: 'unsure' })}
              accessibilityLabel="Não tenho certeza sobre a leitura"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: T.surf,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt s={15} w={800} c={T.t3}>
                ?
              </Txt>
            </Touchable>
          </View> : null}
        </View>
      </Section>

      <Section style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Intensidade visual" value={intLabel} sub="expressão observada" color={intColor} />
        <Stat label="Duração" value={streakLabel} sub="mesma leitura" color={emoColor} />
      </Section>

      {full ? (
        <>
          <Section style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label="Qualidade" value={`${qualityPct}%`} sub="sinal da câmera" color={OK} />
            <Stat
              label="Origem"
              value={state.visionMode === 'demo' ? 'Demo' : 'Local'}
              sub="nenhuma imagem enviada"
              color={T.t1}
            />
          </Section>

          <Section>
            <Card>
              <Txt s={13.5} w={800} c={T.t1} style={{ marginBottom: 12 }}>
                Leitura detalhada
              </Txt>
              <View style={{ gap: 10 }}>
                {emo.scores.map(([name, pct]) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt s={12} c={T.t2} style={{ width: 78 }}>
                      {name}
                    </Txt>
                    <View style={{ flex: 1 }}>
                      <Bar pct={pct} color={emoColor} />
                    </View>
                    <Txt s={12} c={T.t3} style={{ width: 36, textAlign: 'right' }}>
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 9,
                padding: 14,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: T.bd,
              }}
            >
              <Icon d={ICONS.heartOutline} size={16} color={T.pri} sw={1.9} />
              <Txt s={12.5} lh={1.55} c={T.t2} style={{ flex: 1 }}>
                {emo.tip}
              </Txt>
            </View>
          </Section>
        </>
      ) : null}
    </ScreenScroll>
  );
}
