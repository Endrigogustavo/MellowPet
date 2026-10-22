import * as SecureStore from 'expo-secure-store';

import { DEFAULT_GAINS, parseGains, type PersonalGains } from './personalCalibration';

/**
 * Os ganhos pessoais ficam só neste aparelho, por conta. Não sobem para o
 * servidor: dizem algo sobre o rosto da pessoa, e o motor roda aqui mesmo.
 */
const key = (userId: string) => `mellowpet.vision.gains.v1.${encodeURIComponent(userId).slice(0, 120)}`;

export async function loadGains(userId: string): Promise<PersonalGains> {
  try {
    return parseGains(await SecureStore.getItemAsync(key(userId)));
  } catch {
    return DEFAULT_GAINS;
  }
}

export async function saveGains(userId: string, gains: PersonalGains): Promise<void> {
  await SecureStore.setItemAsync(key(userId), JSON.stringify(gains));
}

export async function clearGains(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(userId));
}
