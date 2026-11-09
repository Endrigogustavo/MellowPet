import React, { useState } from 'react';
import { View } from 'react-native';

import { acceptInviteWithConsent } from '../care/careUxClient';
import { CARE_TERMS_VERSION } from '../care/careUxTypes';
import { ActionMessage, CareLinkButton } from '../components/CareStates';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';

const SEES = [
  'Um índice de 0 a 100 e uma frase sobre os sinais agregados (por dia, semana e mês).',
  'A proporção de momentos agradáveis, neutros e difíceis — nunca leitura por leitura.',
  'Alertas quando há vários sinais difíceis em pouco tempo (só o aviso, sem fotos).',
  'Seus pedidos “Preciso de você” e o plano e compromissos que ele combinar com você.',
];

const NOT_SEES = [
  'Suas conversas com o pet ou com o Mellow.',
  'Fotos, vídeo ou imagens da câmera.',
  'Seus check-ins pessoais, diário e anotações.',
  'Sua localização e seus contatos.',
];

/**
 * Aceite do vínculo com prévia (C9): a pessoa vê o que será e o que NÃO será
 * compartilhado antes de aceitar, e o aceite grava a versão do termo.
 */
export function AcceptInviteScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [code, setCode] = useState(state.pairCode);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ consentRecorded: boolean } | null>(null);

  const accept = () => {
    if (!state.userId || busy) return;
    if (!code.trim()) {
      setError('Digite o código que seu cuidador enviou.');
      return;
    }
    if (!agreed) {
      setError('Marque que você leu o que será compartilhado.');
      return;
    }
    setBusy(true);
    setError(null);
    acceptInviteWithConsent(code, state.userId)
      .then((outcome) => {
        setDone({ consentRecorded: outcome.consentRecorded });
        actions.set({ linked: true, pairCode: '' });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível aceitar o convite.'))
      .finally(() => setBusy(false));
  };

  const finish = () => {
    if (!actions.back()) actions.go('settings');
  };

  const list = (items: string[], positive: boolean) =>
    items.map((item) => (
      <View key={item} style={{ flexDirection: 'row', gap: 9, marginTop: 9, alignItems: 'flex-start' }}>
        <Icon d={positive ? ICONS.check : ICONS.close} size={15} color={positive ? OK : DANGER} sw={2.3} />
        <Txt s={13} lh={1.5} c={T.t1} style={{ flex: 1 }}>
          {item}
        </Txt>
      </View>
    ));

  if (done) {
    return (
      <ScreenScroll>
        <ScreenTitle label="CONEXÃO" title={'Pronto,\nvocês estão conectados'} />
        <Section top={0}>
          <Card radius={24} padding={20}>
            <Txt s={14.5} w={800} c={OK} accessibilityRole="alert">
              Convite aceito.
            </Txt>
            <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 6 }}>
              Você pode pausar o compartilhamento ou encerrar a conexão a qualquer momento em Ajustes.
              {done.consentRecorded ? '' : ' (O registro da versão do termo ainda não está ativo no servidor; a conexão funciona normalmente.)'}
            </Txt>
            <PrimaryButton label="Voltar aos ajustes" onPress={finish} style={{ marginTop: 14 }} />
          </Card>
        </Section>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <ScreenTitle label="CONECTAR COM CUIDADOR" title={'Antes de\naceitar'} />
      <Section top={0}>
        <Txt s={12.5} lh={1.55} c={T.t2}>
          Leia com calma. Você decide — e pode pausar ou encerrar quando quiser, sem precisar explicar nada.
        </Txt>
      </Section>
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
            O que seu cuidador vai ver
          </Txt>
          {list(SEES, true)}
        </Card>
      </Section>
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={15} w={800} c={T.t1} accessibilityRole="header">
            O que ele NÃO vai ver
          </Txt>
          {list(NOT_SEES, false)}
        </Card>
      </Section>
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1}>
            Você continua no controle
          </Txt>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 4 }}>
            Pausar por 24 h ou 7 dias esconde os dados (seus pedidos de contato continuam chegando). Encerrar corta o acesso na hora. Em
            Ajustes, “O que meu cuidador vê” mostra o painel dele com os seus dados.
          </Txt>
        </Card>
      </Section>
      <Section>
        <Card radius={24} padding={18}>
          <Field
            label="Código de convite"
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(null);
            }}
            placeholder="MEL-XXXXX-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{ letterSpacing: 1.5, fontWeight: '700' }}
          />
          <Touchable
            onPress={() => {
              setAgreed(!agreed);
              setError(null);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="Li o que será e o que não será compartilhado e quero me conectar"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 44 }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: agreed ? T.pri : T.bd,
                backgroundColor: agreed ? T.pri : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {agreed ? <Icon d={ICONS.check} size={14} color={T.onPri} sw={2.6} /> : null}
            </View>
            <Txt s={12.5} lh={1.45} c={T.t1} style={{ flex: 1 }}>
              Li o que será e o que não será compartilhado e quero me conectar.
            </Txt>
          </Touchable>
          <PrimaryButton label={busy ? 'Conectando…' : 'Aceitar e conectar'} disabled={busy || !agreed || !code.trim()} onPress={accept} style={{ marginTop: 12 }} />
          <ActionMessage message={error ? { text: error, tone: 'error' } : null} onClose={() => setError(null)} />
          <Txt s={11} c={T.t3} style={{ marginTop: 10 }}>
            Versão do termo: {CARE_TERMS_VERSION}
          </Txt>
          <CareLinkButton label="Agora não" tone="muted" onPress={finish} />
        </Card>
      </Section>
    </ScreenScroll>
  );
}
