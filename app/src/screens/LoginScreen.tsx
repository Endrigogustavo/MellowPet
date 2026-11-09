import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { PrimaryButton, Segmented, Touchable, Txt, useReducedMotion } from '../components/ui';
import { ICONS } from '../data/content';
import { EMOTIONS } from '../data/emotions';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { HEAD } from '../data/pets';
import { checkPassword, confirmError } from '../auth/passwordRules';
import { useApp, useTheme } from '../state/AppContext';
import { SUPABASE_CONFIGURED } from '../supabase/client';
import { hexA } from '../theme/palette';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Marca do login: rosto simples com olhos redondos. */
function LoginMark({ color, faceColor }: { color: string; faceColor: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 100 100">
      <Path d={HEAD} fill={color} />
      <G fill={faceColor}>
        <Circle cx={36} cy={52} r={6.6} />
        <Circle cx={64} cy={52} r={6.6} />
      </G>
      <Path
        d="M 40 70 q 10 8 20 0"
        fill="none"
        stroke={faceColor}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Entrada escalonada reativa (< 240ms) respeitando preferência de movimento reduzido. */
function Rise({ delay, children }: { delay: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 200,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [delay, v, reduced]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Barra de força animada por `scaleX` (GPU compositor) em vez de `width`. */
function StrengthBar({ score, color, max = 4 }: { score: number; color: string; max?: number }) {
  const { T } = useTheme();
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(score / max)).current;
  useEffect(() => {
    const target = Math.max(0, Math.min(1, score / max));
    if (reduced) {
      v.setValue(target);
      return;
    }
    Animated.timing(v, {
      toValue: target,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [score, max, v, reduced]);
  return (
    <View
      style={{
        height: 5,
        borderRadius: 999,
        backgroundColor: T.bdL,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '-100%',
          width: '200%',
          transform: [{ scaleX: v }],
        }}
      >
        <View
          style={{
            marginLeft: '50%',
            width: '50%',
            height: '100%',
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      </Animated.View>
    </View>
  );
}

export function LoginScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAwareScroll();

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

  // Erro do servidor chega e a tela treme de leve, sem alerta modal.
  const shake = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!state.authError || reduced) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: 0.6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [state.authError, shake, reduced]);

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
          minHeight: 88,
          borderRadius: 20,
          padding: 14,
          gap: 8,
          backgroundColor: on ? T.priL : T.surf,
          borderWidth: on ? 1.5 : 1,
          borderColor: on ? T.pri : T.bd,
        }}
      >
        <Icon d={icon} size={20} color={on ? T.pri : T.t3} circle={circle} />
        <View>
          <Txt s={13.5} w={800} c={T.t1}>
            {title}
          </Txt>
          <Txt s={11.5} lh={1.4} c={T.t3} style={{ marginTop: 3 }}>
            {sub}
          </Txt>
        </View>
      </Touchable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        ref={kb.ref}
        {...kb.scrollProps}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: Math.max(insets.bottom, 16) + 16 + kb.bottomPadding,
          paddingHorizontal: 22,
        }}
        showsVerticalScrollIndicator={false}
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
            <LoginMark color={T.pri} faceColor={T.surf} />
          </View>

          <Txt s={30} w={800} c={T.t1} ls={-0.7} lh={1.12} style={{ marginTop: 18 }}>
            {signup ? 'Criar conta' : 'Entrar'}
          </Txt>
          <Txt s={14.5} lh={1.6} c={T.t2} style={{ marginTop: 8 }}>
            {signup
              ? 'Leva menos de um minuto. Nenhuma imagem sai do aparelho.'
              : 'Bom te ver de novo.'}
          </Txt>
        </Rise>

        <Rise delay={35}>
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
          <Rise delay={70}>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {roleCard('user', ICONS.smile, 'Para mim', 'Tenho meu bichinho', true)}
              {roleCard('care', ICONS.people, 'Sou cuidador', 'Acompanho alguém')}
            </View>
          </Rise>
        ) : null}

        <Rise delay={100}>
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

            {/* Força da senha: só no cadastro, e só depois de começar a digitar. */}
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
                        color={check.passed ? T.ok : T.t3}
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
                label="Código de convite (opcional)"
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
                  backgroundColor: hexA(T.danger, 0.1),
                }}
              >
                <Icon d={ICONS.alert} size={15} color={T.danger} circle sw={1.9} />
                <Txt s={12.5} lh={1.5} c={T.danger} style={{ flex: 1 }}>
                  {state.authError}
                </Txt>
              </View>
            ) : null}
          </Animated.View>
        </Rise>

        <View style={{ flex: 1, minHeight: 20 }} />

        <Rise delay={135}>
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
            label={signup ? 'Criar conta' : 'Entrar'}
            loading={state.authLoading}
            disabled={!canSubmit}
            onPress={actions.submitAuth}
          />
          {__DEV__ ? (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="Explorar prévia local"
              onPress={() =>
                actions.set((s) => ({
                  userId: 'preview-local',
                  authRestored: true,
                  authError: null,
                  role: 'user',
                  accountRole: 'user',
                  visionMode: 'demo',
                  observedExpression: 'neutral',
                  petMood: 'neutral',
                  signalStatus: 'ready',
                  signalConfidence: EMOTIONS.neutral.conf,
                  qualityScore: EMOTIONS.neutral.quality / 100,
                  careDays: 4,
                  fed: 2,
                  played: 3,
                  xp: 130,
                  screen: 'home',
                  navSeq: s.navSeq + 1,
                }))
              }
              style={{
                marginTop: 10,
                minHeight: 48,
                paddingVertical: 13,
                paddingHorizontal: 18,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: T.surfWarm,
                borderWidth: 1,
                borderColor: T.bd,
              }}
            >
              <Txt s={14} w={700} c={T.t2}>
                {SUPABASE_CONFIGURED ? 'Explorar modo demonstração' : 'Explorar prévia local (sem servidor)'}
              </Txt>
            </Touchable>
          ) : null}
        </Rise>
      </ScrollView>
    </View>
  );
}
