import { supabase } from '../supabase/client';
import type { VisionEventEnvelope, VisionFeedback } from './eventContracts';
import { VISION_FLAGS } from './featureFlags';
import { uploadQueueBatch } from './queueBatch';
import {
  assignVisionFeedbackOwner,
  getVisionQueueStats,
  listVisionQueueItems,
  listUnownedVisionFeedback,
  removeVisionQueueItems,
  storeVisionQueueItem,
} from './visionQueueStore';

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export const VISION_EVENT_UPLOAD_ENABLED = VISION_FLAGS.eventUploadEnabled;

let flushPromise: Promise<VisionQueueMetrics> | null = null;
let failureCount = 0;
let nextAttemptAtMs = 0;
let nextLegacyResolveAtMs = 0;
let legacyResolveUserId: string | null = null;
let legacyCursor: { createdAtMs: number; id: string } | undefined;

export type VisionQueueMetrics = {
  size: number;
  oldestAgeMs: number;
  failureCount: number;
  nextAttemptAtMs: number;
};

export async function enqueueVisionEvent(payload: VisionEventEnvelope) {
  if (!VISION_EVENT_UPLOAD_ENABLED) return;
  await storeVisionQueueItem({
    id: `event_${payload.event.event_id}`,
    createdAtMs: Date.now(),
    type: 'event',
    payload,
  });
}

export async function enqueueVisionFeedback(payload: VisionFeedback) {
  if (!VISION_EVENT_UPLOAD_ENABLED) return;
  await storeVisionQueueItem({
    id: `feedback_${payload.feedback_id}`,
    createdAtMs: Date.now(),
    type: 'feedback',
    payload,
  });
}

async function metrics(): Promise<VisionQueueMetrics> {
  const stats = await getVisionQueueStats();
  return {
    size: stats.size,
    oldestAgeMs: stats.oldestAtMs === null ? 0 : Math.max(0, Date.now() - stats.oldestAtMs),
    failureCount,
    nextAttemptAtMs,
  };
}

function intervalRow(envelope: VisionEventEnvelope) {
  const e = envelope.event;
  return {
    event_id: e.event_id,
    session_id: envelope.session_id,
    device_session_id: envelope.device_session_id,
    user_id: envelope.user_id,
    kind: e.kind,
    started_at: e.started_at,
    ended_at: e.ended_at,
    duration_ms: e.duration_ms,
    observed_expression: e.observed_expression,
    expression_distribution: e.expression_distribution,
    signal_confidence: e.signal_confidence,
    quality_mean: e.quality.mean,
    accepted_coverage: e.quality.accepted_coverage,
    quality_reasons: e.quality.reasons,
    tension_signal: e.tension_signal,
    model_version: e.model_version,
    pipeline_version: e.pipeline_version,
    quality_config_version: e.quality_config_version,
    calibration_version: e.calibration_version,
    source: e.source,
  };
}

function emotionRow(envelope: VisionEventEnvelope) {
  const e = envelope.event;
  return {
    event_id: e.event_id,
    session_id: envelope.session_id,
    user_id: envelope.user_id,
    emotion: e.observed_expression,
    confidence: e.signal_confidence,
    all_scores: e.expression_distribution,
    face_detected: true,
    source: 'mobile_v2',
    created_at: e.ended_at,
  };
}

async function pushEvents(items: { id: string; payload: VisionEventEnvelope }[]) {
  return uploadQueueBatch(items, async (batch) => {
    const { error: intervalError } = await supabase
      .from('vision_intervals')
      .upsert(batch.map((item) => intervalRow(item.payload)), { onConflict: 'event_id', ignoreDuplicates: true });
    if (intervalError) return intervalError;

    const emotionRows = batch
      .filter((item) => item.payload.event.observed_expression !== 'unknown')
      .map((item) => emotionRow(item.payload));
    if (emotionRows.length === 0) return null;
    const { error } = await supabase
      .from('emotion_events')
      .upsert(emotionRows, { onConflict: 'event_id', ignoreDuplicates: true });
    return error;
  });
}

async function pushFeedback(items: { id: string; payload: VisionFeedback }[]) {
  return uploadQueueBatch(items, async (batch) => {
    const { error } = await supabase.from('vision_feedback').upsert(
      batch.map((item) => ({
        feedback_id: item.payload.feedback_id,
        event_id: item.payload.event_id,
        agreement: item.payload.agreement,
        self_reported_state: item.payload.self_reported_state ?? null,
        corrected_observed_expression: item.payload.corrected_observed_expression ?? null,
        note: item.payload.note ?? null,
        created_at_ts: item.payload.created_at,
      })),
      { onConflict: 'feedback_id', ignoreDuplicates: true }
    );
    return error;
  });
}

async function resolveLegacyFeedbackOwner(activeUserId: string) {
  if (legacyResolveUserId !== activeUserId) {
    legacyResolveUserId = activeUserId;
    nextLegacyResolveAtMs = 0;
    legacyCursor = undefined;
  }
  if (Date.now() < nextLegacyResolveAtMs) return;
  nextLegacyResolveAtMs = Date.now() + 5 * 60_000;
  const legacy = await listUnownedVisionFeedback(100, legacyCursor);
  if (legacy.length === 0) {
    legacyCursor = undefined;
    return;
  }
  const eventIds = [...new Set(legacy.map((item) => item.payload.event_id))];
  const { data, error } = await supabase
    .from('vision_intervals')
    .select('event_id')
    .eq('user_id', activeUserId)
    .in('event_id', eventIds);
  if (error) throw error;
  const ownedIds = new Set((data ?? []).map((row) => row.event_id));
  await assignVisionFeedbackOwner(
    legacy.filter((item) => ownedIds.has(item.payload.event_id)).map((item) => item.id),
    activeUserId
  );
  const last = legacy[legacy.length - 1];
  legacyCursor = legacy.length === 100 ? { createdAtMs: last.createdAtMs, id: last.id } : undefined;
}

async function performFlush(): Promise<VisionQueueMetrics> {
  if (!VISION_EVENT_UPLOAD_ENABLED || Date.now() < nextAttemptAtMs) return metrics();

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user.id) return metrics();
    const activeUserId = session.user.id;
    const eventItems = await listVisionQueueItems(activeUserId, 'event');
    if (eventItems.length > 0) {
      const { acknowledged, rejected } = await pushEvents(eventItems);
      await removeVisionQueueItems(acknowledged);
      if (rejected.length > 0) throw new Error('Evento inválido permanece na fila para inspeção.');
    }

    await resolveLegacyFeedbackOwner(activeUserId);
    // A seleção ignora feedback cujo evento ainda esteja na fila local.
    const feedbackItems = await listVisionQueueItems(activeUserId, 'feedback');
    if (feedbackItems.length > 0) {
      const { acknowledged, rejected } = await pushFeedback(feedbackItems);
      await removeVisionQueueItems(acknowledged);
      if (rejected.length > 0) throw new Error('Feedback inválido permanece na fila para inspeção.');
    }

    failureCount = 0;
    nextAttemptAtMs = 0;
  } catch {
    failureCount += 1;
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failureCount - 1));
    nextAttemptAtMs = Date.now() + Math.round(delay * jitter);
  }

  return metrics();
}

export function flushVisionQueue() {
  if (!flushPromise) {
    flushPromise = performFlush().finally(() => {
      flushPromise = null;
    });
  }
  return flushPromise;
}

export async function getVisionQueueMetrics() {
  return metrics();
}
