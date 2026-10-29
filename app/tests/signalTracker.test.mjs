import assert from 'node:assert/strict';
import test from 'node:test';

import { affectFromScores, labelFor } from '../src/vision/affect.ts';
import { COOLDOWN_MS, SignalTracker } from '../src/vision/signalTracker.ts';

const frame = (atMs, over = {}) => ({ atMs, ready: true, tension: 0.1, blink: 0, yaw: 0, lookOut: 0, ...over });

/** Simula N segundos a 2 quadros/s, com piscadas a cada `blinkEvery` segundos. */
function run(tracker, fromMs, seconds, opts = {}) {
  const fired = [];
  for (let i = 0; i < seconds * 2; i++) {
    const t = fromMs + i * 500;
    const sec = Math.floor(i / 2);
    const blink = opts.blinkEvery && sec % opts.blinkEvery === 0 && i % 2 === 0 ? 0.9 : 0;
    const away = opts.awayPattern ? opts.awayPattern(sec) : false;
    const r = tracker.push(frame(t, { tension: opts.tension ?? 0.1, blink, yaw: away ? 0.45 : 0 }), opts.focus ?? false);
    if (r) fired.push({ kind: r, t });
  }
  return fired;
}

test('tensão por minutos dispara; franzir curto não', () => {
  assert.deepEqual(run(new SignalTracker(), 0, 60, { tension: 0.7, blinkEvery: 4 }), []);
  const fired = run(new SignalTracker(), 0, 200, { tension: 0.7, blinkEvery: 4 });
  assert.equal(fired.filter((f) => f.kind === 'tension').length, 1);
});

test('poucas piscadas por minutos sugere pausa; ritmo normal não', () => {
  assert.equal(run(new SignalTracker(), 0, 300, { blinkEvery: 4 }).length, 0); // 15/min
  const fired = run(new SignalTracker(), 0, 300, { blinkEvery: 20 }); // 3/min
  assert.ok(fired.some((f) => f.kind === 'fatigue'));
});

test('lembrete respeita o intervalo mínimo', () => {
  const tr = new SignalTracker();
  const fired = run(tr, 0, 1200, { blinkEvery: 20 });
  const fat = fired.filter((f) => f.kind === 'fatigue');
  assert.equal(fat.length, 1);
  assert.ok(COOLDOWN_MS.fatigue > 1200 * 1000);
});

test('olhar fora várias vezes só cutuca no modo foco', () => {
  const pattern = (sec) => sec % 20 >= 10 && sec % 20 < 13;
  assert.equal(run(new SignalTracker(), 0, 100, { blinkEvery: 4, awayPattern: pattern }).filter((f) => f.kind === 'gaze').length, 0);
  assert.ok(run(new SignalTracker(), 0, 100, { blinkEvery: 4, awayPattern: pattern, focus: true }).some((f) => f.kind === 'gaze'));
});

test('perder o rosto brevemente preserva a janela; ausência longa (>3s) zera', () => {
  const tr = new SignalTracker();
  run(tr, 0, 200, { blinkEvery: 20 });
  tr.push({ atMs: 200_500, ready: false, tension: null, blink: 0, yaw: 0, lookOut: 0 }, false);
  assert.notEqual(tr.blinkRate(200_500), null);
  tr.push({ atMs: 204_000, ready: false, tension: null, blink: 0, yaw: 0, lookOut: 0 }, false);
  assert.equal(tr.blinkRate(204_000), null);
});

test('círculo de Russell: quadrantes e estados derivados', () => {
  assert.equal(affectFromScores({ happy: 0.8, surprised: 0.2 }).label, 'animado');
  assert.equal(affectFromScores({ happy: 0.5, neutral: 0.5 }).label, 'tranquilo');
  assert.equal(affectFromScores({ angry: 0.6, fearful: 0.4 }).label, 'tenso');
  assert.equal(affectFromScores({ sad: 0.7, neutral: 0.3 }).label, 'cansado');
  assert.equal(affectFromScores({ neutral: 1 }).label, 'entediado');
  assert.equal(labelFor(0, -0.1, 0.3), 'concentrado');
  const a = affectFromScores({});
  assert.equal(a.valence, 0);
});
