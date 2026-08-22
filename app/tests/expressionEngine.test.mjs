import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeTensionSignal,
  EXPRESSION_CLASSIFIER_VERSION,
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

test('adversarial cross-class patterns preserve the coherent expression', () => {
  const cases = [
    {
      name: 'angry with mouth-smile contamination',
      expected: 'angry',
      blendshapes: {
        browDownLeft: 0.96,
        browDownRight: 0.92,
        mouthPressLeft: 0.88,
        mouthPressRight: 0.82,
        noseSneerLeft: 0.62,
        noseSneerRight: 0.58,
        eyeSquintLeft: 0.68,
        eyeSquintRight: 0.65,
        mouthSmileLeft: 0.48,
        mouthSmileRight: 0.43,
      },
    },
    {
      name: 'happy with moderate brow noise',
      expected: 'happy',
      blendshapes: {
        ...smile,
        browDownLeft: 0.32,
        browDownRight: 0.28,
        mouthPressLeft: 0.22,
        mouthPressRight: 0.2,
      },
    },
    {
      name: 'surprised with mouth-stretch contamination',
      expected: 'surprised',
      blendshapes: {
        browInnerUp: 0.86,
        browOuterUpLeft: 0.82,
        browOuterUpRight: 0.79,
        jawOpen: 0.94,
        eyeWideLeft: 0.9,
        eyeWideRight: 0.87,
        mouthStretchLeft: 0.36,
        mouthStretchRight: 0.34,
      },
    },
    {
      name: 'fearful with partially open jaw',
      expected: 'fearful',
      blendshapes: {
        browInnerUp: 0.88,
        browOuterUpLeft: 0.62,
        browOuterUpRight: 0.59,
        eyeWideLeft: 0.94,
        eyeWideRight: 0.91,
        mouthStretchLeft: 0.91,
        mouthStretchRight: 0.88,
        mouthPressLeft: 0.48,
        mouthPressRight: 0.45,
        jawOpen: 0.32,
      },
    },
    {
      name: 'disgusted with brow-down contamination',
      expected: 'disgusted',
      blendshapes: {
        noseSneerLeft: 0.96,
        noseSneerRight: 0.91,
        mouthUpperUpLeft: 0.89,
        mouthUpperUpRight: 0.84,
        mouthPucker: 0.52,
        browDownLeft: 0.46,
        browDownRight: 0.42,
        mouthPressLeft: 0.28,
        mouthPressRight: 0.26,
      },
    },
    {
      name: 'sad with weak smile noise',
      expected: 'sad',
      blendshapes: {
        mouthFrownLeft: 0.86,
        mouthFrownRight: 0.82,
        browInnerUp: 0.76,
        mouthLowerDownLeft: 0.58,
        mouthLowerDownRight: 0.55,
        eyeBlinkLeft: 0.4,
        eyeBlinkRight: 0.38,
        mouthSmileLeft: 0.18,
        mouthSmileRight: 0.16,
      },
    },
  ];

  for (const { name, expected, blendshapes } of cases) {
    const scores = scoreBlendshapes(blendshapes);
    const ranking = Object.entries(scores).sort((left, right) => right[1] - left[1]);
    assert.equal(ranking[0][0], expected, `${name}: ${JSON.stringify(scores)}`);
    assert.ok(ranking[0][1] - ranking[1][1] >= 0.08, `${name} has weak margin: ${JSON.stringify(scores)}`);
  }
});

test('low blendshape noise and an isolated unilateral smile remain neutral', () => {
  const noise = scoreBlendshapes({
    browDownLeft: 0.06,
    browInnerUp: 0.05,
    mouthSmileLeft: 0.07,
    mouthFrownRight: 0.06,
    eyeWideLeft: 0.05,
  });
  assert.equal(Object.entries(noise).sort((left, right) => right[1] - left[1])[0][0], 'neutral');
  assert.ok(noise.neutral > 0.8);

  const unilateral = scoreBlendshapes({ mouthSmileLeft: 0.95, mouthSmileRight: 0.04 });
  assert.equal(Object.entries(unilateral).sort((left, right) => right[1] - left[1])[0][0], 'neutral');
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
  assert.match(ready.pipelineVersion, new RegExp(`${EXPRESSION_CLASSIFIER_VERSION}$`));
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

test('strong but contradictory fear and surprise evidence abstains instead of guessing', () => {
  const engine = new ExpressionEngine();
  const ambiguous = {
    browInnerUp: 0.85,
    browOuterUpLeft: 0.75,
    browOuterUpRight: 0.75,
    eyeWideLeft: 0.9,
    eyeWideRight: 0.9,
    jawOpen: 0.72,
    mouthStretchLeft: 0.78,
    mouthStretchRight: 0.78,
    mouthPressLeft: 0.4,
    mouthPressRight: 0.4,
  };

  let result;
  for (let index = 0; index < 6; index += 1) result = engine.process(baseFrame(ambiguous));
  assert.equal(result.observedExpression, 'unknown');
  assert.equal(result.signalStatus, 'uncertain');
  assert.equal(result.signalConfidence, 0);
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
