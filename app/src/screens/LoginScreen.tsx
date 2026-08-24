import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { PrimaryButton, Segmented, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { HEAD } from '../data/pets';
import { useApp, useTheme } from '../state/AppContext';

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

export function LoginScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const insets = useSafeAreaInsets();

  const signup = state.signup;
  const showPairing = signup && state.signupRole === 'user';

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

  const socialButton = (label: string, onPress?: () => void) => (
    <Touchable
      onPress={onPress}
      disabled={!onPress || state.authLoading}
      style={{
        flex: 1,
        paddingVertical: 13,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: T.surf,
        borderWidth: 1,
        borderColor: T.bd,
        opacity: onPress ? 1 : 0.5,
      }}
    >
      <Txt s={13} w={700} c={T.t2}>
        {label}
      </Txt>
    </Touchable>
  );

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

        <Segmented
          items={['Entrar', 'Criar conta']}
          index={signup ? 1 : 0}
          onChange={(i) => actions.set({ signup: i === 1 })}
          style={{ marginTop: 22 }}
        />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {roleCard('user', ICONS.smile, 'Para mim', 'Tenho meu bichinho', true)}
          {roleCard('care', ICONS.people, 'Sou cuidador', 'Acompanho alguém')}
        </View>

        <View style={{ gap: 10, marginTop: 16 }}>
          <Field
            label="E-mail"
            value={state.email}
            onChangeText={(email) => actions.set({ email })}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Senha"
            value={state.pass}
            onChangeText={(pass) => actions.set({ pass })}
            placeholder="••••••••"
            secureTextEntry
          />
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
            <Txt s={12.5} lh={1.5} c="#D64545">
              {state.authError}
            </Txt>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          {socialButton('Google', actions.loginWithGoogle)}
          {socialButton('Apple')}
        </View>

        <View style={{ flex: 1, minHeight: 20 }} />

        <Txt s={11.5} lh={1.55} c={T.t3} style={{ marginBottom: 14 }}>
          Em uma sessão de câmera visível, a análise roda no aparelho. Nenhuma imagem é enviada
          ou armazenada; somente eventos agregados podem ser sincronizados com sua conta.
        </Txt>
        <PrimaryButton
          label={state.authLoading ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
          disabled={state.authLoading}
          onPress={actions.submitAuth}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
