import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// As abas de cada perfil (TabBar.tsx) precisam ter ícone em TAB_ICONS (content.ts).
test('toda aba do usuário e do cuidador tem ícone', () => {
  const tabBar = readFileSync(new URL('../src/components/TabBar.tsx', import.meta.url), 'utf8');
  const content = readFileSync(new URL('../src/data/content.ts', import.meta.url), 'utf8');
  const block = content.slice(content.indexOf('export const TAB_ICONS'), content.indexOf('};', content.indexOf('export const TAB_ICONS')));
  const keys = [...tabBar.matchAll(/\['([a-z]+)', '[^']+'\]/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10, `abas encontradas: ${keys}`);
  for (const key of keys) assert.ok(block.includes(`  ${key}: '`), `aba "${key}" sem ícone`);
});
