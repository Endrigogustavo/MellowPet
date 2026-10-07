import assert from 'node:assert/strict';
import test from 'node:test';

import { uploadQueueBatch } from '../src/vision/queueBatch.ts';

const items = ['a', 'bad', 'c', 'd'].map((id) => ({ id }));

test('isola um feedback inválido sem perder os válidos do lote', async () => {
  const calls = [];
  const result = await uploadQueueBatch(items, async (batch) => {
    calls.push(batch.map((item) => item.id));
    return batch.some((item) => item.id === 'bad') ? { code: '23503' } : null;
  });
  assert.deepEqual([...result.acknowledged].sort(), ['a', 'c', 'd']);
  assert.deepEqual(result.rejected, ['bad']);
  assert.ok(calls.length < items.length * 2 + 1);
});

test('erro de rede não fragmenta o lote', async () => {
  let calls = 0;
  await assert.rejects(uploadQueueBatch(items, async () => {
    calls++;
    return { code: 'PGRST301' };
  }));
  assert.equal(calls, 1);
});

test('lote vazio não chama a rede', async () => {
  const result = await uploadQueueBatch([], async () => { throw new Error('não deveria chamar'); });
  assert.equal(result.acknowledged.size, 0);
});
