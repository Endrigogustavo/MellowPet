import { create } from 'zustand';

export interface EmotionState {
  emotion: string;
  emotionVariant: string;
  emotionZone: string;
  supportTip: string | null;
  confidence: number;
  secondaryEmotion: string | null;
  message: string | null;
  musicSuggestions: string[];
  faceDetected: boolean;
  lastUpdated: number;
  allScores: Record<string, number>;
  noFaceAlertFired: boolean;
  shouldTriggerAlert: boolean;
  compoundEmotion: string | null;
  emotionIntensity: string;
  faceQualityScore: number;
  faceQualityTips: string[];
  emotionStreakSeconds: number;
  heartRateBpm: number | null;
  heartRateConfidence: number;
  heartRateStatus: string;
}

export interface AppState {
  // Session
  sessionId: string;
  userId: string | null;
  isConnected: boolean;

  // Emotion
  currentEmotion: EmotionState;

  // Settings
  settings: {
    petType: 'dog' | 'cat' | 'bunny' | 'bear' | 'fox' | 'panda' | 'owl' | 'seal' | 'hamster' | 'penguin' | 'capybara' | 'unicorn';
    petName: string;
    musicEnabled: boolean;
    alertsEnabled: boolean;
    voiceAssistantEnabled: boolean;
    notificationsEnabled: boolean;
    hapticsEnabled: boolean;
    emergencyContacts: Array<{ name: string; email: string; phone: string }>;
    noFaceAlertMinutes: number;
    userId: string | null;
  };

  // Chat
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  isChatOpen: boolean;

  // Actions
  setEmotion: (emotion: Partial<EmotionState>) => void;
  setConnected: (connected: boolean) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  addChatMessage: (message: { role: 'user' | 'assistant'; content: string }) => void;
  clearChatHistory: () => void;
  setChatOpen: (open: boolean) => void;
  resetSession: () => void;
}

const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildEmotionScoreSignature = (scores: Record<string, number>) => {
  const top = Object.entries(scores || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => `${name}:${Math.round(value * 20) / 20}`);
  return top.join('|');
};

/**
 * Estado inicial da emocao. Uma funcao (e nao uma constante) porque
 * `lastUpdated` precisa ser o instante do reset, e para que nenhum consumidor
 * mute o objeto compartilhado por engano.
 */
const initialEmotion = (): EmotionState => ({
  emotion: 'neutral',
  emotionVariant: 'steady',
  emotionZone: 'balanced',
  supportTip: null,
  confidence: 0,
  secondaryEmotion: null,
  message: null,
  musicSuggestions: [],
  faceDetected: false,
  lastUpdated: Date.now(),
  allScores: {},
  noFaceAlertFired: false,
  shouldTriggerAlert: false,
  compoundEmotion: null,
  emotionIntensity: 'calm',
  faceQualityScore: 0,
  faceQualityTips: [],
  emotionStreakSeconds: 0,
  heartRateBpm: null,
  heartRateConfidence: 0,
  heartRateStatus: 'collecting',
});

export const useAppStore = create<AppState>((set) => ({
  sessionId: generateSessionId(),
  userId: null,
  isConnected: false,

  currentEmotion: initialEmotion(),

  settings: {
    petType: 'seal',
    petName: 'Mellow',
    musicEnabled: true,
    alertsEnabled: true,
    voiceAssistantEnabled: true,
    notificationsEnabled: true,
    hapticsEnabled: true,
    emergencyContacts: [],
    noFaceAlertMinutes: 10,
    userId: null,
  },

  chatHistory: [],
  isChatOpen: false,

  setEmotion: (emotion) =>
    set((state) => {
      const nextEmotion = {
        ...state.currentEmotion,
        ...emotion,
      };

      const changed =
        nextEmotion.emotion !== state.currentEmotion.emotion ||
        nextEmotion.emotionVariant !== state.currentEmotion.emotionVariant ||
        nextEmotion.emotionZone !== state.currentEmotion.emotionZone ||
        nextEmotion.supportTip !== state.currentEmotion.supportTip ||
        Math.abs(nextEmotion.confidence - state.currentEmotion.confidence) >= 0.03 ||
        nextEmotion.secondaryEmotion !== state.currentEmotion.secondaryEmotion ||
        nextEmotion.message !== state.currentEmotion.message ||
        nextEmotion.faceDetected !== state.currentEmotion.faceDetected ||
        nextEmotion.noFaceAlertFired !== state.currentEmotion.noFaceAlertFired ||
        nextEmotion.shouldTriggerAlert !== state.currentEmotion.shouldTriggerAlert ||
        nextEmotion.compoundEmotion !== state.currentEmotion.compoundEmotion ||
        nextEmotion.emotionIntensity !== state.currentEmotion.emotionIntensity ||
        Math.abs((nextEmotion.faceQualityScore ?? 0) - (state.currentEmotion.faceQualityScore ?? 0)) >= 0.03 ||
        Math.abs((nextEmotion.emotionStreakSeconds ?? 0) - (state.currentEmotion.emotionStreakSeconds ?? 0)) >= 1 ||
        nextEmotion.heartRateBpm !== state.currentEmotion.heartRateBpm ||
        nextEmotion.heartRateStatus !== state.currentEmotion.heartRateStatus ||
        JSON.stringify(nextEmotion.musicSuggestions) !== JSON.stringify(state.currentEmotion.musicSuggestions) ||
        buildEmotionScoreSignature(nextEmotion.allScores) !== buildEmotionScoreSignature(state.currentEmotion.allScores);

      if (!changed) {
        return state;
      }

      return {
        currentEmotion: {
          ...nextEmotion,
          lastUpdated: Date.now(),
        },
      };
    }),

  setConnected: (connected) =>
    set((state) => (state.isConnected === connected ? state : { isConnected: connected })),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [
        ...state.chatHistory,
        { ...message, timestamp: Date.now() },
      ],
    })),

  clearChatHistory: () => set({ chatHistory: [] }),

  setChatOpen: (open) => set({ isChatOpen: open }),

  resetSession: () =>
    set({
      sessionId: generateSessionId(),
      chatHistory: [],
      currentEmotion: initialEmotion(),
    }),
}));
