import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Chip, PrimaryButton, ToggleRow, Touchable, Txt } from '../components/ui';
import { CARE_RELS, CARE_SCOPES, ICONS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';

const TITLES = ['Quem você cuida?', 'Combine o que você verá', 'Convide a pessoa'];
const SUBS = [
  'O MellowPet do cuidador não usa sua câmera — ele acompanha somente sinais agregados e consentidos de quem você cuida.',
  'Nada é ativado sem o consentimento dela. Você escolhe agora, ela confirma no aparelho.',
  'Envie o código. A conexão só existe depois que ela aceitar.',
];

export function CareSignupScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const step = state.careStep;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Touchable
            onPress={() =>
              step === 0
                ? actions.go('login')
                : actions.set((s) => ({ careStep: s.careStep - 1 }))
            }
            accessibilityLabel="Voltar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.back} size={16} color={T.t1} sw={2.2} />
          </Touchable>
          <Txt s={10.5} w={800} c={T.t3} ls={1.6}>
            CONTA DE CUIDADOR · {step + 1} de 3
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 18 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                backgroundColor: i <= step ? T.pri : T.bd,
              }}
            />
          ))}
        </View>

        <Txt s={28} w={800} c={T.t1} ls={-0.8} lh={1.15} style={{ marginTop: 22 }}>
          {TITLES[step]}
        </Txt>
        <Txt s={14} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
          {SUBS[step]}
        </Txt>

        <ScrollView
          style={{ flex: 1, marginTop: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 ? (
            <View style={{ gap: 16 }}>
              <Field
                label="Nome de quem você cuida"
                value={state.careName}
                onChangeText={(careName) => actions.set({ careName })}
                placeholder="ex. Lia"
              />
              <View>
                <Txt s={11.5} w={800} c={T.t2} style={{ marginBottom: 9 }}>
                  Seu vínculo
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {CARE_RELS.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      on={r === state.careRel}
                      onPress={() => actions.set({ careRel: r })}
                    />
                  ))}
                </View>
              </View>
              <View style={{ padding: 16, borderRadius: 18, backgroundColor: T.priL }}>
                <Txt s={12.5} lh={1.55} c={T.t2}>
                  Cuidadores não têm bichinho próprio nem leitura de câmera. Sua conta é só o
                  painel de acompanhamento.
                </Txt>
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View
              style={{
                backgroundColor: T.surf,
                borderWidth: 1,
                borderColor: T.bd,
                borderRadius: 22,
                paddingHorizontal: 18,
                paddingVertical: 6,
              }}
            >
              {CARE_SCOPES.map(([key, label, sub], i) => {
                // Conversas ficam privadas por padrão: o interruptor nasce desligado.
                const on = state.toggles[key] !== false && key !== 'scopeChat';
                return (
                  <ToggleRow
                    key={key}
                    label={label}
                    sub={sub}
                    on={on}
                    divider={i > 0}
                    onPress={() =>
                      actions.set((s) => ({
                        toggles: { ...s.toggles, [key]: s.toggles[key] === false },
                      }))
                    }
                  />
                );
              })}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: 12 }}>
              <View
                style={{
                  padding: 20,
                  borderRadius: 22,
                  backgroundColor: T.priL,
                  alignItems: 'center',
                }}
              >
                <Txt s={11} w={800} c={T.pri} ls={1.6}>
                  CÓDIGO DE CONVITE
                </Txt>
                <Txt s={30} w={800} c={T.t1} ls={6} style={{ marginTop: 10 }}>
                  MEL-4821
                </Txt>
                <Txt s={11.5} c={T.t2} style={{ marginTop: 8 }}>
                  válido por 48 horas
                </Txt>
              </View>
              <Touchable
                onPress={() => actions.set({ invited: true })}
                style={{
                  paddingVertical: 15,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: state.invited ? T.bg : T.pri,
                }}
              >
                <Txt s={14} w={800} c={state.invited ? T.t2 : '#fff'}>
                  {state.invited ? 'Convite enviado' : 'Enviar convite'}
                </Txt>
              </Touchable>
              <View
                style={{
                  padding: 16,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: T.bd,
                }}
              >
                <Txt s={12} lh={1.55} c={T.t3}>
                  Enquanto ela não aceitar, o painel fica vazio. Você nunca vê nada sem essa
                  confirmação.
                </Txt>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <PrimaryButton
          label={step === 2 ? 'Concluir' : 'Continuar'}
          onPress={() =>
            step === 2
              ? actions.setRole('care')
              : actions.set((s) => ({ careStep: s.careStep + 1 }))
          }
          style={{ marginTop: 18 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
