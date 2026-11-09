// Contrato de navegação do MellowPet.
//
// ATENÇÃO: estes testes FALHAM até o módulo puro `src/navigation/navModel.ts`
// existir (tarefa do Agente G). Eles descrevem o comportamento CORRETO desejado,
// não o atual. Hoje a lógica de histórico mora no reducer de
// `src/state/AppContext.tsx` (NO_HISTORY, actions.back/goTab) e o guard só de
// sessão em `src/navigation/RootNavigator.tsx` (PUBLIC_SCREENS); não há guard por
// perfil. Problemas que motivam cada caso: docs/ux/problemas-navegacao.md.
//
// Rodar: cd app; node --no-warnings --test --experimental-strip-types tests/*.test.mjs
//
// API esperada de navModel.ts:
//   type Role = 'user' | 'care'
//   canAccess(screen, { authed, role }): boolean
//   homeFor(role, authed): string            ('login' | 'care' | 'home')
//   pushHistory(history, from, to): string[] (sem NO_HISTORY, sem duplicar topo, máx. 30)
//   popHistory(history, role, authed): { screen, history }
//   TAB_ROOTS_USER, TAB_ROOTS_CARE, SCREEN_ACCESS
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

let nav = null;
let loadError = null;
try {
  nav = await import('../src/navigation/navModel.ts');
} catch (error) {
  loadError = error;
}

/** Falha com mensagem clara enquanto o módulo não existe. */
function model() {
  assert.ok(nav, `src/navigation/navModel.ts ainda não existe ou não carrega (Agente G): ${loadError?.message ?? ''}`);
  return nav;
}

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

