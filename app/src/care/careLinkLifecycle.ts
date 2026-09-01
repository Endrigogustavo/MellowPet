/** Fields shared by accepted and pending links after lifecycle migration. */
export type CareLinkLifecycle = {
  id: string;
  revoked_at?: string | null;
  expires_at?: string | null;
};

/** A revoked or expired link must never be rendered from a stale response. */
export function isCareLinkActive(link: CareLinkLifecycle, now = Date.now()): boolean {
  if (link.revoked_at) return false;
  if (!link.expires_at) return true;
  const expiresAt = Date.parse(link.expires_at);
  return Number.isNaN(expiresAt) || expiresAt > now;
}
