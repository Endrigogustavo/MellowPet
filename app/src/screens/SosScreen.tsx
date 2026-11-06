import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, ToggleRow, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { phoneDigits, sosText, whatsappLink } from '../integrations/sos';
import { cachedContacts, fetchSettings, type EmergencyContact } from '../settings/settingsClient';
import { useApp, useTheme } from '../state/AppContext';

/**
 * Pedido de ajuda: tudo o que importa num toque, sem conversa no meio.
 * Ligar para o CVV/SAMU, chamar a rede pelo WhatsApp (com a localização, se a
 * pessoa quiser) e abrir o plano de crise que ela mesma escreveu.
 */
export function SosScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [withLocation, setWithLocation] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!state.userId) return;
    const userId = state.userId;
    cachedContacts(userId).then((local) => setContacts((cur) => (cur.length ? cur : local)));
    fetchSettings(userId)
      .then((s) => setContacts(s.emergency_contacts ?? []))
      .catch(() => undefined);
  }, [state.userId]);

  const open = (url: string, what: string) =>
    Linking.openURL(url).catch(() => setNotice(`Não consegui abrir ${what} neste celular. Tente ligar direto.`));
  const call = (number: string) => open(`tel:${number}`, 'o telefone');

  const whatsapp = async (c: EmergencyContact) => {
    setBusy(c.contact);
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      if (withLocation) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos =
            (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
          coords = pos?.coords ?? null;
        }
      }
    } catch {
      coords = null; // sem localização, a mensagem vai mesmo assim
    } finally {
      setBusy(null);
    }
    if (withLocation && !coords) setNotice('Sem acesso à localização: a mensagem vai sem ela.');
    const link = whatsappLink(c.contact, sosText(coords));
    if (link) open(link, 'o WhatsApp');
  };

  const phones = contacts.filter((c) => phoneDigits(c.contact));

  return (
    <ScreenScroll>
      <ScreenTitle label="Ajuda" title={'Você não está\nsozinho'} onBack={() => actions.back() || actions.goTab('home')} />

      <Section top={0}>
        <Card radius={24} padding={18}>
          <PrimaryButton label="Ligar para o CVV · 188" onPress={() => call('188')} />
          <Txt s={12} lh={1.45} c={T.t3} center style={{ marginTop: 8 }}>
            Gratuito, 24 horas, sigiloso. Também por chat em cvv.org.br.
          </Txt>
          <Touchable
            onPress={() => call('192')}
            accessibilityLabel="Ligar para o SAMU 192"
            style={{
              marginTop: 14,
              minHeight: 50,
              padding: 13,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: T.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt s={14} w={800} c={T.danger}>
              Perigo agora? SAMU · 192
            </Txt>
          </Touchable>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={13.5} w={800} c={T.t1}>
            Chamar minha rede
          </Txt>
          {phones.length === 0 ? (
            <View style={{ marginTop: 8, gap: 12 }}>
              <Txt s={12.5} lh={1.5} c={T.t2}>
                Você ainda não cadastrou contatos de confiança com telefone.
              </Txt>
              <Touchable
                onPress={() => actions.go('settings')}
                accessibilityLabel="Abrir Ajustes para adicionar contatos de emergência"
                style={{
                  minHeight: 46,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  backgroundColor: T.surfWarm,
                  borderWidth: 1,
                  borderColor: T.bd,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Txt s={13} w={800} c={T.pri}>
                  Adicionar contato em Ajustes
                </Txt>
                <Icon d={ICONS.chevron} size={15} color={T.pri} sw={2.1} />
              </Touchable>
            </View>
          ) : (
            <>
              <View style={{ marginTop: 6 }}>
                <ToggleRow
                  label="Mandar minha localização"
                  sub="Só nesta mensagem, só para quem você escolher."
                  on={withLocation}
                  onPress={() => setWithLocation((v) => !v)}
                />
              </View>
              <View style={{ gap: 10, marginTop: 10 }}>
                {phones.map((c) => (
                  <View key={c.contact} style={{ gap: 6 }}>
                    <PrimaryButton
                      label={busy === c.contact ? 'Pegando localização…' : `WhatsApp para ${c.name}`}
                      disabled={busy !== null}
                      onPress={() => {
                        whatsapp(c).catch(() => undefined);
                      }}
                    />
                    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                      <Touchable
                        onPress={() => call(phoneDigits(c.contact)!)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ligar para ${c.name}`}
                        style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}
                      >
                        <Txt s={12.5} w={800} c={T.pri}>
                          Ligar
                        </Txt>
                      </Touchable>
                      <Touchable
                        onPress={() => open(`sms:${phoneDigits(c.contact)}?body=${encodeURIComponent(sosText())}`, 'as mensagens')}
                        accessibilityRole="button"
                        accessibilityLabel={`Mandar SMS para ${c.name}`}
                        style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}
                      >
                        <Txt s={12.5} w={800} c={T.pri}>
                          SMS
                        </Txt>
                      </Touchable>
                    </View>
                  </View>
                ))}
              </View>
              {notice ? (
                <Txt s={12} lh={1.45} c={T.danger} style={{ marginTop: 10 }} accessibilityRole="alert">
                  {notice}
                </Txt>
              ) : null}
            </>
          )}
        </Card>
      </Section>

      <Section>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Touchable
            onPress={() => actions.go('crisisplan')}
            accessibilityLabel="Abrir meu plano de crise"
            style={{
              flex: 1,
              minHeight: 50,
              padding: 14,
              borderRadius: 18,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt s={13} w={800} c={T.pri} center>
              Meu plano de crise
            </Txt>
          </Touchable>
          <Touchable
            onPress={actions.sosChat}
            accessibilityLabel="Conversar com o Mellow"
            style={{
              flex: 1,
              minHeight: 50,
              padding: 14,
              borderRadius: 18,
              backgroundColor: T.priL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt s={13} w={800} c={T.pri} center>
              Falar com o Mellow
            </Txt>
          </Touchable>
        </View>
      </Section>
    </ScreenScroll>
  );
}
