/**
 * Batimento pela câmera (rPPG).
 *
 * A cada pulso, o sangue que chega à pele muda a cor dela de forma ínfima —
 * invisível a olho nu, mas presente na média RGB da testa e das bochechas.
 * O nativo manda só essa média por quadro; aqui:
 *
 * 1. reamostra a série em passo fixo (a câmera não entrega quadros regulares);
 * 2. normaliza cada canal pela própria média e tira a tendência (luz que muda
 *    devagar) com média móvel — vira um passa-alta perto de 0,7 Hz;
 * 3. combina os canais pelo método CHROM (de Haan & Jeanne, 2013), que cancela
 *    boa parte do movimento e das variações de luz;
 * 4. mede a potência espectral de 42 a 180 bpm (0,7–3 Hz), 1 bpm por passo,
 *    e pega o pico;
 * 5. a confiança vem de quanto o pico se destaca da mediana da banda. Com
 *    movimento ou luz ruim o espectro fica espalhado e a confiança cai — e o
 *    app simplesmente não mostra nada.
 *
 * Não é aparelho médico, e a interface diz isso.
 */
export type SkinSample = { t: number; rgb: [number, number, number] | null };

export type HeartEstimate = { bpm: number; confidence: number };

export const WINDOW_MS = 20_000;
export const MIN_SPAN_MS = 12_000;
/** Buraco maior que isso (rosto sumiu) recomeça a janela. */
export const MAX_GAP_MS = 1_500;
/** Abaixo disso a estimativa não conta para a exibição. */
export const SHOW_CONFIDENCE = 0.5;
/** Estimativas seguidas que precisam concordar antes de mostrar um número. */
export const STABLE_RUNS = 3;
export const STABLE_SPREAD_BPM = 6;

const MIN_BPM = 42;
const MAX_BPM = 180;
const FS = 10;

type Point = { t: number; r: number; g: number; b: number };

export class RppgBuffer {
  private points: Point[] = [];

  push(sample: SkinSample) {
    if (!sample.rgb) {
      this.points = [];
      return;
    }
    const last = this.points[this.points.length - 1];
    if (last && (sample.t - last.t > MAX_GAP_MS || sample.t <= last.t)) this.points = [];
    const [r, g, b] = sample.rgb;
    this.points.push({ t: sample.t, r, g, b });
    const cutoff = sample.t - WINDOW_MS;
    while (this.points.length > 0 && this.points[0].t < cutoff) this.points.shift();
  }

  /** Segundos de sinal contínuo já acumulados (para a barra de progresso). */
  spanMs(): number {
    const n = this.points.length;
    return n < 2 ? 0 : this.points[n - 1].t - this.points[0].t;
  }

  reset() {
    this.points = [];
  }

  estimate(): HeartEstimate | null {
    return estimateHeartRate(this.points);
  }
}

function resample(points: Point[]): { r: number[]; g: number[]; b: number[] } | null {
  const start = points[0].t;
  const end = points[points.length - 1].t;
  const n = Math.floor(((end - start) / 1000) * FS);
  if (n < 2) return null;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = start + (i * 1000) / FS;
    while (j < points.length - 2 && points[j + 1].t < t) j++;
    const p = points[j];
    const q = points[j + 1];
    const k = q.t === p.t ? 0 : (t - p.t) / (q.t - p.t);
    r.push(p.r + (q.r - p.r) * k);
    g.push(p.g + (q.g - p.g) * k);
    b.push(p.b + (q.b - p.b) * k);
  }
  return { r, g, b };
}

/** Normaliza pela média e tira a tendência com média móvel de ~1,4 s. */
function detrend(x: number[]): number[] {
  const mean = x.reduce((a, v) => a + v, 0) / x.length;
  if (mean <= 0) return x.map(() => 0);
  const norm = x.map((v) => v / mean - 1);
  const half = Math.round(0.7 * FS);
  return norm.map((v, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(norm.length - 1, i + half); k++) {
      sum += norm[k];
      n++;
    }
    return v - sum / n;
  });
}

function std(x: number[]): number {
  const m = x.reduce((a, v) => a + v, 0) / x.length;
  return Math.sqrt(x.reduce((a, v) => a + (v - m) * (v - m), 0) / x.length);
}

function powerAt(signal: number[], hz: number): number {
  let re = 0;
  let im = 0;
  const w = (2 * Math.PI * hz) / FS;
  for (let i = 0; i < signal.length; i++) {
    // Janela de Hann: reduz o vazamento entre frequências vizinhas.
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (signal.length - 1));
    re += signal[i] * hann * Math.cos(w * i);
    im -= signal[i] * hann * Math.sin(w * i);
  }
  return re * re + im * im;
}

export function estimateHeartRate(points: Point[]): HeartEstimate | null {
  if (points.length < 2 || points[points.length - 1].t - points[0].t < MIN_SPAN_MS) return null;
  const series = resample(points);
  if (!series) return null;
  const r = detrend(series.r);
  const g = detrend(series.g);
  const b = detrend(series.b);
  const x = r.map((v, i) => 3 * v - 2 * g[i]);
  const y = r.map((v, i) => 1.5 * v + g[i] - 1.5 * b[i]);
  const sy = std(y);
  const alpha = sy > 0 ? std(x) / sy : 0;
  const s = x.map((v, i) => v - alpha * y[i]);
  if (std(s) === 0) return null;

  const spectrum: number[] = [];
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) spectrum.push(powerAt(s, bpm / 60));
  let peak = 0;
  for (let i = 1; i < spectrum.length; i++) if (spectrum[i] > spectrum[peak]) peak = i;
  const bpm = MIN_BPM + peak;

  // Pico sobre a mediana da banda. Em ruído puro o espectro é "plano com
  // picos por acaso" e essa razão fica perto de 7 (raramente passa de 20);
  // com pulso de verdade passa fácil de 30. Escala log: 8 → 0, 80 → 1.
  const sorted = [...spectrum].sort((p, q) => p - q);
  const median = sorted[Math.floor(sorted.length / 2)];
  const ratio = median > 0 ? spectrum[peak] / median : 0;
  const confidence = ratio > 0 ? Math.min(1, Math.max(0, Math.log10(ratio / 8))) : 0;
  return { bpm, confidence };
}

/**
 * Porta de exibição. Uma estimativa isolada pode ser ruído com pico por
 * acaso; o batimento real fica parado de uma janela para a outra, o ruído
 * pula. Só devolve um número quando as últimas estimativas confiáveis
 * concordam entre si.
 */
export class HeartGate {
  private recent: number[] = [];

  push(e: HeartEstimate | null): number | null {
    if (!e || e.confidence < SHOW_CONFIDENCE) {
      this.recent = [];
      return null;
    }
    this.recent.push(e.bpm);
    if (this.recent.length > STABLE_RUNS) this.recent.shift();
    if (this.recent.length < STABLE_RUNS) return null;
    if (Math.max(...this.recent) - Math.min(...this.recent) > STABLE_SPREAD_BPM) return null;
    return Math.round(this.recent.reduce((a, v) => a + v, 0) / this.recent.length);
  }

  reset() {
    this.recent = [];
  }
}
