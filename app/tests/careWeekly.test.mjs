import assert from 'node:assert/strict';
import test from 'node:test';

import { checkingNudge, valenceBars, weekSummary } from '../src/care/careWeekly.ts';

const day = (i, pleasant, neutral, difficult) => ({
  at: `2026-10-${20 + i}`,
  count: pleasant + neutral + difficult,
  pleasant,
  neutral,
  difficult,
});

test('barras por humor: dia sem uso e dia difícil não ficam iguais', () => {
  const [empty, hard] = valenceBars([day(0, 0, 0, 0), day(1, 0, 1, 9)]);
  assert.equal(empty.total, 0);
  assert.equal(hard.difficult, 0.9);
  assert.equal(hard.total, 10);
});

test('servidor antigo (só volume) vira neutro', () => {
  const [b] = valenceBars([{ at: 'x', count: 5 }]);
  assert.equal(b.neutral, 1);
  assert.equal(b.difficult, 0);
});

test('resumo semanal: três frases e sugestão coerentes', () => {
  const rough = weekSummary({
    name: 'Lia',
    events: 40,
    openAlerts: 1,
    daily: [day(0, 3, 4, 1), day(1, 3, 4, 1), day(2, 1, 2, 5), day(3, 0, 2, 6)],
  });
  assert.equal(rough.sentences.length, 3);
  assert.match(rough.sentences[1], /aumentaram/);
  assert.match(rough.sentences[2], /1 alerta/);
  assert.match(rough.suggestion, /pesada/);

  const calm = weekSummary({ name: 'Lia', events: 40, openAlerts: 0, daily: [day(0, 5, 3, 0), day(1, 6, 2, 0)] });
  assert.match(calm.sentences[0], /agradável/);
  assert.match(calm.suggestion, /melhor parte/);

  assert.match(weekSummary({ name: 'Lia', events: 1, openAlerts: 0, daily: [] }).sentences[0], /Quase não houve/);
});

test('cuidado com quem cuida', () => {
  assert.equal(checkingNudge(3), null);
  assert.match(checkingNudge(14), /14 vezes/);
});
