import assert from 'node:assert/strict';
import test from 'node:test';

import { acceptEncounter, buildCard, ENCOUNTER_COOLDOWN_MS, parseCard } from '../src/pet/encounterPayload.ts';

const TOKEN = 'a1b2c3d4-e5f6';

test('o cartão vai e volta sem perder nada', () => {
  const card = parseCard(buildCard('Bolinha', 'cat', 'jovem', TOKEN));
  assert.deepEqual(card, { v: 1, petName: 'Bolinha', petType: 'cat', stage: 'jovem', token: TOKEN });
});

test('o cartão não carrega emoção nem identidade', () => {
  const keys = Object.keys(JSON.parse(buildCard('Bolinha', 'cat', 'jovem', TOKEN))).sort();
  assert.deepEqual(keys, ['petName', 'petType', 'stage', 'token', 'v']);
});

test('rejeita entrada malformada ou hostil', () => {
  assert.equal(parseCard('não é json'), null);
  assert.equal(parseCard(JSON.stringify({ v: 2, petName: 'x', petType: 'cat', stage: 'jovem', token: TOKEN })), null);
  assert.equal(parseCard(JSON.stringify({ v: 1, petName: 'x', petType: 'dragão', stage: 'jovem', token: TOKEN })), null);
  assert.equal(parseCard(JSON.stringify({ v: 1, petName: 'x', petType: 'cat', stage: 'velho', token: TOKEN })), null);
  assert.equal(parseCard(JSON.stringify({ v: 1, petName: 'x', petType: 'cat', stage: 'jovem', token: '<script>' })), null);
  assert.equal(parseCard('x'.repeat(600)), null);
});

test('nome é limpo e limitado', () => {
  const card = parseCard(buildCard('\u0007' + 'A'.repeat(40), 'seal', 'filhote', TOKEN));
  assert.equal(card.petName.length, 24);
  assert.ok(!card.petName.includes('\u0007'));
  assert.equal(parseCard(buildCard('   ', 'seal', 'filhote', TOKEN)).petName, 'Amigo');
});

test('mesmo pet não visita de novo dentro do intervalo', () => {
  const card = parseCard(buildCard('Bolinha', 'cat', 'jovem', TOKEN));
  const first = acceptEncounter(card, 'meu-token-123', new Map(), 1000);
  assert.equal(first.accepted, true);
  assert.equal(acceptEncounter(card, 'meu-token-123', first.seen, 1000 + 60_000).accepted, false);
  assert.equal(acceptEncounter(card, 'meu-token-123', first.seen, 1000 + ENCOUNTER_COOLDOWN_MS).accepted, true);
});

test('o próprio pet não conta como visita', () => {
  const card = parseCard(buildCard('Eu', 'seal', 'jovem', TOKEN));
  assert.equal(acceptEncounter(card, TOKEN, new Map(), 0).accepted, false);
});
