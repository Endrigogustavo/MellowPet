// Banca de revisão — SOS/WhatsApp, encontros, refeições e crescimento.
import assert from 'node:assert/strict';
import test from 'node:test';

import { phoneDigits, sosText, whatsappLink } from '../src/integrations/sos.ts';
import { ENCOUNTER_COOLDOWN_MS, acceptEncounter, buildCard, parseCard } from '../src/pet/encounterPayload.ts';
import { MEALS_PER_DAY, mealsLeft, registerMeal } from '../src/pet/feeding.ts';
import { grewUp, growthProgress, stageForDays } from '../src/pet/growth.ts';

// ── SOS ────────────────────────────────────────────────────────────────────
test('sos: formatos brasileiros comuns viram 55+DDD+número', () => {
  assert.equal(phoneDigits('(11) 98765-4321'), '5511987654321');
  assert.equal(phoneDigits('11 3456-7890'), '551134567890');
  assert.equal(phoneDigits('+55 11 98765-4321'), '5511987654321');
});

test('sos: e-mail, nome e número curto não viram link', () => {
  assert.equal(phoneDigits('ana@email.com'), null);
  assert.equal(phoneDigits('Ana'), null);
  assert.equal(phoneDigits('188'), null);
  assert.equal(whatsappLink('Ana', 'oi'), null);
});

test('sos: número com 0 de longa distância (011 ...) precisa virar 5511...', () => {
  assert.equal(phoneDigits('011 98765-4321'), '5511987654321');
});

test('sos: prefixo internacional 00 (0055 ...) precisa virar 55...', () => {
  assert.equal(phoneDigits('0055 11 98765-4321'), '5511987654321');
});

test('sos: texto e link — localização só quando enviada, tudo codificado', () => {
  assert.doesNotMatch(sosText(null), /maps/);
  const t = sosText({ latitude: -23.5505199, longitude: -46.6333094 });
  assert.match(t, /q=-23\.55052,-46\.63331$/);
  const link = whatsappLink('(11) 98765-4321', t);
  assert.ok(link.startsWith('https://wa.me/5511987654321?text='));
  assert.doesNotMatch(link.split('?text=')[1], /[\s&?#]/);
  assert.equal(decodeURIComponent(link.split('?text=')[1]), t);
});

// ── Encontros ──────────────────────────────────────────────────────────────
const TOKEN = 'a1b2c3d4-e5f6';

test('encontro: entradas hostis são recusadas', () => {
  const ok = { v: 1, petName: 'Bolinha', petType: 'cat', stage: 'jovem', token: TOKEN };
  const bad = [
    '[]', 'null', '"x"', '1', '{', 'x'.repeat(600),
    JSON.stringify({ ...ok, v: 2 }),
    JSON.stringify({ ...ok, v: '1' }),
    JSON.stringify({ ...ok, petType: 'dragon' }),
    JSON.stringify({ ...ok, petType: '__proto__' }),
    JSON.stringify({ ...ok, stage: 'idoso' }),
    JSON.stringify({ ...ok, token: 'curto' }),
    JSON.stringify({ ...ok, token: 'a b c d e f g h' }),
    JSON.stringify({ ...ok, token: 'x'.repeat(65) }),
    JSON.stringify({ ...ok, petName: 123 }),
  ];
  for (const raw of bad) assert.equal(parseCard(raw), null, raw.slice(0, 60));
});

test('encontro: campos extras (emoção, id) são descartados', () => {
  const card = parseCard(JSON.stringify({ v: 1, petName: 'Bolinha', petType: 'cat', stage: 'jovem', token: TOKEN, emotion: 'sad', userId: 'u1' }));
  assert.deepEqual(Object.keys(card).sort(), ['petName', 'petType', 'stage', 'token', 'v']);
});

test('encontro: nome vazio/só controle vira "Amigo"; controle é removido', () => {
  assert.equal(parseCard(buildCard('\u0000\u0007  ', 'cat', 'jovem', TOKEN)).petName, 'Amigo');
  assert.equal(parseCard(buildCard('Bo\nli\tnha', 'cat', 'jovem', TOKEN)).petName, 'Bolinha');
});

test('encontro: nome não pode carregar override bidi / zero-width (spoof no balão)', () => {
  const card = parseCard(JSON.stringify({ v: 1, petName: 'Bo‮ahnil​', petType: 'cat', stage: 'jovem', token: TOKEN }));
  assert.doesNotMatch(card.petName, /[​-‏‪-‮⁦-⁩]/);
});

test('encontro: corte em 24 não pode partir emoji ao meio (UTF-16 malformado)', () => {
  const card = parseCard(JSON.stringify({ v: 1, petName: `${'a'.repeat(23)}🐶`, petType: 'cat', stage: 'jovem', token: TOKEN }));
  assert.ok(card.petName.isWellFormed(), JSON.stringify(card.petName));
});

test('encontro: próprio token, cooldown e limite exato', () => {
  const card = parseCard(buildCard('Rex', 'dog', 'filhote', TOKEN));
  assert.equal(acceptEncounter(card, TOKEN, new Map(), 0).accepted, false);
  const seen = new Map([[TOKEN, 1_000]]);
  assert.equal(acceptEncounter(card, 'outro', seen, 1_000 + ENCOUNTER_COOLDOWN_MS - 1).accepted, false);
  const r = acceptEncounter(card, 'outro', seen, 1_000 + ENCOUNTER_COOLDOWN_MS);
  assert.equal(r.accepted, true);
  assert.equal(seen.get(TOKEN), 1_000, 'mapa original não é mutado');
  assert.equal(r.seen.get(TOKEN), 1_000 + ENCOUNTER_COOLDOWN_MS);
});

// ── Refeições ──────────────────────────────────────────────────────────────
test('refeições: virada de dia zera e registro de outro dia não conta', () => {
  let r = null;
  for (let i = 0; i < MEALS_PER_DAY; i++) r = registerMeal(r, '2026-10-22');
  assert.equal(registerMeal(r, '2026-10-22'), null);
  assert.equal(mealsLeft(r, '2026-10-23'), MEALS_PER_DAY);
  assert.deepEqual(registerMeal(r, '2026-10-23'), { day: '2026-10-23', count: 1 });
});

// ── Crescimento ────────────────────────────────────────────────────────────
test('crescimento: progresso e cerimônia nas fronteiras', () => {
  assert.deepEqual(growthProgress(0), { stage: 'filhote', next: 'jovem', remaining: 7, fraction: 0 });
  assert.deepEqual(growthProgress(7), { stage: 'jovem', next: 'adulto', remaining: 23, fraction: 0 });
  assert.deepEqual(growthProgress(500), { stage: 'adulto', next: null, remaining: 0, fraction: 1 });
  assert.equal(grewUp(6, 7), 'jovem');
  assert.equal(grewUp(29, 30), 'adulto');
  assert.equal(grewUp(30, 6), null, 'contagem que cai não dispara cerimônia');
  assert.equal(stageForDays(6.9), 'filhote');
});
