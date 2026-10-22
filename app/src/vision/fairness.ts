/**
 * Auditoria de viés: quanto a leitura facial acerta, medida contra o que a
 * pessoa disse no check-in.
 *
 * Dois níveis:
 * - pessoal: por emoção lida ("quando a câmera diz bravo, você concorda X%");
 * - comunidade: por grupo autodeclarado (óculos, tom de pele, idade, barba),
 *   vindo de uma RPC que só devolve grupos com k ≥ 5 pessoas.
 *
 * Sem IO aqui — testável e reaproveitável.
 */
export type AuditAttribute = 'oculos' | 'tom_de_pele' | 'idade' | 'barba';

export type AuditProfile = {
  glasses: 'sim' | 'nao' | 'as_vezes' | null;
  skinTone: number | null;
  ageBand: '<18' | '18-24' | '25-34' | '35-49' | '50+' | null;
  facialHair: 'sim' | 'nao' | null;
};

export const EMPTY_PROFILE: AuditProfile = { glasses: null, skinTone: null, ageBand: null, facialHair: null };

export const ATTRIBUTE_LABEL: Record<AuditAttribute, string> = {
  oculos: 'Óculos',
  tom_de_pele: 'Tom de pele (escala Monk)',
  idade: 'Idade',
  barba: 'Barba',
};

export const GROUP_LABEL: Record<string, string> = {
  sim: 'sim',
  nao: 'não',
  as_vezes: 'às vezes',
};

/** Mínimo de pessoas por grupo. A RPC aplica; o cliente repete por defesa. */
export const K_MIN = 5;
/** Abaixo disso a taxa oscila demais para dizer algo. */
export const MIN_SAMPLES = 20;
/** Diferença (pontos percentuais) a partir da qual um grupo é sinalizado. */
export const GAP_ALERT = 0.15;

export type LabeledPair = { said: string; seen: string | null };

export type Agreement = { samples: number; agree: number; rate: number | null };

const rate = (agree: number, samples: number) => (samples > 0 ? agree / samples : null);

/** Concordância da pessoa com a câmera, no total e por emoção lida. */
export function personalAgreement(pairs: LabeledPair[]): {
  overall: Agreement;
  byEmotion: Record<string, Agreement>;
} {
  let samples = 0;
  let agree = 0;
  const by: Record<string, { samples: number; agree: number }> = {};
  for (const p of pairs) {
    if (!p.seen) continue;
    samples += 1;
    const ok = p.said === p.seen;
    if (ok) agree += 1;
    const b = (by[p.seen] ??= { samples: 0, agree: 0 });
    b.samples += 1;
    if (ok) b.agree += 1;
  }
  const byEmotion: Record<string, Agreement> = {};
  for (const [k, v] of Object.entries(by)) byEmotion[k] = { ...v, rate: rate(v.agree, v.samples) };
  return { overall: { samples, agree, rate: rate(agree, samples) }, byEmotion };
}

export type GroupRow = { attribute: string; grp: string; users: number; samples: number; agree: number };

export type GroupResult = GroupRow & { rate: number; flagged: boolean; thin: boolean };

/**
 * Prepara o relatório da comunidade: descarta grupos abaixo de k (mesmo que
 * o servidor os mande), calcula a taxa e sinaliza grupos que ficam bem abaixo
 * dos outros grupos do mesmo atributo — é aí que mora o viés.
 */
export function analyzeGroups(rows: GroupRow[]): GroupResult[] {
  const safe = rows.filter((r) => r.users >= K_MIN && r.samples > 0);
  const byAttr = new Map<string, { samples: number; agree: number }>();
  for (const r of safe) {
    const a = byAttr.get(r.attribute) ?? { samples: 0, agree: 0 };
    a.samples += r.samples;
    a.agree += r.agree;
    byAttr.set(r.attribute, a);
  }
  return safe.map((r) => {
    const own = r.agree / r.samples;
    const a = byAttr.get(r.attribute)!;
    const others = a.samples - r.samples;
    const othersRate = others > 0 ? (a.agree - r.agree) / others : own;
    const thin = r.samples < MIN_SAMPLES;
    return { ...r, rate: own, thin, flagged: !thin && othersRate - own >= GAP_ALERT };
  });
}

/** Faixa da escala Monk usada no relatório (a mesma da RPC). */
export function skinBand(tone: number): '1-3' | '4-6' | '7-10' {
  return tone <= 3 ? '1-3' : tone <= 6 ? '4-6' : '7-10';
}
