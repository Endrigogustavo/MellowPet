import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { EMOTIONS, REPLIES, type EmotionKey } from '../data/emotions';
import type { PetKey } from '../data/pets';
import { SOS_MESSAGE, type ToolAction } from '../data/content';
import { DARK, LIGHT, hexA, mix, type Palette } from '../theme/palette';
import { PET_BODY } from '../data/pets';
import { createDemoSnapshot, nextDemoExpression } from '../vision/demoSource';
import { VISION_MODE, type SignalStatus, type VisionMode } from '../vision/contracts';

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'caresignup'
  | 'home'
  | 'tools'
  | 'routine'
  | 'music'
  | 'dashboard'
  | 'care'
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

export type ChatMessage = { role: 'user' | 'bot'; content: string };
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
  /** Leitura facial observada; nunca representa automaticamente o estado interno. */
  observedExpression: EmotionKey;
  /** Estado visual do bichinho, separado da leitura da pessoa. */
  petMood: EmotionKey;
  visionMode: VisionMode;
  signalStatus: SignalStatus;
  signalConfidence: number;
  qualityScore: number;

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

  role: Role;
  spotify: boolean;
  coach: number;

  signup: boolean;
  email: string;
  pass: string;
  pairCode: string;
  plan: string;

  signupRole: Role;
  careName: string;
  careRel: string;
  careStep: number;
  invited: boolean;

  linked: boolean;
  pairPending: boolean;
  quiet: boolean;
  feedback: 'yes' | 'no' | 'unsure' | null;

  journal: JournalEntry[];
  jInput: string;
  jTag: string;
  /** -1 = parado; 0..4 = passo do 5-4-3-2-1. */
  ground: number;

  capsule: string;
  capsuleSaved: boolean;

  fed: number;
  played: number;
  xp: number;
  level: number;
};

const INITIAL: State = {
  theme: 'light',
  density: 'completo',
  screen: 'splash',
  navSeq: 0,

  petName: 'Mellow',
  petType: 'seal',
  observedExpression: VISION_MODE === 'demo' ? 'neutral' : 'unknown',
  petMood: 'neutral',
  visionMode: VISION_MODE,
  signalStatus: VISION_MODE === 'demo' ? 'ready' : 'camera_unavailable',
  signalConfidence: VISION_MODE === 'demo' ? EMOTIONS.neutral.conf : 0,
  qualityScore: VISION_MODE === 'demo' ? EMOTIONS.neutral.quality / 100 : 0,

  breathing: false,
  breathTick: 0,
  focus: false,

  petting: 0,
  hearts: [],
  streak: 47,

  period: 0,

  messages: [],
  chatInput: '',
  typing: false,

  onb: 0,

  toggles: { music: true, alerts: true, voice: true, notif: true, haptics: false },
  noFaceMin: 10,
  person: 'lia',
  rules: { sad3: true, stuck: true, night: true, anger: false, happy: true },

  role: 'user',
  spotify: false,
  coach: 0,

  signup: true,
  email: '',
  pass: '',
  pairCode: '',
  plan: 'plus',

  signupRole: 'user',
  careName: '',
  careRel: 'Mãe/Pai',
  careStep: 0,
  invited: false,

  linked: false,
  pairPending: true,
  quiet: false,
  feedback: null,

  journal: [
    { text: 'Prova de química foi melhor do que eu esperava.', tag: 'Alívio', when: 'ontem, 22h' },
  ],
  jInput: '',
  jTag: 'Alívio',
  ground: -1,

  capsule: '',
  capsuleSaved: false,

  fed: 0,
  played: 0,
  xp: 62,
  level: 4,
};

type Patch = Partial<State> | ((s: State) => Partial<State>);

function reducer(s: State, patch: Patch): State {
  return { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
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
  setRole: (role: Role) => void;
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

  /** Timers pendentes, limpos ao desmontar. */
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    pending.current.push(id);
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
        dispatch({
          messages: [...s.messages, { role: 'user', content: text }],
          chatInput: '',
          typing: true,
        });
        later(
          () =>
            dispatch((cur) => ({
              typing: false,
              messages: [
                ...cur.messages,
                { role: 'bot', content: REPLIES[cur.observedExpression] },
              ],
            })),
          1350
        );
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
        if (act === 'breath') {
          dispatch((s) => ({
            screen: 'home',
            navSeq: s.navSeq + 1,
            breathing: true,
            breathTick: 0,
          }));
        } else if (act === 'home') {
          go('home');
        } else {
          dispatch((s) => ({
            screen: 'chat',
            navSeq: s.navSeq + 1,
            messages: [
              ...s.messages,
              { role: 'bot', content: `${title}: ${sub}. Quer começar agora?` },
            ],
          }));
        }
      },

      toggleTheme: () => dispatch((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setRole: (role) =>
        dispatch((s) => ({
          role,
          screen: role === 'care' ? 'care' : 'home',
          navSeq: s.navSeq + 1,
        })),
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
