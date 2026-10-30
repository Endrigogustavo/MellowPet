import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { LOCAL_ACTIONS_HINT, splitAction, type ChatAction } from '../chat/actions';
import { addNote, extractMemoryRequest } from '../chat/memory';
import { AppState as RNAppState, Linking, Vibration } from 'react-native';

import { EMOTIONS, REPLIES, type EmotionKey } from '../data/emotions';
import type { PetKey } from '../data/pets';
import { COACH, SOS_MESSAGE, type ToolAction } from '../data/content';
import { DARK, LIGHT, hexA, mix, type Palette } from '../theme/palette';
import { PET_BODY } from '../data/pets';
import { createDemoSnapshot, nextDemoExpression } from '../vision/demoSource';
import { VISION_MODE, type SignalStatus, type VisionMode } from '../vision/contracts';
import type { CalibrationState } from '../vision/expressionEngine';
import {
  AuthError,
  loadStoredSession,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  accessToken,
  subscribeToSignOut,
} from '../auth/authClient';
import { SERVER_CONFIGURED, sendChatMessage, streamChatMessage } from '../chat/chatClient';
import { fetchToolContent } from '../tools/toolsClient';
import { listLinks } from '../care/careClient';
import { bumpProfileStats, fetchProfileStats, levelFromXp } from '../profile/profileClient';
import { grewUp, localDay, stageForDays, type PetStage } from '../pet/growth';
import { registerMeal, type MealRecord } from '../pet/feeding';
import { fetchCareDayCount, markCareDay } from '../pet/growthClient';
import { fetchSettings } from '../settings/settingsClient';
import {
  drainPendingWidgetActions,
  moodPctFor,
  updateCareWidgets,
  updateMoodWidget,
} from '../widgets/widgetBridge';
import { fetchStreak } from '../dashboard/streak';
import type { EvidenceSignal } from '../vision/evidence';
import { logManualEmotion } from '../vision/manualEmotion';
import { rescheduleEma, scheduleWaterBreak } from '../notifications/notifications';
import {
  DEFAULT_GAINS,
  learnFromCheckin,
  learnFromFeedback,
  type PersonalGains,
} from '../vision/personalCalibration';
import { clearGains, loadGains, saveGains } from '../vision/personalCalibrationStore';
import type { NudgeKind } from '../vision/signalTracker';
import type { Affect } from '../vision/affect';
import { afterServer, firstRoute } from '../chat/chatRouter';
import { CRISIS_REPLY, detectCrisis } from '../chat/crisis';
import { generateLocal, loadLocalChoice, localReady } from '../chat/localLlm';
import { buildQwenPrompt, systemPrompt, tidyReply } from '../chat/prompt';
import { pushStateToWatch, syncWatchCheckins } from '../wear/wearBridge';
import { dismissCard as persistDismissCard, loadDismissedCards } from './dismissedCardsStore';
import {
  loadCapsule,
  loadDensity,
  loadEmaEnabled,
  loadEncountersEnabled,
  loadHabits,
  loadMemory,
  loadSpeak,
  loadMeals,
  saveDensity,
  saveEmaEnabled,
  saveEncountersEnabled,
  saveHabits,
  saveMemory,
  saveSpeak,
  saveMeals,
} from './preferencesStore';
import type { PetCard } from '../pet/encounterPayload';
import {
  EMPTY_HABITS,
  dismissRitual as dismissRitualIn,
  isUnlocked,
  newlyUnlocked,
  recordHabit,
  type AccessoryId,
  type HabitKind,
  type Habits,
} from '../pet/habits';
import { ritualDay, type Ritual } from '../pet/rituals';
import {
  NO_HISTORY,
  canAccess,
  homeFor,
  isTabRoot,
  popHistory,
  pushHistory,
  replaceHistory,
} from '../navigation/navModel';
import { parseWidgetLink } from '../navigation/deepLinks';
import { recordEncounter, requestEncounterPermissions, startEncounters } from '../pet/encounters';

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'caresignup'
  | 'home'
  | 'tools'
  | 'routine'
  | 'music'
  | 'playlisteditor'
  | 'playlistdetail'
  | 'spotifyimport'
  | 'spotifyplayer'
  | 'dashboard'
  | 'checkin'
  | 'heatmap'
  | 'friends'
  | 'fairness'
  | 'lullaby'
  | 'sos'
  | 'caremirror'
  | 'groups'
  | 'crisisplan'
  | 'wardrobe'
  | 'care'
  | 'carealerts'
  | 'careaudit'
  | 'careplan'
  | 'careguide'
  | 'agenda'
  | 'caretools'
  | 'carehistory'
  | 'carenotes'
  | 'carealertrules'
  | 'carenotify'
  | 'caredcare'
  | 'acceptinvite'
  | 'chat'
  | 'guide'
  | 'plans'
  | 'settings'
  | 'vision';

export type Role = 'user' | 'care';
export type Density = 'simples' | 'completo';
export type ThemeName = 'light' | 'dark';

export type ChatMessage = {
  /** Identifica a bolha que está sendo escrita (streaming). */
  id?: number;
  role: 'user' | 'bot';
  content: string;
  /** De onde veio a resposta — o chat mostra um selo "no aparelho". */
  source?: 'server' | 'device' | 'canned' | 'crisis' | 'memory';
  /** Ação do app sugerida pelo Mellow; vira botão, nunca executa sozinha. */
  action?: ChatAction | null;
};
export type JournalEntry = { text: string; tag: string; when: string };
export type Heart = { id: number; x: number };

