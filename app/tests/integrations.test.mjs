import assert from 'node:assert/strict';
import test from 'node:test';

import { dayMoodScores, healthInsights, nextBreak, pearson } from '../src/insights/integrations.ts';

test('humor do dia exige pelo menos 3 leituras', () => {
  const s = dayMoodScores([
    { emotion: 'happy', day: 'a' },
    { emotion: 'happy', day: 'a' },
    { emotion: 'sad', day: 'a' },
    { emotion: 'happy', day: 'b' },
  ]);
  assert.equal(Math.round(s.a * 1000), 333);
  assert.equal(s.b, undefined);
});

test('pearson', () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
});

test('sono só vira frase com 7+ dias e correlação de verdade', () => {
  const days = Array.from({ length: 10 }, (_, i) => ({ day: `d${i}`, sleepMinutes: 300 + i * 20, steps: null }));
  const mood = Object.fromEntries(days.map((d, i) => [d.day, -0.5 + i * 0.1]));
  const out = healthInsights(days, mood);
  assert.equal(out.length, 1);
  assert.equal(out[0].metric, 'sono');
  assert.ok(out[0].r > 0.9);
  assert.deepEqual(healthInsights(days.slice(0, 5), mood), []);
});

test('pausa: primeira folga depois de um bloco de compromissos', () => {
  const h = (x) => x * 3600_000;
  const busy = [
    { start: h(9), end: h(10) },
    { start: h(10), end: h(11.5) },
    { start: h(13), end: h(14) },
  ];
  assert.equal(nextBreak(busy, h(8.5), h(18)), h(11.5));
  assert.equal(nextBreak(busy, h(12), h(18)), h(14));
  assert.equal(nextBreak([], h(9), h(18)), null);
  assert.equal(nextBreak([{ start: h(17), end: h(17.9) }], h(16), h(18)), null);
});

test('SOS: WhatsApp só para telefones, com DDI do Brasil quando falta', async () => {
  const { phoneDigits, sosText, whatsappLink } = await import('../src/integrations/sos.ts');
  assert.equal(phoneDigits('(11) 98765-4321'), '5511987654321');
  assert.equal(phoneDigits('+55 11 98765-4321'), '5511987654321');
  assert.equal(phoneDigits('ana@email.com'), null);
  assert.equal(phoneDigits('Ana'), null);
  assert.match(whatsappLink('11987654321', sosText()), /^https:\/\/wa\.me\/5511987654321\?text=Oi/);
  assert.match(sosText({ latitude: -23.55052, longitude: -46.633308 }), /maps\.google\.com\/\?q=-23\.55052,-46\.63331/);
});
