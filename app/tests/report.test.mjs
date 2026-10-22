import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, reportHtml, summarize } from '../src/reports/therapistReport.ts';

const c = (emotion, note = '', tags = [], sleepQuality = null, day = '2026-10-20') => ({
  emotion,
  note,
  tags,
  sleepQuality,
  createdAt: `${day}T12:00:00.000Z`,
});

test('resumo conta emoções, tags, sono e dias ativos', () => {
  const s = summarize([c('sad', '', ['trabalho'], 2), c('sad', '', ['trabalho', 'sono'], 4, '2026-10-21'), c('happy')]);
  assert.equal(s.total, 3);
  assert.deepEqual(s.emotions[0], ['sad', 2]);
  assert.deepEqual(s.tags[0], ['trabalho', 2]);
  assert.equal(s.sleepAvg, 3);
  assert.equal(s.activeDays, 2);
});

test('anotações só entram com permissão, e sempre escapadas', () => {
  const input = {
    name: 'Ana',
    days: 30,
    checkins: [c('sad', '<script>alert(1)</script> dia ruim')],
    generatedAt: new Date(2026, 9, 22),
  };
  assert.ok(!reportHtml({ ...input, includeNotes: false }).includes('dia ruim'));
  const html = reportHtml({ ...input, includeNotes: true });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});