export type State = {
  theme: ThemeName;
  density: Density;
  screen: Screen;
  /** Incrementa a cada navegação; usado só para re-disparar a animação de entrada. */
  navSeq: number;
  /** Telas anteriores (para o "voltar" levar aonde a pessoa estava). */
  history: Screen[];

  petName: string;
  petType: PetKey;
  /** Dias distintos com algum cuidado — o que faz o pet crescer. */
  careDays: number;
  /** Estágio recém-alcançado, para a cerimônia de evolução. Some depois de vista. */
  growthEvent: PetStage | null;
  /** Opt-in deste aparelho para encontros por proximidade. */
  encountersEnabled: boolean;
  /** Último status da busca por proximidade (ver describeEncounterStatus). */
  encounterStatus: string | null;
  /** Pet de outra pessoa que está visitando agora (some sozinho). */
  visitor: PetCard | null;
  /** Refeições de hoje (limite diário em pet/feeding.ts). */
  meals: MealRecord | null;
  /** Microcheck-ins em horários sorteados (opt-in deste aparelho). */
  emaEnabled: boolean;
  /** O Mellow ainda está respondendo: novos envios esperam. */
  replying: boolean;
  /** Widget tentou alimentar além do limite do dia: a Home mostra o aviso. */
  fedFull: boolean;
  /** Resultado do código de convite colado no cadastro. */
  inviteNotice: string | null;
  /** Memória do Mellow ligada (consentimento) e as notas pedidas pela pessoa. */
  memoryEnabled: boolean;
  memoryNotes: string[];
  /** O Mellow lê as respostas em voz alta. */
  speakReplies: boolean;
  /** Último check-in desta sessão, para a divergência gentil. */
  lastCheckin: { emotion: string; at: number } | null;
  /** Minutos de rosto tenso desde esse check-in. */
  tenseSinceCheckin: number;
  /** Dia em que a divergência gentil já apareceu (uma vez por dia). */
  divergenceShownDay: string | null;
  /** Diário de hábitos: personalidade, acessórios e rituais. */
  habits: Habits;
  /** Acessório recém-liberado, para comemorar uma vez. */
  unlockEvent: AccessoryId | null;
  /** Tensão facial atual (0–1), para o jogo de ninar. null sem leitura. */
  tension: number | null;
  /** Ganhos por emoção aprendidos com o feedback desta pessoa. */
  personalGains: PersonalGains;
  /** Lembrete vindo de sinal sustentado (tensão, fadiga, olhar no foco). */
  nudge: NudgeKind | null;
  /** Humor contínuo no círculo de Russell, estimado do rosto. */
  affect: Affect | null;
  /** Modelo de IA baixado para rodar no aparelho (null = nenhum). */
  localModel: 'leve' | 'melhor' | null;
  /** "Nada sai do aparelho": o chat nunca fala com o servidor. */
  privateMode: boolean;
  /** Leitura facial observada; nunca representa automaticamente o estado interno. */
  observedExpression: EmotionKey;
  /** Estado visual do bichinho, separado da leitura da pessoa. */
  petMood: EmotionKey;
  visionMode: VisionMode;
  signalStatus: SignalStatus;
  signalConfidence: number;
  qualityScore: number;
  /** Estado do motor de visão real — roda o tempo todo no app, não só numa
   * tela dedicada. Ver src/vision/VisionEngine.tsx. */
  calibration: CalibrationState;
  visionLatencyMs: number | null;
  visionQualityHint: string | null;
  visionNativeError: string | null;
  visionThermalLimited: boolean;
  /** Batimento pela câmera (só na tela da câmera). bpm null = ainda medindo. */
  heart: { bpm: number | null; progress: number } | null;
  /** Pontuação bruta de cada classe (0-1, soma 1) — só pra depuração visual
   * enquanto calibramos o motor contra expressões reais. */
  visionScores: Record<string, number> | null;
  /** Até 2 emoções secundárias da leitura atual (além da primária) — juntas
   * formam a mistura de até 3 emoções exposta como métrica de verdade. */
  secondaryEmotions: { expression: EmotionKey; confidence: number }[];
  /** Sinais do rosto que puxaram a leitura atual (ver vision/evidence.ts). */
  readingEvidence: EvidenceSignal[];

  breathing: boolean;
  breathTick: number;
  focus: boolean;

  petting: number;
  hearts: Heart[];
  /** Segundos na emoção atual. */
  streak: number;

  period: number;

  messages: ChatMessage[];
  chatInput: string;
  typing: boolean;

  onb: number;

  toggles: Record<string, boolean>;
  noFaceMin: number;
  person: string;
  rules: Record<string, boolean>;

  /** Modo de visualização atual — pode ser trocado por `setRole` (só na
   * direção 'care' -> 'user', ver a ação). */
  role: Role;
  /** Papel real da conta, vindo do cadastro/perfil — nunca muda por
   * `setRole`. É o que decide se "Entrar no modo cuidador" existe. */
  accountRole: Role;
  coach: number;

  signup: boolean;
  email: string;
  pass: string;
  pairCode: string;
  plan: string;

  /** Sessão real, vinda da API. null = ninguém autenticado. */
  userId: string | null;
  authRestored: boolean;
  authLoading: boolean;
  authError: string | null;

  signupRole: Role;
  careName: string;
  careRel: string;
  careStep: number;
  invited: boolean;

  linked: boolean;
  /** Cards que o usuário já fechou (ex.: "Conecte um cuidador") — não voltam
   * a aparecer, mesmo depois de reabrir o app. */
  dismissedCards: string[];
  quiet: boolean;
  feedback: 'yes' | 'no' | 'unsure' | null;

  journal: JournalEntry[];
  jInput: string;
  jTag: string;
  /** -1 = parado; 0..4 = passo do 5-4-3-2-1. */
  ground: number;

  capsule: string;
  capsuleSaved: boolean;

  /** Playlist aberta na tela de detalhe. */
  openPlaylistId: string | null;

  /** Sempre acumulativo, sem teto — nível é derivado dele (ver
   * `levelFromXp` em src/profile/profileClient.ts), nunca guardado à parte. */
  fed: number;
  played: number;
  xp: number;
};

const INITIAL: State = {
  theme: 'light',
  density: 'completo',
  screen: 'splash',
  navSeq: 0,
  history: [],

  petName: 'Mellow',
  petType: 'seal',
  careDays: 0,
  growthEvent: null,
  encountersEnabled: false,
  encounterStatus: null,
  visitor: null,
  meals: null,
  emaEnabled: false,
  habits: EMPTY_HABITS,
  fedFull: false,
  replying: false,
  inviteNotice: null,
  memoryEnabled: false,
  memoryNotes: [],
  speakReplies: false,
  lastCheckin: null,
  tenseSinceCheckin: 0,
  divergenceShownDay: null,
  unlockEvent: null,
  tension: null,
  personalGains: DEFAULT_GAINS,
  nudge: null,
  affect: null,
  localModel: null,
  privateMode: false,
  observedExpression: VISION_MODE === 'demo' ? 'neutral' : 'unknown',
  petMood: 'neutral',
  visionMode: VISION_MODE,
  signalStatus: VISION_MODE === 'demo' ? 'ready' : 'camera_unavailable',
  signalConfidence: VISION_MODE === 'demo' ? EMOTIONS.neutral.conf : 0,
  qualityScore: VISION_MODE === 'demo' ? EMOTIONS.neutral.quality / 100 : 0,
  calibration: { active: false, accepted: 0, required: 10, complete: false },
  visionLatencyMs: null,
  visionQualityHint: null,
  visionNativeError: null,
  visionThermalLimited: false,
  heart: null,
  visionScores: null,
  secondaryEmotions: [],
  readingEvidence: [],

  breathing: false,
  breathTick: 0,
  focus: false,

  petting: 0,
  hearts: [],
  streak: 0,

  period: 0,

  messages: [],
  chatInput: '',
  typing: false,

  onb: 0,

  toggles: { music: true, alerts: true, voice: true, notif: true, haptics: false },
  noFaceMin: 10,
  // Id do vínculo selecionado no painel do cuidador; começa vazio e a tela
  // escolhe o primeiro vínculo real até a pessoa selecionar outro.
  person: '',
  rules: { sad3: true, stuck: true, night: true, anger: false, happy: true },

  role: 'user',
  accountRole: 'user',
  // Começa escondido: o tour é da primeira vez que a pessoa cria conta, e
  // só o próprio cadastro liga ele (ver submitAuth). Entrar numa conta que
  // já existe — ou reabrir o app — nunca traz o tour de volta.
  coach: COACH.length,

  signup: true,
  email: '',
  pass: '',
  pairCode: '',
  plan: 'plus',

  userId: null,
  authRestored: false,
  authLoading: false,
  authError: null,

  signupRole: 'user',
  careName: '',
  careRel: 'Mãe/Pai',
  careStep: 0,
  invited: false,

  linked: false,
  dismissedCards: [],
  quiet: false,
  feedback: null,

  journal: [],
  jInput: '',
  jTag: 'Alívio',
  ground: -1,

  capsule: '',
  capsuleSaved: false,

  openPlaylistId: null,

  fed: 0,
  played: 0,
  xp: 0,
};

