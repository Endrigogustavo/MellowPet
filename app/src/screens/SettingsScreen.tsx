import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { acceptInvite, listLinks, revokeCareLink, type CaregiverLink } from '../care/careClient';
import { CalibrationCard } from '../components/CalibrationCard';
import { OfflineMellowCard } from '../components/OfflineMellowCard';
import { Field } from '../components/Field';
import { PetFace } from '../components/PetFace';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import {
  Card,
  PrimaryButton,
  ScreenTitle,
  Segmented,
  Toggle,
  ToggleRow,
  Touchable,
  Txt,
} from '../components/ui';
import { NO_FACE_MINUTES, SETTING_TOGGLES } from '../data/content';
import { NfcTapButton } from '../components/NfcTapButton';
import { PET_TYPES } from '../data/pets';
import { describeEncounterStatus } from '../pet/encounters';
import { phoneDigits } from '../integrations/sos';
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
import { PauseSharing } from '../components/CaredPresence';

export function SettingsScreen() {
  const { state, actions } = useApp();
  const { T, isDark, full } = useTheme();
  const toggles = full ? SETTING_TOGGLES : SETTING_TOGGLES.slice(0, 3);
  const backgroundVisionSupported = Platform.OS === 'android';

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
  const [connectionMessage, setConnectionMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactValue, setContactValue] = useState('');

  // Só salva depois de ler o que já existe: com a rede oscilando, salvar
  // "por cima" de uma lista vazia apagava os contatos reais.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persistContacts = (next: EmergencyContact[], previous: EmergencyContact[]) => {
    if (!state.userId) return;
    setContacts(next);
    saveSettings(state.userId, { emergency_contacts: next }).catch(() => {
      setContacts(previous);
      setContactError('Não foi possível salvar o contato agora. Tente de novo com conexão.');
    });
  };

  const addContact = () => {
    const name = contactName.trim();
    const contact = contactValue.trim();
    if (!name || !contact || !state.userId) return;
    if (!settingsLoaded) {
      setContactError('Seus contatos ainda não carregaram. Tente de novo em instantes.');
      return;
    }
    // O SOS liga e manda WhatsApp: precisa ser um telefone de verdade.
    if (!phoneDigits(contact)) {
      setContactError('Use um telefone com DDD, ex. (11) 98765-4321.');
      return;
    }
    if (contacts.length >= 10) {
      setContactError('Até 10 contatos de emergência.');
      return;
    }
    setContactError(null);
    setContactName('');
    setContactValue('');
    persistContacts([...contacts, { name, contact }], contacts);
  };

  const removeContact = (index: number) => {
    if (!settingsLoaded) return;
    const target = contacts[index];
    Alert.alert(`Remover ${target?.name ?? 'contato'}?`, 'Ele deixa de aparecer no pedido de ajuda.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => persistContacts(contacts.filter((_, i) => i !== index), contacts) },
    ]);
  };

  const refreshLinks = async () => {
    if (!state.userId) return false;
    try {
      const res = await listLinks(state.userId, 'user');
      setLinks(res.links);
      actions.set({ linked: res.links.length > 0 });
      return true;
    } catch (error) {
      setConnectionMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível carregar suas conexões de cuidado.',
      });
      return false;
    }
  };

  // Carrega preferências e vínculos reais de cuidador ao entrar na tela.
  const loadSettings = () => {
    if (!state.userId) return;
    setSettingsError(null);
    fetchSettings(state.userId)
      .then((remote) => {
        skipFirstSave.current = true;
        actions.set((cur) => ({
          petName: remote.pet_name,
          petType: remote.pet_type as typeof state.petType,
          noFaceMin: remote.no_face_alert_minutes,
          toggles: { ...cur.toggles, music: remote.music_enabled, alerts: remote.alerts_enabled },
        }));
        setContacts(remote.emergency_contacts);
        setSettingsLoaded(true);
      })
      .catch((e: Error) => setSettingsError(e.message));
  };
  useEffect(() => {
    loadSettings();
    refreshLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  // Salva no backend com debounce sempre que uma preferência muda — evita um
  // PUT por tecla digitada no nome do bichinho.
  const skipFirstSave = useRef(true);
  // O que falta salvar: sair da tela antes do debounce não pode perder a mudança.
  const latestPayloadRef = useRef<{
    pet_name: string;
    pet_type: typeof state.petType;
    no_face_alert_minutes: number;
    music_enabled: boolean;
    alerts_enabled: boolean;
  } | null>(null);
  const latestUserIdRef = useRef<string | null>(state.userId);
  latestUserIdRef.current = state.userId;

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (!state.userId || !settingsLoaded) return;
    const userId = state.userId;
    const payload = {
      pet_name: state.petName.trim() || 'Mellow',
      pet_type: state.petType,
      no_face_alert_minutes: state.noFaceMin,
      music_enabled: !!state.toggles.music,
      alerts_enabled: !!state.toggles.alerts,
    };
    latestPayloadRef.current = payload;
    latestUserIdRef.current = userId;
    const timer = setTimeout(() => {
      latestPayloadRef.current = null;
      saveSettings(userId, payload)
        .then(() => setSaveError(null))
        .catch(() => setSaveError('Não foi possível salvar seus ajustes. Eles serão enviados de novo na próxima mudança.'));
    }, 700);
    return () => clearTimeout(timer);
  }, [state.userId, settingsLoaded, state.petName, state.petType, state.noFaceMin, state.toggles.music, state.toggles.alerts]);
  useEffect(
    () => () => {
      // Ao sair da tela: envia o que ficou pendente.
      if (latestUserIdRef.current && latestPayloadRef.current) {
        saveSettings(latestUserIdRef.current, latestPayloadRef.current).catch(() => undefined);
        latestPayloadRef.current = null;
      }
    },
    []
  );

  const submitInviteCode = () => {
    const code = codeInput.trim();
    if (!code || !state.userId) return;
    setAccepting(true);
    setAcceptError(null);
    setConnectionMessage(null);
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

  const disconnectCaregiver = () => {
    if (!primaryLink || disconnecting) return;
    Alert.alert(
      'Encerrar conexão?',
      'O acesso do cuidador será interrompido agora. O registro operacional do vínculo será preservado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar conexão',
          style: 'destructive',
          onPress: () => {
            setDisconnecting(true);
            setConnectionMessage(null);
            revokeCareLink(primaryLink.id)
              .then(async () => {
                if (await refreshLinks()) {
                  setConnectionMessage({ tone: 'success', text: 'Conexão encerrada. O cuidador não pode mais acessar seus dados.' });
                }
              })
              .catch((error) => {
                setConnectionMessage({
                  tone: 'error',
                  text: error instanceof Error ? error.message : 'Não foi possível encerrar a conexão.',
                });
              })
              .finally(() => setDisconnecting(false));
          },
        },
      ]
    );
  };

  return (
    <ScreenScroll>
      <ScreenTitle label="AJUSTES" title="Do seu jeito" />

      {settingsError || saveError ? (
        <Section top={0}>
          <Card radius={18} padding={14} style={{ borderColor: DANGER }}>
            <Txt s={12.5} lh={1.45} c={DANGER} accessibilityRole="alert">
              {settingsError ?? saveError}
            </Txt>
            {settingsError ? (
              <Touchable onPress={loadSettings} accessibilityRole="button" style={{ marginTop: 8 }}>
                <Txt s={12} w={800} c={T.pri}>
                  Tentar de novo
                </Txt>
              </Touchable>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {/* Para o cuidador, pet, câmera, IA e convite de cuidador não fazem
          sentido (e o "Ninguém conectado" daqui confundia quem já acompanha). */}
      {state.role !== 'care' ? (
        <>
      {/* bichinho */}
      <Section top={0}>
        <Card radius={24} padding={18}>
          <Txt s={12} w={800} c={T.t2} style={{ marginBottom: 9 }}>
            Nome do bichinho
          </Txt>
          <Field
            variant="filled"
            value={state.petName}
            onChangeText={(petName) => actions.set({ petName: petName.replace(/\s+/g, ' ').slice(0, 20) })}
            onBlur={() => {
              if (!state.petName.trim()) actions.set({ petName: 'Mellow' });
            }}
            maxLength={20}
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

      {/* calibração da leitura facial */}
      <Section>
        <CalibrationCard />
      </Section>

      {/* grupos: escola, clínica ou equipe */}
      <Section>
        <Card radius={24} padding={18}>
          <Touchable onPress={() => actions.go('groups')} accessibilityLabel="Abrir grupos">
            <Txt s={13} w={800} c={T.pri}>
              Grupos: escola, clínica ou equipe
            </Txt>
          </Touchable>
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 4 }}>
            Entre num grupo por código, ou crie um para coordenar. Quem coordena vê só o clima geral, com 5+ pessoas.
          </Txt>
        </Card>
      </Section>

      {/* memória e voz do Mellow */}
      <Section>
        <Card radius={24} padding={18}>
          <ToggleRow
            label="Memória do Mellow"
            sub={
              state.memoryEnabled
                ? 'Diga "Mellow, lembra que…" no chat. Só o que você pedir fica guardado, neste celular, e vai junto nas conversas.'
                : 'Desligada. Ligando, o Mellow guarda só o que você pedir explicitamente para lembrar.'
            }
            on={state.memoryEnabled}
            onPress={() => actions.setMemory(!state.memoryEnabled)}
          />
          {state.memoryEnabled && state.memoryNotes.length > 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              {state.memoryNotes.map((note) => (
                <View key={note} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Txt s={12.5} lh={1.45} c={T.t2} style={{ flex: 1 }}>
                    • {note}
                  </Txt>
                  <Touchable onPress={() => actions.forgetNote(note)} accessibilityLabel={`Esquecer: ${note}`}>
                    <Txt s={12} w={800} c={DANGER}>
                      Esquecer
                    </Txt>
                  </Touchable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: T.bd, marginVertical: 14 }} />
          <ToggleRow
            label="O Mellow fala"
            sub="Lê as respostas do chat em voz alta, com a voz do próprio celular."
            on={state.speakReplies}
            onPress={() => actions.setSpeak(!state.speakReplies)}
          />
        </Card>
      </Section>

      {/* microcheck-ins */}
      <Section>
        <Card radius={24} padding={18}>
          <ToggleRow
            label="Microcheck-ins surpresa"
            sub={
              state.emaEnabled
                ? '3 avisos por dia em horários sorteados entre 9h e 21h. Cada resposta ensina a leitura a acertar mais com você.'
                : 'Desligado. Perguntar sempre na mesma hora mede só aquela hora — sortear dá uma foto mais honesta do seu dia.'
            }
            on={state.emaEnabled}
            onPress={() => {
              actions.setEma(!state.emaEnabled).catch(() => undefined);
            }}
          />
        </Card>
      </Section>

      {/* IA no aparelho */}
      <Section>
        <OfflineMellowCard />
      </Section>

      {/* encontros entre pets */}
      <Section>
        <Card radius={24} padding={18}>
          <ToggleRow
            label="Encontros com outros pets"
            sub={
              state.encountersEnabled
                ? 'Com o app aberto na Home, seu pet conhece os pets de quem está perto. Só o nome, a espécie e o estágio do pet são trocados — nenhuma emoção.'
                : 'Desligado. Ao ligar, o Android pede dispositivos próximos e localização — escolha "Precisa".'
            }
            on={state.encountersEnabled}
            onPress={() => {
              actions.setEncounters(!state.encountersEnabled).catch(() => undefined);
            }}
          />
          {state.encountersEnabled && describeEncounterStatus(state.encounterStatus) ? (
            <Touchable
              disabled={state.encounterStatus !== 'permission'}
              onPress={() => {
                actions.setEncounters(true).catch(() => undefined);
              }}
              accessibilityLabel="Status dos encontros"
              style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: T.priL }}
            >
              <Txt s={12} lh={1.45} w={700} c={T.pri}>
                {describeEncounterStatus(state.encounterStatus)}
              </Txt>
            </Touchable>
          ) : null}
          <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 10 }}>
            Para se encontrarem, os dois celulares precisam estar com o MellowPet aberto na Home, encontros ligados,
            e Bluetooth, Wi-Fi e localização ativados. O app não usa sua localização — o Android só exige a
            permissão para achar aparelhos por perto.
          </Txt>
          <NfcTapButton />
          <Touchable
            onPress={() => actions.go('friends')}
            accessibilityLabel="Abrir amigos do Mellow"
            style={{ marginTop: 12 }}
          >
            <Txt s={12.5} w={800} c={T.pri}>
              Ver os amigos que {state.petName} já conheceu
            </Txt>
          </Touchable>
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
                onPress={disconnectCaregiver}
                disabled={disconnecting}
                accessibilityRole="button"
                accessibilityLabel="Encerrar conexão com cuidador"
                accessibilityHint="Interrompe imediatamente o acesso do cuidador aos seus dados"
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: T.bd,
                }}
              >
                <Txt s={11.5} w={800} c={T.t2}>
                  {disconnecting ? 'Encerrando…' : 'Desconectar'}
                </Txt>
              </Touchable>
            ) : null}
          </View>

          {primaryLink ? (
            <>
              <PauseSharing link={primaryLink} onChange={() => refreshLinks().catch(() => undefined)} />
              <Touchable onPress={() => actions.go('caremirror')} accessibilityRole="button" style={{ marginTop: 12 }}>
                <Txt s={12.5} w={800} c={T.pri}>
                  Ver o que meu cuidador vê
                </Txt>
              </Touchable>
            </>
          ) : null}
          <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 11 }}>
            A conexão é sempre sua escolha. Ao desconectar, o painel dela fica vazio na hora.
          </Txt>
          {connectionMessage ? (
            <Txt
              s={11.5}
              lh={1.45}
              c={connectionMessage.tone === 'error' ? DANGER : T.pri}
              accessibilityRole={connectionMessage.tone === 'error' ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              style={{ marginTop: 8 }}
            >
              {connectionMessage.text}
            </Txt>
          ) : null}

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

          {primaryLink ? <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 11 }}>Ao aceitar a conexão, {linkName} recebe acesso integral ao módulo de cuidado. Não há permissões separadas por recurso.</Txt> : null}
        </Card>
      </Section>
        </>
      ) : null}

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

          {/* Modo de exibição: até agora só dava para escolher no onboarding,
              e quem passava dele ficava preso no que marcou. */}
          <View style={{ paddingVertical: 15, gap: 10 }}>
            <View>
              <Txt s={14.5} w={700} c={T.t1}>
                Modo de exibição
              </Txt>
              <Txt s={11.5} lh={1.45} c={T.t3} style={{ marginTop: 3 }}>
                {full
                  ? 'Completo: todos os painéis, métricas e ajustes finos.'
                  : 'Simples: só o essencial, menos informação na tela.'}
              </Txt>
            </View>
            <Segmented
              items={['Simples', 'Completo']}
              index={full ? 1 : 0}
              onChange={(i) => actions.setDensity(i === 1 ? 'completo' : 'simples')}
            />
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

          {backgroundVisionSupported ? <ToggleRow
            label="Ler expressão com o app fechado"
            sub={`A câmera abre por alguns segundos a cada ${bgVision.intervalMinutes} min, lê e fecha. Fica um aviso permanente enquanto estiver ligado.`}
            on={bgVision.enabled}
            divider
            onPress={() => {
              const next = { ...bgVision, enabled: !bgVision.enabled };
              setBackgroundVision(next.enabled, next.intervalMinutes);
              setBgVision(next);
            }}
          /> : null}

          {backgroundVisionSupported && bgVision.enabled ? (
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

        </>
      ) : null}

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
              label="Telefone com DDD"
              value={contactValue}
              onChangeText={(v) => {
                setContactValue(v);
                setContactError(null);
              }}
              placeholder="ex. (11) 98765-4321"
              keyboardType="phone-pad"
              maxLength={20}
              error={contactError}
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

      <Section top={16}>
        <Touchable
          onPress={() =>
            Alert.alert('Sair da conta?', 'Você volta para a tela de login. Seus dados continuam salvos na conta.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => actions.logout().catch(() => undefined) },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          style={{
            paddingVertical: 15,
            borderRadius: 18,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,.35)',
          }}
        >
          <Txt s={14} w={700} c={DANGER}>
            Sair da conta
          </Txt>
        </Touchable>
      </Section>
    </ScreenScroll>
  );
}
