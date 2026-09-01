import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CareConfigurationInactiveError,
  isCareConfigurationMissing,
  isRequestedScopesMissing,
  toCareClientError,
} from '../src/care/careErrors.ts';

test('recognizes missing caregiver tables from PostgREST errors', () => {
  const missingTable = {
    code: 'PGRST205',
    message: "Could not find the table 'public.care_alerts' in the schema cache",
  };

  assert.equal(isCareConfigurationMissing(missingTable), true);
  assert.equal(isRequestedScopesMissing(missingTable), false);
});

test('recognizes missing caregiver dashboard RPCs', () => {
  assert.equal(
    isCareConfigurationMissing({ code: 'PGRST202', message: 'Could not find the function public.care_dashboard_summary' }),
    true,
  );
  assert.equal(
    isCareConfigurationMissing({ code: '42883', message: 'function public.care_dashboard_summary(uuid) does not exist' }),
    true,
  );
});

test('recognizes the requested_scopes column gap for the legacy invite fallback', () => {
  const missingColumn = { code: '42703', message: 'column "requested_scopes" of relation "caregiver_links" does not exist' };

  assert.equal(isRequestedScopesMissing(missingColumn), true);
  assert.equal(isCareConfigurationMissing(missingColumn), true);
});

test('does not use the requested_scopes fallback for an absent caregiver table', () => {
  assert.equal(
    isRequestedScopesMissing({ code: '42P01', message: 'relation "caregiver_consents" does not exist' }),
    false,
  );
});

test('leaves ordinary request failures unmapped', () => {
  const denied = { code: '42501', message: 'new row violates row-level security policy' };

  assert.equal(isCareConfigurationMissing(denied), false);
  assert.equal(isRequestedScopesMissing(denied), false);
  assert.equal(isCareConfigurationMissing(new Error('Network request failed')), false);
});

test('maps only configuration errors to the safe caregiver setup error', () => {
  const missing = toCareClientError({ code: 'PGRST205', message: 'Could not find the table' }, 'Falha ao carregar');
  assert.ok(missing instanceof CareConfigurationInactiveError);
  assert.equal(missing.message, 'Configuração do cuidador ainda não foi ativada.');

  const ordinary = toCareClientError({ code: '42501', message: 'not allowed' }, 'Falha ao carregar');
  assert.equal(ordinary.message, 'Falha ao carregar');
  assert.equal(ordinary instanceof CareConfigurationInactiveError, false);
});
