import { performance } from 'node:perf_hooks';

import { ExpressionEngine } from '../src/vision/expressionEngine.ts';

const iterations = Number.parseInt(process.argv[2] ?? '100000', 10);
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1_000_000) {
  throw new Error('Informe entre 1 e 1.000.000 atualizações.');
}

const engine = new ExpressionEngine();
const smile = {
  mouthSmileLeft: 0.8,
  mouthSmileRight: 0.82,
  cheekSquintLeft: 0.6,
  cheekSquintRight: 0.58,
};
const frame = {
  status: 'ready',
  qualityScore: 0.9,
  qualityReasons: [],
  blendshapes: smile,
  faceCoverage: 0.2,
  brightness: 0.5,
  contrast: 0.5,
  sharpness: 0.7,
  yaw: 0,
  pitch: 0,
  roll: 0,
  latencyMs: 0,
  capturedAtMs: Date.now(),
  droppedFrames: 0,
  modelVersion: 'benchmark',
  pipelineVersion: 'benchmark',
};

for (let i = 0; i < 2000; i++) engine.process(frame);
const durations = new Float64Array(iterations);
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  frame.blendshapes = i % 20 < 10 ? smile : {};
  const begin = performance.now();
  engine.process(frame);
  durations[i] = performance.now() - begin;
}
const elapsed = performance.now() - start;
durations.sort();
const percentile = (p) => durations[Math.min(iterations - 1, Math.ceil(iterations * p) - 1)];
console.log(JSON.stringify({
  iterations,
  totalMs: Number(elapsed.toFixed(1)),
  perSecond: Math.round(iterations / (elapsed / 1000)),
  p50Ms: Number(percentile(0.5).toFixed(4)),
  p95Ms: Number(percentile(0.95).toFixed(4)),
  p99Ms: Number(percentile(0.99).toFixed(4)),
  scope: 'JS scoring, temporal smoothing and decision only; no native capture, MediaPipe, bridge or render',
}));
