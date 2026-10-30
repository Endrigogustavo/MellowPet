// Deep links dos widgets: cada URL que o módulo nativo emite precisa levar a
// algum lugar (antes care/agenda/tools/settings, tool?action= e playlist?id=
// eram ignorados). Rodar: cd app; node --no-warnings --test --experimental-strip-types tests/*.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import { WIDGET_SCREENS, parseWidgetLink } from '../src/navigation/deepLinks.ts';
import { SCREEN_ACCESS } from '../src/navigation/navModel.ts';

const W = 'mellowpet://widget/';

test('open?screen= aceita as telas que os widgets emitem, dos dois perfis', () => {
  for (const screen of ['home', 'tools', 'routine', 'music', 'dashboard', 'spotifyplayer', 'settings', 'care', 'agenda']) {
    assert.deepEqual(parseWidgetLink(`${W}open?screen=${screen}`), { kind: 'open', screen });
  }
});

test('open?screen= recusa tela desconhecida, fluxo de entrada e tela com efeito ao montar', () => {
  for (const screen of ['naoexiste', 'onboarding', 'caresignup', 'login', 'caretools', '__proto__', '']) {
    assert.equal(parseWidgetLink(`${W}open?screen=${screen}`), null, screen);
  }
});

test('toda tela de widget existe no mapa de acesso', () => {
  for (const screen of WIDGET_SCREENS) assert.ok(screen in SCREEN_ACCESS, screen);
});

test('tool?action= leva à tela da ferramenta; desconhecida cai em Ferramentas', () => {
  assert.deepEqual(parseWidgetLink(`${W}tool?action=breathe`), { kind: 'tool', tool: 'breathe', screen: 'home' });
  assert.deepEqual(parseWidgetLink(`${W}tool?action=ground`), { kind: 'tool', tool: 'ground', screen: 'tools' });
  assert.deepEqual(parseWidgetLink(`${W}tool?action=sos`), { kind: 'tool', tool: 'sos', screen: 'sos' });
  assert.deepEqual(parseWidgetLink(`${W}tool?action=chat`), { kind: 'tool', tool: 'chat', screen: 'chat' });
  assert.deepEqual(parseWidgetLink(`${W}tool?action=constructor`), { kind: 'open', screen: 'tools' });
});

test('playlist?id= abre o detalhe; id estranho cai na Música', () => {
  assert.deepEqual(parseWidgetLink(`${W}playlist?id=3f2a-b9`), { kind: 'playlist', id: '3f2a-b9' });
  assert.deepEqual(parseWidgetLink(`${W}playlist?id=../x`), { kind: 'open', screen: 'music' });
  assert.deepEqual(parseWidgetLink(`${W}playlist`), { kind: 'open', screen: 'music' });
});

test('care?action= só aceita os três cuidados do pet', () => {
  assert.deepEqual(parseWidgetLink(`${W}care?action=feed`), { kind: 'care', action: 'feed' });
  assert.deepEqual(parseWidgetLink(`${W}care?action=hack`), { kind: 'care', action: null });
});

test('URLs que não são de widget (ou o spotify, tratado à parte) não são lidas aqui', () => {
  assert.equal(parseWidgetLink('mellowpet://spotify-callback?code=1'), null);
  assert.equal(parseWidgetLink(`${W}spotify?action=next`), null);
  assert.equal(parseWidgetLink('https://example.com'), null);
});
