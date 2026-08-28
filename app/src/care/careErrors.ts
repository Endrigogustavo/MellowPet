/**
 * Raised when a client build contains the caregiver module but the matching
 * Supabase migration has not been applied yet. Screens can safely show
 * `message` while callers that need a tailored state can use `instanceof`.
 */
export class CareConfigurationInactiveError extends Error {
  readonly code = 'CARE_CONFIGURATION_INACTIVE';

  constructor(cause?: unknown) {
    super('Configuração do cuidador ainda não foi ativada.');
    this.name = 'CareConfigurationInactiveError';
    if (cause !== undefined) this.cause = cause;
  }
}

type SupabaseLikeError = { code?: unknown; message?: unknown; details?: unknown };

/** True for Postgres/PostgREST errors caused by a missing caregiver migration. */
export function isCareConfigurationMissing(error: unknown): boolean {
  const candidate = error as SupabaseLikeError | null | undefined;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(code)) return true;

  const message = [candidate?.message, candidate?.details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the function') ||
    message.includes('schema cache') ||
    message.includes('requested_scopes')
  );
}

/** The only backward-compatible schema gap for caregiver_links itself. */
export function isRequestedScopesMissing(error: unknown): boolean {
  const candidate = error as SupabaseLikeError | null | undefined;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = [candidate?.message, candidate?.details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return code === '42703' || message.includes('requested_scopes');
}

export function toCareClientError(error: unknown, fallback: string): Error {
  if (error instanceof CareConfigurationInactiveError) return error;
  return isCareConfigurationMissing(error) ? new CareConfigurationInactiveError(error) : new Error(fallback);
}
