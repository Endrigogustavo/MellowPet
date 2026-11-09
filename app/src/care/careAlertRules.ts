import type { CareAlertRule, DifficultEmotion } from './careUxTypes';

/**
 * Núcleo puro das regras de alerta: limites, texto humano da regra e
 * validação. Os limites espelham os `check` da tabela care_alert_rules.
 */
export type AlertRuleInput = Omit<CareAlertRule, 'caregiver_link_id'>;

export const MIN_READINGS_RANGE = [2, 10] as const;
export const WINDOW_RANGE = [30, 360] as const;
export const WINDOW_STEP = 15;

export const ALL_DIFFICULT: DifficultEmotion[] = ['sad', 'angry', 'fearful', 'disgusted'];

export const EMOTION_LABEL: Record<DifficultEmotion, string> = {
  sad: 'tristeza',
  angry: 'raiva',
  fearful: 'medo',
  disgusted: 'aversão',
};

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.max(min, Math.min(max, Math.round(value)));

/** "90 minutos", "2 horas", "2 h 30 min". */
export function formatWindow(minutes: number): string {
  if (minutes < 120 && minutes % 60 !== 0) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hora${hours === 1 ? '' : 's'}`;
  return `${hours} h ${rest} min`;
}

/** "tristeza", "tristeza e medo", "tristeza, raiva e medo". */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Mantém a regra dentro dos limites do banco e as emoções sem repetição, na ordem fixa. */
export function clampRule<T extends AlertRuleInput>(rule: T): T {
  return {
    ...rule,
    min_readings: clamp(rule.min_readings, MIN_READINGS_RANGE),
    window_minutes: clamp(rule.window_minutes, WINDOW_RANGE),
    emotions: ALL_DIFFICULT.filter((emotion) => rule.emotions.includes(emotion)),
  };
}

export function validateAlertRule(rule: AlertRuleInput): string | null {
  if (rule.enabled && rule.emotions.length === 0) return 'Escolha ao menos uma emoção que conte como difícil.';
  if (rule.min_readings < MIN_READINGS_RANGE[0] || rule.min_readings > MIN_READINGS_RANGE[1]) {
    return `Use de ${MIN_READINGS_RANGE[0]} a ${MIN_READINGS_RANGE[1]} leituras.`;
  }
  if (rule.window_minutes < WINDOW_RANGE[0] || rule.window_minutes > WINDOW_RANGE[1]) {
    return `Use uma janela de ${formatWindow(WINDOW_RANGE[0])} a ${formatWindow(WINDOW_RANGE[1])}.`;
  }
  return null;
}

/** A regra em uma frase: "Avisar quando houver 3 leituras difíceis em 90 minutos." */
export function describeAlertRule(rule: AlertRuleInput): string {
  if (!rule.enabled) {
    return 'Alertas automáticos desligados para esta pessoa. Pedidos “Preciso de você” continuam chegando.';
  }
  const base = `Avisar quando houver ${rule.min_readings} leituras difíceis em ${formatWindow(rule.window_minutes)}.`;
  const emotions = ALL_DIFFICULT.filter((emotion) => rule.emotions.includes(emotion));
  if (emotions.length === 0 || emotions.length === ALL_DIFFICULT.length) return base;
  return `${base} Contam como difíceis: ${joinPt(emotions.map((emotion) => EMOTION_LABEL[emotion]))}.`;
}

/** Mais leituras ou janela menor = alerta mais raro. Explica o efeito da mudança. */
export function sensitivityHint(rule: AlertRuleInput, base: AlertRuleInput): string | null {
  const perHourRule = rule.min_readings / rule.window_minutes;
  const perHourBase = base.min_readings / base.window_minutes;
  if (Math.abs(perHourRule - perHourBase) < 1e-9 && rule.emotions.length === base.emotions.length) return null;
  if (perHourRule > perHourBase || rule.emotions.length < base.emotions.length) {
    return 'Mais exigente que o padrão: menos alertas, e alguns momentos difíceis podem passar sem aviso.';
  }
  return 'Mais sensível que o padrão: mais alertas, inclusive alguns que não pedem ação.';
}
