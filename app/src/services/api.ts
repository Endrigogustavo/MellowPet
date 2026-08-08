import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

const resolveBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  const apiPort = process.env.EXPO_PUBLIC_API_PORT || '8000';

  if (!__DEV__) {
    return `http://localhost:${apiPort}`;
  }

  const hostUri =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    '';

  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
  if (host) {
    return `http://${host}:${apiPort}`;
  }

  return `http://127.0.0.1:${apiPort}`;
};

const BASE_URL = resolveBaseUrl();

/**
 * Chave compartilhada enviada em X-API-Key.
 *
 * Como todo EXPO_PUBLIC_*, ela é embutida no bundle e pode ser extraída de um
 * APK. Serve para impedir que terceiros usem a API pública por conta própria —
 * não é autenticação de usuário. Se um dia o app tiver contas, troque isto por
 * um token por usuário.
 */
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

if (__DEV__) {
  console.log('[API] BASE_URL =', BASE_URL, '| key:', API_KEY ? 'sim' : 'não');
}

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 9000,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  },
});

// ── Request interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      const method = (config.method || 'GET').toUpperCase();
      const url = `${config.baseURL || ''}${config.url || ''}`;
      console.log('[API] ->', method, url);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const method = (response.config.method || 'GET').toUpperCase();
      const url = `${response.config.baseURL || ''}${response.config.url || ''}`;
      console.log('[API] <-', response.status, method, url);
    }
    return response;
  },
  (error) => {
    // Só loga em dev: o corpo do erro pode conter dados da sessão, e em
    // produção esses logs ficariam acessíveis no dispositivo.
    if (__DEV__) {
      const method = (error?.config?.method || 'GET').toUpperCase();
      const url = `${error?.config?.baseURL || ''}${error?.config?.url || ''}`;
      const status = error?.response?.status;
      const data = error?.response?.data;
      console.warn('[API] xx', status || 'NO_STATUS', method, url);

      if (status === 401) {
        console.warn('[API] 401 — verifique EXPO_PUBLIC_API_KEY e API_KEY na API.');
      }

      // React Native / Axios often reports connection issues as "Network Error" with no status.
      // Include code/timeout to make it clear whether this is offline, refused, or timed out.
      if (data) {
        console.warn('[API Error]', data);
      } else {
        console.warn('[API Error]', {
          message: error?.message,
          code: error?.code,
          timeout: error?.config?.timeout,
        });
      }
    }
    return Promise.reject(error);
  },
);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmotionAnalysisResult {
  emotion: string;
  emotion_variant: string;
  emotion_zone: string;
  support_tip: string;
  confidence: number;
  secondary_emotion: string | null;
  all_scores: Record<string, number>;
  face_detected: boolean;
  processing_time_ms: number;
  message: string | null;
  music_suggestions: string[];
  timestamp: number;
  no_face_alert: boolean;
  seconds_since_last_face: number;
  should_trigger_alert: boolean;
  action_units: Record<string, number> | null;
  micro_expressions: Array<{ emotion: string; intensity: number; duration_ms: number }>;
  detection_models_used: string[];
  face_mesh_landmarks_count: number;
  compound_emotion: string | null;
  emotion_intensity: string;
  face_quality_metrics: FaceQualityMetrics | null;
  emotion_streak_seconds: number;
  heart_rate_bpm: number | null;
  heart_rate_confidence: number;
  heart_rate_status: string;
}

export interface FaceQualityMetrics {
  lighting: string;
  sharpness: number;
  brightness: number;
  contrast: number;
  face_angle: string;
  quality_score: number;
  tips: string[];
}

export interface EmotionTrend {
  session_id: string;
  trend: string;
  trend_score: number;
  dominant_emotion: string;
  dominant_streak_seconds: number;
  intensity_level: string;
  recent_transitions: Array<{ from: string; to: string; timestamp: number; duration_seconds: number }>;
  emotion_distribution: Record<string, number>;
  reading_count: number;
}

export interface EmotionSummary {
  period_hours: number;
  total_events: number;
  dominant_emotion: string;
  emotion_counts: Record<string, number>;
  emotion_percentages: Record<string, number>;
  avg_confidences: Record<string, number>;
  face_detected_count: number;
}

export interface DashboardData {
  period_hours: number;
  total_events: number;
  timeline: Array<{ hour: number; emotions: Record<string, number>; total: number }>;
  emotion_distribution: Record<string, number>;
  emotion_counts: Record<string, number>;
  wellbeing_score: number;
  peak_emotions: Array<[string, number]>;
  ai_insight: string;
  ai_provider?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  emotion_context: string;
  provider: string;
}

export interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: string;
  accent: boolean;
}

export interface ToolsRecommendations {
  emotion: string;
  confidence: number;
  support_message: string;
  suggested_tools: ToolItem[];
  micro_plan: string[];
  focus_mode_hint: string;
}

