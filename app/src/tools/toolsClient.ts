import { apiGet } from '../api/client';

/**
 * Nem todo card do grid tem um endpoint dedicado no backend (ex.: "Pausa de
 * água" é só um lembrete local). Os que têm, mapeiam por título — os 19
 * endpoints de api/routers/tools.py não têm um identificador em comum com
 * `Tool.act` (quase tudo é 'chat'), então o título é a chave mais estável.
 */
const TOOL_ENDPOINT_BY_TITLE: Record<string, string> = {
  'Respiração guiada': '/api/v1/tools/breathing-protocol',
  Aterramento: '/api/v1/tools/grounding',
  'Body scan': '/api/v1/tools/body-scan',
  Visualização: '/api/v1/tools/visualization',
  Afirmações: '/api/v1/tools/affirmations',
  'Roda emocional': '/api/v1/tools/emotion-wheel',
  Diário: '/api/v1/tools/journal-prompts',
  'Modo foco': '/api/v1/tools/focus-mode',
  'Meditação guiada': '/api/v1/tools/meditation',
  'Relaxamento muscular': '/api/v1/tools/muscle-relaxation',
  'Reestruturar pensamento': '/api/v1/tools/cognitive-reframing',
  Gratidão: '/api/v1/tools/gratitude',
  Conexão: '/api/v1/tools/social-connection',
  'Higiene do sono': '/api/v1/tools/sleep-hygiene',
  'Energia rápida': '/api/v1/tools/energy-boost',
  'Playlist da emoção': '/api/v1/tools/playlist',
  'Entender a emoção': '/api/v1/tools/emotion-education',
};

const LIST_FIELDS = [
  'steps',
  'guide_steps',
  'guided_steps',
  'prompts',
  'guided_questions',
  'tips',
  'wind_down_routine',
  'suggestions',
  'conversation_starters',
  'affirmations',
  'quick_wins',
  'body_signals',
  'healthy_responses',
];

function itemText(item: unknown): string | null {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const rec = item as Record<string, unknown>;
    const label = rec.name ?? rec.title ?? rec.label;
    return typeof label === 'string' ? label : null;
  }
  return null;
}

/** Cada endpoint devolve um shape diferente; isso condensa qualquer um deles
 * num texto curto de bolha de chat em vez de precisar de um formatter por
 * endpoint. */
function summarize(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const title = data.title ?? data.mood_label;
  if (typeof title === 'string') lines.push(title);
  if (typeof data.intro === 'string') lines.push(data.intro);
  if (typeof data.technique === 'string') lines.push(`Técnica: ${data.technique}`);
  if (typeof data.scenario === 'string') lines.push(data.scenario);
  if (typeof data.what_it_is === 'string') lines.push(data.what_it_is);

  for (const field of LIST_FIELDS) {
    const value = data[field];
    if (Array.isArray(value) && value.length > 0) {
      const items = value.slice(0, 5).map(itemText).filter((x): x is string => Boolean(x));
      items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      break;
    }
  }

  const closing =
    data.closing_message ?? data.closing ?? data.closing_affirmation ?? data.bedtime_affirmation ??
    data.reflection_closing ?? data.tip ?? data.practice_prompt ?? data.reward_after;
  if (typeof closing === 'string') lines.push(closing);

  return lines.filter(Boolean).join('\n');
}

export function hasRealToolContent(title: string): boolean {
  return title in TOOL_ENDPOINT_BY_TITLE;
}

export async function fetchToolContent(title: string, emotion: string): Promise<string | null> {
  const path = TOOL_ENDPOINT_BY_TITLE[title];
  if (!path) return null;
  const data = await apiGet<Record<string, unknown>>(path, { emotion });
  const text = summarize(data);
  return text || null;
}
