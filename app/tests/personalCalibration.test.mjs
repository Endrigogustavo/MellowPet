import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyGains,
  DEFAULT_GAINS,
  learnFromCheckin,
  learnFromFeedback,
  MAX_GAIN,
  MIN_GAIN,
  parseGains,
} from '../src/vision/personalCalibration.ts';

test('"não" deixa o motor mais exigente com aquela emoção', () => {
  const g = learnFromFeedback(DEFAULT_GAINS, 'angry', 'no');
  assert.ok(g.angry < 1);
  assert.equal(g.happy, 1);
  assert.equal(g.samples, 1);
});

test('"não sei" e neutro não ensinam nada', () => {
  assert.equal(learnFromFeedback(DEFAULT_GAINS, 'angry', 'unsure'), DEFAULT_GAINS);
  assert.equal(learnFromFeedback(DEFAULT_GAINS, 'neutral', 'no'), DEFAULT_GAINS);
});

test('nenhuma sequência passa dos limites', () => {
  let g = DEFAULT_GAINS;
  for (let i = 0; i < 200; i++) g = learnFromFeedback(g, 'sad', 'no');
  assert.equal(g.sad, MIN_GAIN);
  for (let i = 0; i < 500; i++) g = learnFromFeedback(g, 'happy', 'yes');
  assert.equal(g.happy, MAX_GAIN);
});

test('check-in divergente move as duas emoções', () => {
  const g = learnFromCheckin(DEFAULT_GAINS, 'sad', 'neutral');
  assert.equal(g.neutral, undefined);
  assert.ok(g.sad > 1);
  const g2 = learnFromCheckin(DEFAULT_GAINS, 'sad', 'angry');
  assert.ok(g2.angry < 1 && g2.sad > 1);
  assert.equal(learnFromCheckin(DEFAULT_GAINS, 'sad', 'sad'), DEFAULT_GAINS);
});

test('ganhos mudam a distribuição e ela continua somando 1', () => {
  const scores = { happy: 0.3, sad: 0.3, angry: 0.2, surprised: 0.05, disgusted: 0.05, fearful: 0.05, neutral: 0.05 };
  const g = { ...DEFAULT_GAINS, angry: 0.6 };
  const out = applyGains(scores, g);
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(out.angry < scores.angry);
});

test('armazenamento corrompido volta ao padrão sem quebrar', () => {
  assert.deepEqual(parseGains('lixo'), DEFAULT_GAINS);
  assert.equal(parseGains(JSON.stringify({ sad: 99, samples: 3 })).sad, MAX_GAIN);
});
