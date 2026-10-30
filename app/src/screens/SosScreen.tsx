import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View, type ViewStyle } from 'react-native';

import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, ToggleRow, Touchable, Txt } from '../components/ui';
import { phoneDigits, sosText, whatsappLink } from '../integrations/sos';
import { cachedContacts, fetchSettings, type EmergencyContact } from '../settings/settingsClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';

/** Onde a mensagem de falha aparece: junto do bloco que a gerou. */
type NoticeArea = 'emergency' | 'network';

/**
 * Pedido de ajuda: tudo o que importa num toque, sem conversa no meio.
 * Ligar para o CVV/SAMU, chamar a rede pelo WhatsApp (com a localização, se a
 * pessoa quiser) e abrir o plano de crise que ela mesma escreveu.
 */
export function SosScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  // Sem isto a tela dizia "nenhum contato" antes de o cache responder.
  const [contactsLoading, setContactsLoading] = useState(true);
  const [withLocation, setWithLocation] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ text: string; area: NoticeArea } | null>(null);

  // Primeiro a cópia do aparelho (funciona sem rede, que é justamente quando
  // mais falta faz), depois a do servidor se vier.
  useEffect(() => {
    if (!state.userId) return;
    const userId = state.userId;
    let alive = true;
    cachedContacts(userId)
      .then((local) => {
        if (!alive) return;
        setContacts((cur) => (cur.length ? cur : local));
        if (local.length) setContactsLoading(false);
      })
      .catch(() => undefined);
    fetchSettings(userId)
      .then((s) => {
        if (alive) setContacts(s.emergency_contacts ?? []);
      })
      // Sem servidor fica a cópia do aparelho; CVV e SAMU seguem funcionando.
      .catch(() => undefined)
      .finally(() => {
        if (alive) setContactsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [state.userId]);

  const open = (url: string, what: string, area: NoticeArea = 'network') =>
    Linking.openURL(url).catch(() =>
      setNotice({ text: `Não consegui abrir ${what} neste celular. Tente ligar direto.`, area })
    );
  const call = (number: string, area: NoticeArea = 'network') => open(`tel:${number}`, 'o telefone', area);

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
    if (withLocation && !coords) {
      setNotice({ text: 'Sem acesso à localização: a mensagem vai sem ela.', area: 'network' });
    }
    const link = whatsappLink(c.contact, sosText(coords));
    if (link) open(link, 'o WhatsApp');
  };

  const phones = contacts.filter((c) => phoneDigits(c.contact));

  // "Ligar" e "SMS" lado a lado com 48 px: é a tela de crise.
  const sideButton: ViewStyle = {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: T.priL,
  };

  const noticeFor = (area: NoticeArea) =>
    notice?.area === area ? (
      <Txt
        s={12}
        lh={1.45}
        c={DANGER}
        style={{ marginTop: 10 }}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {notice.text}
      </Txt>
    ) : null;

  return (
    <ScreenScroll>
      <ScreenTitle label="AJUDA" title={'Você não está\nsozinho'} />

      <Section top={4}>
        <Card radius={24} padding={18}>
          <PrimaryButton label="Ligar para o CVV · 188" onPress={() => call('188', 'emergency')} />
          <Txt s={11.5} lh={1.45} c={T.t3} center style={{ marginTop: 6 }}>
            Gratuito, 24 horas, sigiloso. Também por chat em cvv.org.br.
          </Txt>
          <Touchable
            onPress={() => call('192', 'emergency')}
            accessibilityLabel="Ligar para o SAMU 192"
            style={{
              marginTop: 14,
              minHeight: 48,
              justifyContent: 'center',
              padding: 13,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: DANGER,
              alignItems: 'center',
            }}
          >
            <Txt s={14} w={800} c={DANGER}>
              Perigo agora? SAMU · 192
            </Txt>
          </Touchable>
          {noticeFor('emergency')}
        </Card>
      </Section>

      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2}>
            Chamar minha rede
          </Txt>
          {phones.length === 0 && contactsLoading ? (
            <View
              accessible
              accessibilityLabel="Carregando seus contatos"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}
            >
              <ActivityIndicator size="small" color={T.pri} />
              <Txt s={12.5} c={T.t3}>
                Carregando seus contatos…
              </Txt>
            </View>
          ) : phones.length === 0 ? (
            <>
              <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
                Nenhum contato com telefone ainda. Quem você adicionar aparece aqui, pronto
                para ligar ou mandar mensagem.
              </Txt>
              <Touchable
                onPress={() => actions.go('settings')}
                accessibilityLabel="Adicionar contato de emergência em Ajustes"
                style={[sideButton, { flex: 0, marginTop: 10 }]}
              >
                <Txt s={13.5} w={800} c={T.pri}>
                  + Adicionar contato
                </Txt>
              </Touchable>
            </>
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
              <View style={{ gap: 12, marginTop: 10 }}>
                {phones.map((c) => (
                  <View key={c.contact} style={{ gap: 8 }}>
                    <PrimaryButton
                      label={`WhatsApp para ${c.name}`}
                      loading={busy === c.contact}
                      disabled={busy !== null && busy !== c.contact}
                      onPress={() => {
                        whatsapp(c).catch(() => undefined);
                      }}
                    />
                    {/* Sem WhatsApp ou sem internet: ligar e SMS sempre funcionam. */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Touchable
                        onPress={() => call(phoneDigits(c.contact)!)}
                        accessibilityLabel={`Ligar para ${c.name}`}
                        style={sideButton}
                      >
                        <Txt s={13.5} w={800} c={T.pri}>
                          Ligar
                        </Txt>
                      </Touchable>
                      <Touchable
                        onPress={() =>
                          open(`sms:${phoneDigits(c.contact)}?body=${encodeURIComponent(sosText())}`, 'as mensagens')
                        }
                        accessibilityLabel={`Mandar SMS para ${c.name}`}
                        style={sideButton}
                      >
                        <Txt s={13.5} w={800} c={T.pri}>
                          SMS
                        </Txt>
                      </Touchable>
                    </View>
                  </View>
                ))}
              </View>
              {noticeFor('network')}
            </>
          )}
        </Card>
      </Section>

      <Section>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Touchable
            onPress={() => actions.go('crisisplan')}
            accessibilityLabel="Abrir meu plano de crise"
            style={{ flex: 1, minHeight: 48, justifyContent: 'center', padding: 14, borderRadius: 18, backgroundColor: T.priL, alignItems: 'center' }}
          >
            <Txt s={13} w={800} c={T.pri}>
              Meu plano de crise
            </Txt>
          </Touchable>
          <Touchable
            onPress={actions.sosChat}
            accessibilityLabel="Conversar com o Mellow"
            style={{ flex: 1, minHeight: 48, justifyContent: 'center', padding: 14, borderRadius: 18, backgroundColor: T.priL, alignItems: 'center' }}
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
