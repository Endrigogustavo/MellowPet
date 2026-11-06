// Web compatibility shim for expo-secure-store (used in Expo Web / phone preview).
// Native iOS/Android builds continue to resolve the real expo-secure-store module.

const memoryFallback = new Map();

function readKey(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Restricted storage context: fall back to memory.
  }
  return memoryFallback.has(key) ? memoryFallback.get(key) : null;
}

function writeKey(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, String(value));
      return;
    }
  } catch {
    // Restricted storage context: fall back to memory.
  }
  memoryFallback.set(key, String(value));
}

function removeKey(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage error.
  }
  memoryFallback.delete(key);
}

export async function getItemAsync(key) {
  return readKey(key);
}

export async function setItemAsync(key, value) {
  writeKey(key, value);
}

export async function deleteItemAsync(key) {
  removeKey(key);
}

export function getItem(key) {
  return readKey(key);
}

export function setItem(key, value) {
  writeKey(key, value);
}

export async function isAvailableAsync() {
  return true;
}

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
