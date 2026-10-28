/**
 * Memória de longo prazo do Mellow — com consentimento, e só o que a pessoa
 * pede explicitamente ("Mellow, lembra que eu tenho prova na sexta").
 *
 * Nada é extraído por conta própria da conversa: lembrar sem pedir é
 * exatamente o que faria a pessoa desconfiar de contar coisas. As notas ficam
 * no aparelho, aparecem em Ajustes para apagar, e só vão junto com a mensagem
 * quando a memória está ligada.
 */
export const MAX_NOTES = 8;
export const MAX_NOTE = 160;

const ASK =
  /^(?:mellow[,!:]?\s+)?(?:por favor[,]?\s+)?(?:lembr[ae](?:-se)?|se lembr[ae]|guarda|anota|n[aã]o esque[cç]a)(?:[:,]\s*|\s+)(?:(?:de que|de|que|disso|isso)[:,]?\s+)?(.+)$/i;

/** Nota a guardar, se a mensagem for um pedido de lembrar; senão null. */
export function extractMemoryRequest(message: string): string | null {
  // "lembra de mim?" é pergunta, não pedido para guardar.
  if (/\?\s*$/.test(message)) return null;
  const m = message.trim().match(ASK);
  if (!m) return null;
  const note = m[1]
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/, '')
    .trim();
  if (note.length < 3) return null;
  return note.slice(0, MAX_NOTE);
}

/** Acrescenta sem repetir; passando do limite, sai a mais antiga. */
export function addNote(notes: string[], note: string): string[] {
  const key = note.toLocaleLowerCase('pt-BR');
  const rest = notes.filter((n) => n.toLocaleLowerCase('pt-BR') !== key);
  return [...rest, note].slice(-MAX_NOTES);
}

export function parseNotes(raw: string | null): string[] {
  try {
    const list = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(list)
      ? list.filter((n): n is string => typeof n === 'string' && n.length > 0).map((n) => n.slice(0, MAX_NOTE)).slice(-MAX_NOTES)
      : [];
  } catch {
    return [];
  }
}
