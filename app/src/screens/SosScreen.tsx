import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, ToggleRow, Touchable, Txt } from '../components/ui';
import { phoneDigits, sosText, whatsappLink } from '../integrations/sos';
import { fetchSettings, type EmergencyContact } from '../settings/settingsClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

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

  useEffect(() => {
    if (!state.userId) return;
    fetchSettings(state.userId)
      .then((s) => setContacts(s.emergency_contacts ?? []))
      .catch(() => undefined);
  }, [state.userId]);

  const call = (number: string) => Linking.openURL(`tel:${number}`).catch(() => undefined);

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
    const link = whatsappLink(c.contact, sosText(coords));
    if (link) Linking.openURL(link).catch(() => undefined);
  };

  const phones = contacts.filter((c) => phoneDigits(c.contact));

  return (
    <ScreenScroll>
      <ScreenTitle label="AJUDA" title={'Você não está\nsozinho'} />

      <Section top={4}>
        <Card radius={24} padding={18}>
          <PrimaryButton label="Ligar para o CVV · 188" onPress={() => call('188')} />
          <Txt s={11.5} lh={1.45} c={T.t3} center style={{ marginTop: 6 }}>
            Gratuito, 24 horas, sigiloso. Também por chat em cvv.org.br.
          </Txt>
          <Touchable
            onPress={() => call('192')}
            accessibilityLabel="Ligar para o SAMU 192"
            style={{ marginTop: 14, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: DANGER, alignItems: 'center' }}
          >
            <Txt s={14} w={800} c={DANGER}>
              Perigo agora? SAMU · 192
            </Txt>
          </Touchable>
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2}>
            Chamar minha rede
          </Txt>
          {phones.length === 0 ? (
            <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
              Nenhum contato com telefone. Adicione em Ajustes → Contatos de emergência.
            </Txt>
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
              <View style={{ gap: 8, marginTop: 10 }}>
                {phones.map((c) => (
                  <PrimaryButton
                    key={c.contact}
                    label={busy === c.contact ? 'Pegando localização…' : `WhatsApp para ${c.name}`}
                    onPress={() => {
                      whatsapp(c).catch(() => undefined);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </Card>
      </Section>

      <Section>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Touchable
            onPress={() => actions.go('crisisplan')}
            accessibilityLabel="Abrir meu plano de crise"
            style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: T.priL, alignItems: 'center' }}
          >
            <Txt s={13} w={800} c={T.pri}>
              Meu plano de crise
            </Txt>
          </Touchable>
          <Touchable
            onPress={actions.sosChat}
            accessibilityLabel="Conversar com o Mellow"
            style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: T.priL, alignItems: 'center' }}
          >
            <Txt s={13} w={800} c={T.pri}>
              Falar com o Mellow
            </Txt>
          </Touchable>
        </View>
      </Section>
    </ScreenScroll>
  );
}