export interface DailyContent {
  emotion: string;
  affirmation: string;
  journal_prompt: string;
  reset_prompt: string;
}

export interface BreathingProtocol {
  emotion: string;
  cycle_seconds: number;
  inhale_seconds: number;
  hold_seconds: number;
  exhale_seconds: number;
  hold_after_exhale_seconds: number;
  rounds: number;
  intro: string;
}

export interface MeditationSession {
  emotion: string;
  title: string;
  duration_minutes: number;
  technique: string;
  guide_steps: string[];
  closing_message: string;
}

export interface GroundingExercise {
  emotion: string;
  title: string;
  technique: string;
  steps: string[];
  duration_seconds: number;
  tip: string;
}

export interface JournalPrompts {
  emotion: string;
  prompts: string[];
  guided_questions: string[];
  reflection_closing: string;
}

export interface CognitiveReframing {
  emotion: string;
  automatic_thought_example: string;
  cognitive_distortion: string;
  reframed_thought: string;
  steps: string[];
  practice_prompt: string;
}

export interface MuscleRelaxation {
  emotion: string;
  title: string;
  duration_minutes: number;
  body_groups: Array<{ group: string; instruction: string; duration_seconds: number }>;
  closing_message: string;
}

export interface SleepHygiene {
  emotion: string;
  tips: string[];
  wind_down_routine: string[];
  avoid_list: string[];
  bedtime_affirmation: string;
}

export interface EmotionEducation {
  emotion: string;
  what_it_is: string;
  why_it_happens: string;
  body_signals: string[];
  healthy_responses: string[];
  unhealthy_patterns: string[];
  fun_fact: string;
}

export interface GratitudePractice {
  emotion: string;
  prompts: string[];
  micro_gratitude: string;
  sharing_prompt: string;
}

export interface SocialConnection {
  emotion: string;
  suggestions: string[];
  conversation_starters: string[];
  boundary_tip: string;
}

export interface CrisisResources {
  emotion: string;
  severity: string;
  immediate_actions: string[];
  hotlines: Array<{ name: string; number: string; hours: string; type: string }>;
  safety_plan_steps: string[];
  grounding_quick: string;
}

export interface EnergyBoost {
  emotion: string;
  physical_activities: Array<{ name: string; intensity: string; benefit: string }>;
  quick_wins: string[];
  nutrition_tip: string;
  hydration_reminder: string;
}

export interface FocusMode {
  emotion: string;
  technique: string;
  duration_minutes: number;
  steps: string[];
  distraction_blockers: string[];
  reward_after: string;
}

export interface EmotionPlaylist {
  emotion: string;
  mood_label: string;
  genres: string[];
  curated_tracks: Array<{ title: string; artist: string; mood: string }>;
  ambient_sounds: string[];
}

export interface BodyScan {
  emotion: string;
  title: string;
  duration_minutes: number;
  body_areas: Array<{ area: string; instruction: string }>;
  closing_message: string;
}

export interface Visualization {
  emotion: string;
  title: string;
  scenario: string;
  guided_steps: string[];
  sensory_details: Record<string, string>;
  duration_minutes: number;
  closing_affirmation: string;
}

export interface PositiveAffirmations {
  emotion: string;
  affirmations: string[];
  mirror_exercise: string;
  repeat_count: number;
  closing: string;
}

export interface EmotionWheel {
  emotion: string;
  primary_emotion: string;
  secondary_emotions: string[];
  nuanced_feelings: string[];
  description: string;
  body_map: string[];
  coping_match: string[];
}

// ── API Calls ──────────────────────────────────────────────────────────────────

