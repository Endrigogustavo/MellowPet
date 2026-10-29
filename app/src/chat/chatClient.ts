import type { ChatAction } from './actions';

/** Validação local da ação (sem import de valor: os testes do Node rodam este arquivo direto). */
const ACTIONS = new Set(['respirar', 'musica', 'checkin', 'ninar', 'diario']);
const parseAction = (value: unknown): ChatAction | null =>
  typeof value === 'string' && ACTIONS.has(value) ? (value as ChatAction) : null;

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export class ChatError extends Error {}

export function toApiHistory(history: { role: 'user' | 'bot'; content: string }[]) {
  // Corta cada turno: uma mensagem longa antiga não pode fazer todos os
  // envios seguintes serem recusados pela validação da API.
  return history.slice(-12).map(({ role, content }) => ({
    role: role === 'bot' ? 'assistant' : role,
    content: content.slice(0, 2000),
  }));
}

export async function sendChatMessage(
  message: string,
  emotion: string,
  confidence: number,
  history: { role: 'user' | 'bot'; content: string }[],
  memory: string[] = [],
  authToken: string | null = null
): Promise<{ content: string; provider: string; action: ChatAction | null }> {
  if (!API_BASE_URL) {
    throw new ChatError('API não configurada neste build (EXPO_PUBLIC_API_BASE_URL ausente).');
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : null),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : null),
      },
      body: JSON.stringify({
        message,
        emotion,
        confidence,
        // A API espera uma lista de turnos; o mesmo shape de ChatMessage do app.
        history: toApiHistory(history),
        memory,
      }),
    });
  } catch {
    throw new ChatError('network');
  }
  if (!response.ok) {
    throw new ChatError(`http_${response.status}`);
  }
  const data = (await response.json()) as { response: string; provider?: string; action?: unknown };
  // "fallback" = o servidor está de pé mas sem token de IA; o app troca para o
  // modelo no aparelho quando houver um baixado.
  return { content: data.response, provider: data.provider ?? 'unknown', action: parseAction(data.action) };
}

/**
 * Mesmo pedido, com a resposta chegando aos pedaços (Server-Sent Events).
 *
 * O fetch do React Native não expõe o corpo em streaming; o XMLHttpRequest
 * sim — `onprogress` entrega o texto acumulado conforme chega. Cada evento
 * `data: {...}` traz um `delta` ou, no fim, `done` com provedor e ação.
 * Rejeita se nada chegou (o chamador cai para o pedido normal/local).
 */
export function streamChatMessage(
  message: string,
  emotion: string,
  confidence: number,
  history: { role: 'user' | 'bot'; content: string }[],
  memory: string[],
  onText: (textSoFar: string) => void,
  authToken: string | null = null
): Promise<{ content: string; provider: string; action: ChatAction | null }> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ChatError('API não configurada neste build.'));
      return;
    }
    const xhr = new XMLHttpRequest();
    let seen = 0;
    let text = '';
    let finished: { provider: string; action: ChatAction | null } | null = null;

    const consume = () => {
      const raw = xhr.responseText ?? '';
      // Só processa eventos completos (terminados em linha em branco).
      const end = raw.lastIndexOf('\n\n');
      if (end < seen) return;
      const chunk = raw.slice(seen, end + 2);
      seen = end + 2;
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6)) as {
            delta?: string;
            done?: boolean;
            provider?: string;
            action?: unknown;
            reply?: string;
          };
          if (typeof ev.delta === 'string') {
            text += ev.delta;
            onText(text);
          }
          if (ev.done) {
            if (typeof ev.reply === 'string' && ev.reply) text = ev.reply;
            finished = { provider: ev.provider ?? 'unknown', action: parseAction(ev.action) };
          }
        } catch {
          // evento corrompido: ignora e segue
        }
      }
    };

    xhr.open('POST', `${API_BASE_URL}/api/v1/chat/stream`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (API_KEY) xhr.setRequestHeader('X-API-Key', API_KEY);
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.timeout = 60_000;
    xhr.onprogress = consume;
    xhr.onload = () => {
      consume();
      if (xhr.status !== 200 || !text) {
        reject(new ChatError(`http_${xhr.status}`));
        return;
      }
      const result = finished ?? { provider: 'unknown', action: null };
      resolve({ content: text, ...result });
    };
    xhr.onerror = () => reject(new ChatError('network'));
    xhr.ontimeout = () => (text ? resolve({ content: text, provider: 'unknown', action: null }) : reject(new ChatError('timeout')));
    xhr.send(JSON.stringify({ message, emotion, confidence, history: toApiHistory(history), memory }));
  });
}

/** Há URL de API neste build? */
export const SERVER_CONFIGURED = API_BASE_URL.length > 0;
