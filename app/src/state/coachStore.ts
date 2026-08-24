import * as SecureStore from 'expo-secure-store';

/** Guarda só um booleano: a pessoa já viu o tour de boas-vindas alguma vez
 * neste aparelho. Sem isto o tour reaparecia em toda abertura do app, porque
 * `state.coach` vive só em memória e volta a 0 a cada cold start. */
const STORAGE_KEY = 'mellowpet.coach_seen.v1';

export async function loadCoachSeen(): Promise<boolean> {
  return (await SecureStore.getItemAsync(STORAGE_KEY)) === '1';
}

export async function markCoachSeen(): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, '1');
}
