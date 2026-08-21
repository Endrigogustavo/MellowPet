import assert from 'node:assert/strict';
import test from 'node:test';

import { VisionEventRecorder } from '../src/vision/eventRecorder.ts';

const zeroScores = {
  happy: 0,
  sad: 0,
  angry: 0,
  neutral: 0,
  surprised: 0,
  disgusted: 0,
  fearful: 0,
};

function result(expression, overrides = {}) {
  return {
    observedExpression: expression,
    signalConfidence: expression === 'unknown' ? 0 : 0.8,
    signalStatus: expression === 'unknown' ? 'no_face' : 'ready',
    qualityScore: expression === 'unknown' ? 0 : 0.9,
    qualityReasons: expression === 'unknown' ? ['no_face'] : [],
    tensionSignal: expression === 'angry' ? 0.6 : 0.1,
    capturedAtMs: 1_776_948_602_000,
    modelVersion: 'model@1',
    pipelineVersion: 'pipeline@2',
    calibrationProgress: null,
    scores: { ...zeroScores, [expression === 'unknown' ? 'neutral' : expression]: 1 },
    latencyMs: 40,
    droppedFrames: 0,
    calibration: { active: false, accepted: 0, required: 10, complete: true },
    ...overrides,
  };
}

test('recorder emits intervals only on transition or session end', () => {
  const recorder = new VisionEventRecorder('session_123', 'device_123');
  assert.equal(recorder.record(result('happy')).length, 0);
  assert.equal(
    recorder.record(result('happy', { capturedAtMs: 1_776_948_602_100 })).length,
    0
  );
  const [transition] = recorder.record(
    result('sad', { capturedAtMs: 1_776_948_602_200, scores: { ...zeroScores, sad: 1 } })
  );
  assert.equal(transition.event.kind, 'transition');
  assert.equal(transition.event.observed_expression, 'happy');
  assert.equal(transition.event.quality.accepted_coverage, 1);
  assert.equal(recorder.finish().event.observed_expression, 'sad');
});

test('unknown interval contains reasons but no fabricated distribution', () => {
  const recorder = new VisionEventRecorder('session_123', 'device_123');
  recorder.record(result('unknown'));
  const interval = recorder.finish().event;
  assert.equal(interval.observed_expression, 'unknown');
  assert.deepEqual(interval.expression_distribution, {});
  assert.deepEqual(interval.quality.reasons, ['no_face']);
  assert.equal(interval.quality.accepted_coverage, 0);
});

test('event contract contains aggregates and no frame-like field', () => {
  const recorder = new VisionEventRecorder('session_123', 'device_123');
  recorder.record(result('angry'));
  const encoded = JSON.stringify(recorder.finish());
  assert.doesNotMatch(encoded, /frame|bitmap|landmark|base64/i);
  assert.match(encoded, /model@1/);
  assert.match(encoded, /quality@1\.0\.0/);
});
