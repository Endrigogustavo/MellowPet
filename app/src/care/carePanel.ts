/**
 * Núcleo puro do painel do cuidador: estado curto de cada pessoa nos cartões,
 * "há X min" e status do convite pendente.
 */

/** "agora", "há 5 min", "há 3 h", "há 2 dias"; sem data → null. */
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 2) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

export type PersonTone = 'neutral' | 'ok' | 'attention' | 'danger';

export type PersonStatusInput = {
  paused: boolean;
  /** Ainda sem resposta do servidor. */
  loading: boolean;
  /** Falhou e não há dado anterior. */
  failed: boolean;
  events: number | null;
  score: number | null;
  lastEventAt: string | null;
  openRequests: number;
  openAlerts: number;
};

/**
 * Estado de uma pessoa no cartão do painel. Ordem: pedido de contato (é a
 * voz da pessoa e vale mesmo pausado) > pausa > erro > alerta > índice.
 */
export function personStatus(input: PersonStatusInput, now = Date.now()): { text: string; tone: PersonTone } {
  if (input.openRequests > 0) return { text: 'pediu contato', tone: 'danger' };
  if (input.paused) return { text: 'compartilhamento pausado', tone: 'neutral' };
  if (input.failed) return { text: 'não foi possível atualizar', tone: 'neutral' };
  if (input.loading || input.events === null) return { text: 'carregando…', tone: 'neutral' };
  if (input.openAlerts > 0) return { text: `${input.openAlerts} alerta${input.openAlerts === 1 ? '' : 's'} aberto${input.openAlerts === 1 ? '' : 's'}`, tone: 'attention' };
  if (input.events === 0) return { text: 'sem leituras em 7 dias', tone: 'neutral' };
  const ago = timeAgo(input.lastEventAt, now);
  const when = ago ? ` · ${ago}` : '';
  if (input.score === null) return { text: `poucas leituras${when}`, tone: 'neutral' };
  if (input.score < 40) return { text: `índice ${input.score}${when}`, tone: 'attention' };
  return { text: `índice ${input.score}${when}`, tone: 'ok' };
}

export type InviteLike = {
  status: 'pending' | 'accepted';
  expires_at?: string | null;
  revoked_at?: string | null;
  accepted_at?: string | null;
  created_at?: string | null;
};

export type InviteStatus = { kind: 'waiting' | 'accepted' | 'expired' | 'revoked'; text: string };

/** Status do convite: aguardando (com prazo), aceito, expirado ou cancelado. */
export function inviteStatus(link: InviteLike, now = Date.now()): InviteStatus {
  if (link.revoked_at) return { kind: 'revoked', text: 'Convite cancelado' };
  if (link.status === 'accepted') {
    const ago = timeAgo(link.accepted_at ?? null, now);
    return { kind: 'accepted', text: ago ? `Convite aceito ${ago}` : 'Convite aceito' };
  }
  const expires = link.expires_at ? Date.parse(link.expires_at) : NaN;
  if (!Number.isNaN(expires) && expires <= now) return { kind: 'expired', text: 'Convite expirado — gere um novo código' };
  if (Number.isNaN(expires)) return { kind: 'waiting', text: 'Aguardando a pessoa aceitar' };
  const hours = Math.max(1, Math.round((expires - now) / 3_600_000));
  const left = hours >= 48 ? `${Math.round(hours / 24)} dias` : `${hours} h`;
  return { kind: 'waiting', text: `Aguardando a pessoa aceitar · vale por mais ${left}` };
}

/** O convite mais recente que ainda merece aparecer (pendente ou aceito há menos de 1 dia). */
export function relevantInvite<T extends InviteLike>(invites: T[], now = Date.now()): T | null {
  for (const invite of invites) {
    const status = inviteStatus(invite, now);
    if (status.kind === 'waiting' || status.kind === 'expired') return invite;
    if (status.kind === 'accepted' && invite.accepted_at && now - Date.parse(invite.accepted_at) < 86_400_000) return invite;
  }
  return null;
}
