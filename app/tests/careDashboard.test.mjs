import assert from 'node:assert/strict';
import test from 'node:test';

import { signalScore } from '../src/care/careMetrics.ts';

const summary = (distribution, events = distribution.reduce((sum, item) => sum + item.count, 0)) => ({
  events,
  last_event_at: null,
  mean_confidence: 80,
  distribution,
  hourly: [],
  daily: [],
  sources: [],
});

test('care summary refuses to score a tiny sample', () => {
  assert.equal(signalScore(summary([{ emotion: 'happy', count: 2 }], 2)), null);
});

test('care summary does not classify surprise as a positive wellbeing signal', () => {
  const neutral = signalScore(summary([{ emotion: 'neutral', count: 3 }]));
  const surprised = signalScore(summary([{ emotion: 'surprised', count: 3 }]));
  assert.equal(neutral, 50);
  assert.equal(surprised, 50);
});

test('care summary lowers the score for difficult-signal patterns', () => {
  const difficult = summary([{ emotion: 'sad', count: 5 }, { emotion: 'neutral', count: 1 }]);
  assert.ok(signalScore(difficult) < 40);
});

test('care summary keeps no-data distinct from a neutral result', () => {
  assert.equal(signalScore(summary([], 0)), null);
  assert.equal(signalScore(summary([], 3)), null);
  assert.equal(signalScore(summary([{ emotion: 'neutral', count: 3 }])), 50);
});

test('care summary uses only happy as a positive signal', () => {
  assert.equal(signalScore(summary([{ emotion: 'happy', count: 3 }])), 100);
  assert.equal(signalScore(summary([{ emotion: 'surprised', count: 3 }])), 50);
});

test('care summary bounds difficult-signal scores and weighs all observed samples', () => {
  assert.equal(signalScore(summary([{ emotion: 'fearful', count: 3 }])), 0);
  const mixed = signalScore(summary([{ emotion: 'happy', count: 3 }, { emotion: 'sad', count: 1 }]));
  assert.equal(mixed, 75);
});
