/**
 * Presentation rules for the audit timeline. The database action is an
 * implementation detail; this mapper intentionally never receives audit
 * metadata, artifact content, or actor identity.
 */
export function auditActionLabel(action: string): string {
  const normalized = action.toLowerCase();
  const operation = normalized.split('.').at(-1);
  const verb = operation === 'insert' ? 'criado' : operation === 'delete' ? 'removido' : 'atualizado';

  if (normalized.includes('caregiver_consents')) return `Registro histórico de permissões ${verb}`;
  if (normalized.includes('care_alerts')) return `Alerta ${verb}`;
  if (normalized.includes('care_checkins')) return `Check-in ${verb}`;
  if (normalized.includes('care_appointments')) return `Compromisso ${verb}`;
  if (normalized.includes('care_plans')) return `Plano de cuidado ${verb}`;
  if (normalized.includes('care_team_members')) return `Equipe de cuidado ${verb}`;
  if (normalized.includes('care_support_actions')) return `Ação de apoio ${verb}`;
  if (normalized.includes('caregiver_links')) return 'Vínculo de cuidado atualizado';
  return 'Alteração de cuidado registrada';
}