type Patch = Partial<State> | ((s: State) => Partial<State>);

/** Aonde um toque de fora do app (notificação, widget) quer levar. */
type Destination = {
  screen: Screen;
  /** Estado que a tela precisa ao abrir (playlist, modo respiração...). */
  patch?: Partial<State>;
  /** Pessoa do alerta, para o cuidador abrir já nela. */
  caredUserId?: string;
};

/**
 * Toda troca de tela passa aqui, venha de onde vier (botão, notificação,
 * widget, Chat): o guard por perfil do navModel e a pilha do "voltar".
 * Quem já define `history` (voltar, substituir) manda na pilha; raiz de aba
 * sempre recomeça a pilha, para o voltar visual e o físico concordarem.
 */
function routeChanges(s: State, changes: Partial<State>, screen: Screen): Partial<State> {
  const authed = Boolean('userId' in changes ? changes.userId : s.userId);
  const role = changes.role ?? s.role;
  let to = screen;
  if (!canAccess(to, { authed, role })) {
    if (!authed) {
      // Sem sessão a troca não vale (o restore da sessão ainda pode chegar);
      // o RootNavigator já mostra o login.
      const rest = { ...changes };
      delete rest.screen;
      delete rest.navSeq;
      return rest;
    }
    to = homeFor(role, authed);
  }
  const history = isTabRoot(to, role)
    ? s.history.length === 0
      ? s.history
      : []
    : changes.history
      ? changes.history
      : to === s.screen
        ? s.history
        : pushHistory(s.history, s.screen, to);
  return { ...changes, screen: to, history };
}

function reducer(s: State, patch: Patch): State {
  let changes = typeof patch === 'function' ? patch(s) : patch;
  if (changes.screen) changes = routeChanges(s, changes, changes.screen);
  const keys = Object.keys(changes) as (keyof State)[];
  if (keys.length === 0 || keys.every((key) => Object.is(s[key], changes[key]))) {
    return s;
  }
  return { ...s, ...changes };
}

/**
 * Tipo, nome e dias de cuidado do pet, lidos no restore da sessão. Antes só a
 * tela de Ajustes lia tipo/nome, então depois de reiniciar a Home mostrava a
 * foca padrão até alguém abrir Ajustes.
 */
function loadPetIdentity(userId: string, apply: (patch: Partial<State>) => void) {
  fetchSettings(userId)
    .then((s) => apply({ petType: s.pet_type as PetKey, petName: s.pet_name }))
    .catch(() => undefined);
  fetchCareDayCount(userId)
    .then((careDays) => apply({ careDays }))
    .catch(() => undefined);
  loadMeals(userId)
    .then((meals) => apply({ meals }))
    .catch(() => undefined);
  loadGains(userId)
    .then((personalGains) => apply({ personalGains }))
    .catch(() => undefined);
  loadHabits(userId)
    .then((habits) => apply({ habits }))
    .catch(() => undefined);
  loadMemory(userId)
    .then(({ enabled, notes }) => apply({ memoryEnabled: enabled, memoryNotes: notes }))
    .catch(() => undefined);
  loadCapsule(userId)
    .then(({ text, saved }) => apply({ capsule: text, capsuleSaved: saved }))
    .catch(() => undefined);
}

export type Actions = {
  set: (patch: Patch) => void;
  go: (screen: Screen) => void;
  /** Volta para a tela anterior que o perfil pode abrir (sem nenhuma, a
   * inicial do perfil); devolve false só sem sessão. */
  back: () => boolean;
  /** Troca de aba: recomeça o histórico a partir dela. */
  goTab: (screen: Screen) => void;
  /** Troca a tela atual sem empilhá-la (fim de fluxo: salvar, cancelar,
   * excluir). O voltar físico não reabre o formulário. */
  replace: (screen: Screen) => void;
  pet: () => void;
  send: () => void;
  sendBot: (content: string, screen?: Screen) => void;
  /** Abre a tela de ajuda (CVV, SAMU, rede, plano de crise). */
  sos: () => void;
  /** Leva ao chat com a mensagem de apoio. */
  sosChat: () => void;
  openTool: (act: ToolAction, title: string, sub: string) => void;
  toggleTheme: () => void;
  /** Modo simples/completo. Persiste no aparelho. */
  setDensity: (density: Density) => void;
  setRole: (role: Role) => void;
  submitAuth: () => Promise<void>;
  logout: () => Promise<void>;
  dismissCard: (id: string) => void;
  /** Registra que hoje houve cuidado. Idempotente por dia. */
  markCare: () => void;
  /** Alimenta o pet respeitando o limite diário. Devolve false se já comeu o bastante hoje. */
  feed: () => boolean;
  /** Resposta a "essa leitura combinou?" — também ensina o motor. */
  giveFeedback: (verdict: 'yes' | 'no' | 'unsure') => void;
  /** Check-in salvo: o que a pessoa disse corrige o que a câmera leu. */
  learnFromCheckin: (said: string, seen: string | null) => void;
  /** Volta o motor aos pesos padrão. */
  resetCalibration: () => void;
  /** Liga/desliga os encontros. Ao ligar pede as permissões; devolve se ficou ligado. */
  setEncounters: (enabled: boolean) => Promise<boolean>;
  /** Liga/desliga os microcheck-ins; devolve quantos ficaram agendados. */
  setEma: (enabled: boolean) => Promise<number>;
  /** Anota um hábito no diário do pet (personalidade e acessórios). */
  habit: (kind: HabitKind) => void;
  /** Veste um acessório já liberado (null tira). */
  equip: (id: AccessoryId | null) => void;
  /** "Agora não" num ritual: some até a próxima janela, sem contar. */
  dismissRitual: (ritual: Ritual) => void;
  /** Liga/desliga a memória do Mellow (desligar apaga as notas). */
  setMemory: (enabled: boolean) => void;
  forgetNote: (note: string) => void;
  setSpeak: (enabled: boolean) => void;
  /** Executa a ação sugerida no chat (toque da pessoa). */
  runChatAction: (action: ChatAction) => void;
};

