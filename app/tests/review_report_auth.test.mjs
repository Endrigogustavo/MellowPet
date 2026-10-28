// Banca de revisão — relatório PDF (escape HTML, contagens) e regras de senha do cadastro.
//
// O fuso é fixado em São Paulo ANTES de qualquer Date, para o teste de "dias
// ativos" ser determinístico em qualquer máquina.
process.env.TZ = 'America/Sao_Paulo';

import assert from 'node:assert/strict';
import test from 'node:test';

const { escapeHtml, reportHtml, summarize } = await import('../src/reports/therapistReport.ts');
const { checkPassword, confirmError } = await import('../src/auth/passwordRules.ts');

const c = (emotion, createdAt, note = '', tags = []) => ({ emotion, note, tags, sleepQuality: null, createdAt });

test('relatório: escapeHtml cobre os 5 caracteres e & primeiro', () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&amp;</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;amp;&lt;/a&gt;');
});

test('relatório: nome, emoção desconhecida, tag e nota hostis saem escapados', () => {
  const html = reportHtml({
    name: '<script>alert(1)</script>',
    days: 7,
    checkins: [c('<img src=x onerror=alert(1)>', '2026-10-20T15:00:00.000Z', '"><svg onload=alert(1)>', ['<b>tag</b>'])],
    includeNotes: true,
    generatedAt: new Date('2026-10-21T12:00:00Z'),
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<svg/);
  assert.doesNotMatch(html, /<b>tag<\/b>/);
});

test('relatório: sem permissão, nenhuma anotação entra (nem a seção)', () => {
  const html = reportHtml({
    name: 'Ana', days: 7, includeNotes: false, generatedAt: new Date(),
    checkins: [c('sad', '2026-10-20T15:00:00.000Z', 'segredo íntimo')],
  });
  assert.doesNotMatch(html, /segredo/);
  assert.doesNotMatch(html, /Anotações/);
});

test('relatório: período vazio mostra a linha "Sem check-ins"', () => {
  const html = reportHtml({ name: 'Ana', days: 7, includeNotes: true, generatedAt: new Date(), checkins: [] });
  assert.match(html, /Sem check-ins no período/);
  assert.match(html, /0 check-ins em 0 dias/);
});

test('relatório: "dias diferentes" conta o dia LOCAL, não o dia UTC', () => {
  // Ambos são 20/10 em Brasília: 10:00 e 23:30 (= 02:30Z do dia 21).
  const s = summarize([c('sad', '2026-10-20T13:00:00.000Z'), c('sad', '2026-10-21T02:30:00.000Z')]);
  assert.equal(s.activeDays, 1);
});

// ── Senha (cadastro/login) ────────────────────────────────────────────────
test('senha: exigências individuais', () => {
  const ids = (p) => checkPassword(p).checks.filter((x) => !x.passed).map((x) => x.id);
  assert.deepEqual(ids('abc1'), ['length']);
  assert.deepEqual(ids('97531864'), ['letter']);
  assert.deepEqual(ids('abcdefgh'), ['number']);
  assert.ok(ids('senha123').includes('common'));
  assert.ok(ids('Password1').includes('common'));
  assert.ok(ids('!!mellowpet2026!!').includes('common'));
  assert.equal(checkPassword('').label, '');
});

test('senha: senha boa que só CONTÉM palavra comum passa; 12+ é forte', () => {
  assert.equal(checkPassword('Mellow2026forte').valid, true);
  assert.equal(checkPassword('Mellow2026forte').label, 'Senha forte');
  assert.equal(checkPassword('gato-azul-7').label, 'Senha boa');
});

test('senha: confirmação', () => {
  assert.equal(confirmError('abc', ''), null);
  assert.equal(confirmError('abc', 'abd'), 'As senhas não são iguais.');
  assert.equal(confirmError('abc', 'abc'), null);
});
