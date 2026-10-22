import assert from 'node:assert/strict';
import test from 'node:test';

import { EMA_DEFAULTS, pickEmaTimes, upcomingEmaTimes } from '../src/checkins/ema.ts';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('três horários por dia, dentro da janela e espaçados', () => {
  for (let seed = 1; seed < 200; seed++) {
    const times = pickEmaTimes(new Date(2026, 9, 22, 15), seeded(seed));
    assert.equal(times.length, 3);
    for (const t of times) {
      const h = t.getHours() + t.getMinutes() / 60;
      assert.ok(h >= EMA_DEFAULTS.startHour && h <= EMA_DEFAULTS.endHour, `fora da janela: ${t}`);
    }
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] - times[i - 1] >= EMA_DEFAULTS.minGapMin * 60_000);
    }
  }
});

test('extremos do sorteio continuam respeitando o espaçamento', () => {
  const lo = pickEmaTimes(new Date(2026, 9, 22), () => 0);
  const hi = pickEmaTimes(new Date(2026, 9, 22), () => 1);
  for (const times of [lo, hi]) {
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 90 * 60_000);
  }
});

test('não agenda o que já passou nem para os próximos 10 min', () => {
  const now = new Date(2026, 9, 22, 20, 0);
  const out = upcomingEmaTimes(now, 2, seeded(7));
  assert.ok(out.every((t) => t.getTime() > now.getTime() + 10 * 60_000));
  // O dia seguinte vem inteiro.
  assert.equal(out.filter((t) => t.getDate() === 23).length, 3);
});

test('janela curta demais reduz a quantidade em vez de apertar', () => {
  const times = pickEmaTimes(new Date(2026, 9, 22), seeded(3), { perDay: 5, startHour: 9, endHour: 12, minGapMin: 90 });
  assert.equal(times.length, 2);
});
