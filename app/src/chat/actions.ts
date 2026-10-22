/**
 * Ações do app que o Mellow pode sugerir no chat — espelho de
 * api/services/chat_actions.py.
 *
 * O modelo (do servidor ou do aparelho) termina a resposta com [[acao:nome]].
 * O app tira a etiqueta do texto e mostra um botão; nada é executado sem o
 * toque da pessoa. Nome fora da lista é descartado.
 */
export type ChatAction = 'respirar' | 'musica' | 'checkin' | 'ninar' | 'diario';

export const ACTION_LABEL: Record<ChatAction, string> = {
  respirar: 'Respirar agora',
  musica: 'Abrir músicas',
  checkin: 'Fazer check-in',
  ninar: 'Ninar o pet',
  diario: 'Ditar diário',
};

const KNOWN = new Set<string>(Object.keys(ACTION_LABEL));
const TAG = /\[\[\s*acao\s*:\s*([a-z_]+)\s*\]\]/gi;
/** Etiqueta ainda chegando no streaming ("[[acao:resp"): esconde até fechar. */
const PARTIAL_TAG = /\[\[[^\]]*$/;

export function splitAction(text: string): { text: string; action: ChatAction | null } {
  let action: ChatAction | null = null;
  const clean = text
    .replace(TAG, (_, name: string) => {
      const n = name.toLowerCase();
      if (!action && KNOWN.has(n)) action = n as ChatAction;
      return '';
    })
    .replace(PARTIAL_TAG, '')
    .trim();
  return { text: clean, action };
}

export function parseAction(value: unknown): ChatAction | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as ChatAction) : null;
}

/** Linha de instrução para o modelo pequeno do aparelho. */
export const LOCAL_ACTIONS_HINT =
  'Se ajudar muito, termine com UMA etiqueta: [[acao:respirar]], [[acao:musica]], [[acao:checkin]] ou [[acao:ninar]]. Quase sempre, nenhuma.';
