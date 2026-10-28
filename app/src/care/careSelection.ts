import type { CaregiverLink } from './careClient';

/**
 * Regra única de "quem está selecionado" para todas as telas do cuidador.
 *
 * Antes cada tela tinha a sua (e o seletor escondia vínculos sem nome): a
 * tela mostrava uma pessoa, o seletor outra, e o plano de uma acabava salvo
 * na outra.
 */
export function careName(link: Pick<CaregiverLink, 'id' | 'cared_name'>, links: Pick<CaregiverLink, 'id'>[]): string {
  const name = link.cared_name?.trim();
  if (name) return name;
  const index = links.findIndex((l) => l.id === link.id);
  return `Pessoa acompanhada ${index >= 0 ? index + 1 : ''}`.trim();
}

/** A pessoa escolhida, se ainda existir; senão a primeira. Nunca "inventa" outra. */
export function pickCurrent<T extends Pick<CaregiverLink, 'id'>>(links: T[], personId: string | null): T | null {
  return links.find((link) => link.id === personId) ?? links[0] ?? null;
}
