import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { detectCrisis, normalizeCrisisText } from '../src/chat/crisis.ts';

// Mesmos casos de api/tests/test_crisis_third_person.py: os dois detectores
// precisam concordar.
const cases = JSON.parse(
  readFileSync(new URL('../../api/tests/fixtures/crisis_cases.json', import.meta.url), 'utf8'),
);

test('crise em 3ª pessoa (cuidador falando de alguém) dispara', () => {
  const missed = cases.risk.filter((m) => detectCrisis(m) !== 'risk');
  assert.deepEqual(missed, [], `falsos negativos: ${missed.join(' | ')}`);
});

test('frases do dia a dia não disparam', () => {
  const wrong = cases.safe.filter((m) => detectCrisis(m) !== 'none');
  assert.deepEqual(wrong, [], `falsos positivos: ${wrong.join(' | ')}`);
});

test('normalização tira acento, caixa e espaços extras', () => {
  assert.equal(normalizeCrisisText('Ela  AMEAÇOU   se matar'), 'ela ameacou se matar');
  assert.equal(detectCrisis('NÃO QUER MAIS VIVER'), 'risk');
});
