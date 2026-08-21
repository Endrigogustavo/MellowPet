import { EMOTIONS, ORDER, type EmotionKey } from '../data/emotions';

import type { VisionSnapshot } from './contracts';

export function nextDemoExpression(current: EmotionKey): EmotionKey {
  const index = ORDER.indexOf(current);
  return ORDER[(index + 1 + ORDER.length) % ORDER.length];
}

export function createDemoSnapshot(expression: EmotionKey): VisionSnapshot {
  const sample = EMOTIONS[expression];
  return {
    observedExpression: expression,
    signalConfidence: sample.conf,
    signalStatus: 'ready',
    qualityScore: sample.quality / 100,
    qualityReasons: [],
    tensionSignal: null,
    capturedAtMs: Date.now(),
    modelVersion: 'demo-fixture@1',
    pipelineVersion: 'demo-source@1',
    calibrationProgress: null,
  };
}
