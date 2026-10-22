/**
 * Rituais de bom dia e boa noite.
 *
 * Bom dia: das 5h às 11h59 — o pet conta o que sonhou e pergunta do sono.
 * Boa noite: das 20h às 4h59 — uma coisa boa do dia e o pet vai dormir.
 * A noite que passa da meia-noite ainda pertence ao dia anterior: quem faz o
 * ritual à 1h não pode ser cobrado de novo às 20h do mesmo "dia".
 */
export type Ritual = 'morning' | 'night';

/** Dia (AAAA-MM-DD) ao qual um instante pertence para o ritual. */
export function ritualDay(now: Date, ritual: Ritual): string {
  const d = new Date(now);
  if (ritual === 'night' && d.getHours() < 5) d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ritualWindow(now: Date): Ritual | null {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 20 || h < 5) return 'night';
  return null;
}

/** Ritual a oferecer agora, ou null se fora de hora ou já feito/dispensado. */
export function pendingRitual(now: Date, doneDays: { morning: string[]; night: string[] }): Ritual | null {
  const r = ritualWindow(now);
  if (!r) return null;
  return doneDays[r].includes(ritualDay(now, r)) ? null : r;
}
