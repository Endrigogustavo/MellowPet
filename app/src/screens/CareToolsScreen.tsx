import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Share, View } from 'react-native';
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

  return (
    <ScreenScroll>
      <ScreenTitle label="RECURSOS" title={'Ferramentas\nde quem cuida'} />

      <Section top={0} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {CARE_TOOLS.map(({ title, sub, icon, target }) => (
          <Touchable
            key={title}
            onPress={() => actions.go(target)}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${sub}`}
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
        <View style={{ borderRadius: 20, padding: 6, paddingHorizontal: 15, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd }}>
          {(
            [
              ['Histórico por dia, semana e mês', 'carehistory'],
              ['Anotações por dia', 'carenotes'],
              ['Regras de alerta', 'carealertrules'],
              ['Notificações e silêncio noturno', 'carenotify'],
            ] as const
          ).map(([label, target], index) => (
            <Touchable
              key={target}
              onPress={() => actions.go(target)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTopWidth: index ? 1 : 0,
                borderTopColor: T.bdL,
              }}
            >
              <Txt s={13.5} w={700} c={T.t1}>
                {label}
              </Txt>
              <Txt s={16} w={800} c={T.t3}>
                ›
              </Txt>
            </Touchable>
          ))}
        </View>
      </Section>

      <Section top={12}>
        <Touchable
          onPress={() => actions.go('careguide')}
          accessibilityRole="button"
          style={{ borderRadius: 20, padding: 15, backgroundColor: T.priL, flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Icon d={ICONS.help} size={20} color={T.pri} />
          <View style={{ flex: 1 }}>
            <Txt s={14} w={800} c={T.t1}>Guia do cuidador</Txt>
            <Txt s={12} c={T.t2} style={{ marginTop: 3 }}>Conexão, limites do vínculo e próximos passos respeitosos.</Txt>
          </View>
        </Touchable>
      </Section>

      {/* código de convite */}
      <Section top={12}>
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: T.priL }}>
          <Txt s={13} w={800} c={T.pri}>
            Convidar uma pessoa acompanhada
          </Txt>
          <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 7 }}>
            Envie o código abaixo. Ele vale por 72 horas, e o acompanhamento só começa depois que a pessoa aceitar. Ela pode encerrar o vínculo quando quiser.
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
          {notice ? (
            <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
              {notice}
            </Txt>
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
        <Touchable
          onPress={() => Linking.openURL('tel:188').catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel="Ligar para o CVV, 188"
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
              Toque para ligar para o CVV (188, 24h). Perigo imediato: SAMU 192.
            </Txt>
          </View>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
