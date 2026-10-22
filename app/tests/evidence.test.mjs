import assert from 'node:assert/strict';
import test from 'node:test';

import { EVIDENCE_DRIVERS, explainReading } from '../src/vision/evidence.ts';
import { measureActionUnits, scoreBlendshapes } from '../src/vision/expressionEngine.ts';

/**
 * Cada AU listado como "driver" de uma emoção precisa, de fato, empurrar o
 * score daquela emoção para cima. É isto que impede a explicação de mentir
 * depois que alguém recalibrar as fórmulas do motor.
 *
 * Os blendshapes abaixo são os nomes crus do MediaPipe que alimentam cada AU.
 */
const RAW = {
  smile: ['mouthSmileLeft', 'mouthSmileRight'],
  cheekRaise: ['cheekSquintLeft', 'cheekSquintRight'],
  dimple: ['mouthDimpleLeft', 'mouthDimpleRight'],
  frown: ['mouthFrownLeft', 'mouthFrownRight'],
  browInner: ['browInnerUp'],
  browOuter: ['browOuterUpLeft', 'browOuterUpRight'],
  browDown: ['browDownLeft', 'browDownRight'],
  eyesClosed: ['eyeBlinkLeft', 'eyeBlinkRight'],
  mouthLower: ['mouthLowerDownLeft', 'mouthLowerDownRight'],
  mouthPress: ['mouthPressLeft', 'mouthPressRight'],
  noseWrinkle: ['noseSneerLeft', 'noseSneerRight'],
  eyeSquint: ['eyeSquintLeft', 'eyeSquintRight'],
  jawOpen: ['jawOpen'],
  eyeWide: ['eyeWideLeft', 'eyeWideRight'],
  mouthStretch: ['mouthStretchLeft', 'mouthStretchRight'],
  mouthUpper: ['mouthUpperUpLeft', 'mouthUpperUpRight'],
  mouthPucker: ['mouthPucker'],
};

const raise = (au, value) => Object.fromEntries((RAW[au] ?? []).map((k) => [k, value]));

for (const [emotion, drivers] of Object.entries(EVIDENCE_DRIVERS)) {
  for (const au of drivers) {
    test(`${au} eleva ${emotion} (a explicação não pode citar um sinal que não pesa)`, () => {
      assert.ok(RAW[au], `teste sem mapeamento cru para ${au}`);
      const off = scoreBlendshapes({});
      const on = scoreBlendshapes(raise(au, 0.6));
      assert.ok(
        on[emotion] > off[emotion],
        `${au} listado como driver de ${emotion}, mas o score foi de ${off[emotion]} para ${on[emotion]}`
      );
    });
  }
}

test('um sorriso claro é explicado pelos cantos da boca', () => {
  const aus = measureActionUnits({ ...raise('smile', 0.8), ...raise('cheekRaise', 0.5) });
  const signals = explainReading(aus, 'happy');
  assert.equal(signals[0].label, 'cantos da boca para cima');
  assert.ok(signals.length <= 3);
});

test('leitura neutra não inventa explicação', () => {
  const aus = measureActionUnits(raise('smile', 0.9));
  assert.deepEqual(explainReading(aus, 'neutral'), []);
});

test('sinais abaixo do ruído não são citados', () => {
  const aus = measureActionUnits(raise('frown', 0.02));
  assert.deepEqual(explainReading(aus, 'sad'), []);
});
