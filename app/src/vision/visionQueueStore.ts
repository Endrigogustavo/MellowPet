import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type { VisionEventEnvelope, VisionFeedback } from './eventContracts';
import { parseLegacyIndex, parseLegacyItem } from './visionQueueLegacy';
import {
  CREATE_QUEUE_SCHEMA_SQL,
  SELECT_READY_ITEMS_SQL,
  SELECT_UNOWNED_FEEDBACK_SQL,
} from './visionQueueSql';

const DATABASE_NAME = 'mellowpet-vision-queue.db';
const DATABASE_KEY = 'mellowpet.vision.queue.v3.dbkey';
const LEGACY_INDEX_KEY = 'mellowpet.vision.queue.v2.index';
const LEGACY_ITEM_PREFIX = 'mellowpet.vision.queue.v2.item.';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredQueueItem =
  | { id: string; createdAtMs: number; type: 'event'; payload: VisionEventEnvelope }
  | { id: string; createdAtMs: number; type: 'feedback'; payload: VisionFeedback };
type EventQueueItem = Extract<StoredQueueItem, { type: 'event' }>;
type FeedbackQueueItem = Extract<StoredQueueItem, { type: 'feedback' }>;

type QueueRow = { id: string; created_at_ms: number; payload: string };
type QueueStats = { size: number; oldest_at_ms: number | null };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function encryptionKey() {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY);
  if (existing) {
    if (!/^[0-9a-f]{64}$/.test(existing)) throw new Error('Chave local da fila inválida.');
    return existing;
  }
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DATABASE_KEY, key);
  return key;
}

function owner(item: StoredQueueItem, legacyOwners?: Map<string, string>): string | null {
  if (item.type === 'event') return item.payload.user_id ?? null;
  return item.payload.user_id ?? legacyOwners?.get(item.payload.event_id) ?? null;
}

function eventId(item: StoredQueueItem): string {
  return item.type === 'event' ? item.payload.event.event_id : item.payload.event_id;
}

async function insert(db: SQLite.SQLiteDatabase, item: StoredQueueItem, legacyOwners?: Map<string, string>) {
  await db.runAsync(
    `insert into vision_queue (id, type, event_id, user_id, created_at_ms, payload)
     values (?, ?, ?, ?, ?, ?)
     on conflict(id) do nothing`,
    item.id,
    item.type,
    eventId(item),
    owner(item, legacyOwners),
    item.createdAtMs,
    JSON.stringify(item.payload)
  );
}

async function migrateLegacy(db: SQLite.SQLiteDatabase) {
  const encodedIndex = await SecureStore.getItemAsync(LEGACY_INDEX_KEY);
  if (!encodedIndex) return;
  const index = parseLegacyIndex(encodedIndex);
  if (index.length === 0) {
    // Não destrua um índice ilegível. Uma lista vazia válida pode ser limpa.
    if (encodedIndex.trim() === '[]') await SecureStore.deleteItemAsync(LEGACY_INDEX_KEY);
    return;
  }
  const entries = await Promise.all(index.map(async (entry) => {
    const { id } = entry;
    const encoded = await SecureStore.getItemAsync(LEGACY_ITEM_PREFIX + id);
    const parsed = encoded ? parseLegacyItem(encoded) : null;
    return { entry, encoded, item: parsed?.id === id ? parsed : null };
  }));
  const items = entries.flatMap(({ item }) => item ? [item] : []);
  const owners = new Map<string, string>();
  items.filter((item) => item.type === 'event').forEach((item) => {
    const userId = owner(item);
    if (userId) owners.set(eventId(item), userId);
  });
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const item of items) await insert(transaction, item, owners);
  });
  // SQLite confirmou toda a transação. Só agora removemos as cópias antigas;
  // um reinício no meio é seguro porque o INSERT é idempotente.
  for (const { entry, item } of entries) {
    if (item) await SecureStore.deleteItemAsync(LEGACY_ITEM_PREFIX + entry.id);
  }
  const corrupt = entries.filter(({ encoded, item }) => encoded && !item).map(({ entry }) => entry);
  if (corrupt.length > 0) {
    // Itens ilegíveis permanecem no SecureStore para diagnóstico/recuperação.
    await SecureStore.setItemAsync(LEGACY_INDEX_KEY, JSON.stringify(corrupt));
  } else {
    await SecureStore.deleteItemAsync(LEGACY_INDEX_KEY);
  }
}

async function openDatabase() {
  const key = await encryptionKey();
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    // `key` contém apenas hex gerado localmente, nunca entrada do usuário.
    await db.execAsync(`PRAGMA key = '${key}';`);
    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) throw new Error('O build não inclui SQLCipher para a fila local.');
    await db.execAsync(`PRAGMA journal_mode = WAL; ${CREATE_QUEUE_SCHEMA_SQL}`);
    await migrateLegacy(db);
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

function database() {
  if (!databasePromise) {
    databasePromise = openDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function purgeExpired(db: SQLite.SQLiteDatabase) {
  await db.runAsync('delete from vision_queue where created_at_ms < ?', Date.now() - RETENTION_MS);
}

export async function storeVisionQueueItem(item: StoredQueueItem) {
  const db = await database();
  await insert(db, item);
  await purgeExpired(db);
}

export function listVisionQueueItems(userId: string, type: 'event', limit?: number): Promise<EventQueueItem[]>;
export function listVisionQueueItems(userId: string, type: 'feedback', limit?: number): Promise<FeedbackQueueItem[]>;
export async function listVisionQueueItems(userId: string, type: StoredQueueItem['type'], limit = 100): Promise<StoredQueueItem[]> {
  const db = await database();
  await purgeExpired(db);
  const rows = await db.getAllAsync<QueueRow>(
    SELECT_READY_ITEMS_SQL,
    userId, type, type, limit
  );
  return rows.map((row) => ({
    id: row.id,
    createdAtMs: row.created_at_ms,
    type,
    payload: JSON.parse(row.payload),
  })) as StoredQueueItem[];
}

export async function removeVisionQueueItems(ids: Set<string>) {
  if (ids.size === 0) return;
  const db = await database();
  const values = [...ids];
  const placeholders = values.map(() => '?').join(',');
  await db.runAsync(`delete from vision_queue where id in (${placeholders})`, values);
}

export async function listUnownedVisionFeedback(
  limit = 100,
  after?: { createdAtMs: number; id: string }
): Promise<FeedbackQueueItem[]> {
  const db = await database();
  await purgeExpired(db);
  const rows = await db.getAllAsync<QueueRow>(
    SELECT_UNOWNED_FEEDBACK_SQL,
    after?.createdAtMs ?? -1, after?.createdAtMs ?? -1, after?.id ?? '', limit
  );
  return rows.map((row) => ({
    id: row.id,
    createdAtMs: row.created_at_ms,
    type: 'feedback',
    payload: JSON.parse(row.payload) as VisionFeedback,
  }));
}

export async function assignVisionFeedbackOwner(ids: string[], userId: string) {
  if (ids.length === 0) return;
  const db = await database();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `update vision_queue set user_id = ?
     where type = 'feedback' and user_id is null and id in (${placeholders})`,
    [userId, ...ids]
  );
}

export async function getVisionQueueStats() {
  const db = await database();
  await purgeExpired(db);
  const row = await db.getFirstAsync<QueueStats>(
    'select count(*) as size, min(created_at_ms) as oldest_at_ms from vision_queue'
  );
  return { size: row?.size ?? 0, oldestAtMs: row?.oldest_at_ms ?? null };
}
