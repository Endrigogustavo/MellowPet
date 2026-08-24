import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { Linking } from 'react-native';

import { EMOTIONS, REPLIES, type EmotionKey } from '../data/emotions';
import type { PetKey } from '../data/pets';
import { SOS_MESSAGE, type ToolAction } from '../data/content';
import { DARK, LIGHT, hexA, mix, type Palette } from '../theme/palette';
import { PET_BODY } from '../data/pets';
import { createDemoSnapshot, nextDemoExpression } from '../vision/demoSource';
import { VISION_MODE, type SignalStatus, type VisionMode } from '../vision/contracts';
import type { CalibrationState } from '../vision/expressionEngine';
import {
  AuthError,
  completeOAuthRedirect,
  loadStoredSession,
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  signup as apiSignup,
  subscribeToSignOut,
} from '../auth/authClient';
import { sendChatMessage } from '../chat/chatClient';
import { fetchToolContent } from '../tools/toolsClient';
import { listLinks } from '../care/careClient';
import { fetchProfileStats } from '../profile/profileClient';
import { dismissCard as persistDismissCard, loadDismissedCards } from './dismissedCardsStore';

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
  /** Estado do motor de visão real — roda o tempo todo no app, não só numa
   * tela dedicada. Ver src/vision/VisionEngine.tsx. */
  calibration: CalibrationState;
  visionLatencyMs: number | null;
  visionQualityHint: string | null;
  visionNativeError: string | null;
  visionThermalLimited: boolean;
  /** Pontuação bruta de cada classe (0-1, soma 1) — só pra depuração visual
   * enquanto calibramos o motor contra expressões reais. */
  visionScores: Record<string, number> | null;
  /** Até 2 emoções secundárias da leitura atual (além da primária) — juntas
   * formam a mistura de até 3 emoções exposta como métrica de verdade. */
  secondaryEmotions: { expression: EmotionKey; confidence: number }[];

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
  visionScores: null,
  secondaryEmotions: [],

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
  person: 'lia',
  rules: { sad3: true, stuck: true, night: true, anger: false, happy: true },

  role: 'user',
  accountRole: 'user',
  coach: 0,

  signup: true,
  email: '',
  pass: '',
  pairCode: '',
  plan: 'plus',

  userId: null,
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

  fed: 0,
  played: 0,
  xp: 0,
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
  submitAuth: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  dismissCard: (id: string) => void;
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
    loadDismissedCards().then((cards) => {
      if (cards.size > 0) dispatch({ dismissedCards: [...cards] });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    loadStoredSession().then((user) => {
      if (!alive || !user) return;
      dispatch((s) => ({
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
      completeOAuthRedirect(url)
        .then((user) => {
          if (!user) return;
          dispatch((s) => ({
            authLoading: false,
            authError: null,
            userId: user.userId,
            role: user.role,
            accountRole: user.role,
            screen: user.role === 'care' ? 'care' : 'home',
            navSeq: s.navSeq + 1,
          }));
          listLinks(user.userId, 'user')
            .then((res) => dispatch({ linked: res.links.length > 0 }))
            .catch(() => undefined);
          fetchProfileStats(user.userId).then((stats) => dispatch(stats));
        })
        .catch((error) => {
          dispatch({
            authLoading: false,
            authError: error instanceof AuthError ? error.message : 'Não foi possível continuar.',
          });
        });
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
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
        sendChatMessage(text, emotion, confidence, history)
          .then((content) => {
            dispatch((cur) => ({ typing: false, messages: [...cur.messages, { role: 'bot', content }] }));
          })
          .catch(() => {
            // Sem API configurada ou rede indisponível: cai para uma resposta
            // de apoio local em vez de deixar a pessoa sem resposta nenhuma.
            dispatch((cur) => ({
              typing: false,
              messages: [...cur.messages, { role: 'bot', content: REPLIES[emotion] }],
            }));
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
            navSeq: cur.navSeq + 1,
          }));
          listLinks(user.userId, 'user')
            .then((res) => dispatch({ linked: res.links.length > 0 }))
            .catch(() => undefined);
          fetchProfileStats(user.userId).then((stats) => dispatch(stats));
        } catch (error) {
          dispatch({
            authLoading: false,
            authError: error instanceof AuthError ? error.message : 'Não foi possível continuar.',
          });
        }
      },

      loginWithGoogle: async () => {
        dispatch({ authLoading: true, authError: null });
        try {
          await apiLoginWithGoogle();
          // Não desliga authLoading aqui: o app perde o foco pro navegador e
          // só volta a rodar quando o deep link do callback chega, no efeito
          // acima — que é quem decide o resultado final.
        } catch (error) {
          dispatch({
            authLoading: false,
            authError: error instanceof AuthError ? error.message : 'Não foi possível continuar.',
          });
        }
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
