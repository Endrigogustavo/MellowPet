// Banca de revisão — lógica pura do front do cuidador.
//
// careDashboard.ts tem imports de VALOR sem extensão ('../data/emotions',
// '../theme/palette'), então NÃO pode ser importado direto no Node (dá
// ERR_MODULE_NOT_FOUND). Para testar a lógica de alertas/insight do cuidador
// sem mexer no código de produção, este arquivo registra um hook de resolução
// que acrescenta '.ts' a especificadores relativos sem extensão.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // cai no resolve normal
      }
    }
    return next(specifier, context);
  },
});

const { formatFreshness, isKnownEmotion, safeInsight, signalColor, signalScore } = await import('../src/care/careDashboard.ts');
const { DANGER, OK, WARN } = await import('../src/theme/palette.ts');
const { isCareLinkActive } = await import('../src/care/careLinkLifecycle.ts');
const { auditActionLabel } = await import('../src/care/careAudit.ts');
const { parseDeviceLocalDateTime, validateDateRange, formatInDeviceTimeZone } = await import('../src/care/careDateTime.ts');

const summary = (distribution, events = distribution.reduce((s, r) => s + r.count, 0)) => ({
  events,
  last_event_at: null,
  mean_confidence: 80,
  distribution,
  hourly: [],
  daily: [],
  sources: [],
});

test('cuidador: cor do índice segue as faixas (>=65 ok, >=40 atenção, <40 perigo, sem dado = atenção)', () => {
  assert.equal(signalColor(100), OK);
  assert.equal(signalColor(65), OK);
  assert.equal(signalColor(64), WARN);
  assert.equal(signalColor(40), WARN);
  assert.equal(signalColor(39), DANGER);
  assert.equal(signalColor(0), DANGER);
  assert.equal(signalColor(null), WARN);
});

test('cuidador: insight não conclui nada com 0 ou poucos eventos', () => {
  assert.match(safeInsight(summary([], 0)), /Ainda não há sinais suficientes/);
  assert.match(safeInsight(summary([{ emotion: 'sad', count: 2 }])), /poucos registros/);
});

test('cuidador: predominância de sinais difíceis (>=55%) vira aviso', () => {
  const s = summary([{ emotion: 'sad', count: 6 }, { emotion: 'neutral', count: 4 }]);
  assert.match(safeInsight(s), /predominância de sinais difíceis/);
  assert.match(safeInsight(s), /triste/i);
});

test('cuidador: emoção desconhecida/hostil no topo não quebra o texto', () => {
  const s = summary([{ emotion: '__proto__', count: 5 }]);
  assert.equal(isKnownEmotion('__proto__'), false);
  assert.equal(isKnownEmotion('constructor'), false);
  assert.equal(isKnownEmotion(null), false);
  assert.match(safeInsight(s), /variação emocional/);
});

test('cuidador: índice em faixa de PERIGO não pode vir com texto tranquilizador', () => {
  // 40% tristeza + 60% neutro => signalScore 30 (vermelho), mas safeInsight só
  // avisa a partir de 55% difíceis e devolve o texto neutro "padrão mais frequente".
  const s = summary([{ emotion: 'sad', count: 4 }, { emotion: 'neutral', count: 6 }]);
  const score = signalScore(s);
  assert.equal(signalColor(score), DANGER, `score=${score}`);
  assert.doesNotMatch(
    safeInsight(s),
    /O padrão mais frequente foi/,
    'tela do cuidador mostra número vermelho com mensagem neutra (alerta inconsistente)'
  );
});

test('cuidador: frescor do último registro', () => {
  const now = Date.now();
  assert.equal(formatFreshness(null), 'Sem registros neste período');
  assert.equal(formatFreshness(new Date(now - 30_000).toISOString()), 'Atualizado agora');
  assert.equal(formatFreshness(new Date(now - 10 * 60_000).toISOString()), 'Atualizado há 10 min');
  assert.equal(formatFreshness(new Date(now - 3 * 3_600_000).toISOString()), 'Atualizado há 3 h');
  assert.equal(formatFreshness(new Date(now - 3 * 86_400_000).toISOString()), 'Último registro há 3 dias');
  // relógio adiantado no servidor não vira número negativo
  assert.equal(formatFreshness(new Date(now + 3_600_000).toISOString()), 'Atualizado agora');
});

test('cuidador: data inválida vinda do servidor não pode virar "NaN dias"', () => {
  assert.doesNotMatch(formatFreshness('isso-nao-e-data'), /NaN/);
});

test('cuidador: vínculo com expires_at corrompido NÃO pode ser tratado como ativo (fail-closed)', () => {
  const now = Date.parse('2026-08-28T12:00:00.000Z');
  assert.equal(isCareLinkActive({ id: 'x', expires_at: 'lixo' }, now), false);
});

test('cuidador: auditoria — rótulos com concordância de gênero correta', () => {
  assert.equal(auditActionLabel('public.care_team_members.update'), 'Equipe de cuidado atualizada');
  assert.equal(auditActionLabel('public.care_support_actions.delete'), 'Ação de apoio removida');
});

test('cuidador: auditoria — criação/remoção de vínculo não aparece como "atualizado"', () => {
  assert.notEqual(auditActionLabel('public.caregiver_links.insert'), 'Vínculo de cuidado atualizado');
  assert.notEqual(auditActionLabel('public.caregiver_links.delete'), 'Vínculo de cuidado atualizado');
});

test('cuidador: auditoria — ação desconhecida tem rótulo genérico, sem vazar o nome da tabela', () => {
  const label = auditActionLabel('public.emotion_events.insert');
  assert.equal(label, 'Alteração de cuidado registrada');
  assert.doesNotMatch(label, /emotion_events/);
});

test('cuidador: agenda rejeita 24:00, minuto 60 e espaço duplo', () => {
  assert.ok(parseDeviceLocalDateTime('2026-08-29 24:00').error);
  assert.ok(parseDeviceLocalDateTime('2026-08-29 18:60').error);
  assert.ok(parseDeviceLocalDateTime('2026-08-29  18:30').error);
  assert.ok(parseDeviceLocalDateTime('  2026-08-29 18:30  ').iso, 'espaços nas pontas são tolerados');
});

test('cuidador: intervalo com início inválido não pode passar como válido', () => {
  assert.notEqual(validateDateRange('lixo', '2026-08-29T18:00:00.000Z'), null);
  assert.equal(formatInDeviceTimeZone('lixo'), 'Data não disponível');
});
