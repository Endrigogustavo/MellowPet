import assert from 'node:assert/strict';
import test from 'node:test';

import { parseLegacyIndex, parseLegacyItem } from '../src/vision/visionQueueLegacy.ts';

test('legacy queue migration accepts valid entries and rejects malformed ones', () => {
  const index = parseLegacyIndex(JSON.stringify([
    { id: 'event_1', createdAtMs: 123 },
    { id: 4, createdAtMs: 456 },
    { id: 'event_2', createdAtMs: 'bad' },
  ]));
  assert.deepEqual(index, [{ id: 'event_1', createdAtMs: 123 }]);
  assert.deepEqual(parseLegacyIndex('{broken'), []);
  assert.equal(parseLegacyItem(JSON.stringify({ id: 'event_1', createdAtMs: 123, type: 'event', payload: {} })), null);
  assert.equal(parseLegacyItem(JSON.stringify({
    id: 'event_1', createdAtMs: 123, type: 'event',
    payload: { user_id: 'owner', event: { event_id: '1' } },
  }))?.id, 'event_1');
});
