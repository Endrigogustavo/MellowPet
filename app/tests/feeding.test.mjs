import assert from 'node:assert/strict';
import test from 'node:test';

import { MEALS_PER_DAY, mealsLeft, registerMeal } from '../src/pet/feeding.ts';

test('três refeições por dia, a quarta é recusada', () => {
  let r = null;
  for (let i = 0; i < MEALS_PER_DAY; i++) {
    r = registerMeal(r, '2026-10-22');
    assert.ok(r, `refeição ${i + 1}`);
  }
  assert.equal(r.count, 3);
  assert.equal(mealsLeft(r, '2026-10-22'), 0);
  assert.equal(registerMeal(r, '2026-10-22'), null);
});

test('zera no dia seguinte', () => {
  const full = { day: '2026-10-22', count: 3 };
  assert.equal(mealsLeft(full, '2026-10-23'), 3);
  assert.deepEqual(registerMeal(full, '2026-10-23'), { day: '2026-10-23', count: 1 });
});

test('sem registro, dia cheio disponível', () => {
  assert.equal(mealsLeft(null, '2026-10-22'), 3);
});
