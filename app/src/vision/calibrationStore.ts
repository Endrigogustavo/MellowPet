import * as SecureStore from 'expo-secure-store';

import { EXPRESSION_CLASSIFIER_VERSION } from './expressionEngine';

type StoredCalibration = {
  schemaVersion: 2;
  userId: string;
  classifierVersion: string;
  baseline: Record<string, number>;
};

function storageKey(userId: string) {
  const safeUserId = encodeURIComponent(userId).slice(0, 120);
  return `mellowpet.vision.calibration.v2.${safeUserId}.${EXPRESSION_CLASSIFIER_VERSION}`;
}

export async function loadCalibrationBaseline(userId: string | null | undefined) {
  if (!userId) return null;
  const encoded = await SecureStore.getItemAsync(storageKey(userId));
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(encoded) as Partial<StoredCalibration>;
    if (
      parsed.schemaVersion !== 2 ||
      parsed.userId !== userId ||
      parsed.classifierVersion !== EXPRESSION_CLASSIFIER_VERSION ||
      !parsed.baseline ||
      typeof parsed.baseline !== 'object'
    ) {
      return null;
    }
    const entries = Object.entries(parsed.baseline).filter(
      ([key, value]) => key.length > 0 && typeof value === 'number' && Number.isFinite(value)
    );
    return Object.fromEntries(entries.map(([key, value]) => [key, Math.min(1, Math.max(0, value))]));
  } catch {
    return null;
  }
}

export async function saveCalibrationBaseline(userId: string, baseline: Record<string, number>) {
  const payload: StoredCalibration = {
    schemaVersion: 2,
    userId,
    classifierVersion: EXPRESSION_CLASSIFIER_VERSION,
    baseline,
  };
  await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(payload));
}

export async function clearCalibrationBaseline(userId: string | null | undefined) {
  if (!userId) return;
  await SecureStore.deleteItemAsync(storageKey(userId));
}
