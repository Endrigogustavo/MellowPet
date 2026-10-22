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
  subscribeToSignOut,
} from '../auth/authClient';
import { SERVER_CONFIGURED, sendChatMessage } from '../chat/chatClient';
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
  loadDensity,
  loadEmaEnabled,
  loadEncountersEnabled,
  loadHabits,
  loadMeals,
  saveDensity,
  saveEmaEnabled,
  saveEncountersEnabled,
  saveHabits,
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
  | 'wardrobe'
  | 'care'
  | 'carealerts'
  | 'careaudit'
  | 'careplan'
  | 'careguide'
  | 'agenda'
  | 'caretools'
  | 'chat'
  | 'guide'
  | 'plans'
  | 'settings'
  | 'vision';

export type Role = 'user' | 'care';
export type Density = 'simples' | 'completo';
export type ThemeName = 'light' | 'dark';

export type ChatMessage = {
  role: 'user' | 'bot';
  content: string;
  /** De onde veio a resposta — o chat mostra um selo "no aparelho". */
  source?: 'server' | 'device' | 'canned' | 'crisis';
};
export type JournalEntry = { text: string; tag: string; when: string };
export type Heart = { id: number; x: number };

export type State = {
  theme: ThemeName;
  density: Density;
  screen: Screen;
  /** Incrementa a cada navegação; usado só para re-disparar a animação de entrada. */
  navSeq: number;

  petName: string;
  petType: PetKey;
  /** Dias distintos com algum cuidado — o que faz o pet crescer. */
  careDays: number;
  /** Estágio recém-alcançado, para a cerimônia de evolução. Some depois de vista. */
  growthEvent: PetStage | null;
  /** Opt-in deste aparelho para encontros por proximidade. */
  encountersEnabled: boolean;
  /** Pet de outra pessoa que está visitando agora (some sozinho). */
  visitor: PetCard | null;
  /** Refeições de hoje (limite diário em pet/feeding.ts). */
  meals: MealRecord | null;
  /** Microcheck-ins em horários sorteados (opt-in deste aparelho). */
  emaEnabled: boolean;
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

  petName: 'Mellow',
  petType: 'seal',
  careDays: 0,
  growthEvent: null,
  encountersEnabled: false,
  visitor: null,
  meals: null,
  emaEnabled: false,
  habits: EMPTY_HABITS,
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

function reducer(s: State, patch: Patch): State {
  const changes = typeof patch === 'function' ? patch(s) : patch;
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
}

export type Actions = {
  set: (patch: Patch) => void;
  go: (screen: Screen) => void;
  pet: () => void;
  send: () => void;
  sendBot: (content: string, screen?: Screen) => void;
  sos: () => void;
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
   * Única porta de entrada para alimentar o pet (Home e widget). Aplica o
   * limite de refeições do dia; devolve o registro novo ou null se já comeu.
   * Atualiza `ref` na hora para dois toques rápidos não passarem do limite.
   */
  const consumeMeal = (): MealRecord | null => {
    const next = registerMeal(ref.current.meals, localDay());
    if (!next) return null;
    updateHabits((h) => recordHabit(h, 'feed', localDay()));
    ref.current = { ...ref.current, meals: next };
    dispatch({ meals: next });
    const userId = ref.current.userId;
    if (userId) saveMeals(userId, next).catch(() => undefined);
    return next;
  };

  /**
   * Toda escrita no diário passa aqui: atualiza `ref` na hora (dois toques
   * seguidos não se perdem), persiste e detecta acessório recém-liberado.
   */
  const updateHabits = (fn: (h: Habits) => Habits) => {
    const before = ref.current.habits;
    const after = fn(before);
    if (after === before) return;
    const unlocked = newlyUnlocked(before, after);
    ref.current = { ...ref.current, habits: after };
    dispatch(unlocked ? { habits: after, unlockEvent: unlocked } : { habits: after });
    const userId = ref.current.userId;
    if (userId) saveHabits(userId, after).catch(() => undefined);
  };

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

  useEffect(() => {
    const target = pendingScreen.current;
    if (!target || !state.userId || state.screen !== 'home') return;
    pendingScreen.current = null;
    if (target !== 'home') dispatch((s) => ({ screen: target, navSeq: s.navSeq + 1 }));
  }, [state.userId, state.screen]);

  const encounterStage = stageForDays(state.careDays);
  useEffect(() => {
    if (!state.userId || !state.encountersEnabled || !foreground || state.screen !== 'home') return;
    const userId = state.userId;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let visitTimer: ReturnType<typeof setTimeout> | null = null;
    startEncounters(
      { petName: state.petName, petType: state.petType, stage: encounterStage },
      (card) => {
        Vibration.vibrate([0, 40, 60, 40]);
        dispatch((s) => ({ visitor: card, xp: s.xp + 3 }));
        updateHabits((h) => recordHabit(h, 'encounter', localDay()));
        bumpProfileStats({ xp: 3 }).catch(() => undefined);
        actions.markCare();
        recordEncounter(userId, card).catch(() => undefined);
        if (visitTimer) clearTimeout(visitTimer);
        // A visita dura o bastante para ser vista e some sozinha.
        visitTimer = setTimeout(() => dispatch({ visitor: null }), 12_000);
      }
    ).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });
    return () => {
      cancelled = true;
      stop?.();
      if (visitTimer) clearTimeout(visitTimer);
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
        dispatch((s) => ({
          userId: null,
          authRestored: true,
          email: '',
          pass: '',
          screen: 'login',
          navSeq: s.navSeq + 1,
        }));
      }),
    []
  );

  /** Conclui o login com Google quando o navegador volta pro app via deep
   * link. `getInitialURL` cobre o caso do Android matar o processo enquanto
   * o navegador estava em primeiro plano; o listener cobre o caso comum de
   * app só suspenso. */
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url.startsWith('mellowpet://widget/')) {
        const [, query] = url.split('?');
        const params = new URLSearchParams(query ?? '');
        if (url.includes('/widget/open')) {
          const target = params.get('screen');
          const allowed: Screen[] = ['home', 'music', 'routine', 'spotifyplayer', 'checkin', 'heatmap', 'dashboard'];
          if (target && (allowed as string[]).includes(target)) {
            dispatch((s) => ({ screen: target as Screen, navSeq: s.navSeq + 1 }));
          }
        } else if (url.includes('/widget/mood')) {
          const value = params.get('value') as EmotionKey | null;
          const userId = ref.current.userId;
          if (value && userId) logManualEmotion(userId, value).catch(() => undefined);
          dispatch((s) => ({
            observedExpression: value ?? s.observedExpression,
            screen: 'home',
            navSeq: s.navSeq + 1,
          }));
        } else if (url.includes('/widget/care')) {
          // Mesmos deltas dos botões da Home (ver HomeScreen.bumpCare): o
          // widget é um atalho pra mesma ação, não uma economia paralela.
          const action = params.get('action');
          const delta =
            action === 'feed'
              ? { fed: 1, xp: 6 }
              : action === 'play'
                ? { played: 1, xp: 4 }
                : action === 'rest'
                  ? { xp: 3 }
                  : null;
          if (!delta) return;
          if (action === 'feed' && !consumeMeal()) {
            // Já comeu o bastante hoje: abre a Home, que explica, sem dar XP.
            dispatch((s) => ({ screen: 'home', navSeq: s.navSeq + 1 }));
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
            screen: 'home',
            navSeq: s.navSeq + 1,
            ...mood,
          }));
          if (ref.current.userId) {
            bumpProfileStats(delta)
              .then((stats) => {
                if (stats) dispatch(stats);
              })
              .catch(() => undefined);
          }
        }
        return;
      }

      // Fora os deep links de widget, nada mais chega aqui: o login com
      // Google foi removido, então não há callback de OAuth para tratar.
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Toque numa notificação: microcheck-in abre o check-in; pausa de água
  // volta para a Home (o pet comemora a pausa por lá).
  // Com o app frio, o toque chega antes do login terminar; a tela fica
  // guardada e só abre quando a Home aparecer (senão o splash a atropela).
  const pendingScreen = useRef<Screen | null>(null);
  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      const target: Screen | null = data?.kind === 'ema' ? 'checkin' : data?.kind === 'water' ? 'home' : null;
      if (!target) return;
      if (ref.current.userId && ref.current.screen !== 'splash') {
        dispatch((s) => ({ screen: target, navSeq: s.navSeq + 1 }));
      } else {
        pendingScreen.current = target;
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Relógio de 1s: conta a duração da emoção e os ciclos de respiração.
    const tick = setInterval(() => {
      dispatch((s) => ({
        streak: s.streak + 1,
        breathTick: s.breathing ? s.breathTick + 1 : s.breathTick,
      }));
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
        if (!text || s.typing) return;
        const history = s.messages;
        const emotion = s.observedExpression;
        const confidence = s.signalConfidence;
        dispatch({
          messages: [...s.messages, { role: 'user', content: text }],
          chatInput: '',
          typing: true,
        });

        const reply = (content: string, source: ChatMessage['source']) =>
          dispatch((cur) => ({ typing: false, messages: [...cur.messages, { role: 'bot', content, source }] }));
        const canned = () => reply(REPLIES[emotion], 'canned');

        // Escreve a resposta do modelo local aos poucos, conforme é gerada.
        const runDevice = () => {
          const modelId = s.localModel!;
          const prompt = buildQwenPrompt(
            systemPrompt(EMOTIONS[emotion].label.toLowerCase(), Math.round(confidence * 100)),
            history,
            text
          );
          dispatch((cur) => ({
            typing: false,
            messages: [...cur.messages, { role: 'bot', content: '…', source: 'device' }],
          }));
          const setLast = (content: string) =>
            dispatch((cur) => {
              const messages = [...cur.messages];
              messages[messages.length - 1] = { role: 'bot', content, source: 'device' };
              return { messages };
            });
          generateLocal(modelId, prompt, (partial) => setLast(tidyReply(partial) || '…'))
            .then((full) => setLast(tidyReply(full) || REPLIES[emotion]))
            .catch(() => setLast(REPLIES[emotion]));
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

        sendChatMessage(text, emotion, confidence, history)
          .then(({ content, provider }) => {
            const next = afterServer(provider, ready);
            if (next === 'device') runDevice();
            else reply(content, 'server');
          })
          .catch(() => {
            // Rede ou servidor fora: modelo local se houver, senão as fixas.
            if (afterServer(null, ready) === 'device') runDevice();
            else canned();
          });
      },

      sendBot: (content, screen) =>
        dispatch((s) => ({
          messages: [...s.messages, { role: 'bot', content }],
          ...(screen ? { screen, navSeq: s.navSeq + 1 } : null),
        })),

      sos: () =>
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
        dispatch({ encountersEnabled: enabled });
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
  }, [later]);

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
