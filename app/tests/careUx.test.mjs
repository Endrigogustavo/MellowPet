import assert from 'node:assert/strict';
import test from 'node:test';

import { dayLabel, groupNotesByDay, localDayKey, normalizeNoteRow, recentDayOptions, wasEdited } from '../src/care/careNotes.ts';
import { clampRule, describeAlertRule, formatWindow, sensitivityHint, validateAlertRule } from '../src/care/careAlertRules.ts';
import {
  bucketLabel,
  bucketStart,
  describeHistory,
  expectedBuckets,
  fallbackHours,
  fillHistory,
  historyFromDaily,
  historyTrend,
} from '../src/care/careHistory.ts';
import {
  buildWeeklyInput,
  lastCompleteWeekStart,
  parseDigest,
  serializeDigest,
  weekLabel,
  weekStartOf,
  weeklyCacheKey,
} from '../src/care/careWeeklyDigest.ts';
import { inviteStatus, personStatus, relevantInvite, timeAgo } from '../src/care/carePanel.ts';
import { inQuietHours, normalizeTime, quietSummary, shiftTime } from '../src/care/careNotifyPrefs.ts';
import { defaultSlot, futureError, withDate, withTime } from '../src/care/careDateTime.ts';

const DEFAULT_RULE = { enabled: true, min_readings: 3, window_minutes: 90, emotions: ['sad', 'angry', 'fearful', 'disgusted'] };

// ── anotações ────────────────────────────────────────────────────────────────
const note = (id, day, created) => ({
  id,
  body: id,
  note_day: day,
  created_at: created,
  updated_at: null,
  cared_user_id: 'c',
  caregiver_link_id: 'l',
  author_id: 'a',
});

test('anotações: agrupadas por dia, dia e nota mais recentes primeiro', () => {
  const groups = groupNotesByDay([
    note('a', '2026-10-28', '2026-10-28T10:00:00Z'),
    note('b', '2026-10-30', '2026-10-30T09:00:00Z'),
    note('c', '2026-10-28', '2026-10-28T20:00:00Z'),
  ]);
  assert.deepEqual(groups.map((g) => g.day), ['2026-10-30', '2026-10-28']);
  assert.deepEqual(groups[1].notes.map((n) => n.id), ['c', 'a']);
});

test('anotações: linha antiga sem note_day usa o dia local de created_at', () => {
  const created = new Date(2026, 9, 29, 23, 30).toISOString();
  const row = normalizeNoteRow({ id: '1', body: 'oi', created_at: created, caregiver_user_id: 'me' }, 'link-1');
  assert.equal(row.note_day, '2026-10-29');
  assert.equal(row.caregiver_link_id, 'link-1');
  assert.equal(row.author_id, 'me');
  assert.equal(normalizeNoteRow({ id: '2', body: 'x', created_at: created, note_day: '2026-10-01' }, 'l').note_day, '2026-10-01');
  assert.equal(normalizeNoteRow({ id: '3' }, 'l'), null);
});

