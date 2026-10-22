/**
 * Quem responde a mensagem.
 *
 *  1. Crise detectada → resposta de apoio fixa (CVV/SOS). Sempre, antes de tudo.
 *  2. Modo privado ligado e modelo local pronto → no aparelho.
 *  3. Servidor com provedor de IA → servidor.
 *  4. Servidor sem token ("fallback"), fora do ar, ou sem API → no aparelho, se pronto.
 *  5. Nada disso → respostas fixas do app.
 *
 * Função pura para a ordem poder ser testada sem rede nem modelo.
 */
export type Route = 'crisis' | 'device' | 'server' | 'canned';

export type RouteInput = {
  crisis: boolean;
  privateMode: boolean;
  localReady: boolean;
  /** Antes de tentar: há URL de API neste build? */
  serverConfigured: boolean;
};

/** Primeira escolha, antes de falar com o servidor. */
export function firstRoute(i: RouteInput): Route {
  if (i.crisis) return 'crisis';
  if (i.privateMode && i.localReady) return 'device';
  if (i.serverConfigured && !i.privateMode) return 'server';
  return i.localReady ? 'device' : 'canned';
}

/** O servidor respondeu sem IA de verdade (ou falhou): para onde cair. */
export function afterServer(serverProvider: string | null, localReady: boolean): Route {
  if (serverProvider && serverProvider !== 'fallback') return 'server';
  return localReady ? 'device' : serverProvider === 'fallback' ? 'server' : 'canned';
}
