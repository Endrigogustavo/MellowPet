/**
 * Regras de navegação do MellowPet, puras e testáveis (contrato em
 * tests/nav_contract.test.mjs). O reducer do AppContext, o RootNavigator, o
 * título das telas e os pontos de entrada externos (widget, notificação,
 * ações do Chat) perguntam tudo aqui — não há outra lista de quem pode o quê.
 *
 * Só `import type`: o teste carrega este arquivo direto no Node.
 */
import type { Role, Screen } from '../state/AppContext';

/** Quem pode abrir a tela: sem sessão, só usuário, só cuidador ou os dois. */
export type Access = 'public' | 'user' | 'care' | 'both';

export type NavContext = { authed: boolean; role: Role | null };

export const SCREEN_ACCESS: Record<Screen, Access> = {
  splash: 'public',
  login: 'public',

  onboarding: 'user',
  home: 'user',
  tools: 'user',
  routine: 'user',
  music: 'user',
  playlisteditor: 'user',
  playlistdetail: 'user',
  spotifyimport: 'user',
  spotifyplayer: 'user',
  checkin: 'user',
  heatmap: 'user',
  friends: 'user',
  fairness: 'user',
  lullaby: 'user',
  sos: 'user',
  caremirror: 'user',
  groups: 'user',
  crisisplan: 'user',
  wardrobe: 'user',
  guide: 'user',
  plans: 'user',
  vision: 'user',

  caresignup: 'care',
  care: 'care',
  carealerts: 'care',
  careaudit: 'care',
  careplan: 'care',
  careguide: 'care',
  agenda: 'care',
  caretools: 'care',

  // Bem-estar (usuário) e Dados (cuidador) dividem o id; Ajustes e Chat
  // existem nos dois perfis com conteúdo próprio.
  dashboard: 'both',
  settings: 'both',
  chat: 'both',
};

/**
 * Telas da nova área do cuidador que ainda não existem no tipo `Screen` nem no
 * RootNavigator. Quem criar a tela move a entrada para `SCREEN_ACCESS` (o tipo
 * `Record<Screen, Access>` acusa a falta assim que o id entrar em `Screen`).
 */
export const PLANNED_SCREEN_ACCESS = {
  carehistory: 'care',
  carenotes: 'care',
  carealertrules: 'care',
  carenotify: 'care',
  caredcare: 'user',
  acceptinvite: 'user',
} as const satisfies Record<string, Access>;

export type PlannedScreen = Exclude<keyof typeof PLANNED_SCREEN_ACCESS, Screen>;

/** Qualquer id de rota conhecido, inclusive os que ainda vão ganhar tela. */
export type RouteId = Screen | PlannedScreen;

/** Telas que não entram no histórico (não faz sentido "voltar" para elas). */
export const NO_HISTORY: readonly Screen[] = ['splash', 'login', 'onboarding', 'caresignup'];

/** Abas de cada perfil, na ordem da TabBar. */
export const TAB_ROOTS_USER: readonly Screen[] = ['home', 'tools', 'routine', 'music', 'dashboard'];
export const TAB_ROOTS_CARE: readonly Screen[] = ['care', 'carealerts', 'dashboard', 'agenda', 'caretools'];

/** Limite da pilha do "voltar". */
export const MAX_HISTORY = 30;

function accessOf(screen: string): Access | null {
  if (Object.prototype.hasOwnProperty.call(SCREEN_ACCESS, screen)) return SCREEN_ACCESS[screen as Screen];
  if (Object.prototype.hasOwnProperty.call(PLANNED_SCREEN_ACCESS, screen)) {
    return PLANNED_SCREEN_ACCESS[screen as keyof typeof PLANNED_SCREEN_ACCESS];
  }
  return null;
}

/** O guard único: a tela existe e este perfil pode abri-la agora? */
export function canAccess(screen: string, { authed, role }: NavContext): boolean {
  const access = accessOf(screen);
  if (access === null) return false;
  if (access === 'public') return true;
  if (!authed) return false;
  if (access === 'both') return true;
  return role === access;
}

/** Tela inicial: login sem sessão; Painel para cuidador; Home para usuário. */
export function homeFor(role: Role | null, authed: boolean): Screen {
  if (!authed) return 'login';
  return role === 'care' ? 'care' : 'home';
}

export function tabRootsFor(role: Role | null): readonly Screen[] {
  return role === 'care' ? TAB_ROOTS_CARE : TAB_ROOTS_USER;
}

/** Raiz de aba do perfil atual (não da união dos dois). */
export function isTabRoot(screen: string, role: Role | null): boolean {
  return (tabRootsFor(role) as readonly string[]).includes(screen);
}

/** O título mostra "Voltar" em toda tela que não é aba nem fluxo de entrada. */
export function showsBackButton(screen: Screen, role: Role | null): boolean {
  return !isTabRoot(screen, role) && !NO_HISTORY.includes(screen);
}

/**
 * Pilha depois de ir de `from` para `to`. Ir para a tela logo abaixo do topo
 * desempilha em vez de empilhar: Check-in → "Ver o mês" → "Fazer check-in"
 * não cresce a pilha a cada volta.
 */
export function pushHistory<S extends string>(history: readonly S[], from: S, to: S): S[] {
  if (from === to) return [...history];
  const top = history[history.length - 1];
  if (top === to) return history.slice(0, -1);
  if ((NO_HISTORY as readonly string[]).includes(from) || top === from) return [...history];
  return [...history, from].slice(-MAX_HISTORY);
}

/** Pilha para trocar a tela atual por `to` sem empilhá-la (fim de fluxo). */
export function replaceHistory<S extends string>(history: readonly S[], to: S): S[] {
  return history[history.length - 1] === to ? history.slice(0, -1) : [...history];
}

/**
 * Para onde o "voltar" leva: a entrada mais recente que este perfil ainda pode
 * abrir. Entradas proibidas ou de NO_HISTORY são descartadas no caminho; sem
 * nenhuma válida, a home do perfil. Sem sessão, sempre o login.
 */
export function popHistory(
  history: readonly string[],
  role: Role | null,
  authed: boolean
): { screen: Screen; history: Screen[] } {
  if (!authed) return { screen: 'login', history: [] };
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const candidate = history[i];
    if ((NO_HISTORY as readonly string[]).includes(candidate)) continue;
    if (!canAccess(candidate, { authed, role })) continue;
    // Telas planejadas nunca estão na pilha (não há como abri-las ainda).
    if (!Object.prototype.hasOwnProperty.call(SCREEN_ACCESS, candidate)) continue;
    return { screen: candidate as Screen, history: history.slice(0, i) as Screen[] };
  }
  return { screen: homeFor(role, authed), history: [] };
}
