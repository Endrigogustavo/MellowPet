import assert from 'node:assert/strict';
import test from 'node:test';

import { visionFps } from '../src/vision/fpsPolicy.ts';

const ok = { base: 5, battery: 0.8, charging: false, lowPowerMode: false, thermal: 0 };

test('aparelho normal usa a taxa base', () => {
  assert.deepEqual(visionFps(ok), { fps: 5, reason: null });
});

test('bateria baixa reduz; carregando não', () => {
  assert.equal(visionFps({ ...ok, battery: 0.1 }).fps, 1);
  assert.equal(visionFps({ ...ok, battery: 0.25 }).fps, 2);
  assert.equal(visionFps({ ...ok, battery: 0.1, charging: true }).fps, 5);
  assert.equal(visionFps({ ...ok, lowPowerMode: true }).fps, 2);
});

test('calor reduz e, grave, pausa', () => {
  assert.equal(visionFps({ ...ok, thermal: 1 }).fps, 2);
  assert.equal(visionFps({ ...ok, thermal: 2 }).fps, 2);
  assert.equal(visionFps({ ...ok, thermal: 3 }).fps, 0);
  assert.equal(visionFps({ ...ok, thermal: 5, charging: true }).fps, 0);
});

test('estado desconhecido não penaliza', () => {
  assert.equal(visionFps({ ...ok, battery: null, thermal: null }).fps, 5);
});