test('anotações: rótulos de dia e opções dos últimos dias', () => {
  const now = new Date(2026, 9, 30, 15, 0);
  assert.equal(dayLabel('2026-10-30', now), 'Hoje');
  assert.equal(dayLabel('2026-10-29', now), 'Ontem');
  assert.match(dayLabel('2026-10-27', now), /27\/10$/);
  const days = recentDayOptions(3, now);
  assert.deepEqual(days, ['2026-10-30', '2026-10-29', '2026-10-28']);
  assert.equal(localDayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(wasEdited({ created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T10:00:20Z' }), false);
  assert.equal(wasEdited({ created_at: '2026-10-30T10:00:00Z', updated_at: '2026-10-30T12:00:00Z' }), true);
});

// ── regras de alerta ─────────────────────────────────────────────────────────
test('regra de alerta: frase humana do padrão', () => {
  assert.equal(describeAlertRule(DEFAULT_RULE), 'Avisar quando houver 3 leituras difíceis em 90 minutos.');
  assert.match(describeAlertRule({ ...DEFAULT_RULE, emotions: ['sad', 'fearful'] }), /Contam como difíceis: tristeza e medo\./);
  assert.match(describeAlertRule({ ...DEFAULT_RULE, enabled: false }), /desligados/);
  assert.equal(formatWindow(120), '2 horas');
  assert.equal(formatWindow(150), '2 h 30 min');
  assert.equal(formatWindow(60), '1 hora');
  assert.equal(formatWindow(45), '45 minutos');
});

test('regra de alerta: limites do banco e validação', () => {
  const clamped = clampRule({ ...DEFAULT_RULE, min_readings: 40, window_minutes: 5, emotions: ['fearful', 'sad', 'sad'] });
  assert.equal(clamped.min_readings, 10);
  assert.equal(clamped.window_minutes, 30);
  assert.deepEqual(clamped.emotions, ['sad', 'fearful']);
  assert.match(validateAlertRule({ ...DEFAULT_RULE, emotions: [] }), /ao menos uma/);
  assert.equal(validateAlertRule(DEFAULT_RULE), null);
  assert.match(sensitivityHint({ ...DEFAULT_RULE, min_readings: 5 }, DEFAULT_RULE), /exigente/);
  assert.match(sensitivityHint({ ...DEFAULT_RULE, min_readings: 2 }, DEFAULT_RULE), /sensível/);
  assert.equal(sensitivityHint(DEFAULT_RULE, DEFAULT_RULE), null);
});

// ── histórico ────────────────────────────────────────────────────────────────
test('histórico: períodos esperados por granularidade', () => {
  const now = new Date(2026, 9, 30, 10); // sexta
  assert.equal(expectedBuckets('day', 14, now).length, 14);
  assert.equal(expectedBuckets('day', 14, now).at(-1), '2026-10-30');
  const weeks = expectedBuckets('week', 12, now);
  assert.equal(weeks.at(-1), '2026-10-26');
  assert.equal(weeks[0], '2026-08-10');
  assert.deepEqual(expectedBuckets('month', 3, now), ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.equal(bucketStart('2026-11-01', 'week'), '2026-10-26');
});

test('histórico: preenche buracos e agrega a reserva do resumo diário', () => {
  const now = new Date(2026, 9, 30, 10);
  const filled = fillHistory([{ bucket: '2026-10-29', total: 4, pleasant: 1, neutral: 1, difficult: 2, top_emotion: 'sad' }], 'day', 3, now);
  assert.deepEqual(filled.map((b) => b.total), [0, 4, 0]);
  const weekly = historyFromDaily(
    [
      { at: '2026-10-26T00:00:00+00:00', count: 3, pleasant: 1, neutral: 1, difficult: 1 },
      { at: '2026-10-27T00:00:00+00:00', count: 5 },
    ],
    'week',
    2,
    now
  );
  assert.equal(weekly[1].total, 8);
  assert.equal(weekly[1].neutral, 6);
  assert.equal(fallbackHours('month', 6), 2160);
});

test('histórico: tendência e descrição acessível com os números', () => {
  const b = (bucket, total, difficult) => ({ bucket, total, pleasant: total - difficult, neutral: 0, difficult, top_emotion: null });
  const up = historyTrend([b('1', 10, 1), b('2', 10, 1), b('3', 10, 6), b('4', 10, 7)]);
  assert.equal(up.kind, 'up');
  assert.equal(historyTrend([b('1', 10, 6), b('2', 10, 6), b('3', 10, 1), b('4', 10, 1)]).kind, 'down');
  assert.equal(historyTrend([b('1', 0, 0), b('2', 10, 1)]).kind, 'few');
  const text = describeHistory([b('2026-10-29', 0, 0), b('2026-10-30', 4, 1)], 'day');
  assert.match(text, /29\/10: sem leituras/);
  assert.match(text, /30\/10: 4 leituras, 25% difícil/);
  assert.equal(bucketLabel('2026-10-01', 'month'), 'out');
});

// ── resumo semanal ───────────────────────────────────────────────────────────
test('resumo semanal: semana completa anterior, rótulo e chave de cache', () => {
  const now = new Date(2026, 9, 30, 10); // sexta 30/10
  assert.equal(weekStartOf(now), '2026-10-26');
  assert.equal(lastCompleteWeekStart(now), '2026-10-19');
  assert.equal(weekStartOf(new Date(2026, 10, 1, 9)), '2026-10-26'); // domingo
  assert.equal(weekLabel('2026-10-19'), '19 a 25/10');
  assert.equal(weekLabel('2026-10-26'), '26/10 a 01/11');
  assert.equal(weeklyCacheKey('ab-12', '2026-10-19'), 'mellowpet.care.digest.ab-12.2026-10-19');
  assert.doesNotMatch(weeklyCacheKey('a/b c', '2026'), /[ /]/);
});

test('resumo semanal: entrada só com agregados dos 7 dias da semana', () => {
  const input = buildWeeklyInput(
    [
      { at: '2026-10-18T00:00:00Z', count: 9, pleasant: 9 },
      { at: '2026-10-19T00:00:00Z', count: 4, pleasant: 1, neutral: 1, difficult: 2 },
      { at: '2026-10-25T00:00:00Z', count: 3 },
      { at: '2026-10-26T00:00:00Z', count: 5 },
    ],
    '2026-10-19',
    2,
    '  mãe  '
  );
  assert.deepEqual(input.days.map((d) => d.day), ['2026-10-19', '2026-10-25']);
  assert.equal(input.days[1].neutral, 3);
  assert.equal(input.days[0].total, 4);
  assert.equal(input.open_alerts, 2);
  assert.equal(input.relationship, 'mãe');
});

test('resumo semanal: cache só vale para a mesma semana e com texto', () => {
  const raw = serializeDigest('2026-10-19', { text: 'Semana tranquila.', provider: 'gemini' });
  assert.equal(parseDigest(raw, '2026-10-19').text, 'Semana tranquila.');
  assert.equal(parseDigest(raw, '2026-10-26'), null);
  assert.equal(serializeDigest('2026-10-19', { text: null, provider: 'none' }), null);
  assert.equal(parseDigest('{oops', '2026-10-19'), null);
});

// ── painel ───────────────────────────────────────────────────────────────────
test('painel: estado curto da pessoa e "há X min"', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const base = { paused: false, loading: false, failed: false, events: 12, score: 70, lastEventAt: '2026-10-30T11:50:00Z', openRequests: 0, openAlerts: 0 };
  assert.deepEqual(personStatus(base, now), { text: 'índice 70 · há 10 min', tone: 'ok' });
  assert.equal(personStatus({ ...base, paused: true, openRequests: 1 }, now).text, 'pediu contato');
  assert.equal(personStatus({ ...base, paused: true }, now).text, 'compartilhamento pausado');
  assert.equal(personStatus({ ...base, openAlerts: 2 }, now).text, '2 alertas abertos');
  assert.equal(personStatus({ ...base, events: 0 }, now).text, 'sem leituras em 7 dias');
  assert.equal(personStatus({ ...base, failed: true }, now).tone, 'neutral');
  assert.equal(timeAgo('2026-10-28T12:00:00Z', now), 'há 2 dias');
  assert.equal(timeAgo(null, now), null);
});

test('painel: status do convite', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  assert.match(inviteStatus({ status: 'pending', expires_at: '2026-11-01T12:00:00Z' }, now).text, /2 dias/);
  assert.equal(inviteStatus({ status: 'pending', expires_at: '2026-10-29T12:00:00Z' }, now).kind, 'expired');
  assert.equal(inviteStatus({ status: 'accepted', accepted_at: '2026-10-30T11:00:00Z' }, now).text, 'Convite aceito há 1 h');
  assert.equal(inviteStatus({ status: 'pending', revoked_at: '2026-10-30T11:00:00Z' }, now).kind, 'revoked');
  const old = { status: 'accepted', accepted_at: '2026-10-01T00:00:00Z' };
  const waiting = { status: 'pending', expires_at: '2026-11-01T12:00:00Z' };
  assert.equal(relevantInvite([old, waiting], now), waiting);
  assert.equal(relevantInvite([old], now), null);
});

// ── notificações ─────────────────────────────────────────────────────────────
test('notificações: horários e silêncio noturno', () => {
  assert.equal(normalizeTime('22:00:00'), '22:00');
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(shiftTime('23:30', 60), '00:30');
  assert.equal(shiftTime('00:00', -30), '23:30');
  assert.match(quietSummary('22:00', '07:00'), /agora/);
  assert.match(quietSummary(null, null), /qualquer hora/);
  assert.equal(inQuietHours('23:10', '22:00', '07:00'), true);
  assert.equal(inQuietHours('12:00', '22:00', '07:00'), false);
  assert.equal(inQuietHours('13:00', '12:00', '14:00'), true);
});

// ── agenda ───────────────────────────────────────────────────────────────────
test('agenda: seletor troca dia e hora sem perder o outro', () => {
  const base = defaultSlot(1, 18, new Date(2026, 9, 30, 9));
  assert.equal(base.getDate(), 31);
  assert.equal(base.getHours(), 18);
  const moved = withDate(base, new Date(2026, 10, 3, 7, 15));
  assert.equal(moved.getDate(), 3);
  assert.equal(moved.getHours(), 18);
  const timed = withTime(moved, new Date(2000, 0, 1, 9, 45));
  assert.equal(timed.getDate(), 3);
  assert.equal(timed.getMinutes(), 45);
  assert.match(futureError(new Date(Date.now() - 3_600_000)), /futuro/);
  assert.equal(futureError(new Date(Date.now() + 3_600_000)), null);
});
