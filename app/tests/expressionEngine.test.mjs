import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeTensionSignal,
  ExpressionEngine,
  scoreBlendshapes,
} from '../src/vision/expressionEngine.ts';

const baseFrame = (blendshapes = {}, overrides = {}) => ({
  status: 'ready',
  qualityScore: 0.9,
  qualityReasons: [],
  blendshapes,
  faceCoverage: 0.2,
  brightness: 0.5,
  contrast: 0.5,
  sharpness: 0.7,
  yaw: 0,
  pitch: 0,
  roll: 0,
  latencyMs: 42,
  capturedAtMs: Date.now(),
  droppedFrames: 0,
  modelVersion: 'test-model',
  pipelineVersion: 'test-pipeline',
  ...overrides,
});

const smile = {
  mouthSmileLeft: 0.95,
  mouthSmileRight: 0.95,
  cheekSquintLeft: 0.75,
  cheekSquintRight: 0.75,
  mouthDimpleLeft: 0.55,
  mouthDimpleRight: 0.55,
};

test('smile with cheek raise ranks happy first', () => {
  const scores = scoreBlendshapes(smile);
  const winner = Object.entries(scores).sort((left, right) => right[1] - left[1])[0][0];
  assert.equal(winner, 'happy');
  assert.ok(scores.happy > 0.55);
});

test('canonical blendshape patterns rank every visual class first', () => {
  const cases = {
    sad: {
      mouthFrownLeft: 0.92,
      mouthFrownRight: 0.92,
      browInnerUp: 0.75,
      eyeBlinkLeft: 0.35,
      eyeBlinkRight: 0.35,
    },
    angry: {
      browDownLeft: 0.95,
      browDownRight: 0.95,
      mouthPressLeft: 0.85,
      mouthPressRight: 0.85,
      noseSneerLeft: 0.55,
      noseSneerRight: 0.55,
    },
    surprised: {
      browInnerUp: 0.85,
      browOuterUpLeft: 0.8,
      browOuterUpRight: 0.8,
      jawOpen: 0.95,
      eyeWideLeft: 0.85,
      eyeWideRight: 0.85,
    },
    disgusted: {
      noseSneerLeft: 0.95,
      noseSneerRight: 0.95,
      mouthUpperUpLeft: 0.85,
      mouthUpperUpRight: 0.85,
      mouthPucker: 0.45,
    },
    fearful: {
      browInnerUp: 0.85,
      browOuterUpLeft: 0.55,
      browOuterUpRight: 0.55,
      eyeWideLeft: 0.95,
      eyeWideRight: 0.95,
      mouthStretchLeft: 0.9,
      mouthStretchRight: 0.9,
      mouthPressLeft: 0.4,
      mouthPressRight: 0.4,
    },
    neutral: {},
  };

  for (const [expected, blendshapes] of Object.entries(cases)) {
    const scores = scoreBlendshapes(blendshapes);
    const winner = Object.entries(scores).sort((left, right) => right[1] - left[1])[0][0];
    assert.equal(winner, expected, `${expected} should rank first: ${JSON.stringify(scores)}`);
  }
});

test('tension is a separate signal and never an expression class', () => {
  const tension = computeTensionSignal({
    browDownLeft: 0.9,
    browDownRight: 0.9,
    mouthPressLeft: 0.8,
    mouthPressRight: 0.8,
  });
  assert.ok(tension > 0.4);
  assert.equal('anxious' in scoreBlendshapes({}), false);
});

test('engine abstains during warm-up and then emits neutral', () => {
  const engine = new ExpressionEngine();
  assert.equal(engine.process(baseFrame()).signalStatus, 'warming_up');
  assert.equal(engine.process(baseFrame()).observedExpression, 'unknown');
  const ready = engine.process(baseFrame());
  assert.equal(ready.signalStatus, 'ready');
  assert.equal(ready.observedExpression, 'neutral');
});

test('one divergent frame cannot switch the stable expression', () => {
  const engine = new ExpressionEngine();
  for (let index = 0; index < 4; index += 1) engine.process(baseFrame());
  const outlier = engine.process(baseFrame(smile));
  assert.notEqual(outlier.observedExpression, 'happy');

  let result = outlier;
  let switchedAt = null;
  for (let index = 2; index <= 8; index += 1) {
    result = engine.process(baseFrame(smile));
    if (result.observedExpression === 'happy' && switchedAt === null) switchedAt = index;
  }
  assert.equal(result.observedExpression, 'happy');
  // A 10 fps, seis updates equivalem ao budget de 600 ms da especificacao.
  assert.ok(switchedAt !== null && switchedAt <= 6, `switch took ${switchedAt} updates`);
});

test('quality rejection always produces unknown', () => {
  const engine = new ExpressionEngine();
  const result = engine.process(
    baseFrame(smile, {
      status: 'insufficient_quality',
      qualityScore: 0.2,
      qualityReasons: ['too_dark'],
    })
  );
  assert.equal(result.observedExpression, 'unknown');
  assert.equal(result.signalConfidence, 0);
  assert.deepEqual(result.qualityReasons, ['too_dark']);
});

test('calibration only learns after an explicit request', () => {
  const engine = new ExpressionEngine();
  assert.equal(engine.getCalibrationState().complete, false);
  engine.beginCalibration();
  for (let index = 0; index < 10; index += 1) {
    engine.process(baseFrame({ mouthFrownLeft: 0.25, mouthFrownRight: 0.25 }));
  }
  assert.equal(engine.getCalibrationState().complete, true);
  assert.ok(engine.exportBaseline());
});
