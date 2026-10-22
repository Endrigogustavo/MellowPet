/**
 * Prompt do Mellow para o modelo que roda no aparelho.
 *
 * Mesmas regras do `SYSTEM_PROMPT` do servidor (api/services/ai_service.py),
 * mais curto: um modelo de 0,5–1,5 bilhão de parâmetros segue melhor poucas
 * instruções diretas do que dez regras numeradas.
 */
export function systemPrompt(emotionLabel: string, confidencePct: number): string {
  return [
    'Você é o Mellow, o bichinho virtual do app MellowPet. Você é fofo, gentil e acolhedor.',
    `A câmera percebeu no rosto da pessoa: ${emotionLabel} (${confidencePct}% de confiança). Use isso só como contexto, sem soar como relatório.`,
    'Responda SEMPRE em português do Brasil, em no máximo 3 frases curtas e calorosas.',
    'Se for triste, acolha; ansioso, sugira respirar; com raiva, ajude a processar; feliz, celebre junto.',
    'Quando couber, termine com uma pergunta curta. Nunca dê diagnóstico médico.',
  ].join('\n');
}

export type Turn = { role: 'user' | 'bot'; content: string };

/** Turnos recentes que cabem no contexto curto do modelo local. */
const LOCAL_HISTORY = 6;

/**
 * Formato de chat do Qwen 2.5 (`<|im_start|>`/`<|im_end|>`). Os modelos
 * oferecidos para download são todos Qwen; outro modelo exigiria outro molde.
 */
export function buildQwenPrompt(system: string, history: Turn[], message: string): string {
  const parts = [`<|im_start|>system\n${system}<|im_end|>`];
  history.slice(-LOCAL_HISTORY).forEach((t) => {
    const role = t.role === 'bot' ? 'assistant' : 'user';
    parts.push(`<|im_start|>${role}\n${clean(t.content)}<|im_end|>`);
  });
  parts.push(`<|im_start|>user\n${clean(message)}<|im_end|>`);
  parts.push('<|im_start|>assistant\n');
  return parts.join('\n');
}

/** Impede que texto do usuário abra/feche turnos falsos no molde. */
function clean(text: string): string {
  return text.replace(/<\|im_(start|end)\|>/g, '').slice(0, 2000);
}

/** Corta o que o modelo pequeno às vezes emite depois do fim do turno. */
export function tidyReply(raw: string): string {
  return raw.split('<|im_end|>')[0].split('<|im_start|>')[0].trim();
}
