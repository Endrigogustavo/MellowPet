import assert from 'node:assert/strict';
import test from 'node:test';

import { isCareLinkActive } from '../src/care/careLinkLifecycle.ts';

const now = Date.parse('2026-08-28T12:00:00.000Z');

test('does not render revoked caregiver links from a stale response', () => {
  assert.equal(isCareLinkActive({ id: 'link-1', revoked_at: '2026-08-28T11:59:00.000Z' }, now), false);
});

test('does not render expired caregiver links but keeps a valid future link', () => {
  assert.equal(isCareLinkActive({ id: 'link-1', expires_at: '2026-08-28T11:59:00.000Z' }, now), false);
  assert.equal(isCareLinkActive({ id: 'link-2', expires_at: '2026-08-28T12:01:00.000Z' }, now), true);
});

test('keeps legacy links active when lifecycle fields are unavailable', () => {
  assert.equal(isCareLinkActive({ id: 'legacy-link' }, now), true);
});
