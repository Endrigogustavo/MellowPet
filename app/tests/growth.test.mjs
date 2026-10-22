import assert from 'node:assert/strict';
import test from 'node:test';

import { growthProgress, grewUp, localDay, stageForDays } from '../src/pet/growth.ts';

test('limites dos estágios', () => {
  assert.equal(stageForDays(0), 'filhote');
  assert.equal(stageForDays(6), 'filhote');
  assert.equal(stageForDays(7), 'jovem');
  assert.equal(stageForDays(29), 'jovem');
  assert.equal(stageForDays(30), 'adulto');
  assert.equal(stageForDays(-3), 'filhote');
});

test('progresso dentro do estágio', () => {
  assert.deepEqual(growthProgress(3), { stage: 'filhote', next: 'jovem', remaining: 4, fraction: 3 / 7 });
  assert.equal(growthProgress(18).remaining, 12);
  assert.equal(growthProgress(40).next, null);
});

test('só sobe, nunca regride', () => {
  assert.equal(grewUp(6, 7), 'jovem');
  assert.equal(grewUp(29, 30), 'adulto');
  assert.equal(grewUp(7, 6), null);
  assert.equal(grewUp(8, 9), null);
});

test('dia local, não UTC', () => {
  assert.equal(localDay(new Date(2026, 9, 22, 23, 50)), '2026-10-22');
});
