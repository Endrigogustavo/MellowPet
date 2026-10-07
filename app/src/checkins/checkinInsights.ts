import { EMOTIONS, type EmotionKey } from '../data/emotions';
import { NEGATIVE } from '../dashboard/valence';
import { CHECKIN_TAGS, type Checkin, type CheckinTag, type DetectedRow } from './checkinTypes';

/**
 * Agregações sobre check-ins. Funções puras: recebem linhas, devolvem números.
 * Nenhuma delas afirma causalidade — mostram coincidência, e os textos das
 * telas precisam dizer isso.
 */

function isEmotionKey(key: string): key is EmotionKey {
  return Object.prototype.hasOwnProperty.call(EMOTIONS, key);
}

/** Abaixo disto é ruído, não padrão. Mesmo limiar do dashboard. */
export const MIN_SAMPLES = 3;

/** Chave de dia no fuso local ("2026-09-16"). UTC partiria a noite ao meio. */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DayMood = {
  emotion: EmotionKey;
  /** `checkin` = a pessoa disse; `detected` = só a câmera viu. */
  source: 'checkin' | 'detected';
  count: number;
};

function dominant(keys: string[]): EmotionKey | null {
  const counts: Record<string, number> = {};
  keys.forEach((k) => {
    if (k === 'unknown' || !isEmotionKey(k)) return;
    counts[k] = (counts[k] ?? 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top && isEmotionKey(top[0]) ? top[0] : null;
}

/**
 * Emoção predominante por dia. O que a pessoa declarou vale mais que o que a
 * câmera inferiu: num dia com check-in, a leitura não entra na conta.
 */
export function dailyMoods(checkins: Checkin[], detected: DetectedRow[]): Map<string, DayMood> {
  const byDay = new Map<string, { said: string[]; seen: string[] }>();
  const slot = (k: string) => {
    let s = byDay.get(k);
    if (!s) {
      s = { said: [], seen: [] };
      byDay.set(k, s);
    }
    return s;
  };
  checkins.forEach((c) => slot(dayKey(c.createdAt)).said.push(c.emotion));
  detected.forEach((r) => slot(dayKey(r.created_at)).seen.push(r.emotion));

  const out = new Map<string, DayMood>();
  byDay.forEach((s, k) => {
    const said = dominant(s.said);
    if (said) {
      out.set(k, { emotion: said, source: 'checkin', count: s.said.length });
      return;
    }
    const seen = dominant(s.seen);
    if (seen) out.set(k, { emotion: seen, source: 'detected', count: s.seen.length });
  });
  return out;
}

export type Agreement = {
  /** Check-ins que tinham leitura da câmera para comparar. */
  compared: number;
  agreed: number;
  /** 0–100. null quando não há amostra. */
  rate: number | null;
  /** Divergências mais comuns: "disse X, câmera viu Y". */
  mismatches: { said: EmotionKey; seen: EmotionKey; count: number }[];
};

/** Autopercepção × detecção. Só entra check-in feito com leitura confiável
 * na hora — sem isso não há o que comparar. */
export function perceptionAgreement(checkins: Checkin[]): Agreement {
  const pairs: Record<string, number> = {};
  let compared = 0;
  let agreed = 0;
  checkins.forEach((c) => {
    if (!c.detectedEmotion) return;
    compared++;
    if (c.detectedEmotion === c.emotion) {
      agreed++;
      return;
    }
    const key = `${c.emotion}>${c.detectedEmotion}`;
    pairs[key] = (pairs[key] ?? 0) + 1;
  });
  const mismatches = Object.entries(pairs)
    .map(([key, count]) => {
      const [said, seen] = key.split('>') as [EmotionKey, EmotionKey];
      return { said, seen, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return {
    compared,
    agreed,
    rate: compared >= MIN_SAMPLES ? Math.round((agreed / compared) * 100) : null,
    mismatches,
  };
}

export type TagPattern = {
  tag: CheckinTag;
  label: string;
  total: number;
  top: { emotion: EmotionKey; share: number };
  /** Fatia de emoções negativas (0–100) quando a tag está presente. */
  negativeShare: number;
};

/** Para cada contexto com amostra, a emoção que mais aparece junto. Ordena
 * pelos contextos mais "pesados" primeiro — é o que a pessoa quer descobrir. */
export function tagPatterns(checkins: Checkin[]): TagPattern[] {
  const labels = new Map<string, string>(CHECKIN_TAGS.map(([k, l]) => [k, l]));
  const byTag = new Map<CheckinTag, EmotionKey[]>();
  checkins.forEach((c) => {
    c.tags.forEach((t) => {
      const list = byTag.get(t) ?? [];
      list.push(c.emotion);
      byTag.set(t, list);
    });
  });

  const out: TagPattern[] = [];
  byTag.forEach((emotions, tag) => {
    if (emotions.length < MIN_SAMPLES) return;
    const counts: Partial<Record<EmotionKey, number>> = {};
    let negative = 0;
    emotions.forEach((e) => {
      counts[e] = (counts[e] ?? 0) + 1;
      if (NEGATIVE.has(e)) negative++;
    });
    const [topKey, topCount] = Object.entries(counts).sort((a, b) => b[1]! - a[1]!)[0] as [EmotionKey, number];
    out.push({
      tag,
      label: labels.get(tag) ?? tag,
      total: emotions.length,
      top: { emotion: topKey, share: Math.round((topCount / emotions.length) * 100) },
      negativeShare: Math.round((negative / emotions.length) * 100),
    });
  });
  return out.sort((a, b) => b.negativeShare - a.negativeShare || b.total - a.total);
}

export type SleepPattern = {
  /** Dormiu bem (4–5). */
  good: { n: number; negativeShare: number };
  /** Dormiu mal (1–2). */
  bad: { n: number; negativeShare: number };
};

/** Sono × humor do mesmo dia. Precisa de amostra dos dois lados; com um só
 * não há comparação, só um número solto. */
export function sleepPattern(checkins: Checkin[]): SleepPattern | null {
  const good: EmotionKey[] = [];
  const bad: EmotionKey[] = [];
  checkins.forEach((c) => {
    if (c.sleepQuality == null) return;
    if (c.sleepQuality >= 4) good.push(c.emotion);
    else if (c.sleepQuality <= 2) bad.push(c.emotion);
  });
  if (good.length < MIN_SAMPLES || bad.length < MIN_SAMPLES) return null;
  const share = (list: EmotionKey[]) =>
    Math.round((list.filter((e) => NEGATIVE.has(e)).length / list.length) * 100);
  return {
    good: { n: good.length, negativeShare: share(good) },
    bad: { n: bad.length, negativeShare: share(bad) },
  };
}

export function emotionLabel(key: EmotionKey): string {
  return EMOTIONS[key].label.toLowerCase();
}
