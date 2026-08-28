import React, { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { ScreenTitle, Touchable, Txt, useColumnWidth } from '../components/ui';
import { CARE_TOOLS, ICONS } from '../data/content';
import { getOrCreatePendingInvite } from '../care/careClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

export function CareToolsScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const cardWidth = useColumnWidth(2, 9);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInvite = useCallback(async () => {
    if (!state.userId) {
      setInviteCode(null);
      setInviteError('Não foi possível identificar sua conta para criar o convite.');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    try {
      const link = await getOrCreatePendingInvite(state.userId);
      setInviteCode(link.invite_code);
    } catch (error) {
      setInviteCode(null);
      setInviteError(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível carregar seu código de convite. Tente novamente.'
      );
    } finally {
      setInviteLoading(false);
    }
  }, [state.userId]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const copyCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      setNotice(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice('Não foi possível copiar o código. Você pode digitá-lo ou tentar novamente.');
    }
  };

  const shareCode = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({ message: `Use o código ${inviteCode} para se conectar comigo no MellowPet.` });
      setNotice(null);
    } catch {
      setNotice('Não foi possível abrir o compartilhamento. Copie o código e envie pelo canal que preferir.');
    }
  };

  const destinationFor = (title: string) => {
    if (title === 'Guia do cuidador') return 'careguide' as const;
    if (title === 'Relatório semanal' || title === 'Comparar semanas' || title === 'Exportar dados') return 'dashboard' as const;
    if (title === 'Definir alertas') return 'carealerts' as const;
    if (title === 'Histórico de cuidado') return 'careaudit' as const;
    if (title === 'Check-in agendado' || title === 'Lembretes de rotina') return 'agenda' as const;
    if (title === 'Rede de apoio' || title === 'Plano de crise' || title === 'Equipe de cuidado' || title === 'Notas privadas' || title === 'Combinar limites') return 'careplan' as const;
    return null;
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="RECURSOS" title={'Ferramentas\nde quem cuida'} />

      <Section top={0}>
        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: T.priL,
            borderWidth: 1,
            borderColor: T.bd,
          }}
        >
          <Txt s={13} w={800} c={T.t1}>
            Recursos de acompanhamento aguardam ativação
          </Txt>
          <Txt s={12} lh={1.55} c={T.t2} style={{ marginTop: 5 }}>
            Você já pode enviar convites e combinar limites. Painel agregado, alertas, check-ins, agenda, plano de cuidado, equipe e notas dependem da configuração do módulo de cuidado no servidor. Até lá, nenhum dado é exibido.
          </Txt>
        </View>
      </Section>

      <Section top={12} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {CARE_TOOLS.map(([title, sub, icon]) => (
          <Touchable
            key={title}
            onPress={() => {
              const target = destinationFor(title);
              if (target) actions.go(target);
              else setNotice('O assistente para cuidadores está sendo preparado. Enquanto isso, use o guia para combinar limites e próximos passos respeitosos.');
            }}
            style={{
              width: cardWidth,
              minHeight: 120,
              borderRadius: 20,
              padding: 15,
              gap: 10,
              backgroundColor: T.surf,
              borderWidth: 1,
              borderColor: T.bd,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: T.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon d={icon} size={19} color={T.pri} />
            </View>
            <View>
              <Txt s={13.5} w={800} c={T.t1} lh={1.25}>
                {title}
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
                {sub}
              </Txt>
            </View>
          </Touchable>
        ))}
      </Section>

      <Section top={12}>
        <Touchable
          onPress={() => actions.go('careaudit')}
          accessibilityRole="button"
          accessibilityLabel="Abrir histórico de cuidado"
          accessibilityHint="Mostra apenas as ações importantes autorizadas, sem conteúdo sensível"
          style={{ borderRadius: 20, padding: 15, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd, flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Icon d="M6 4h10l4 4v12H6zM9 13h6M9 16h4" size={20} color={T.pri} />
          <View style={{ flex: 1 }}>
            <Txt s={14} w={800} c={T.t1}>Histórico de cuidado</Txt>
            <Txt s={12} c={T.t2} style={{ marginTop: 3 }}>Alterações importantes, sem exibir conteúdo sensível.</Txt>
          </View>
        </Touchable>
      </Section>

      <Section top={12}>
        <Touchable
          onPress={() => actions.go('careguide')}
          style={{ borderRadius: 20, padding: 15, backgroundColor: T.priL, flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Icon d={ICONS.help} size={20} color={T.pri} />
          <View style={{ flex: 1 }}>
            <Txt s={14} w={800} c={T.t1}>Guia do cuidador</Txt>
            <Txt s={12} c={T.t2} style={{ marginTop: 3 }}>Consentimento, limites e próximos passos respeitosos.</Txt>
          </View>
        </Touchable>
      </Section>

      {notice ? (
        <Section top={0}>
          <View style={{ padding: 14, borderRadius: 18, backgroundColor: T.priL }}>
            <Txt s={12.5} lh={1.5} c={T.t2}>{notice}</Txt>
          </View>
        </Section>
      ) : null}

      {/* código de convite */}
      <Section top={12}>
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: T.priL }}>
          <Txt s={13} w={800} c={T.pri}>
            Convidar uma pessoa acompanhada
          </Txt>
          <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 7 }}>
            Envie o código abaixo. A conexão só vale depois que a pessoa aceitar. Compartilhamento e recursos de acompanhamento continuam desativados até ela conceder permissões e o módulo de cuidado ser configurado.
          </Txt>
          <View
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 15,
              backgroundColor: T.surf,
              alignItems: 'center',
            }}
          >
            <Txt s={20} w={800} c={T.t1} ls={4}>
              {inviteCode ?? (inviteLoading ? 'Gerando…' : '···· ····')}
            </Txt>
          </View>
          {inviteCode ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
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
          {inviteError ? (
            <View style={{ marginTop: 12, gap: 9 }}>
              <Txt s={12} lh={1.5} c={DANGER}>{inviteError}</Txt>
              <Touchable
                disabled={inviteLoading}
                onPress={() => void loadInvite()}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: T.surf }}
              >
                <Txt s={12} w={800} c={T.pri}>{inviteLoading ? 'Tentando…' : 'Tentar novamente'}</Txt>
              </Touchable>
            </View>
          ) : null}
        </View>
      </Section>

      {/* emergência */}
      <Section top={12}>
        <View
          style={{
            padding: 15,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,.32)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: 'rgba(239,68,68,.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={ICONS.alert} size={17} color={DANGER} sw={1.9} circle />
          </View>
          <View style={{ flex: 1 }}>
            <Txt s={13} w={800} c={T.t1}>
              Emergência
            </Txt>
            <Txt s={11.5} c={T.t3} style={{ marginTop: 2 }}>
              CVV 188 · CAPS da região · plano combinado
            </Txt>
          </View>
        </View>
      </Section>
    </ScreenScroll>
  );
}
