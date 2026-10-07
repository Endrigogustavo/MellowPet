import assert from 'node:assert/strict';
import test from 'node:test';

import { toApiHistory } from '../src/chat/chatClient.ts';

test('chat history maps local bot turns to the API assistant role', () => {
  assert.deepEqual(toApiHistory([
    { role: 'user', content: 'oi' },
    { role: 'bot', content: 'olá' },
  ]), [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'olá' },
  ]);
});
