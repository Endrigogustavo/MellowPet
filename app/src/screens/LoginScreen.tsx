import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { PrimaryButton, Segmented, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { HEAD } from '../data/pets';
import { checkPassword, confirmError } from '../auth/passwordRules';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, hexA } from '../theme/palette';

/** Marca do login: rosto simples com olhos redondos. */
function LoginMark({ color }: { color: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 100 100">
      <Path d={HEAD} fill={color} />
      <G fill="#FFFFFF">
        <Circle cx={36} cy={52} r={6.6} />
        <Circle cx={64} cy={52} r={6.6} />
      </G>
      <Path
        d="M 40 70 q 10 8 20 0"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Entrada escalonada: cada bloco sobe e aparece com um atraso próprio. */
function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [delay, v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Barra de força que cresce e muda de cor conforme a senha melhora. */
function StrengthBar({ score, color, max = 4 }: { score: number; color: string; max?: number }) {
  const { T } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: score / max,
      duration: 320,
      easing: Easing.out(Easing.quad),
      // width não é animável pelo driver nativo.
      useNativeDriver: false,
    }).start();
  }, [score, max, v]);
  return (
    <View style={{ height: 5, borderRadius: 999, backgroundColor: T.bdL, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 999,
          backgroundColor: color,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

export function LoginScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const signup = state.signup;
  const showPairing = signup && state.signupRole === 'user';

  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState({ email: false, pass: false, confirm: false });

  const strength = useMemo(() => checkPassword(state.pass), [state.pass]);
  const mismatch = confirmError(state.pass, confirmation);

  const emailError =
    touched.email && state.email.trim() && !/^\S+@\S+\.\S+$/.test(state.email.trim())
      ? 'Digite um e-mail válido, como voce@email.com.'
      : null;

  // No cadastro a senha precisa passar nas regras; no login qualquer senha
  // serve — quem valida é o servidor, e travar aqui impediria alguém de
  // entrar numa conta antiga criada com senha mais curta.
  const passError =
    signup && touched.pass && state.pass && !strength.valid
      ? 'A senha ainda não atende aos requisitos abaixo.'
      : null;

  const canSubmit =
    state.email.trim().length > 0 &&
    state.pass.length > 0 &&
    !emailError &&
    (!signup || (strength.valid && !mismatch && confirmation.length > 0));

  // Erro do servidor chega e a tela treme de leve — o movimento chama a
  // atenção sem precisar de um alerta modal.
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!state.authError) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [state.authError, shake]);

  const roleCard = (
    role: 'user' | 'care',
    icon: string | string[],
    title: string,
    sub: string,
    circle?: boolean
  ) => {
    const on = state.signupRole === role;
    return (
      <Touchable
        onPress={() => actions.set({ signupRole: role })}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{
          flex: 1,
          borderRadius: 18,
          padding: 14,
          gap: 8,
          backgroundColor: on ? T.priL : T.surf,
          borderWidth: on ? 1.5 : 1,
          borderColor: on ? T.pri : T.bd,
        }}
      >
        <Icon d={icon} size={20} color={on ? T.pri : T.t3} circle={circle} />
        <View>
          <Txt s={13} w={800} c={T.t1}>
            {title}
          </Txt>
          <Txt s={11} lh={1.4} c={T.t3} style={{ marginTop: 3 }}>
            {sub}
          </Txt>
        </View>
      </Touchable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Rise delay={0}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoginMark color={T.pri} />
          </View>

          <Txt s={31} w={800} c={T.t1} ls={-0.9} lh={1.1} style={{ marginTop: 18 }}>
            {signup ? 'Criar conta' : 'Entrar'}
          </Txt>
          <Txt s={14.5} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
            {signup
              ? 'Leva menos de um minuto. Nenhuma imagem sai do aparelho.'
              : 'Bom te ver de novo.'}
          </Txt>
        </Rise>

        <Rise delay={70}>
          <Segmented
            items={['Entrar', 'Criar conta']}
            index={signup ? 1 : 0}
            onChange={(i) => {
              actions.set({ signup: i === 1, authError: null });
              setConfirmation('');
              setTouched({ email: false, pass: false, confirm: false });
            }}
            style={{ marginTop: 22 }}
          />
        </Rise>

        {signup ? (
          <Rise delay={130}>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {roleCard('user', ICONS.smile, 'Para mim', 'Tenho meu bichinho', true)}
              {roleCard('care', ICONS.people, 'Sou cuidador', 'Acompanho alguém')}
            </View>
          </Rise>
        ) : null}

        <Rise delay={190}>
          <Animated.View
            style={{
              gap: 12,
              marginTop: 16,
              transform: [
                { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
              ],
            }}
          >
            <Field
              label="E-mail"
              value={state.email}
              onChangeText={(email) => actions.set({ email, authError: null })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
            />

            <Field
              label="Senha"
              value={state.pass}
              onChangeText={(pass) => actions.set({ pass, authError: null })}
              onBlur={() => setTouched((t) => ({ ...t, pass: true }))}
              placeholder="Sua senha"
              autoCapitalize="none"
              autoComplete={signup ? 'new-password' : 'current-password'}
              revealable
              error={passError}
            />

            {/* Força da senha: só no cadastro, e só depois de começar a
                digitar — mostrar requisitos num campo vazio é ruído. */}
            {signup && state.pass.length > 0 ? (
              <View style={{ gap: 9 }}>
                <StrengthBar score={strength.score} color={strength.color} />
                <Txt s={11.5} w={800} c={strength.color}>
                  {strength.label}
                </Txt>
                <View style={{ gap: 6 }}>
                  {strength.checks.map((check) => (
                    <View
                      key={check.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
                    >
                      <Icon
                        d={check.passed ? ICONS.check : ICONS.close}
                        size={12}
                        color={check.passed ? OK : T.t3}
                        sw={2.4}
                      />
                      <Txt s={11.5} c={check.passed ? T.t2 : T.t3}>
                        {check.label}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {signup ? (
              <Field
                label="Confirmar senha"
                value={confirmation}
                onChangeText={setConfirmation}
                onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                placeholder="Digite a senha de novo"
                autoCapitalize="none"
                autoComplete="new-password"
                revealable
                error={touched.confirm || confirmation ? mismatch : null}
                success={
                  confirmation.length > 0 && !mismatch && strength.valid ? 'As senhas conferem' : null
                }
              />
            ) : null}

            {showPairing ? (
              <Field
                label="Código de convite — opcional"
                value={state.pairCode}
                onChangeText={(pairCode) => actions.set({ pairCode })}
                placeholder="MEL-4821"
                autoCapitalize="characters"
                hint="Recebeu um código de um cuidador? Cole aqui para conectar as contas."
                style={{ letterSpacing: 2, fontWeight: '700' }}
              />
            ) : null}

            {state.authError ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: 13,
                  borderRadius: 14,
                  backgroundColor: hexA(DANGER, 0.1),
                }}
              >
                <Icon d={ICONS.alert} size={15} color={DANGER} circle sw={1.9} />
                <Txt s={12.5} lh={1.5} c={DANGER} style={{ flex: 1 }}>
                  {state.authError}
                </Txt>
              </View>
            ) : null}
          </Animated.View>
        </Rise>

        <View style={{ flex: 1, minHeight: 20 }} />

        <Rise delay={250}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Icon d={ICONS.shield} size={14} color={T.t3} sw={1.8} />
            <Txt s={11.5} lh={1.55} c={T.t3} style={{ flex: 1 }}>
              Em uma sessão de câmera visível, a análise roda no aparelho. Nenhuma imagem é
              enviada ou armazenada; somente eventos agregados podem ser sincronizados com sua
              conta.
            </Txt>
          </View>

          <PrimaryButton
            label={state.authLoading ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
            disabled={state.authLoading || !canSubmit}
            onPress={actions.submitAuth}
          />
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
