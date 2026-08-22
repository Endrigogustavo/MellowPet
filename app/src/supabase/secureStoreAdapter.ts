import * as SecureStore from 'expo-secure-store';

// expo-secure-store caps each item at 2048 bytes (Android Keystore/iOS
// Keychain entry limit). A Supabase session (access token + refresh token +
// user metadata, JSON-encoded) regularly exceeds that, so the SDK's session
// blob is split across numbered chunk keys instead of stored as one value.
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}.chunk${index}`;
}

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}.chunks`);
  const count = raw ? Number(raw) : 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** Storage adapter for supabase-js's `auth.storage` option, backed by
 * expo-secure-store instead of the default (unavailable on native) web
 * storage — matches this app's existing pattern for anything sensitive. */
export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (count === 0) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
    );
    if (parts.some((part) => part === null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readChunkCount(key);
    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
    // Drop leftover chunks from a previous, longer value.
    await Promise.all(
      Array.from({ length: Math.max(0, previousCount - chunks.length) }, (_, offset) =>
        SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset))
      )
    );
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))));
    await SecureStore.deleteItemAsync(`${key}.chunks`);
  },
};
