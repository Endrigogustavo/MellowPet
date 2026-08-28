import assert from 'node:assert/strict';
import test from 'node:test';

import {
  localDateTimeInput,
  parseDeviceLocalDateTime,
  validateDateRange,
} from '../src/care/careDateTime.ts';

test('formats future agenda defaults as an explicit local calendar value', () => {
  assert.equal(localDateTimeInput(1, new Date(2026, 7, 28, 9, 30)), '2026-08-29 18:00');
});

test('parses the agenda format as a device-local instant', () => {
  const result = parseDeviceLocalDateTime('2026-08-29 18:30');
  assert.ok(result.iso);
  assert.equal(new Date(result.iso).getFullYear(), 2026);
});

test('rejects ambiguous, malformed and impossible local dates', () => {
  assert.equal(parseDeviceLocalDateTime('29/08/2026 18:30').error, 'Use o formato AAAA-MM-DD HH:mm.');
  assert.equal(parseDeviceLocalDateTime('2026-02-30 18:30').error, 'Informe uma data e horário existentes no fuso do aparelho.');
});

test('requires an optional appointment end to be after its start', () => {
  assert.equal(validateDateRange('2026-08-29T18:00:00.000Z', null), null);
  assert.equal(validateDateRange('2026-08-29T18:00:00.000Z', '2026-08-29T18:01:00.000Z'), null);
  assert.equal(validateDateRange('2026-08-29T18:00:00.000Z', '2026-08-29T18:00:00.000Z'), 'O término precisa ser posterior ao início.');
});
