import assert from 'node:assert/strict';
import test from 'node:test';

import { localDream } from '../src/pet/dream.ts';
import {
  EMPTY_HABITS,
  dismissRitual,
  isUnlocked,
  newlyUnlocked,
  parseHabits,
  personality,
  recordHabit,
  ritualDays,
} from '../src/pet/habits.ts';
import { LULLABY_MS, LULLABY_START, lullabyStep } from '../src/pet/lullaby.ts';
import { pendingRitual, ritualDay } from '../src/pet/rituals.ts';

const day = (n) => `2026-10-${String(n).padStart(2, '0')}`;

function many(h, kind, times, d = day(1)) {
  for (let i = 0; i < times; i++) h = recordHabit(h, kind, d);
  return h;
}

test('hábitos contam por tipo e por dia distinto', () => {
  let h = recordHabit(EMPTY_HABITS, 'night', day(1));
  h = recordHabit(h, 'night', day(1));
  h = recordHabit(h, 'night', day(2));
  assert.equal(h.counts.night, 3);
  assert.deepEqual(h.days.night, [day(1), day(2)]);
  assert.equal(h.daily[day(1)].night, 2);
});

test('o diário por dia guarda só os últimos dias', () => {
  let h = EMPTY_HABITS;
  for (let d = 1; d <= 20; d++) h = recordHabit(h, 'feed', day(d));
  assert.equal(Object.keys(h.daily).length, 8);
  assert.ok(h.daily[day(20)]);
  assert.equal(h.daily[day(1)], undefined);
});

test('cachecol exige 7 noites diferentes, não 7 toques na mesma noite', () => {
  let h = many(EMPTY_HABITS, 'night', 10, day(1));
  assert.equal(isUnlocked(h, 'cachecol'), false);
  for (let d = 2; d <= 6; d++) h = recordHabit(h, 'night', day(d));
  const before = h;
  h = recordHabit(h, 'night', day(7));
  assert.equal(isUnlocked(h, 'cachecol'), true);
  assert.equal(newlyUnlocked(before, h), 'cachecol');
  assert.equal(newlyUnlocked(h, recordHabit(h, 'night', day(8))), null);
});

test('personalidade só aparece com história e reflete o cuidado', () => {
  assert.equal(personality(many(EMPTY_HABITS, 'play', 5)), null);
  assert.deepEqual(personality(many(EMPTY_HABITS, 'play', 20)), ['brincalhao']);
  const mixed = many(many(EMPTY_HABITS, 'play', 10), 'breath', 4);
  assert.deepEqual(personality(mixed), ['brincalhao', 'calmo']);
  // Comer é fácil: muito mais refeições que brincadeiras ainda empata pouco.
  assert.deepEqual(personality(many(many(EMPTY_HABITS, 'feed', 20), 'play', 14)), ['brincalhao', 'guloso']);
});

test('dados corrompidos ou acessório inventado voltam ao vazio', () => {
  assert.deepEqual(parseHabits('{lixo'), EMPTY_HABITS);
  assert.equal(parseHabits(JSON.stringify({ ...EMPTY_HABITS, equipped: 'coroa-de-ouro' })).equipped, null);
  assert.equal(parseHabits(JSON.stringify({ ...EMPTY_HABITS, equipped: 'fones' })).equipped, 'fones');
});

test('rituais: janela, madrugada conta como a noite anterior, feito não volta', () => {
  const morning = new Date(2026, 9, 22, 8, 0);
  const lateNight = new Date(2026, 9, 23, 1, 30);
  const afternoon = new Date(2026, 9, 22, 15, 0);
  assert.equal(ritualDay(lateNight, 'night'), '2026-10-22');
  assert.equal(pendingRitual(afternoon, { morning: [], night: [] }), null);
  assert.equal(pendingRitual(morning, { morning: [], night: [] }), 'morning');
  assert.equal(pendingRitual(morning, { morning: ['2026-10-22'], night: [] }), null);
  assert.equal(pendingRitual(lateNight, { morning: [], night: ['2026-10-22'] }), null);
  const h = dismissRitual(EMPTY_HABITS, 'night', '2026-10-22');
  assert.equal(pendingRitual(lateNight, ritualDays(h)), null);
  assert.equal(h.counts.night, undefined);
});

test('sonho local: estável no mesmo dia e usa o que aconteceu', () => {
  const base = { petName: 'Bolinha', dominant: 'happy', fed: 1, played: 0, breaths: 0, friends: ['Tico'], day: day(5) };
  assert.equal(localDream(base), localDream(base));
  assert.match(localDream(base), /Bolinha/);
  assert.match(localDream(base), /Tico/);
  assert.match(localDream({ ...base, dominant: 'xyz', friends: [] }), /sono calmo/);
});

test('ninar: rosto calmo enche, tensão esvazia, sem rosto pausa', () => {
  const calm = { ready: true, tension: 0.1, expression: 'neutral' };
  const tense = { ready: true, tension: 0.7, expression: 'angry' };
  const away = { ready: false, tension: null, expression: 'neutral' };
  let s = LULLABY_START;
  for (let t = 0; t < 30; t++) s = lullabyStep(s, calm, 1000);
  assert.ok(Math.abs(s.progress - 0.5) < 1e-9);
  const paused = lullabyStep(s, away, 1000);
  assert.equal(paused.progress, s.progress);
  assert.equal(paused.relaxed, null);
  s = lullabyStep(s, tense, 1000);
  assert.ok(Math.abs(s.progress - (0.5 - 2000 / LULLABY_MS)) < 1e-9);
  for (let t = 0; t < 40; t++) s = lullabyStep(s, calm, 1000);
  assert.equal(s.asleep, true);
  assert.equal(lullabyStep(s, tense, 1000), s);
});
