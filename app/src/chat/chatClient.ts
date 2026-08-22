const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export class ChatError extends Error {}

export async function sendChatMessage(
  message: string,
  emotion: string,
  confidence: number,
  history: { role: 'user' | 'bot'; content: string }[]
): Promise<string> {
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
        history: history.slice(-12),
      }),
    });
  } catch {
    throw new ChatError('network');
  }
  if (!response.ok) {
    throw new ChatError(`http_${response.status}`);
  }
  const data = (await response.json()) as { response: string };
  return data.response;
}