export const ApiService = {
  // Health
  async health(options?: { timeoutMs?: number }) {
    const { data } = await api.get('/health', {
      timeout: options?.timeoutMs ?? 2500,
    });
    return data;
  },

  // Emotion
  async analyzeFrame(
    frameB64: string,
    sessionId: string,
    userId?: string,
    petName = 'Mellow',
  ): Promise<EmotionAnalysisResult> {
    const { data } = await api.post('/api/v1/emotion/analyze', {
      frame_b64: frameB64,
      session_id: sessionId,
      user_id: userId,
      pet_name: petName,
      source: 'mobile',
    });
    return data;
  },

  // History
  async getHistory(params: { sessionId?: string; userId?: string; limit?: number }) {
    const { data } = await api.get('/api/v1/history/', { params: {
      session_id: params.sessionId,
      user_id: params.userId,
      limit: params.limit ?? 100,
    }});
    return data;
  },

  async getSummary(params: { userId?: string; sessionId?: string; hours?: number }): Promise<EmotionSummary> {
    const { data } = await api.get('/api/v1/history/summary', { params: {
      user_id: params.userId,
      session_id: params.sessionId,
      hours: params.hours ?? 24,
    }});
    return data;
  },

  async getEmotionTrend(sessionId: string): Promise<EmotionTrend> {
    const { data } = await api.get(`/api/v1/emotion/session/${sessionId}/trend`);
    return data;
  },

  // Dashboard
  async getDashboard(params: { userId?: string; sessionId?: string; hours?: number }): Promise<DashboardData> {
    const { data } = await api.get('/api/v1/dashboard/overview', { params: {
      user_id: params.userId,
      session_id: params.sessionId,
      hours: params.hours ?? 24,
    }});
    return data;
  },

  // Chat
  async chat(
    message: string,
    emotion: string,
    confidence: number,
    history: ChatMessage[] = [],
  ): Promise<ChatResponse> {
    const { data } = await api.post('/api/v1/chat/', {
      message,
      emotion,
      confidence,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    });
    return data;
  },

  async getToolRecommendations(params: { emotion: string; confidence: number; faceDetected: boolean }): Promise<ToolsRecommendations> {
    const { data } = await api.get('/api/v1/tools/recommendations', {
      params: {
        emotion: params.emotion,
        confidence: params.confidence,
        face_detected: params.faceDetected,
      },
    });
    return data;
  },

  async getDailyContent(params: { emotion: string }): Promise<DailyContent> {
    const { data } = await api.get('/api/v1/tools/daily-content', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getBreathingProtocol(params: { emotion: string; confidence: number }): Promise<BreathingProtocol> {
    const { data } = await api.get('/api/v1/tools/breathing-protocol', {
      params: {
        emotion: params.emotion,
        confidence: params.confidence,
      },
    });
    return data;
  },

  async getMeditation(params: { emotion: string; duration?: number }): Promise<MeditationSession> {
    const { data } = await api.get('/api/v1/tools/meditation', {
      params: { emotion: params.emotion, duration: params.duration ?? 5 },
    });
    return data;
  },

  async getGrounding(params: { emotion: string }): Promise<GroundingExercise> {
    const { data } = await api.get('/api/v1/tools/grounding', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getJournalPrompts(params: { emotion: string }): Promise<JournalPrompts> {
    const { data } = await api.get('/api/v1/tools/journal-prompts', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getCognitiveReframing(params: { emotion: string }): Promise<CognitiveReframing> {
    const { data } = await api.get('/api/v1/tools/cognitive-reframing', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getMuscleRelaxation(params: { emotion: string }): Promise<MuscleRelaxation> {
    const { data } = await api.get('/api/v1/tools/muscle-relaxation', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getSleepHygiene(params: { emotion: string }): Promise<SleepHygiene> {
    const { data } = await api.get('/api/v1/tools/sleep-hygiene', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getEmotionEducation(params: { emotion: string }): Promise<EmotionEducation> {
    const { data } = await api.get('/api/v1/tools/emotion-education', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getGratitude(params: { emotion: string }): Promise<GratitudePractice> {
    const { data } = await api.get('/api/v1/tools/gratitude', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getSocialConnection(params: { emotion: string }): Promise<SocialConnection> {
    const { data } = await api.get('/api/v1/tools/social-connection', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getCrisisResources(params: { emotion: string; confidence: number }): Promise<CrisisResources> {
    const { data } = await api.get('/api/v1/tools/crisis-resources', {
      params: { emotion: params.emotion, confidence: params.confidence },
    });
    return data;
  },

  async getEnergyBoost(params: { emotion: string }): Promise<EnergyBoost> {
    const { data } = await api.get('/api/v1/tools/energy-boost', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getFocusMode(params: { emotion: string }): Promise<FocusMode> {
    const { data } = await api.get('/api/v1/tools/focus-mode', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getEmotionPlaylist(params: { emotion: string }): Promise<EmotionPlaylist> {
    const { data } = await api.get('/api/v1/tools/playlist', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getBodyScan(params: { emotion: string; duration?: number }): Promise<BodyScan> {
    const { data } = await api.get('/api/v1/tools/body-scan', {
      params: { emotion: params.emotion, duration: params.duration || 5 },
    });
    return data;
  },

  async getVisualization(params: { emotion: string }): Promise<Visualization> {
    const { data } = await api.get('/api/v1/tools/visualization', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getAffirmations(params: { emotion: string }): Promise<PositiveAffirmations> {
    const { data } = await api.get('/api/v1/tools/affirmations', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  async getEmotionWheel(params: { emotion: string }): Promise<EmotionWheel> {
    const { data } = await api.get('/api/v1/tools/emotion-wheel', {
      params: { emotion: params.emotion },
    });
    return data;
  },

  // Alerts
  async triggerEmotionAlert(payload: {
    session_id: string;
    user_name?: string;
    emotion: string;
    duration_minutes: number;
    contact_email?: string;
  }) {
    const { data } = await api.post('/api/v1/alerts/emotion', payload);
    return data;
  },

  async triggerNoFaceAlert(payload: {
    session_id: string;
    user_name?: string;
    minutes_without_face: number;
    contact_email?: string;
  }) {
    const { data } = await api.post('/api/v1/alerts/no-face', payload);
    return data;
  },
};