// Lista real de telas, lida do tipo `Screen` em AppContext.tsx.
const appContext = src('state/AppContext.tsx');
const screenUnion = appContext.slice(appContext.indexOf('export type Screen ='), appContext.indexOf(';', appContext.indexOf('export type Screen =')));
const ALL_SCREENS = [...screenUnion.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

// Classificação desejada (quem DEVE poder abrir cada tela).
const PUBLIC = ['splash', 'login'];
const USER_ONLY = [
  'onboarding', 'home', 'tools', 'routine', 'music', 'playlisteditor', 'playlistdetail', 'spotifyimport',
  'spotifyplayer', 'checkin', 'heatmap', 'friends', 'fairness', 'lullaby', 'sos', 'caremirror', 'groups',
  'crisisplan', 'wardrobe', 'guide', 'plans', 'vision', 'caredcare', 'acceptinvite',
];
const CARE_ONLY = [
  'caresignup', 'care', 'carealerts', 'careaudit', 'careplan', 'careguide', 'agenda', 'caretools',
  'carehistory', 'carenotes', 'carealertrules', 'carenotify',
];
const BOTH = ['dashboard', 'settings', 'chat'];

const USER = { authed: true, role: 'user' };
const CARE = { authed: true, role: 'care' };
const ANON = { authed: false, role: null };

test('lista de telas lida do código está completa (sanidade do próprio teste)', () => {
  assert.equal(ALL_SCREENS.length, 41, `telas: ${ALL_SCREENS}`);
  const classified = [...PUBLIC, ...USER_ONLY, ...CARE_ONLY, ...BOTH].sort();
  assert.deepEqual(classified, [...ALL_SCREENS].sort());
});

// ---------------------------------------------------------------- SCREEN_ACCESS
test('SCREEN_ACCESS cobre exatamente as telas do tipo Screen', () => {
  const { SCREEN_ACCESS } = model();
  assert.deepEqual(Object.keys(SCREEN_ACCESS).sort(), [...ALL_SCREENS].sort());
});

test('SCREEN_ACCESS cobre exatamente o mapa SCREENS do RootNavigator', () => {
  const { SCREEN_ACCESS } = model();
  const root = src('navigation/RootNavigator.tsx');
  const block = root.slice(root.indexOf('const SCREENS'), root.indexOf('};', root.indexOf('const SCREENS')));
  const keys = [...block.matchAll(/^\s+([a-z]+):/gm)].map((m) => m[1]);
  assert.deepEqual(Object.keys(SCREEN_ACCESS).sort(), keys.sort());
});

test('SCREEN_ACCESS classifica cada tela com o perfil correto', () => {
  const { SCREEN_ACCESS } = model();
  for (const s of PUBLIC) assert.equal(SCREEN_ACCESS[s], 'public', s);
  for (const s of USER_ONLY) assert.equal(SCREEN_ACCESS[s], 'user', s);
  for (const s of CARE_ONLY) assert.equal(SCREEN_ACCESS[s], 'care', s);
  for (const s of BOTH) assert.equal(SCREEN_ACCESS[s], 'both', s);
});

// -------------------------------------------------------------------- canAccess
test('sem sessão só abre telas públicas (splash e login)', () => {
  const { canAccess } = model();
  for (const s of ALL_SCREENS) assert.equal(canAccess(s, ANON), PUBLIC.includes(s), s);
});

test('sem sessão, mesmo com role "lembrado", nada autenticado abre', () => {
  const { canAccess } = model();
  for (const s of [...USER_ONLY, ...CARE_ONLY, ...BOTH]) {
    assert.equal(canAccess(s, { authed: false, role: 'user' }), false, `user/${s}`);
    assert.equal(canAccess(s, { authed: false, role: 'care' }), false, `care/${s}`);
  }
});

test('cuidador não abre telas só de usuário (Home do pet, câmera, música, SOS pessoal...)', () => {
  const { canAccess } = model();
  for (const s of USER_ONLY) assert.equal(canAccess(s, CARE), false, s);
});

test('usuário não abre telas só de cuidador (painel, alertas, agenda, convites...)', () => {
  const { canAccess } = model();
  for (const s of CARE_ONLY) assert.equal(canAccess(s, USER), false, s);
});

test('cada perfil abre as próprias telas e as compartilhadas', () => {
  const { canAccess } = model();
  for (const s of [...USER_ONLY, ...BOTH]) assert.equal(canAccess(s, USER), true, `user/${s}`);
  for (const s of [...CARE_ONLY, ...BOTH]) assert.equal(canAccess(s, CARE), true, `care/${s}`);
});

test('tela desconhecida nunca é acessível', () => {
  const { canAccess } = model();
  assert.equal(canAccess('naoexiste', USER), false);
  assert.equal(canAccess('naoexiste', CARE), false);
  assert.equal(canAccess('naoexiste', ANON), false);
});

test('autenticado com role nulo (perfil ainda não carregado) não abre telas de perfil', () => {
  const { canAccess } = model();
  for (const s of [...USER_ONLY, ...CARE_ONLY]) assert.equal(canAccess(s, { authed: true, role: null }), false, s);
});

// ----------------------------------------------------------------------- homeFor
test('homeFor: login sem sessão, care para cuidador, home para usuário', () => {
  const { homeFor } = model();
  assert.equal(homeFor(null, false), 'login');
  assert.equal(homeFor('user', false), 'login');
  assert.equal(homeFor('care', false), 'login');
  assert.equal(homeFor('user', true), 'home');
  assert.equal(homeFor('care', true), 'care');
});

test('homeFor devolve sempre uma tela que o próprio perfil pode abrir (sem loop de redirecionamento)', () => {
  const { homeFor, canAccess } = model();
  for (const [role, authed] of [[null, false], ['user', false], ['care', false], ['user', true], ['care', true]]) {
    assert.equal(canAccess(homeFor(role, authed), { authed, role }), true, `${role}/${authed}`);
  }
});

// ------------------------------------------------------------------- tab roots
test('TAB_ROOTS_USER e TAB_ROOTS_CARE batem com as abas da TabBar', () => {
  const { TAB_ROOTS_USER, TAB_ROOTS_CARE } = model();
  const tabBar = src('components/TabBar.tsx');
  const keys = (name) => {
    const start = tabBar.indexOf(`const ${name}`);
    const block = tabBar.slice(start, tabBar.indexOf('];', start));
    return [...block.matchAll(/\['([a-z]+)', '[^']+'\]/g)].map((m) => m[1]);
  };
  assert.deepEqual([...TAB_ROOTS_USER], keys('USER_TABS'));
  assert.deepEqual([...TAB_ROOTS_CARE], keys('CARE_TABS'));
});

test('toda raiz de aba é acessível ao perfil dela e a home do perfil é uma raiz', () => {
  const { TAB_ROOTS_USER, TAB_ROOTS_CARE, canAccess, homeFor } = model();
  for (const s of TAB_ROOTS_USER) assert.equal(canAccess(s, USER), true, s);
  for (const s of TAB_ROOTS_CARE) assert.equal(canAccess(s, CARE), true, s);
  assert.ok(TAB_ROOTS_USER.includes(homeFor('user', true)));
  assert.ok(TAB_ROOTS_CARE.includes(homeFor('care', true)));
});

test('raízes de abas são separadas por perfil (o "Voltar" do título não pode usar a união)', () => {
  const { TAB_ROOTS_USER, TAB_ROOTS_CARE } = model();
  // Só 'dashboard' é compartilhada (Bem-estar / Dados).
  assert.deepEqual(TAB_ROOTS_USER.filter((s) => TAB_ROOTS_CARE.includes(s)), ['dashboard']);
});

// ------------------------------------------------------------------ pushHistory
test('pushHistory empilha a tela de origem', () => {
  const { pushHistory } = model();
  assert.deepEqual(pushHistory([], 'tools', 'sos'), ['tools']);
  assert.deepEqual(pushHistory(['tools'], 'sos', 'crisisplan'), ['tools', 'sos']);
});

test('pushHistory não empilha telas de NO_HISTORY (splash, login, onboarding, caresignup)', () => {
  const { pushHistory } = model();
  for (const from of ['splash', 'login', 'onboarding', 'caresignup']) {
    assert.deepEqual(pushHistory(['home'], from, 'settings'), ['home'], from);
  }
});

test('pushHistory não duplica o topo', () => {
  const { pushHistory } = model();
  assert.deepEqual(pushHistory(['home', 'settings'], 'settings', 'friends'), ['home', 'settings']);
});

test('pushHistory ignora navegação para a mesma tela', () => {
  const { pushHistory } = model();
  assert.deepEqual(pushHistory(['home'], 'playlistdetail', 'playlistdetail'), ['home']);
});

test('pushHistory limita a pilha a 30 entradas, descartando as mais antigas', () => {
  const { pushHistory } = model();
  let h = [];
  const seq = ['home', 'settings', 'friends', 'groups'];
  for (let i = 0; i < 80; i += 1) h = pushHistory(h, `${seq[i % 4]}`, seq[(i + 1) % 4]);
  assert.ok(h.length <= 30, `tamanho ${h.length}`);
  // A mais recente fica no topo.
  assert.equal(h[h.length - 1], seq[79 % 4]);
});

test('pushHistory é puro (não altera o array recebido)', () => {
  const { pushHistory } = model();
  const h = Object.freeze(['home']);
  const out = pushHistory(h, 'settings', 'friends');
  assert.deepEqual(h, ['home']);
  assert.notEqual(out, h);
});

// ------------------------------------------------------------------- popHistory
test('popHistory volta para a tela anterior e encurta a pilha', () => {
  const { popHistory } = model();
  assert.deepEqual(popHistory(['tools', 'sos'], 'user', true), { screen: 'sos', history: ['tools'] });
  assert.deepEqual(popHistory(['tools'], 'user', true), { screen: 'tools', history: [] });
});

test('popHistory com pilha vazia vai para a home do perfil', () => {
  const { popHistory } = model();
  assert.deepEqual(popHistory([], 'user', true), { screen: 'home', history: [] });
  assert.deepEqual(popHistory([], 'care', true), { screen: 'care', history: [] });
});

test('popHistory pula entradas que o perfil não pode abrir', () => {
  const { popHistory } = model();
  // Cuidador com pilha "contaminada" por deep link/notificação de usuário.
  assert.deepEqual(popHistory(['care', 'home', 'music'], 'care', true), { screen: 'care', history: [] });
  // Usuário com pilha contaminada por notificação care_alert.
  assert.deepEqual(popHistory(['home', 'carealerts'], 'user', true), { screen: 'home', history: [] });
  // Tudo inválido → home do perfil.
  assert.deepEqual(popHistory(['carealerts', 'agenda'], 'user', true), { screen: 'home', history: [] });
});

test('popHistory pula telas de NO_HISTORY que tenham escapado para a pilha', () => {
  const { popHistory } = model();
  assert.deepEqual(popHistory(['home', 'login', 'onboarding'], 'user', true), { screen: 'home', history: [] });
});

test('voltar após logout nunca devolve uma tela autenticada', () => {
  const { popHistory } = model();
  // Pilha de antes do logout ainda presente (ex.: SIGNED_OUT chegou com a pilha cheia).
  assert.deepEqual(popHistory(['home', 'settings', 'friends'], 'user', false), { screen: 'login', history: [] });
  assert.deepEqual(popHistory(['care', 'carealerts'], 'care', false), { screen: 'login', history: [] });
  assert.deepEqual(popHistory([], null, false), { screen: 'login', history: [] });
});

test('popHistory é puro e repetido esvazia a pilha sem loop', () => {
  const { popHistory } = model();
  const start = Object.freeze(['home', 'heatmap', 'checkin', 'heatmap']);
  let h = start;
  const visited = [];
  for (let i = 0; i < 10 && h.length > 0; i += 1) {
    const r = popHistory(h, 'user', true);
    visited.push(r.screen);
    assert.ok(r.history.length < h.length, 'cada voltar encurta a pilha');
    h = r.history;
  }
  assert.equal(h.length, 0);
  assert.deepEqual(start, ['home', 'heatmap', 'checkin', 'heatmap']);
});

test('troca de perfil (mesma pilha) respeita o perfil novo', () => {
  const { popHistory } = model();
  // Login de um cuidador num aparelho em que um usuário deixou pilha (sem reset completo).
  const r = popHistory(['home', 'tools', 'sos'], 'care', true);
  assert.equal(r.screen, 'care');
});

// ----------------------------------------- integração esperada (código atual)
// Os testes abaixo leem o código de produção e passam a valer quando o
// navModel estiver ligado ao app. Hoje falham de propósito.
test('RootNavigator usa canAccess (guard por perfil, não só por sessão)', () => {
  const root = src('navigation/RootNavigator.tsx');
  assert.match(root, /canAccess\(/, 'RootNavigator ainda só tem PUBLIC_SCREENS');
});

test('AppContext usa pushHistory/popHistory do navModel', () => {
  assert.match(appContext, /pushHistory\(/);
  assert.match(appContext, /popHistory\(/);
});

test('"Voltar" do título usa as raízes do perfil atual, não a união das duas TabBars', () => {
  const ui = src('components/ui.tsx');
  assert.doesNotMatch(ui, /const TAB_ROOTS = \['home', 'tools', 'routine', 'music', 'dashboard', 'care'/);
});

test('fluxos que terminam (salvar/cancelar/excluir) voltam com back()/goTab, não empilham a raiz', () => {
  const offenders = [];
  for (const [file, target] of [
    ['screens/PlaylistEditorScreen.tsx', 'music'],
    ['screens/PlaylistDetailScreen.tsx', 'music'],
    ['screens/SpotifyImportScreen.tsx', 'music'],
    ['screens/LullabyScreen.tsx', 'home'],
    ['screens/VisionScreen.tsx', 'home'],
  ]) {
    if (src(file).includes(`actions.go('${target}')`)) offenders.push(`${file} → go('${target}')`);
  }
  assert.deepEqual(offenders, []);
});

test('logout limpa o destino pendente de notificação (pendingScreen)', () => {
  const signOut = appContext.slice(appContext.indexOf('subscribeToSignOut(() =>'), appContext.indexOf('[]', appContext.indexOf('subscribeToSignOut(() =>')));
  assert.match(signOut, /pendingScreen\.current = null/);
});
