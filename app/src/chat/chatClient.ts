const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export class ChatError extends Error {}

export function toApiHistory(history: { role: 'user' | 'bot'; content: string }[]) {
  return history.slice(-12).map(({ role, content }) => ({
    role: role === 'bot' ? 'assistant' : role,
    content,
  }));
}

export async function sendChatMessage(
  message: string,
  emotion: string,
  confidence: number,
  history: { role: 'user' | 'bot'; content: string }[]
): Promise<{ content: string; provider: string }> {
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
      },
      body: JSON.stringify({
        message,
        emotion,
        confidence,
        // A API espera uma lista de turnos; o mesmo shape de ChatMessage do app.
        history: toApiHistory(history),
      }),
    });
  } catch {
    throw new ChatError('network');
  }
  if (!response.ok) {
    throw new ChatError(`http_${response.status}`);
  }
  const data = (await response.json()) as { response: string; provider?: string };
  // "fallback" = o servidor está de pé mas sem token de IA; o app troca para o
  // modelo no aparelho quando houver um baixado.
  return { content: data.response, provider: data.provider ?? 'unknown' };
}

/** Há URL de API neste build? */
export const SERVER_CONFIGURED = API_BASE_URL.length > 0;
