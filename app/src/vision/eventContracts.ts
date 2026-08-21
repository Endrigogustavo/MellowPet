import type { EmotionKey } from '../data/emotions';

export type KnownVisualExpression = Exclude<EmotionKey, 'unknown'>;
export type VisionEventKind = 'transition' | 'heartbeat' | 'session_end';

/** Espelho do schema OpenAPI `/api/v2/expression-events:batch`. */
export type VisionIntervalEvent = {
  event_id: string;
  kind: VisionEventKind;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  observed_expression: EmotionKey;
  expression_distribution: Partial<Record<KnownVisualExpression, number>>;
  signal_confidence: number;
  quality: {
    mean: number;
    accepted_coverage: number;
    reasons: string[];
  };
  tension_signal: number | null;
  model_version: string;
  pipeline_version: string;
  quality_config_version: string;
  calibration_version: string | null;
  source: 'mobile';
};

export type VisionEventEnvelope = {
  session_id: string;
  device_session_id: string;
  user_id?: string;
  event: VisionIntervalEvent;
};

export type VisionFeedback = {
  feedback_id: string;
  event_id: string;
  agreement: 'yes' | 'no' | 'unsure';
  self_reported_state?: string;
  corrected_observed_expression?: KnownVisualExpression;
  note?: string;
  created_at: string;
};

export type VisionBatchResponse = {
  accepted_event_ids: string[];
  duplicate_event_ids: string[];
  rejected: { event_id: string; reason: string }[];
  server_time: string;
};
