import assert from 'node:assert/strict';
import test from 'node:test';

import { splitAction } from '../src/chat/actions.ts';
import { MAX_NOTES, addNote, extractMemoryRequest, parseNotes } from '../src/chat/memory.ts';

test('ação: etiqueta some do texto e só vale nome conhecido', () => {
  assert.deepEqual(splitAction('Vamos respirar juntos? [[acao:respirar]]'), {
    text: 'Vamos respirar juntos?',
    action: 'respirar',
  });
  assert.deepEqual(splitAction('Oi [[ACAO: musica ]]'), { text: 'Oi', action: 'musica' });
  assert.deepEqual(splitAction('Oi [[acao:apagar_tudo]]'), { text: 'Oi', action: null });
});

test('ação: etiqueta pela metade no streaming não aparece', () => {
  assert.deepEqual(splitAction('Que tal respirar? [[acao:resp'), { text: 'Que tal respirar?', action: null });
});

test('memória: só pedidos explícitos viram nota', () => {
  assert.equal(extractMemoryRequest('Mellow, lembra que eu tenho prova na sexta.'), 'eu tenho prova na sexta');
  assert.equal(extractMemoryRequest('lembre-se de que minha gata se chama Luna'), 'minha gata se chama Luna');
  assert.equal(extractMemoryRequest('anota: gosto de chá de camomila'), 'gosto de chá de camomila');
  assert.equal(extractMemoryRequest('não esqueça que eu odeio segundas'), 'eu odeio segundas');
  assert.equal(extractMemoryRequest('hoje lembrei da minha avó'), null);
  assert.equal(extractMemoryRequest('estou triste'), null);
});

test('memória: sem repetição e com limite', () => {
  let notes = [];
  for (let i = 0; i < 12; i++) notes = addNote(notes, `nota ${i}`);
  assert.equal(notes.length, MAX_NOTES);
  assert.equal(notes[0], 'nota 4');
  notes = addNote(notes, 'NOTA 11');
  assert.equal(notes.filter((n) => n.toLowerCase() === 'nota 11').length, 1);
  assert.deepEqual(parseNotes('lixo'), []);
  assert.deepEqual(parseNotes(JSON.stringify(['a', 3, null, 'b'])), ['a', 'b']);
});

test('diário: sugere tags pelo texto, sem repetir as já marcadas', async () => {
  const { suggestTags } = await import('../src/checkins/tagSuggest.ts');
  assert.deepEqual(suggestTags('Dormi mal e o chefe cobrou o prazo do projeto'), ['trabalho', 'sono']);
  assert.deepEqual(suggestTags('Saí com os amigos, vimos um filme'), ['amizades', 'lazer']);
  assert.deepEqual(suggestTags('Briguei com minha mãe', ['familia']), []);
  assert.deepEqual(suggestTags('nada demais hoje'), []);
  assert.deepEqual(suggestTags('Estou com dor de cabeça'), ['saude']);
});
