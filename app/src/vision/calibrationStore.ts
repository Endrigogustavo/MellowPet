import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'mellowpet.vision.calibration.v1';

type StoredCalibration = {
  schemaVersion: 1;
  baseline: Record<string, number>;
};

export async function loadCalibrationBaseline() {
  const encoded = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(encoded) as Partial<StoredCalibration>;
    if (parsed.schemaVersion !== 1 || !parsed.baseline || typeof parsed.baseline !== 'object') {
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

export async function saveCalibrationBaseline(baseline: Record<string, number>) {
  const payload: StoredCalibration = { schemaVersion: 1, baseline };
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearCalibrationBaseline() {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
