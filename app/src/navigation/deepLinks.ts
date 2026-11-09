/**
 * Leitura dos deep links `mellowpet://widget/...` que os widgets da tela
 * inicial emitem (ver WidgetIntents.openApp no módulo nativo). Puro: só diz
 * aonde o link quer levar; quem decide se o perfil atual pode ir é o
 * `canAccess` do navModel, na hora de aplicar.
 *
 * Qualquer app pode abrir esses links, então nada aqui confia no texto: tela
 * fora da lista, ação desconhecida ou id estranho viram `null`.
 */
import type { Screen } from '../state/AppContext';

/** Telas que um widget pode abrir. Fica de fora quem tem efeito ao montar
 * (Mais do cuidador gera convite) e os fluxos de entrada. */
export const WIDGET_SCREENS: readonly Screen[] = [
  'home',
  'tools',
  'routine',
  'music',
  'dashboard',
  'spotifyplayer',
  'checkin',
  'heatmap',
  'settings',
  'care',
  'carealerts',
  'agenda',
];

/** `tool?action=` → tela e o modo que ela abre ligado. */
export type WidgetTool = 'breathe' | 'focus' | 'ground' | 'journal' | 'stretch' | 'chat' | 'sos';
const TOOL_SCREENS: Record<WidgetTool, Screen> = {
  breathe: 'home',
  focus: 'home',
  ground: 'tools',
  journal: 'tools',
  stretch: 'tools',
  chat: 'chat',
  sos: 'sos',
};

export type PetCareAction = 'feed' | 'play' | 'rest';

export type WidgetLink =
  | { kind: 'open'; screen: Screen }
  | { kind: 'tool'; tool: WidgetTool; screen: Screen }
  | { kind: 'playlist'; id: string }
  | { kind: 'mood'; value: string | null }
  | { kind: 'care'; action: PetCareAction | null };

const PLAYLIST_ID = /^[A-Za-z0-9_-]{1,64}$/;

function own<K extends string>(map: Record<K, unknown>, key: string): key is K {
  return Object.prototype.hasOwnProperty.call(map, key);
}

export function parseWidgetLink(url: string): WidgetLink | null {
  const prefix = 'mellowpet://widget/';
  if (!url.startsWith(prefix)) return null;
  const [path, query] = url.slice(prefix.length).split('?');
  const params = new URLSearchParams(query ?? '');

  switch (path) {
    case 'open': {
      const screen = params.get('screen') ?? '';
      return (WIDGET_SCREENS as readonly string[]).includes(screen) ? { kind: 'open', screen: screen as Screen } : null;
    }
    case 'tool': {
      const tool = params.get('action') ?? '';
      // Ferramenta desconhecida ainda leva às Ferramentas: o toque não se perde.
      if (!own(TOOL_SCREENS, tool)) return { kind: 'open', screen: 'tools' };
      return { kind: 'tool', tool, screen: TOOL_SCREENS[tool] };
    }
    case 'playlist': {
      const id = params.get('id') ?? '';
      return PLAYLIST_ID.test(id) ? { kind: 'playlist', id } : { kind: 'open', screen: 'music' };
    }
    case 'mood':
      return { kind: 'mood', value: params.get('value') };
    case 'care': {
      const action = params.get('action');
      return { kind: 'care', action: action === 'feed' || action === 'play' || action === 'rest' ? action : null };
    }
    default:
      return null;
  }
}
