import * as SecureStore from 'expo-secure-store';

import type {
  VisionBatchResponse,
  VisionEventEnvelope,
  VisionFeedback,
} from './eventContracts';
import { VISION_FLAGS } from './featureFlags';

const INDEX_KEY = 'mellowpet.vision.queue.v2.index';
const ITEM_PREFIX = 'mellowpet.vision.queue.v2.item.';
const MAX_QUEUE_ITEMS = 32;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export const VISION_EVENT_UPLOAD_ENABLED = VISION_FLAGS.eventUploadEnabled;
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

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

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : null),
    },
    body: JSON.stringify(body),
  });
  return response;
}

async function performFlush(): Promise<VisionQueueMetrics> {
  const items = await listItems();
  if (!VISION_EVENT_UPLOAD_ENABLED || !API_BASE_URL || items.length === 0) return metrics(items);
  if (Date.now() < nextAttemptAtMs) return metrics(items);

  const acknowledged = new Set<string>();
  try {
    const eventItems = items.filter((item) => item.type === 'event');
    const groups = new Map<string, typeof eventItems>();
    eventItems.forEach((item) => {
      const key = [
        item.payload.session_id,
        item.payload.device_session_id,
        item.payload.user_id ?? '',
      ].join('|');
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

    for (const group of groups.values()) {
      const first = group[0].payload;
      const response = await postJson('/api/v2/expression-events:batch', {
        session_id: first.session_id,
        device_session_id: first.device_session_id,
        ...(first.user_id ? { user_id: first.user_id } : null),
        events: group.map((item) => item.payload.event),
      });
      if (!response.ok) throw new Error(`event_batch_${response.status}`);
      const result = (await response.json()) as VisionBatchResponse;
      const acceptedIds = new Set([
        ...result.accepted_event_ids,
        ...result.duplicate_event_ids,
        ...result.rejected
          .filter((event) => event.reason !== 'storage_error')
          .map((event) => event.event_id),
      ]);
      group.forEach((item) => {
        if (acceptedIds.has(item.payload.event.event_id)) acknowledged.add(item.id);
      });
    }

    // Eventos sempre sao enviados antes do feedback que os referencia.
    for (const item of items.filter((entry) => entry.type === 'feedback')) {
      const response = await postJson('/api/v2/expression-feedback', item.payload);
      if (response.ok) acknowledged.add(item.id);
      else if (response.status !== 404) throw new Error(`feedback_${response.status}`);
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
