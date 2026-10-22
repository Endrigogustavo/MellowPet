import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeGroups, personalAgreement } from '../src/vision/fairness.ts';

test('concordância pessoal ignora check-ins sem leitura', () => {
  const r = personalAgreement([
    { said: 'happy', seen: 'happy' },
    { said: 'sad', seen: 'neutral' },
    { said: 'neutral', seen: 'neutral' },
    { said: 'angry', seen: null },
  ]);
  assert.equal(r.overall.samples, 3);
  assert.equal(r.overall.agree, 2);
  assert.equal(r.byEmotion.neutral.samples, 2);
  assert.equal(r.byEmotion.neutral.rate, 0.5);
  assert.equal(personalAgreement([]).overall.rate, null);
});

test('grupos abaixo de k somem mesmo se o servidor mandar', () => {
  const out = analyzeGroups([
    { attribute: 'oculos', grp: 'sim', users: 4, samples: 100, agree: 10 },
    { attribute: 'oculos', grp: 'nao', users: 9, samples: 100, agree: 80 },
  ]);
  assert.deepEqual(
    out.map((g) => g.grp),
    ['nao']
  );
});

test('grupo bem abaixo dos outros do mesmo atributo é sinalizado', () => {
  const out = analyzeGroups([
    { attribute: 'oculos', grp: 'sim', users: 6, samples: 100, agree: 55 },
    { attribute: 'oculos', grp: 'nao', users: 12, samples: 200, agree: 160 },
    { attribute: 'barba', grp: 'sim', users: 5, samples: 10, agree: 1 },
    { attribute: 'barba', grp: 'nao', users: 8, samples: 60, agree: 48 },
  ]);
  const get = (a, g) => out.find((r) => r.attribute === a && r.grp === g);
  assert.equal(get('oculos', 'sim').flagged, true);
  assert.equal(get('oculos', 'nao').flagged, false);
  // Amostra pequena não sinaliza: oscila demais.
  assert.equal(get('barba', 'sim').thin, true);
  assert.equal(get('barba', 'sim').flagged, false);
});
