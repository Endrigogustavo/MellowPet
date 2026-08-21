import assert from 'node:assert/strict';
import test from 'node:test';

import { qualityGuidance, VisionTelemetry } from '../src/vision/telemetry.ts';

function sample(index, status = 'ready') {
  const unknown = status !== 'ready';
  const native = {
    receivedFrames: index + 2,
    processedFrames: index + 1,
    droppedFrames: 1,
    effectiveFps: 10,
    thermalState: 'nominal',
    initializationLatencyMs: 450,
  };
  const result = {
    observedExpression: unknown ? 'unknown' : 'neutral',
    signalStatus: status,
    latencyMs: (index + 1) * 10,
    qualityReasons: unknown ? ['too_dark'] : [],
  };
  return [native, result];
}

test('telemetry reports percentiles, coverage and native counters', () => {
  const telemetry = new VisionTelemetry();
  for (let index = 0; index < 10; index += 1) {
    telemetry.record(...sample(index, index < 2 ? 'insufficient_quality' : 'ready'));
  }
  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.latencyP50Ms, 50);
  assert.equal(snapshot.latencyP95Ms, 100);
  assert.equal(snapshot.qualityCoverage, 0.8);
  assert.equal(snapshot.unknownRate, 0.2);
  assert.equal(snapshot.receivedFrames, 11);
  assert.equal(snapshot.processedFrames, 10);
  assert.equal(snapshot.qualityReasonCounts.too_dark, 2);
});

test('quality guidance prioritizes actionable reasons', () => {
  assert.match(qualityGuidance('insufficient_quality', ['too_dark']), /luz suave/);
  assert.match(qualityGuidance('no_face', ['no_face']), /Centralize/);
  assert.equal(qualityGuidance('ready', []), null);
});
