import assert from 'node:assert/strict';
import test from 'node:test';

import { HeartGate, RppgBuffer, SHOW_CONFIDENCE } from '../src/vision/rppg.ts';

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Pele sintética: cor de base, deriva lenta de luz, pulso na direção típica
 * de sangue na pele (mais forte no verde) e ruído de câmera. Quadros com
 * intervalo irregular (8–12 fps), como a câmera real entrega.
 */
function feed(buffer, { bpm, seconds = 20, noise = 0.6, pulse = 0.8, seed = 1 }) {
  const rand = rng(seed);
  let t = 0;
  while (t < seconds * 1000) {
    const s = t / 1000;
    const light = 1 + 0.03 * Math.sin(2 * Math.PI * 0.1 * s);
    const p = pulse * Math.sin(2 * Math.PI * (bpm / 60) * s);
    const n = () => (rand() - 0.5) * 2 * noise;
    buffer.push({
      t,
      rgb: [180 * light + 0.33 * p + n(), 120 * light + 0.77 * p + n(), 100 * light + 0.53 * p + n()],
    });
    t += 80 + rand() * 45;
  }
}

test('encontra o batimento num sinal limpo', () => {
  for (const bpm of [55, 72, 96, 130]) {
    const b = new RppgBuffer();
    feed(b, { bpm, noise: 0.2, seed: bpm });
    const e = b.estimate();
    assert.ok(e, `sem estimativa para ${bpm}`);
    assert.ok(Math.abs(e.bpm - bpm) <= 3, `esperava ~${bpm}, veio ${e.bpm}`);
    assert.ok(e.confidence >= SHOW_CONFIDENCE, `confiança baixa ${e.confidence} em ${bpm}`);
  }
});

test('ruído forte ainda acerta o bpm, mesmo sem confiança para exibir', () => {
  const b = new RppgBuffer();
  feed(b, { bpm: 72, noise: 0.6, seed: 72 });
  assert.ok(Math.abs(b.estimate().bpm - 72) <= 3);
});

/** Alimenta a câmera por `seconds` e passa uma estimativa a cada 2 s pela porta. */
function gated(opts) {
  const rand = rng(opts.seed);
  const b = new RppgBuffer();
  const gate = new HeartGate();
  const shown = [];
  let t = 0;
  let nextEstimate = 2000;
  while (t < opts.seconds * 1000) {
    const s = t / 1000;
    const p = opts.pulse * Math.sin(2 * Math.PI * (opts.bpm / 60) * s);
    const n = () => (rand() - 0.5) * 2 * opts.noise;
    b.push({ t, rgb: [180 + 0.33 * p + n(), 120 + 0.77 * p + n(), 100 + 0.53 * p + n()] });
    if (t >= nextEstimate) {
      nextEstimate += 2000;
      const v = gate.push(b.estimate());
      if (v !== null) shown.push(v);
    }
    t += 80 + rand() * 45;
  }
  return shown;
}

test('só ruído nunca vira número na tela', () => {
  for (let seed = 1; seed <= 30; seed++) {
    assert.deepEqual(gated({ seed, bpm: 72, pulse: 0, noise: 1.2, seconds: 60 }), [], `seed ${seed}`);
  }
});

test('pulso estável aparece e fica perto do real', () => {
  const shown = gated({ seed: 4, bpm: 68, pulse: 0.8, noise: 0.2, seconds: 40 });
  assert.ok(shown.length > 0);
  assert.ok(shown.every((v) => Math.abs(v - 68) <= 3), shown.join(','));
});

test('precisa de pelo menos 12 s contínuos', () => {
  const b = new RppgBuffer();
  feed(b, { bpm: 72, seconds: 8 });
  assert.equal(b.estimate(), null);
});

test('rosto sumido recomeça a janela', () => {
  const b = new RppgBuffer();
  feed(b, { bpm: 72 });
  b.push({ t: 20_100, rgb: null });
  assert.equal(b.spanMs(), 0);
  assert.equal(b.estimate(), null);
});
