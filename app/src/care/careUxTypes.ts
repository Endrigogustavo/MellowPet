/**
 * Contratos da nova área do cuidador (docs/ux/plano.md §4). Os nomes de
 * coluna espelham a migration 202610300001_care_ux.sql e os schemas
 * Pydantic de api/routers/care.py — mudar aqui exige mudar lá.
 */

/** Anotação do cuidador sobre uma pessoa, presa a um dia local. */
export type CareNote = {
  id: string;
  cared_user_id: string;
  caregiver_link_id: string;
  author_id: string;
  body: string;
  /** Dia local da anotação, AAAA-MM-DD. */
  note_day: string;
  created_at: string;
  updated_at: string | null;
};

/** Preferências de push por vínculo (tabela care_notification_prefs). */
export type CareNotificationPrefs = {
  caregiver_link_id: string;
  push_alerts: boolean;
  push_requests: boolean;
  weekly_digest: boolean;
  /** Silêncio noturno em hora local "HH:MM"; null = sem silêncio. Pedidos "agora" furam o silêncio. */
  quiet_start: string | null;
  quiet_end: string | null;
};

export const DEFAULT_NOTIFICATION_PREFS: Omit<CareNotificationPrefs, 'caregiver_link_id'> = {
  push_alerts: true,
  push_requests: true,
  weekly_digest: true,
  quiet_start: '22:00',
  quiet_end: '07:00',
};

/** Emoções que contam como "difícil" numa regra de alerta. */
export type DifficultEmotion = 'sad' | 'angry' | 'fearful' | 'disgusted';

/** Regra de alerta por vínculo (tabela care_alert_rules). Sem linha = regra padrão do servidor. */
export type CareAlertRule = {
  caregiver_link_id: string;
  enabled: boolean;
  /** 2..10 leituras difíceis... */
  min_readings: number;
  /** ...dentro de 30..360 minutos. */
  window_minutes: number;
  emotions: DifficultEmotion[];
};

export const DEFAULT_ALERT_RULE: Omit<CareAlertRule, 'caregiver_link_id'> = {
  enabled: true,
  min_readings: 3,
  window_minutes: 90,
  emotions: ['sad', 'angry', 'fearful', 'disgusted'],
};

export type HistoryGranularity = 'day' | 'week' | 'month';

/** Uma linha da RPC care_history(p_cared, p_granularity, p_periods, p_tz). */
export type CareHistoryBucket = {
  /** Início do período em data local, AAAA-MM-DD. */
  bucket: string;
  total: number;
  pleasant: number;
  neutral: number;
  difficult: number;
  top_emotion: string | null;
};

/** Entrada de POST /api/v1/care/weekly: só agregados, nunca leituras individuais. */
export type WeeklySummaryInput = {
  week_start: string;
  days: { day: string; total: number; pleasant: number; neutral: number; difficult: number }[];
  open_alerts: number;
  relationship?: string | null;
};

/** Saída de POST /api/v1/care/weekly. `text` null = sem IA; o app usa o resumo por regras. */
export type WeeklySummaryOutput = { text: string | null; provider: string };

/** Versão do termo que a pessoa acompanhada aceita (RPC accept_invite_with_consent). */
export const CARE_TERMS_VERSION = '2026-10-30';
