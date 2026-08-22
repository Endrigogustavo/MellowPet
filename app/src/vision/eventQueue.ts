import * as SecureStore from 'expo-secure-store';

import { supabase } from '../supabase/client';
import type { VisionEventEnvelope, VisionFeedback } from './eventContracts';
import { VISION_FLAGS } from './featureFlags';

const INDEX_KEY = 'mellowpet.vision.queue.v2.index';
const ITEM_PREFIX = 'mellowpet.vision.queue.v2.item.';
const MAX_QUEUE_ITEMS = 32;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export const VISION_EVENT_UPLOAD_ENABLED = VISION_FLAGS.eventUploadEnabled;

type QueueIndexItem = { id: string; createdAtMs: number };
type StoredQueueItem =
  | { id: string; createdAtMs: number; type: 'event'; payload: VisionEventEnvelope }
  | { id: string; createdAtMs: number; type: 'feedback'; payload: VisionFeedback };

let storageChain: Promise<unknown> = Promise.resolve();
let flushPromise: Promise<VisionQueueMetrics> | null = null;
let failureCount = 0;
let nextAttemptAtMs = 0;

export type VisionQueueMetrics = {
  size: number;
  oldestAgeMs: number;
  failureCount: number;
  nextAttemptAtMs: number;
};

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = storageChain.then(operation, operation);
  storageChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readIndex(): Promise<QueueIndexItem[]> {
  const encoded = await SecureStore.getItemAsync(INDEX_KEY);
  if (!encoded) return [];
  try {
    const value = JSON.parse(encoded) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is QueueIndexItem =>
        typeof item?.id === 'string' &&
        typeof item?.createdAtMs === 'number' &&
        Number.isFinite(item.createdAtMs)
    );
  } catch {
    return [];
  }
}

async function writeIndex(index: QueueIndexItem[]) {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index));
}

async function enqueue(item: StoredQueueItem) {
  return serialized(async () => {
    const now = Date.now();
    let index = (await readIndex()).filter((entry) => now - entry.createdAtMs <= RETENTION_MS);
    const expired = (await readIndex()).filter((entry) => now - entry.createdAtMs > RETENTION_MS);
    await Promise.all(expired.map((entry) => SecureStore.deleteItemAsync(ITEM_PREFIX + entry.id)));

    await SecureStore.setItemAsync(ITEM_PREFIX + item.id, JSON.stringify(item));
    index = [...index.filter((entry) => entry.id !== item.id), { id: item.id, createdAtMs: item.createdAtMs }];
    while (index.length > MAX_QUEUE_ITEMS) {
      const removed = index.shift();
      if (removed) await SecureStore.deleteItemAsync(ITEM_PREFIX + removed.id);
    }
    await writeIndex(index);
  });
}

export async function enqueueVisionEvent(payload: VisionEventEnvelope) {
  if (!VISION_EVENT_UPLOAD_ENABLED) return;
  await enqueue({
    id: `event_${payload.event.event_id}`,
    createdAtMs: Date.now(),
    type: 'event',
    payload,
  });
}

export async function enqueueVisionFeedback(payload: VisionFeedback) {
  if (!VISION_EVENT_UPLOAD_ENABLED) return;
  await enqueue({
    id: `feedback_${payload.feedback_id}`,
    createdAtMs: Date.now(),
    type: 'feedback',
    payload,
  });
}

async function listItems(): Promise<StoredQueueItem[]> {
  return serialized(async () => {
    const index = await readIndex();
    const items = await Promise.all(
      index.map(async (entry) => {
        const encoded = await SecureStore.getItemAsync(ITEM_PREFIX + entry.id);
        if (!encoded) return null;
        try {
          return JSON.parse(encoded) as StoredQueueItem;
        } catch {
          return null;
        }
      })
    );
    return items.filter((item): item is StoredQueueItem => item !== null);
  });
}

