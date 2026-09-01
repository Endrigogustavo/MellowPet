import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { createInvite } from '../care/careClient';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Chip, PrimaryButton, Touchable, Txt } from '../components/ui';
import { CARE_RELS, ICONS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';

const TITLES = ['Quem você cuida?', 'Acesso do cuidador', 'Convide a pessoa'];
const SUBS = [
  'O MellowPet do cuidador não usa sua câmera — ele acompanha o histórico e os recursos de cuidado da pessoa vinculada.',
  'Quando o convite for aceito, o cuidador terá acesso integral ao módulo de cuidado deste vínculo.',
  'Envie o código. A conexão e o acesso integral começam somente depois que ela aceitar.',
];

export function CareSignupScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const step = state.careStep;

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvite = useCallback(async () => {
    if (!state.userId) {
      setInviteError('Não foi possível identificar sua conta para gerar o convite.');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    try {
      const link = await createInvite(state.userId, state.careName, state.careRel);
      setInviteCode(link.invite_code);
    } catch (error) {
      setInviteError(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível gerar o código. Verifique a conexão e tente novamente.'
      );
    } finally {
      setInviteLoading(false);
    }
  }, [state.careName, state.careRel, state.userId]);

  useEffect(() => {
    if (step !== 2 || inviteCode || inviteLoading || inviteError) return;
    void generateInvite();
  }, [generateInvite, inviteCode, inviteError, inviteLoading, step]);

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setInviteError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError('Não foi possível copiar o código. Você pode digitá-lo ou tentar novamente.');
    }
  };

  const shareCode = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `Use o código ${inviteCode} para se conectar comigo no MellowPet.`,
      });
    } catch {
      setInviteError('Não foi possível abrir o compartilhamento. Copie o código e envie pelo canal que preferir.');
    }
  };

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
            <View style={{ gap: 12 }}>
              <View
                style={{
                  padding: 15,
                  borderRadius: 18,
                  backgroundColor: T.priL,
                }}
              >
                <Txt s={12.5} w={800} c={T.t1}>
                  Acesso integral após aceitar
                </Txt>
                <Txt s={12} lh={1.55} c={T.t2} style={{ marginTop: 4 }}>
                  Este vínculo não usa permissões por tela ou recurso. Depois que a pessoa aceitar o código, o cuidador poderá consultar e operar o painel, tendências, alertas, agenda, plano, equipe, ações e histórico.
                </Txt>
              </View>
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
                  {inviteCode ?? (inviteError ? '· · · ·' : 'Gerando…')}
                </Txt>
                <Txt s={11.5} c={T.t2} style={{ marginTop: 8 }}>
                  {inviteError ?? 'compartilhe este código com a pessoa acompanhada'}
                </Txt>
                {inviteCode ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, width: '100%' }}>
                    <Touchable
                      onPress={copyCode}
                      style={{
                        flex: 1,
                        paddingVertical: 11,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: T.surf,
                      }}
                    >
                      <Txt s={12.5} w={800} c={T.pri}>
                        {copied ? 'Copiado!' : 'Copiar código'}
                      </Txt>
                    </Touchable>
                    <Touchable
                      onPress={shareCode}
                      style={{
                        flex: 1,
                        paddingVertical: 11,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: T.surf,
                      }}
                    >
                      <Txt s={12.5} w={800} c={T.pri}>
                        Enviar
                      </Txt>
                    </Touchable>
                  </View>
                ) : null}
              </View>
              {inviteError && !inviteCode ? (
                <Touchable
                  disabled={inviteLoading}
                  onPress={() => void generateInvite()}
                  style={{ paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd }}
                >
                  <Txt s={13} w={800} c={T.pri}>{inviteLoading ? 'Tentando…' : 'Gerar código novamente'}</Txt>
                </Touchable>
              ) : null}
              <Touchable
                disabled={!inviteCode}
                onPress={() => actions.set({ invited: true })}
                style={{
                  paddingVertical: 15,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: state.invited ? T.bg : inviteCode ? T.pri : T.bd,
                }}
              >
                <Txt s={14} w={800} c={state.invited ? T.t2 : '#fff'}>
                  {state.invited ? 'Convite marcado como enviado' : 'Marquei que enviei'}
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
                  O convite pode ser enviado agora. Enquanto ela não aceitar — e as permissões
                  não estiverem configuradas — não há acesso a nenhum dado.
                </Txt>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <PrimaryButton
          label={step === 2 && !inviteCode ? (inviteLoading ? 'Gerando convite…' : 'Gere um convite para concluir') : step === 2 ? 'Concluir' : 'Continuar'}
          onPress={() =>
            step === 2
              ? actions.setRole('care')
              : actions.set((s) => ({ careStep: s.careStep + 1 }))
          }
          disabled={step === 2 && !inviteCode}
          style={{ marginTop: 18 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
