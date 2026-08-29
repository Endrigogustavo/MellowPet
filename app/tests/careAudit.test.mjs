import assert from 'node:assert/strict';
import test from 'node:test';

import { auditActionLabel } from '../src/care/careAudit.ts';

test('audit labels map each supported artifact without exposing its contents', () => {
  assert.equal(auditActionLabel('public.care_alerts.insert'), 'Alerta criado');
  assert.equal(auditActionLabel('public.care_checkins.update'), 'Check-in atualizado');
  assert.equal(auditActionLabel('public.care_appointments.delete'), 'Compromisso removido');
  assert.equal(auditActionLabel('public.care_plans.insert'), 'Plano de cuidado criado');
  assert.equal(auditActionLabel('public.care_team_members.update'), 'Equipe de cuidado atualizado');
  assert.equal(auditActionLabel('public.care_support_actions.delete'), 'Ação de apoio removido');
  assert.equal(auditActionLabel('public.caregiver_consents.update'), 'Registro histórico de permissões atualizado');
  assert.equal(auditActionLabel('public.caregiver_links.update'), 'Vínculo de cuidado atualizado');
});

test('audit labels fall back safely for an unknown database action', () => {
  assert.equal(auditActionLabel('public.caregiver_notes.insert'), 'Alteração de cuidado registrada');
  assert.equal(auditActionLabel('unexpected'), 'Alteração de cuidado registrada');
});

test('audit labels are case-insensitive because action values are operational data', () => {
  assert.equal(auditActionLabel('PUBLIC.CARE_ALERTS.DELETE'), 'Alerta removido');
});