async function removeItems(ids: Set<string>) {
  if (ids.size === 0) return;
  await serialized(async () => {
    const index = await readIndex();
    await Promise.all([...ids].map((id) => SecureStore.deleteItemAsync(ITEM_PREFIX + id)));
    await writeIndex(index.filter((entry) => !ids.has(entry.id)));
  });
}

function metrics(items: StoredQueueItem[]): VisionQueueMetrics {
  const oldest = items.reduce(
    (minimum, item) => Math.min(minimum, item.createdAtMs),
    Number.POSITIVE_INFINITY
  );
  return {
    size: items.length,
    oldestAgeMs: Number.isFinite(oldest) ? Math.max(0, Date.now() - oldest) : 0,
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

/** Sem usuário autenticado não há como escrever sob RLS — descarta em vez
 * de tentar pra sempre (nunca vai conseguir). */
async function pushEvents(items: { id: string; payload: VisionEventEnvelope }[]): Promise<Set<string>> {
  const acknowledged = new Set<string>();
  const withUser = items.filter((item) => item.payload.user_id);
  items.filter((item) => !item.payload.user_id).forEach((item) => acknowledged.add(item.id));
  if (withUser.length === 0) return acknowledged;

  const { error: intervalError } = await supabase
    .from('vision_intervals')
    .upsert(withUser.map((item) => intervalRow(item.payload)), { onConflict: 'event_id', ignoreDuplicates: true });
  if (intervalError) throw intervalError;

  const emotionRows = withUser
    .filter((item) => item.payload.event.observed_expression !== 'unknown')
    .map((item) => emotionRow(item.payload));
  if (emotionRows.length > 0) {
    const { error: emotionError } = await supabase
      .from('emotion_events')
      .upsert(emotionRows, { onConflict: 'event_id', ignoreDuplicates: true });
    if (emotionError) throw emotionError;
  }

  withUser.forEach((item) => acknowledged.add(item.id));
  return acknowledged;
}

async function pushFeedback(items: { id: string; payload: VisionFeedback }[]): Promise<Set<string>> {
  const acknowledged = new Set<string>();
  for (const item of items) {
    const { error } = await supabase.from('vision_feedback').upsert(
      {
        feedback_id: item.payload.feedback_id,
        event_id: item.payload.event_id,
        agreement: item.payload.agreement,
        self_reported_state: item.payload.self_reported_state ?? null,
        corrected_observed_expression: item.payload.corrected_observed_expression ?? null,
        note: item.payload.note ?? null,
        created_at_ts: item.payload.created_at,
      },
      { onConflict: 'feedback_id', ignoreDuplicates: true }
    );
    // Evento referenciado pode ter sido descartado (sem user_id) — não
    // trava a fila por isso, só não reconhece esse item de feedback.
    if (!error) acknowledged.add(item.id);
  }
  return acknowledged;
}

async function performFlush(): Promise<VisionQueueMetrics> {
  const items = await listItems();
  if (!VISION_EVENT_UPLOAD_ENABLED || items.length === 0) return metrics(items);
  if (Date.now() < nextAttemptAtMs) return metrics(items);

  const acknowledged = new Set<string>();
  try {
    const eventItems = items.filter(
      (item): item is StoredQueueItem & { type: 'event' } => item.type === 'event'
    );
    if (eventItems.length > 0) {
      const acked = await pushEvents(eventItems);
      acked.forEach((id) => acknowledged.add(id));
    }

    // Eventos sempre sao enviados antes do feedback que os referencia.
    const feedbackItems = items.filter(
      (item): item is StoredQueueItem & { type: 'feedback' } => item.type === 'feedback'
    );
    if (feedbackItems.length > 0) {
      const acked = await pushFeedback(feedbackItems);
      acked.forEach((id) => acknowledged.add(id));
    }

    await removeItems(acknowledged);
    failureCount = 0;
    nextAttemptAtMs = 0;
  } catch {
    failureCount += 1;
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failureCount - 1));
    nextAttemptAtMs = Date.now() + Math.round(delay * jitter);
  }

  return metrics(await listItems());
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
  return metrics(await listItems());
}
