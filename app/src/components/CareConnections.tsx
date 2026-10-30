import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { listLinks, revokeCareLink, type CaregiverLink } from '../care/careClient';
import { isPaused } from '../care/presenceClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK } from '../theme/palette';
import { ActionMessage, CareLinkButton, CarePillButton, LoadingCard } from './CareStates';
import { PauseSharing } from './CaredPresence';
import { Field } from './Field';
import { Card, PrimaryButton, Txt } from './ui';

type Message = { text: string; tone: 'ok' | 'error' };

const caregiverName = (link: CaregiverLink) => link.caregiver_display_name?.trim() || link.caregiver_email || 'Cuidador';

/**
 * Seção "Conexões" dos Ajustes da pessoa acompanhada. Lista TODOS os
 * cuidadores (C8), cada um com pausar/retomar e encerrar, e leva o código de
 * convite para a tela de prévia + consentimento (C9).
 */
export function CareConnectionsCard() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [links, setLinks] = useState<CaregiverLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message>>({});

  const refresh = useCallback(async () => {
    if (!state.userId) return false;
    try {
      const res = await listLinks(state.userId, 'user');
      setLinks(res.links);
      setLoadError(null);
      actions.set({ linked: res.links.length > 0 });
      return true;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar suas conexões de cuidado.');
      return false;
    }
  }, [actions, state.userId]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const setMessage = (id: string, message: Message | null) =>
    setMessages((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });

  const disconnect = (link: CaregiverLink) => {
    if (busy) return;
    const name = caregiverName(link);
    Alert.alert(
      `Encerrar conexão com ${name}?`,
      'O acesso é interrompido agora e não dá para desfazer: para voltar, será preciso um convite novo. O registro operacional do vínculo é preservado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar conexão',
          style: 'destructive',
          onPress: () => {
            setBusy(link.id);
            setMessage(link.id, null);
            revokeCareLink(link.id)
              .then(async () => {
                if (await refresh()) setMessage('global', { tone: 'ok', text: `Conexão com ${name} encerrada. Ele não acessa mais seus dados.` });
              })
              .catch((error) =>
                setMessage(link.id, { tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível encerrar a conexão.' })
              )
              .finally(() => setBusy(null));
          },
        },
      ]
    );
  };

  const openPreview = () => {
    actions.set({ pairCode: code.trim() });
    actions.go('acceptinvite');
  };

  return (
    <Card radius={24} padding={18}>
      <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 6 }} accessibilityRole="header">
        Conexões de cuidado
      </Txt>
      <Txt s={11.5} lh={1.5} c={T.t3}>
        A conexão é sempre sua escolha. Pausar esconde os dados por um tempo; encerrar corta o acesso na hora.
      </Txt>

      {links === null && !loadError ? (
        <View style={{ marginTop: 12 }}>
          <LoadingCard text="Carregando conexões…" />
        </View>
      ) : null}
      {loadError ? (
        <View style={{ marginTop: 12 }}>
          <Txt s={12.5} lh={1.45} c={DANGER} accessibilityRole="alert">
            {loadError}
          </Txt>
          <CareLinkButton label="Tentar de novo" onPress={() => refresh().catch(() => undefined)} />
        </View>
      ) : null}
      {links && links.length === 0 ? (
        <Txt s={13} w={700} c={T.t1} style={{ marginTop: 12 }}>
          Nenhum cuidador conectado.
        </Txt>
      ) : null}

      {(links ?? []).map((link) => {
        const name = caregiverName(link);
        const paused = isPaused(link);
        return (
          <View key={link.id} style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.bdL }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: T.priL, alignItems: 'center', justifyContent: 'center' }}>
                <Txt s={15} w={800} c={T.pri}>
                  {name.charAt(0).toUpperCase()}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt s={14} w={700} c={T.t1}>
                  {name}
                </Txt>
                <Txt s={11.5} w={700} c={paused ? T.t3 : OK} style={{ marginTop: 2 }}>
                  {paused ? 'Compartilhamento pausado' : 'Conectado'}
                </Txt>
              </View>
            </View>
            <PauseSharing link={link} onChange={() => refresh().catch(() => undefined)} />
            <CarePillButton
              label={busy === link.id ? 'Encerrando…' : `Encerrar conexão com ${name}`}
              onPress={() => disconnect(link)}
              disabled={busy !== null}
              danger
              hint="Pede confirmação antes de encerrar"
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
            />
            <ActionMessage message={messages[link.id] ?? null} onClose={() => setMessage(link.id, null)} />
          </View>
        );
      })}
      <ActionMessage message={messages.global ?? null} onClose={() => setMessage('global', null)} />

      {links && links.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <CareLinkButton label="Ver o que meu cuidador vê" onPress={() => actions.go('caremirror')} />
          <CareLinkButton label="Do meu cuidador: plano e compromissos" onPress={() => actions.go('caredcare')} />
        </View>
      ) : null}

      <View style={{ marginTop: 14, gap: 8 }}>
        <Field
          label={links && links.length > 0 ? 'Conectar outro cuidador' : 'Código de convite de um cuidador'}
          value={code}
          onChangeText={setCode}
          placeholder="MEL-XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          hint="Antes de aceitar, você vê o que será compartilhado."
          style={{ letterSpacing: 1.5, fontWeight: '700' }}
        />
        <PrimaryButton label="Ver o que será compartilhado" disabled={!code.trim()} onPress={openPreview} />
      </View>
    </Card>
  );
}
