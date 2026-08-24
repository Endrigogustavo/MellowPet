import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'mellowpet.dismissed_cards.v1';

export async function loadDismissedCards(): Promise<Set<string>> {
  const encoded = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!encoded) return new Set();
  try {
    const parsed = JSON.parse(encoded);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export async function dismissCard(id: string, current: Set<string>): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...current, id]));
}
