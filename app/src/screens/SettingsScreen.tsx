import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { acceptInvite, deleteLink, listLinks, type CaregiverLink } from '../care/careClient';
import { Field } from '../components/Field';
import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, PrimaryButton, ScreenTitle, Toggle, ToggleRow, Touchable, Txt } from '../components/ui';
import { NO_FACE_MINUTES, SETTING_TOGGLES } from '../data/content';
import { PET_TYPES } from '../data/pets';
import { fetchSettings, saveSettings, type EmergencyContact } from '../settings/settingsClient';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER, OK, WARN, hexA, mix } from '../theme/palette';
import {
  getBackgroundHealth,
  isBackgroundEnabled,
  openAutostartSettings,
  requestBatteryExemption,
  setBackgroundEnabled,
} from '../widgets/widgetBridge';
import {
  BACKGROUND_VISION_INTERVALS,
  getBackgroundVision,
  setBackgroundVision,
} from '../vision/backgroundVision';

export function SettingsScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();
  const toggles = full ? SETTING_TOGGLES : SETTING_TOGGLES.slice(0, 3);

  // Vem do lado nativo, não do estado do app: quem manda é o serviço estar
  // rodando ou não, e ele sobrevive ao app fechar.
  const [background, setBackground] = useState(() => isBackgroundEnabled());
  const [bgVision, setBgVision] = useState(() => getBackgroundVision());
  // Reconsultado ao voltar de uma tela do sistema — é o único jeito de
  // saber se a pessoa concedeu a isenção.
  const [health, setHealth] = useState(() => getBackgroundHealth());
  const backgroundOn = background || bgVision.enabled;

  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactValue, setContactValue] = useState('');

  const addContact = () => {
    const name = contactName.trim();
    const contact = contactValue.trim();
    if (!name || !contact || !state.userId) return;
    const next = [...contacts, { name, contact }];
    setContacts(next);
    setContactName('');
    setContactValue('');
    saveSettings(state.userId, { emergency_contacts: next }).catch(() => undefined);
  };

  const removeContact = (index: number) => {
    const next = contacts.filter((_, i) => i !== index);
    setContacts(next);
    if (state.userId) saveSettings(state.userId, { emergency_contacts: next }).catch(() => undefined);
  };

  const refreshLinks = () => {
    if (!state.userId) return;
    listLinks(state.userId, 'user')
      .then((res) => {
        setLinks(res.links);
        actions.set({ linked: res.links.length > 0 });
      })
      .catch(() => undefined);
  };

  // Carrega preferências e vínculos reais de cuidador ao entrar na tela.
  useEffect(() => {
    if (!state.userId) return;
    fetchSettings(state.userId)
      .then((remote) => {
        actions.set({
          petName: remote.pet_name,
          petType: remote.pet_type as typeof state.petType,
          noFaceMin: remote.no_face_alert_minutes,
          toggles: { ...state.toggles, music: remote.music_enabled, alerts: remote.alerts_enabled },
        });
        setContacts(remote.emergency_contacts);
      })
      .catch(() => undefined);
    refreshLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  // Salva no backend com debounce sempre que uma preferência muda — evita um
  // PUT por tecla digitada no nome do bichinho.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (!state.userId) return;
    const timer = setTimeout(() => {
      saveSettings(state.userId!, {
        pet_name: state.petName,
        pet_type: state.petType,
        no_face_alert_minutes: state.noFaceMin,
        music_enabled: !!state.toggles.music,
        alerts_enabled: !!state.toggles.alerts,
      }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [state.userId, state.petName, state.petType, state.noFaceMin, state.toggles.music, state.toggles.alerts]);

  const submitInviteCode = () => {
    const code = codeInput.trim();
    if (!code || !state.userId) return;
    setAccepting(true);
    setAcceptError(null);
    acceptInvite(code, state.userId)
      .then(() => {
        setCodeInput('');
        refreshLinks();
      })
      .catch((error) => setAcceptError(error instanceof Error ? error.message : 'Código inválido'))
      .finally(() => setAccepting(false));
  };

  const primaryLink = links[0];
  const linkLabel = primaryLink ? 'Conectado' : 'Nenhum cuidador conectado';
  const linkColor = primaryLink ? OK : T.t3;
  const linkName =
    primaryLink?.caregiver_display_name || primaryLink?.caregiver_email || 'Cuidador';

  return (
    <ScreenScroll>
      <ScreenTitle label="AJUSTES" title="Do seu jeito" />

      {/* bichinho */}
      <Section top={0}>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 9 }}>
            Nome do bichinho
          </Txt>
          <Field
            variant="filled"
            value={state.petName}
            onChangeText={(petName) => actions.set({ petName })}
            style={{ fontSize: 15, fontWeight: '700' }}
          />

          <Txt s={12} w={800} c={T.t2} style={{ marginTop: 16, marginBottom: 9 }}>
            Aparência
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PET_TYPES.map(([id, label, color]) => {
              const on = id === state.petType;
              return (
                <Touchable
                  key={id}
                  onPress={() => actions.set({ petType: id })}
                  style={{
                    width: '30%',
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: on ? T.priL : T.bg,
                  }}
                >
                  <PetFace
                    size={34}
                    petType={id}
                    body={isDark ? mix(color, '#FFFFFF', 0.14) : color}
                  />
                  <Txt s={11} w={700} c={on ? T.pri : T.t2}>
                    {label}
                  </Txt>
                </Touchable>
              );
            })}
          </View>
        </Card>
      </Section>

      {/* conexões */}
      <Section>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 12 }}>
            Conexões
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: T.priL,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt s={15} w={800} c={T.pri}>
                {linkName.charAt(0).toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={14} w={700} c={T.t1}>
                {primaryLink ? linkName : 'Ninguém conectado'}
              </Txt>
              <Txt s={11.5} w={700} c={linkColor} style={{ marginTop: 2 }}>
                {linkLabel}
              </Txt>
            </View>
            {primaryLink ? (
              <Touchable
                onPress={() =>
                  state.userId &&
                  deleteLink(primaryLink.id, state.userId)
                    .then(refreshLinks)
                    .catch(() => undefined)
                }
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: T.bd,
                }}
              >
                <Txt s={11.5} w={800} c={T.t2}>
                  Desconectar
                </Txt>
              </Touchable>
            ) : null}
          </View>

          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 11 }}>
            A conexão é sempre sua escolha. Ao desconectar, o painel dela fica vazio na hora.
          </Txt>

          {!primaryLink ? (
            <View style={{ marginTop: 13, gap: 8 }}>
              <Field
                label="Código de convite de um cuidador"
                value={codeInput}
                onChangeText={setCodeInput}
                placeholder="MEL-4821"
                autoCapitalize="characters"
                style={{ letterSpacing: 2, fontWeight: '700' }}
              />
              {acceptError ? (
                <Txt s={12} c={DANGER}>
                  {acceptError}
                </Txt>
              ) : null}
              <PrimaryButton
                label={accepting ? 'Aguarde…' : 'Conectar com o código'}
                disabled={accepting || !codeInput.trim()}
                onPress={submitInviteCode}
              />
            </View>
          ) : null}

          {state.accountRole === 'care' ? (
            <Touchable
              onPress={() => actions.setRole('care')}
              style={{
                marginTop: 14,
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: T.priL,
              }}
            >
              <Txt s={13.5} w={800} c={T.pri}>
                Ver painel de cuidador
              </Txt>
            </Touchable>
          ) : null}
        </Card>
      </Section>

      {/* preferências */}
      <Section>
        <Card radius={24} padding={18} style={{ paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 }}>
            <View style={{ flex: 1 }}>
              <Txt s={14.5} w={700} c={T.t1}>
                Modo silencioso
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                Sem avisos em aula ou reunião - a leitura continua
              </Txt>
            </View>
            <Toggle on={state.quiet} onPress={() => actions.set((s) => ({ quiet: !s.quiet }))} />
          </View>

          <ToggleRow
            label="Widgets em segundo plano"
            sub="Registrar sentimento e controlar a música pela tela inicial com o app fechado. Deixa um aviso fixo na barra."
            on={background}
            divider
            onPress={() => {
              const next = !background;
              setBackgroundEnabled(next);
              setBackground(next);
            }}
          />

          <ToggleRow
            label="Ler expressão com o app fechado"
            sub={`A câmera abre por alguns segundos a cada ${bgVision.intervalMinutes} min, lê e fecha. Fica um aviso permanente enquanto estiver ligado.`}
            on={bgVision.enabled}
            divider
            onPress={() => {
              const next = { ...bgVision, enabled: !bgVision.enabled };
              setBackgroundVision(next.enabled, next.intervalMinutes);
              setBgVision(next);
            }}
          />

          {bgVision.enabled ? (
            <View style={{ paddingBottom: 15, gap: 8 }}>
              <Txt s={11.5} c={T.t3}>
                Uma leitura a cada
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {BACKGROUND_VISION_INTERVALS.map((minutes) => {
                  const on = minutes === bgVision.intervalMinutes;
                  return (
                    <Touchable
                      key={minutes}
                      onPress={() => {
                        setBackgroundVision(true, minutes);
                        setBgVision({ enabled: true, intervalMinutes: minutes });
                      }}
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: on ? T.priL : T.bg,
                        borderWidth: 1,
                        borderColor: on ? T.pri : T.bd,
                      }}
                    >
                      <Txt s={12.5} w={800} c={on ? T.pri : T.t2}>
                        {minutes} min
                      </Txt>
                    </Touchable>
                  );
                })}
              </View>
              <Txt s={11} lh={1.45} c={T.t3}>
                Intervalos curtos gastam mais bateria. As imagens não saem do
                aparelho — só o resultado da leitura é guardado.
              </Txt>
            </View>
          ) : null}

          {/* O serviço parar sozinho quase sempre é o sistema derrubando, não
              o app desistindo. Estas duas travas são as culpadas comuns. */}
          {backgroundOn && (!health.batteryExempt || health.aggressiveOem) ? (
            <View
              style={{
                marginBottom: 15,
                padding: 14,
                borderRadius: 16,
                backgroundColor: hexA(WARN, 0.1),
                gap: 10,
              }}
            >
              <Txt s={12.5} w={800} c={T.t1}>
                Para não parar sozinho
              </Txt>
              <Txt s={11.5} lh={1.5} c={T.t2}>
                O Android desliga o MellowPet depois de um tempo se estas duas
                permissões não estiverem liberadas.
              </Txt>

              {!health.batteryExempt ? (
                <Touchable
                  onPress={() => {
                    requestBatteryExemption();
                    // A resposta vem de outra tela; reconsulta ao voltar.
                    setTimeout(() => setHealth(getBackgroundHealth()), 800);
                  }}
                  style={{
                    paddingVertical: 11,
                    borderRadius: 13,
                    alignItems: 'center',
                    backgroundColor: T.pri,
                  }}
                >
                  <Txt s={12.5} w={800} c="#fff">
                    1. Liberar bateria sem restrição
                  </Txt>
                </Touchable>
              ) : (
                <Txt s={11.5} w={700} c={OK}>
                  Bateria sem restrição — liberado
                </Txt>
              )}

              {health.aggressiveOem ? (
                <Touchable
                  onPress={() => openAutostartSettings()}
                  style={{
                    paddingVertical: 11,
                    borderRadius: 13,
                    alignItems: 'center',
                    backgroundColor: T.surf,
                    borderWidth: 1,
                    borderColor: T.bd,
                  }}
                >
                  <Txt s={12.5} w={800} c={T.t1}>
                    2. Ativar inicialização automática
                  </Txt>
                </Touchable>
              ) : null}

              {health.aggressiveOem ? (
                <Txt s={11} lh={1.45} c={T.t3}>
                  No seu aparelho, procure o MellowPet na lista e ligue a chave.
                  Vale também abrir os apps recentes e travar o MellowPet com o
                  cadeado.
                </Txt>
              ) : null}
            </View>
          ) : null}

          {toggles.map(([key, label, sub]) => (
            <ToggleRow
              key={key}
              label={label}
              sub={sub}
              on={!!state.toggles[key]}
              divider
              onPress={() =>
                actions.set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } }))
              }
            />
          ))}
        </Card>
      </Section>

      {full ? (
        <>
          <Section>
            <Card radius={24} padding={18}>
              <Txt s={14.5} w={700} c={T.t1}>
                Alerta sem rosto
              </Txt>
              <Txt s={11.5} c={T.t3} style={{ marginTop: 3 }}>
                Avisar após {state.noFaceMin} min sem detecção
              </Txt>
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
                {NO_FACE_MINUTES.map((m) => {
                  const on = m === state.noFaceMin;
                  return (
                    <Touchable
                      key={m}
                      onPress={() => actions.set({ noFaceMin: m })}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 13,
                        alignItems: 'center',
                        backgroundColor: on ? T.priL : T.bg,
                      }}
                    >
                      <Txt s={12.5} w={700} c={on ? T.pri : T.t2}>
                        {m}m
                      </Txt>
                    </Touchable>
                  );
                })}
              </View>
            </Card>
          </Section>

          <Section>
            <Card radius={24} padding={18}>
              <Txt s={14.5} w={700} c={T.t1}>
                Contatos de emergência
              </Txt>
              {contacts.length === 0 ? (
                <Txt s={12} c={T.t3} style={{ marginTop: 10 }}>
                  Nenhum contato adicionado ainda.
                </Txt>
              ) : (
                contacts.map((c, i) => (
                  <View
                    key={`${c.name}-${i}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: T.priL,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt s={15} w={800} c={T.pri}>
                        {c.name.charAt(0).toUpperCase() || '?'}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt s={14} w={700} c={T.t1}>
                        {c.name}
                      </Txt>
                      <Txt s={11.5} c={T.t3}>
                        {c.contact}
                      </Txt>
                    </View>
                    <Touchable onPress={() => removeContact(i)} style={{ padding: 6 }}>
                      <Txt s={11.5} w={800} c={DANGER}>
                        Remover
                      </Txt>
                    </Touchable>
                  </View>
                ))
              )}
              <View style={{ marginTop: 14, gap: 8 }}>
                <Field
                  label="Nome"
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="ex. Ana Ribeiro"
                />
                <Field
                  label="Email ou telefone"
                  value={contactValue}
                  onChangeText={setContactValue}
                  placeholder="ex. ana@email.com"
                />
              </View>
              <Touchable
                onPress={addContact}
                disabled={!contactName.trim() || !contactValue.trim()}
                style={{
                  marginTop: 14,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: T.priL,
                  opacity: contactName.trim() && contactValue.trim() ? 1 : 0.5,
                }}
              >
                <Txt s={14} w={800} c={T.pri}>
                  + Adicionar contato
                </Txt>
              </Touchable>
            </Card>
          </Section>
        </>
      ) : null}

      <Section top={16}>
        <Touchable
          onPress={() => actions.go('splash')}
          style={{
            paddingVertical: 15,
            borderRadius: 18,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,.35)',
          }}
        >
          <Txt s={14} w={700} c={DANGER}>
            Reiniciar sessão
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
