/**
 * Mensagem de SOS pelo WhatsApp para um contato de emergência.
 *
 * O contato foi cadastrado como texto livre ("Ana", "ana@email.com",
 * "(11) 98765-4321"). Só vira link de WhatsApp quando parece telefone; número
 * brasileiro sem DDI (10–11 dígitos) ganha o 55. A localização entra só se a
 * pessoa escolher mandar.
 */
export function phoneDigits(contact: string): string | null {
  if (/@/.test(contact)) return null;
  const digits = contact.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

export function sosText(coords?: { latitude: number; longitude: number } | null): string {
  const base = 'Oi, não estou bem e preciso de você agora. Pode me ligar ou vir até mim?';
  if (!coords) return base;
  const lat = coords.latitude.toFixed(5);
  const lon = coords.longitude.toFixed(5);
  return `${base}\nEstou aqui: https://maps.google.com/?q=${lat},${lon}`;
}

export function whatsappLink(contact: string, text: string): string | null {
  const phone = phoneDigits(contact);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}