type Ctx = { state: State; actions: Actions };

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  /**
   * Espelho do estado para callbacks que rodam fora do ciclo de render (timers
   * e handlers). Atualizado depois do commit, nunca durante o render.
   */
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  });

  /**
   * Toda escrita no diário passa aqui: atualiza `ref` na hora (dois toques
   * seguidos não se perdem), persiste e detecta acessório recém-liberado.
   */
  const updateHabits = useCallback((fn: (h: Habits) => Habits) => {
    const before = ref.current.habits;
    const after = fn(before);
    if (after === before) return;
    const unlocked = newlyUnlocked(before, after);
    ref.current = { ...ref.current, habits: after };
    dispatch(unlocked ? { habits: after, unlockEvent: unlocked } : { habits: after });
    const userId = ref.current.userId;
    if (userId) saveHabits(userId, after).catch(() => undefined);
  }, []);

  /**
   * Única porta de entrada para alimentar o pet (Home e widget). Aplica o
   * limite de refeições do dia; devolve o registro novo ou null se já comeu.
   * Atualiza `ref` na hora para dois toques rápidos não passarem do limite.
   */
  const consumeMeal = useCallback((): MealRecord | null => {
    const next = registerMeal(ref.current.meals, localDay());
    if (!next) return null;
    updateHabits((h) => recordHabit(h, 'feed', localDay()));
    ref.current = { ...ref.current, meals: next };
    dispatch({ meals: next });
    const userId = ref.current.userId;
    if (userId) saveMeals(userId, next).catch(() => undefined);
    return next;
  }, [updateHabits]);

  /** Timers pendentes, limpos ao desmontar. */
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    pending.current.push(id);
  }, []);

  useEffect(() => {
    loadDismissedCards().then((cards) => {
      if (cards.size > 0) dispatch({ dismissedCards: [...cards] });
    });
  }, []);

  // Modo simples/completo escolhido antes — sem isto ele voltava para
  // "completo" a cada abertura, ignorando a escolha do onboarding.
  useEffect(() => {
    loadDensity().then((density) => {
      if (density) dispatch({ density });
    });
    loadEncountersEnabled()
      .then((encountersEnabled) => dispatch({ encountersEnabled }))
      .catch(() => undefined);
    loadSpeak()
      .then((speakReplies) => dispatch({ speakReplies }))
      .catch(() => undefined);
    // Refaz o sorteio a cada abertura: avisos já disparados saem, os de
    // amanhã entram. Sem isso a pessoa só receberia os do dia em que ligou.
    loadEmaEnabled()
      .then((emaEnabled) => {
        dispatch({ emaEnabled });
        if (emaEnabled) rescheduleEma(true).catch(() => undefined);
      })
      .catch(() => undefined);
    loadLocalChoice()
      .then(({ modelId, privateMode }) => dispatch({ localModel: modelId, privateMode }))
      .catch(() => undefined);
  }, []);

  // O que a pessoa registrou pelos widgets com o app fechado. Só drena
  // depois de ter sessão: sem `userId` não há como escrever sob RLS, e a
  // fila do lado nativo se esvazia ao ser lida — perderíamos os toques.
  // Check-ins feitos no relógio. Mesma razão de esperar a sessão: a fila
  // nativa esvazia ao ser lida, então ler sem `userId` perderia tudo.
  useEffect(() => {
    if (!state.userId) return;
    syncWatchCheckins(state.userId)
      .then((saved) => {
        if (saved > 0) actions.markCare();
      })
      .catch(() => undefined);
    // `actions` é estável e declarado mais abaixo; listá-lo aqui leria a
    // variável antes da inicialização durante o render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  // Encontros por proximidade. Só procura com tudo isto verdadeiro: sessão,
  // opt-in, app em primeiro plano e Home aberta. Em segundo plano o anúncio
  // gastaria bateria e anunciaria o pet sem a pessoa estar olhando.
  const [foreground, setForeground] = useState(RNAppState.currentState === 'active');
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => sub.remove();
  }, []);

  /**
   * Destino vindo de fora do app (notificação, widget). Com o app frio o toque
   * chega antes do restore da sessão; durante o login, o onboarding ou o
   * cadastro de cuidador ele também espera. Fica guardado e só é aplicado
   * quando a tela inicial do perfil aparecer — e só se o perfil puder abri-lo.
   */
  const pendingScreen = useRef<Destination | null>(null);

  const applyDestination = useCallback((dest: Destination) => {
    const s = ref.current;
    if (!canAccess(dest.screen, { authed: Boolean(s.userId), role: s.role })) return;
    const navigate = (person: string | null) =>
      dispatch((cur) => ({
        ...dest.patch,
        ...(person ? { person } : null),
        screen: dest.screen,
        navSeq: cur.navSeq + 1,
      }));
    // Alerta de uma pessoa específica: seleciona ela antes de abrir, senão a
    // tela mostra quem foi selecionado por último.
    if (dest.caredUserId && s.userId && s.role === 'care') {
      const caredUserId = dest.caredUserId;
      listLinks(s.userId, 'care')
        .then((res) => navigate(res.links.find((l) => l.cared_user_id === caredUserId)?.id ?? null))
        .catch(() => navigate(null));
      return;
    }
    navigate(null);
  }, []);

  const openExternal = useCallback(
    (dest: Destination) => {
      const s = ref.current;
      if (!s.userId || NO_HISTORY.includes(s.screen)) {
        pendingScreen.current = dest;
        return;
      }
      applyDestination(dest);
    },
    [applyDestination]
  );

  useEffect(() => {
    const dest = pendingScreen.current;
    if (!dest || !state.userId || state.screen !== homeFor(state.role, true)) return;
    pendingScreen.current = null;
    if (dest.screen !== state.screen || dest.patch || dest.caredUserId) applyDestination(dest);
  }, [state.userId, state.screen, state.role, applyDestination]);

  const encounterStage = stageForDays(state.careDays);
  const encounterTimes = useRef<number[]>([]);
  useEffect(() => {
    // Ajustes também: é de lá que se dispara o encontro por NFC.
    const encounterScreen = state.screen === 'home' || state.screen === 'settings';
    if (!state.userId || !state.encountersEnabled || !foreground || !encounterScreen) return;
    const userId = state.userId;
    let stop: (() => void) | null = null;
    let cancelled = false;
    startEncounters(
      { petName: state.petName, petType: state.petType, stage: encounterStage },
      (card) => {
        const now = Date.now();
        encounterTimes.current = encounterTimes.current.filter((t) => now - t < 3600_000);
        if (encounterTimes.current.length >= 10) return;
        encounterTimes.current.push(now);
        Vibration.vibrate([0, 40, 60, 40]);
        dispatch((s) => ({ visitor: card, xp: s.xp + 3 }));
        updateHabits((h) => recordHabit(h, 'encounter', localDay()));
        bumpProfileStats({ xp: 3 }).catch(() => undefined);
        actions.markCare();
        recordEncounter(userId, card).catch(() => undefined);
        // Quanto a visita dura é decidido no PetStage: o relógio só anda com
        // ela na tela (o encontro pode chegar com a pessoa em Ajustes).
      },
      (encounterStatus) => dispatch({ encounterStatus })
    ).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
    // `actions` é estável e declarado mais abaixo (ver efeito acima).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId, state.encountersEnabled, foreground, state.screen, state.petName, state.petType, encounterStage]);

  // Espelha o estado no relógio: o pet no pulso mostra a mesma emoção e nível
  // da tela inicial. A sequência vem do banco, não de `state.streak` — aquele
  // conta segundos da mesma leitura, não dias seguidos.
  useEffect(() => {
    if (!state.userId) return;
    let alive = true;
    fetchStreak(state.userId)
      .then(({ days, week }) => {
        if (!alive) return;
        pushStateToWatch(state.observedExpression, levelFromXp(state.xp), days, week[6] === true);
      })
      .catch(() => {
        if (alive) pushStateToWatch(state.observedExpression, levelFromXp(state.xp), 0, false);
      });
    return () => {
      alive = false;
    };
  }, [state.userId, state.observedExpression, state.xp]);

  useEffect(() => {
    if (!state.userId) return;
    const pending = drainPendingWidgetActions();
    if (pending.length === 0) return;

    // Registro manual e leitura da câmera entram os dois no histórico, mas
    // com `source` diferente — o painel precisa poder distinguir o que a
    // pessoa disse do que o Mellow leu.
    const moods = pending.filter((a) => a.kind === 'mood' || a.kind === 'vision');
    moods.forEach((a) => {
      logManualEmotion(
        state.userId!,
        a.value as EmotionKey,
        a.kind === 'vision' ? 'background_vision' : 'widget_manual'
      ).catch(() => undefined);
    });
    // Carinhos viram XP igual ao botão da Home; um bump só com a soma, em
    // vez de uma chamada por toque.
    const pets = pending.filter((a) => a.kind === 'pet').length;
    if (pets > 0) {
      dispatch((s) => ({ played: s.played + pets, xp: s.xp + pets * 4 }));
      bumpProfileStats({ played: pets, xp: pets * 4 })
        .then((stats) => {
          if (stats) dispatch(stats);
        })
        .catch(() => undefined);
    }
    const lastMood = moods[moods.length - 1];
    if (lastMood) dispatch({ observedExpression: lastMood.value as EmotionKey });
  }, [state.userId]);

  // Widgets de humor/cuidar na tela inicial do celular: atualizam sempre que
  // o sentimento observado, o nível ou os cuidados mudam — não só quando o
  // app está aberto em primeiro plano.
  useEffect(() => {
    const cared = state.fed + state.played;
    updateMoodWidget({
      emotion: state.observedExpression,
      label: EMOTIONS[state.observedExpression].label,
      level: levelFromXp(state.xp),
      progress: Math.max(0, state.xp) % 100,
      moodPct: moodPctFor(state.observedExpression),
      petName: state.petName,
      hunger: cared > 14 ? 'bem cuidado hoje' : 'quer atenção',
      pets: state.fed + state.played,
    });
  }, [state.observedExpression, state.xp, state.fed, state.played, state.petName]);

  useEffect(() => {
    let alive = true;
    loadStoredSession().then((user) => {
      if (!alive) return;
      if (!user) {
        dispatch({ authRestored: true });
        return;
      }
      dispatch((s) => ({
        authRestored: true,
        userId: user.userId,
        email: user.email,
        role: user.role,
        accountRole: user.role,
        screen: user.role === 'care' ? 'care' : 'home',
        navSeq: s.navSeq + 1,
      }));
      listLinks(user.userId, 'user')
        .then((res) => {
          if (alive) dispatch({ linked: res.links.length > 0 });
        })
        .catch(() => undefined);
      fetchProfileStats(user.userId).then((stats) => {
        if (alive) dispatch(stats);
      });
      loadPetIdentity(user.userId, (patch) => {
        if (alive) dispatch(patch);
      });
    }).catch(() => {
      if (alive) dispatch({ authRestored: true });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeToSignOut(() => {
        // Tudo que é da conta sai junto (histórico do chat, pessoa
        // acompanhada, memória, pet, papel); só ficam preferências do aparelho.
        // O destino pendente de notificação/widget era da conta que saiu.
        pendingScreen.current = null;
        Speech.stop();
        // O widget do cuidador fica na tela inicial do aparelho: sai junto.
        updateCareWidgets({ people: [], alert: null, checkin: null });
        dispatch((s) => ({
          ...INITIAL,
          theme: s.theme,
          density: s.density,
          encountersEnabled: s.encountersEnabled,
          emaEnabled: s.emaEnabled,
          speakReplies: s.speakReplies,
          localModel: s.localModel,
          privateMode: s.privateMode,
          dismissedCards: s.dismissedCards,
          authRestored: true,
          screen: 'login',
          navSeq: s.navSeq + 1,
        }));
      }),
    []
  );

  /** Deep links dos widgets da tela inicial (`mellowpet://widget/...`).
   * `getInitialURL` cobre o app aberto pelo próprio toque; o listener, o app
   * já aberto. A tela vai pelo mesmo caminho das notificações (guard por
   * perfil e espera do restore da sessão). */
  const widgetMoodAt = useRef(0);
  const widgetCareAt = useRef(0);
  useEffect(() => {
    const handleUrl = (url: string) => {
      const link = parseWidgetLink(url);
      if (!link) return;
      // Os widgets do pet (humor, cuidar) são da conta pessoal: no cuidador
      // gravariam humor e XP na conta errada.
      const petWidget = ref.current.role !== 'care';
      if (link.kind === 'open') {
        openExternal({ screen: link.screen });
      } else if (link.kind === 'playlist') {
        openExternal({ screen: 'playlistdetail', patch: { openPlaylistId: link.id } });
      } else if (link.kind === 'tool') {
        const patch: Partial<State> =
          link.tool === 'breathe'
            ? { breathing: true, breathTick: 0, focus: false }
            : link.tool === 'focus'
              ? { focus: true, breathing: false }
              : link.tool === 'ground'
                ? { ground: 0 }
                : {};
        openExternal({ screen: link.screen, patch });
      } else if (link.kind === 'mood') {
        if (!petWidget) return;
        // Qualquer app pode abrir este link: só aceita emoção conhecida e no
        // máximo um registro por minuto (senão forjava alertas para o cuidador).
        const raw = link.value;
        const value = raw && Object.prototype.hasOwnProperty.call(EMOTIONS, raw) && raw !== 'unknown' ? (raw as EmotionKey) : null;
        const userId = ref.current.userId;
        const now = Date.now();
        if (value && userId && now - widgetMoodAt.current > 60_000) {
          widgetMoodAt.current = now;
          logManualEmotion(userId, value).catch(() => undefined);
        }
        openExternal({ screen: 'home', patch: value ? { observedExpression: value } : undefined });
      } else if (link.kind === 'care') {
        if (!petWidget) return;
        // Mesmos deltas dos botões da Home (ver HomeScreen.bumpCare): o
        // widget é um atalho pra mesma ação, não uma economia paralela.
        const action = link.action;
        const delta =
          action === 'feed'
            ? { fed: 1, xp: 6 }
            : action === 'play'
              ? { played: 1, xp: 4 }
              : action === 'rest'
                ? { xp: 3 }
                : null;
        if (!delta) return;
        // XP pelo link é limitado: no máximo um cuidado a cada 30 s.
        if (Date.now() - widgetCareAt.current < 30_000) return;
        widgetCareAt.current = Date.now();
        if (action === 'feed' && !consumeMeal()) {
          // Já comeu o bastante hoje: a Home abre mostrando o aviso.
          openExternal({ screen: 'home', patch: { fedFull: true } });
          return;
        }
        if (action !== 'feed') updateHabits((h) => recordHabit(h, action === 'play' ? 'play' : 'rest', localDay()));
        const mood: Partial<State> =
          action === 'feed'
            ? { petMood: 'happy' }
            : action === 'play'
              ? { petMood: 'surprised' }
              : { petMood: 'neutral', breathing: true, breathTick: 0 };
        dispatch((s) => ({
          fed: s.fed + (delta.fed ?? 0),
          played: s.played + (delta.played ?? 0),
          xp: s.xp + (delta.xp ?? 0),
          streak: 0,
          ...mood,
        }));
        openExternal({ screen: 'home' });
        if (ref.current.userId) {
          bumpProfileStats(delta)
            .then((stats) => {
              if (stats) dispatch(stats);
            })
            .catch(() => undefined);
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [consumeMeal, updateHabits, openExternal]);

  // Toque numa notificação: microcheck-in abre o check-in; pausa de água
  // volta para a Home (o pet comemora a pausa por lá); as do cuidador abrem
  // o painel ou os alertas. O guard decide: um usuário que recebe um push
  // `care_*` antigo (ou um cuidador que toca um lembrete local de água) fica
  // onde está.
  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      const kind = data?.kind;
      const target: Screen | null =
        kind === 'ema'
          ? 'checkin'
          : kind === 'water' || kind === 'care_gestures'
            ? 'home'
            : kind === 'care_alert' || kind === 'care_alerts'
              ? 'carealerts'
              : kind === 'care_request' || kind === 'care_requests'
                ? 'care'
                : null;
      if (!target) return;
      // O push pode trazer quem gerou o alerta; sem o campo, fica a seleção atual.
      const cared = data?.cared_user_id;
      openExternal({ screen: target, caredUserId: typeof cared === 'string' && cared ? cared : undefined });
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, [openExternal]);

  useEffect(() => {
    // Relógio de 1s: conta a duração da emoção na Home (quando há leitura
    // ativa) e os ciclos de respiração. Fora disso devolve `{}` para não
    // re-renderizar a árvore inteira a cada segundo em outras telas.
    const tick = setInterval(() => {
      dispatch((s) => {
        const countStreak = s.screen === 'home' && s.signalStatus === 'ready';
        if (!countStreak && !s.breathing) return {};
        return {
          ...(countStreak ? { streak: s.streak + 1 } : null),
          ...(s.breathing ? { breathTick: s.breathTick + 1 } : null),
        };
      });
    }, 1000);

    // Fonte demo explicitamente isolada. Builds de produção sem o pipeline
    // nativo ficam em unknown, sem apresentar fixtures como leitura real.
    const emo = setInterval(() => {
      if (ref.current.visionMode !== 'demo') return;
      const expression = nextDemoExpression(ref.current.observedExpression);
      const snapshot = createDemoSnapshot(expression);
      dispatch({
        observedExpression: snapshot.observedExpression,
        petMood: snapshot.observedExpression,
        signalStatus: snapshot.signalStatus,
        signalConfidence: snapshot.signalConfidence,
        qualityScore: snapshot.qualityScore,
        streak: 0,
      });
    }, 8000);

    return () => {
      clearInterval(tick);
      clearInterval(emo);
      pending.current.forEach(clearTimeout);
      pending.current = [];
    };
  }, []);

  const actions = useMemo<Actions>(() => {
    const set = (patch: Patch) => dispatch(patch);
    const go = (screen: Screen) => dispatch((s) => ({ screen, navSeq: s.navSeq + 1 }));

    return {
      back: () => {
        if (!ref.current.userId) return false;
        // Calculado dentro do dispatch: dois toques rápidos voltam duas telas,
        // em vez de os dois lerem a mesma pilha antiga.
        dispatch((s) => {
          const { screen, history } = popHistory(s.history, s.role, Boolean(s.userId));
          return { screen, history, navSeq: s.navSeq + 1 };
        });
        return true;
      },

      goTab: (screen) => dispatch((s) => ({ screen, history: [], navSeq: s.navSeq + 1 })),

      replace: (screen) =>
        dispatch((s) => ({ screen, history: replaceHistory(s.history, screen), navSeq: s.navSeq + 1 })),

      set,
      go,

      pet: () => {
        const id = Date.now() + Math.random();
        dispatch((s) => ({
          hearts: [...s.hearts, { id, x: 34 + Math.random() * 32 }],
          petting: s.petting + 1,
        }));
        later(() => dispatch((s) => ({ hearts: s.hearts.filter((h) => h.id !== id) })), 1300);
      },

      send: () => {
        const s = ref.current;
        const text = s.chatInput.trim();
        // `typing` some na primeira palavra; `replying` só quando a resposta
        // termina — enviar no meio fazia o stream sobrescrever a mensagem nova.
        if (!text || s.typing || s.replying) return;
        const history = s.messages;
        const emotion = s.observedExpression;
        const confidence = s.signalConfidence;
        const memory = s.memoryEnabled ? s.memoryNotes : [];
        dispatch({
          messages: [...s.messages, { role: 'user', content: text }],
          chatInput: '',
          typing: true,
          replying: true,
        });
        const botId = Date.now() + Math.random();
        const done = () => dispatch({ typing: false, replying: false });

        const speak = (content: string) => {
          if (!ref.current.speakReplies) return;
          Speech.stop();
          Speech.speak(content, { language: 'pt-BR', rate: 1.0, pitch: 1.15 });
        };
        const reply = (content: string, source: ChatMessage['source'], action: ChatAction | null = null) => {
          dispatch((cur) => ({ typing: false, messages: [...cur.messages, { id: botId, role: 'bot', content, source, action }] }));
          speak(content);
          done();
        };
        // Atualiza a bolha DESTA resposta pelo id (não "a última": se a conversa
        // foi limpa no meio, a resposta simplesmente não reaparece).
        const setLast = (content: string, source: ChatMessage['source'], action: ChatAction | null = null) =>
          dispatch((cur) => ({
            typing: false,
            messages: cur.messages.map((m) => (m.id === botId ? { id: botId, role: 'bot', content, source, action } : m)),
          }));
        const dropLast = () => dispatch((cur) => ({ messages: cur.messages.filter((m) => m.id !== botId) }));
        const canned = () => reply(REPLIES[emotion], 'canned');

        // "Mellow, lembra que…": só guarda com a memória ligada.
        const note = extractMemoryRequest(text);
        if (note) {
          if (!s.memoryEnabled) {
            reply(
              'Eu adoraria lembrar disso! Para eu guardar, ligue "Memória do Mellow" em Ajustes — fica só no seu celular e você apaga quando quiser.',
              'memory'
            );
            return;
          }
          const notes = addNote(s.memoryNotes, note);
          dispatch({ memoryNotes: notes });
          if (s.userId) saveMemory(s.userId, { enabled: true, notes }).catch(() => undefined);
          reply(`Pode deixar, vou lembrar: "${note}". Dá para apagar em Ajustes.`, 'memory');
          return;
        }

        // Escreve a resposta do modelo local aos poucos, conforme é gerada.
        const runDevice = () => {
          const modelId = s.localModel!;
          const memoryLine = memory.length > 0 ? `\nA pessoa pediu para você lembrar: ${memory.join('; ')}.` : '';
          const prompt = buildQwenPrompt(
            systemPrompt(EMOTIONS[emotion].label.toLowerCase(), Math.round(confidence * 100)) +
              memoryLine +
              '\n' +
              LOCAL_ACTIONS_HINT,
            history,
            text
          );
          // A animação de "digitando" fica até a primeira palavra de verdade;
          // só então a bolha aparece e vai crescendo.
          dispatch({ typing: true });
          let shown = false;
          const show = (content: string, action: ChatAction | null = null) => {
            if (!shown) {
              shown = true;
              reply(content, 'device', action);
            } else {
              setLast(content, 'device', action);
            }
          };
          generateLocal(modelId, prompt, (partial) => {
            const text = splitAction(tidyReply(partial)).text;
            if (text) {
              if (!shown) {
                shown = true;
                dispatch((cur) => ({ typing: false, messages: [...cur.messages, { id: botId, role: 'bot', content: text, source: 'device' }] }));
              } else {
                setLast(text, 'device');
              }
            }
          })
            .then((full) => {
              const { text: clean, action } = splitAction(tidyReply(full));
              if (shown) {
                setLast(clean || REPLIES[emotion], 'device', action);
                speak(clean || REPLIES[emotion]);
                done();
              } else {
                show(clean || REPLIES[emotion], action);
              }
            })
            .catch(() => show(REPLIES[emotion]));
        };

        const ready = localReady(s.localModel);
        const route = firstRoute({
          crisis: detectCrisis(text) === 'risk',
          privateMode: s.privateMode,
          localReady: ready,
          serverConfigured: SERVER_CONFIGURED,
        });
        if (route === 'crisis') return reply(CRISIS_REPLY, 'crisis');
        if (route === 'device') return runDevice();
        if (route === 'canned') return canned();

        // Servidor em streaming: as palavras aparecem conforme o modelo escreve.
        let started = false;
        const finishServer = (content: string, provider: string, action: ChatAction | null) => {
          if (afterServer(provider, ready) === 'device') {
            // Servidor sem IA e modelo local pronto: a resposta local substitui a fixa.
            if (started) dropLast();
            runDevice();
            return;
          }
          const clean = splitAction(content).text || REPLIES[emotion];
          if (started) {
            setLast(clean, provider === 'crisis' ? 'crisis' : 'server', action);
            speak(clean);
            done();
          } else {
            reply(clean, provider === 'crisis' ? 'crisis' : 'server', action);
          }
        };
        accessToken().then((token) => streamChatMessage(text, emotion, confidence, history, memory, (soFar) => {
          const shown = splitAction(soFar).text;
          // Só cria a bolha com texto de verdade; até lá fica o "digitando".
          if (!shown) return;
          if (!started) {
            started = true;
            dispatch((cur) => ({
              typing: false,
              messages: [...cur.messages, { id: botId, role: 'bot', content: shown, source: 'server' }],
            }));
          } else {
            setLast(shown, 'server');
          }
        }, token))
          .then(({ content, provider, action }) => finishServer(content, provider, action))
          .catch(() => {
            if (started) {
              done(); // já mostrou parte da resposta; fica com ela
              return;
            }
            // Streaming indisponível (proxy, versão antiga da API): pedido normal.
            accessToken()
              .then((token) => sendChatMessage(text, emotion, confidence, history, memory, token))
              .then(({ content, provider, action }) => finishServer(content, provider, action))
              .catch(() => {
                // Rede ou servidor fora: modelo local se houver, senão as fixas.
                if (afterServer(null, ready) === 'device') runDevice();
                else canned();
              });
          });
      },

      sendBot: (content, screen) =>
        dispatch((s) => ({
          messages: [...s.messages, { role: 'bot', content }],
          ...(screen ? { screen, navSeq: s.navSeq + 1 } : null),
        })),

      sos: () => go('sos'),

      sosChat: () =>
        dispatch((s) => ({
          screen: 'chat',
          navSeq: s.navSeq + 1,
          messages: [...s.messages, { role: 'bot', content: SOS_MESSAGE }],
        })),

      openTool: (act, title, sub) => {
        // "Pausa de água" agenda um lembrete de verdade, além da conversa.
        if (title === 'Pausa de água') scheduleWaterBreak().catch(() => undefined);
        if (act === 'breath') {
          updateHabits((h) => recordHabit(h, 'breath', localDay()));
          dispatch((s) => ({
            screen: 'home',
            navSeq: s.navSeq + 1,
            breathing: true,
            breathTick: 0,
          }));
        } else if (act === 'home') {
          go('home');
        } else {
          const emotion = ref.current.observedExpression;
          dispatch((s) => ({
            screen: 'chat',
            navSeq: s.navSeq + 1,
            messages: [
              ...s.messages,
              { role: 'bot', content: `${title}: ${sub}. Quer começar agora?` },
            ],
          }));
          // Conteúdo real do backend (quando o card tem endpoint correspondente)
          // chega como uma segunda mensagem, sem travar a resposta inicial.
          fetchToolContent(title, emotion)
            .then((content) => {
              if (!content) return;
              dispatch((s) => ({ messages: [...s.messages, { role: 'bot', content }] }));
            })
            .catch(() => undefined);
        }
      },

      toggleTheme: () => dispatch((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setDensity: (density: Density) => {
        dispatch({ density });
        saveDensity(density).catch(() => undefined);
      },

      setRole: (role) =>
        dispatch((s) => {
          // Quem se cadastrou como usuário comum nunca acessa a tela de
          // cuidador, nem pelo botão "Entrar no modo cuidador" — só a conta
          // cadastrada como tal (accountRole) pode entrar nesse modo.
          if (role === 'care' && s.accountRole !== 'care') return {};
          return {
            role,
            screen: role === 'care' ? 'care' : 'home',
            navSeq: s.navSeq + 1,
          };
        }),

      submitAuth: async () => {
        const s = ref.current;
        const email = s.email.trim();
        const password = s.pass;
        if (!email || !password) {
          dispatch({ authError: 'Preencha e-mail e senha.' });
          return;
        }
        dispatch({ authLoading: true, authError: null });
        try {
          const user = s.signup
            ? await apiSignup(email, password, s.signupRole)
            : await apiLogin(email, password);
          const isCareSignup = s.signup && s.signupRole === 'care';
          dispatch((cur) => ({
            authLoading: false,
            authError: null,
            userId: user.userId,
            authRestored: true,
            role: user.role,
            accountRole: user.role,
            pass: '',
            // Cadastro de cuidador começa no fluxo de gerar convite; cadastro
            // comum vai pro onboarding (primeira vez); login (conta já
            // existente) vai direto pra tela do papel — antes, um LOGIN de
            // cuidador caía sempre em "onboarding", nunca no painel dele.
            screen: isCareSignup
              ? 'caresignup'
              : s.signup
                ? 'onboarding'
                : user.role === 'care'
                  ? 'care'
                  : 'home',
            careStep: isCareSignup ? 0 : cur.careStep,
            onb: isCareSignup ? cur.onb : 0,
            // Só o cadastro de conta pessoal liga o tour de boas-vindas.
            coach: s.signup && !isCareSignup ? 0 : cur.coach,
            navSeq: cur.navSeq + 1,
          }));
          // Código de convite colado no cadastro: não conecta sozinho. A Home
          // leva à prévia do que será compartilhado, e o aceite grava o termo.
          if (s.signup && !isCareSignup && s.pairCode.trim()) {
            dispatch({ inviteNotice: 'Seu cuidador mandou um convite. Veja o que ele vai poder ver antes de aceitar.' });
          }
          listLinks(user.userId, 'user')
            .then((res) => dispatch({ linked: res.links.length > 0 }))
            .catch(() => undefined);
          fetchProfileStats(user.userId).then((stats) => dispatch(stats));
          loadPetIdentity(user.userId, dispatch);
        } catch (error) {
          dispatch({
            authLoading: false,
            authError: error instanceof AuthError ? error.message : 'Não foi possível continuar.',
          });
        }
      },


      giveFeedback: (verdict) => {
        const s = ref.current;
        const gains = learnFromFeedback(s.personalGains, s.observedExpression, verdict);
        dispatch({ feedback: verdict, personalGains: gains });
        if (s.userId && gains !== s.personalGains) saveGains(s.userId, gains).catch(() => undefined);
      },

      learnFromCheckin: (said, seen) => {
        dispatch({ lastCheckin: { emotion: said, at: Date.now() }, tenseSinceCheckin: 0 });
        const s = ref.current;
        const gains = learnFromCheckin(s.personalGains, said, seen);
        if (gains === s.personalGains) return;
        dispatch({ personalGains: gains });
        if (s.userId) saveGains(s.userId, gains).catch(() => undefined);
      },

      resetCalibration: () => {
        const userId = ref.current.userId;
        dispatch({ personalGains: DEFAULT_GAINS });
        if (userId) clearGains(userId).catch(() => undefined);
      },

      feed: () => {
        if (!consumeMeal()) return false;
        dispatch((s) => ({ fed: s.fed + 1, xp: s.xp + 6, streak: 0, petMood: 'happy' }));
        if (ref.current.userId) {
          bumpProfileStats({ fed: 1, xp: 6 })
            .then((stats) => {
              if (stats) dispatch(stats);
            })
            .catch(() => undefined);
        }
        return true;
      },

      habit: (kind) => updateHabits((h) => recordHabit(h, kind, localDay())),

      equip: (id) => updateHabits((h) => (id === null || isUnlocked(h, id) ? { ...h, equipped: id } : h)),

      dismissRitual: (ritual) => updateHabits((h) => dismissRitualIn(h, ritual, ritualDay(new Date(), ritual))),

      setMemory: (enabled) => {
        // Desligar é também esquecer: memória sem consentimento não fica.
        const notes = enabled ? ref.current.memoryNotes : [];
        dispatch({ memoryEnabled: enabled, memoryNotes: notes });
        const userId = ref.current.userId;
        if (userId) saveMemory(userId, { enabled, notes }).catch(() => undefined);
      },

      forgetNote: (note) => {
        const notes = ref.current.memoryNotes.filter((n) => n !== note);
        dispatch({ memoryNotes: notes });
        const userId = ref.current.userId;
        if (userId) saveMemory(userId, { enabled: ref.current.memoryEnabled, notes }).catch(() => undefined);
      },

      setSpeak: (enabled) => {
        if (!enabled) Speech.stop();
        dispatch({ speakReplies: enabled });
        saveSpeak(enabled).catch(() => undefined);
      },

      runChatAction: (action) => {
        const target: Screen =
          action === 'respirar' ? 'home' : action === 'musica' ? 'music' : action === 'ninar' ? 'lullaby' : 'checkin';
        // As ações levam a telas do pet; no copiloto do cuidador não valem.
        const s = ref.current;
        if (!canAccess(target, { authed: Boolean(s.userId), role: s.role })) return;
        if (action === 'respirar') {
          updateHabits((h) => recordHabit(h, 'breath', localDay()));
          dispatch((st) => ({ screen: 'home', navSeq: st.navSeq + 1, breathing: true, breathTick: 0, focus: false }));
        } else go(target);
      },

      setEma: async (enabled: boolean) => {
        const scheduled = await rescheduleEma(enabled).catch(() => 0);
        // Sem permissão de notificação não adianta ficar "ligado".
        const on = enabled && scheduled > 0;
        dispatch({ emaEnabled: on });
        await saveEmaEnabled(on).catch(() => undefined);
        return scheduled;
      },

      setEncounters: async (enabled: boolean) => {
        if (enabled && !(await requestEncounterPermissions())) {
          dispatch({ encountersEnabled: false });
          return false;
        }
        dispatch({ encountersEnabled: enabled, encounterStatus: null });
        await saveEncountersEnabled(enabled).catch(() => undefined);
        return enabled;
      },

      markCare: () => {
        const userId = ref.current.userId;
        if (!userId) return;
        markCareDay(userId)
          .then((isNewDay) => {
            if (!isNewDay) return;
            dispatch((s) => {
              const careDays = s.careDays + 1;
              const reached = grewUp(s.careDays, careDays);
              return reached ? { careDays, growthEvent: reached } : { careDays };
            });
          })
          .catch(() => undefined);
      },

      dismissCard: (id: string) => {
        dispatch((s) => {
          if (s.dismissedCards.includes(id)) return {};
          const next = [...s.dismissedCards, id];
          persistDismissCard(id, new Set(s.dismissedCards)).catch(() => undefined);
          return { dismissedCards: next };
        });
      },

      logout: async () => {
        // Estado é atualizado pelo listener SIGNED_OUT (subscribeToSignOut
        // acima) — mesmo caminho usado quando a sessão cai sozinha em
        // background, sem duplicar a transição aqui.
        await apiLogout();
      },
    };
  }, [later, consumeMeal, updateHabits]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>');
  return ctx;
}

export type Theme = {
  T: Palette;
  isDark: boolean;
  /** Densidade "completo". */
  full: boolean;
  emotion: EmotionKey;
  emo: (typeof EMOTIONS)[EmotionKey];
  /** `--emo`: cor viva da emoção. */
  emoColor: string;
  /** `--emoL`: fundo suave da emoção. */
  emoLight: string;
  /** Cores do corpo do bichinho, já ajustadas ao tema. */
  pet: { body: string; belly: string; line: string; whisker: string; blush: number };
};

/** Equivale ao bloco de CSS custom properties que o design monta em `renderVals`. */
export function useTheme(): Theme {
  const { state } = useApp();
  return useMemo(() => {
    const isDark = state.theme === 'dark';
    const T = isDark ? DARK : LIGHT;
    const emo = EMOTIONS[state.observedExpression];
    const base = PET_BODY[state.petType];
    const body = isDark ? mix(base, '#FFFFFF', 0.14) : base;

    return {
      T,
      isDark,
      full: state.density === 'completo',
      emotion: state.observedExpression,
      emo,
      emoColor: emo.c,
      emoLight: isDark ? hexA(emo.c, 0.17) : emo.l,
      pet: {
        body,
        belly: mix(body, '#000000', 0.1),
        line: '#2E2A33',
        whisker: hexA('#6B6470', 0.75),
        blush: 0.55,
      },
    };
  }, [state.theme, state.observedExpression, state.density, state.petType]);
}
