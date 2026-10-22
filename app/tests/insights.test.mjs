import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowDivergence } from '../src/insights/divergence.ts';
import { forecastFor, periodOf } from '../src/insights/forecast.ts';

// 2026-10-20 é uma terça.
const at = (day, hour) => new Date(2026, 9, day, hour, 0).getTime();

test('períodos do dia', () => {
  assert.deepEqual([4, 5, 11, 12, 17, 18, 23].map(periodOf), ['noite', 'manha', 'manha', 'tarde', 'tarde', 'noite', 'noite']);
});

test('previsão usa o mesmo dia da semana quando há amostra', () => {
  const events = [];
  // Terças à tarde tensas; outros dias à tarde felizes.
  for (const day of [6, 13, 20]) for (let i = 0; i < 3; i++) events.push({ emotion: i ? 'angry' : 'fearful', at: at(day, 15) });
  for (const day of [7, 8, 9, 10, 11]) for (let i = 0; i < 3; i++) events.push({ emotion: 'happy', at: at(day, 15) });
  const tuesday = forecastFor(new Date(2026, 9, 27), events);
  assert.equal(tuesday.find((p) => p.period === 'tarde').weather, 'tempestade');
  const wednesday = forecastFor(new Date(2026, 9, 28), events);
  // Quarta tem só 3 leituras próprias: usa todos os dias (24 leituras, maioria feliz).
  assert.equal(wednesday.find((p) => p.period === 'tarde').weather, 'nublado');
});

test('sem amostra, sem palpite', () => {
  const f = forecastFor(new Date(2026, 9, 27), [{ emotion: 'sad', at: at(20, 9) }]);
  assert.ok(f.every((p) => p.weather === null));
});

test('divergência: só depois de dizer "bem", com tensão somada, uma vez por dia', () => {
  const base = {
    lastCheckin: { emotion: 'happy', at: at(22, 9) },
    tenseMinutes: 25,
    now: at(22, 12),
    today: '2026-10-22',
    lastShownDay: null,
  };
  assert.equal(shouldShowDivergence(base), true);
  assert.equal(shouldShowDivergence({ ...base, tenseMinutes: 10 }), false);
  assert.equal(shouldShowDivergence({ ...base, lastCheckin: { emotion: 'sad', at: at(22, 9) } }), false);
  assert.equal(shouldShowDivergence({ ...base, now: at(22, 18) }), false);
  assert.equal(shouldShowDivergence({ ...base, lastShownDay: '2026-10-22' }), false);
  assert.equal(shouldShowDivergence({ ...base, lastCheckin: null }), false);
});
