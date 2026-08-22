import React, { useEffect, useState } from 'react';
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
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!state.userId) return;
    getOrCreatePendingInvite(state.userId)
      .then((link) => setInviteCode(link.invite_code))
      .catch(() => undefined);
  }, [state.userId]);

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    if (!inviteCode) return;
    Share.share({ message: `Use o código ${inviteCode} para se conectar comigo no MellowPet.` }).catch(
      () => undefined
    );
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="RECURSOS" title={'Ferramentas\nde quem cuida'} />

      <Section top={0} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {CARE_TOOLS.map(([title, sub, icon]) => (
          <Touchable
            key={title}
            onPress={() => actions.go('chat')}
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

      {/* código de convite */}
      <Section top={12}>
        <View style={{ padding: 16, borderRadius: 20, backgroundColor: T.priL }}>
          <Txt s={13} w={800} c={T.pri}>
            Convidar alguém
          </Txt>
          <Txt s={13} lh={1.55} c={T.t2} style={{ marginTop: 7 }}>
            Envie o código abaixo. A conexão só vale depois que a pessoa aceitar no aparelho dela.
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
              {inviteCode ?? '···· ····'}
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
