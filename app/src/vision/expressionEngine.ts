import type { VisionFramePayload } from '../../modules/mellow-vision';
import type { EmotionKey } from '../data/emotions';
import type { SignalStatus, VisionSnapshot } from './contracts';

type ObservedExpression = Exclude<EmotionKey, 'unknown'>;
type Scores = Record<ObservedExpression, number>;
type Blendshapes = Record<string, number>;

export type CalibrationState = {
  active: boolean;
  accepted: number;
  required: number;
  complete: boolean;
};

export type ExpressionEngineResult = VisionSnapshot & {
  scores: Scores;
  latencyMs: number;
  droppedFrames: number;
  calibration: CalibrationState;
};

const EXPRESSIONS: ObservedExpression[] = [
  'happy',
  'sad',
  'angry',
  'neutral',
  'surprised',
  'disgusted',
  'fearful',
];
const ZERO_SCORES: Scores = {
  happy: 0,
  sad: 0,
  angry: 0,
  neutral: 0,
  surprised: 0,
  disgusted: 0,
  fearful: 0,
};

const CALIBRATION_FRAMES = 10;
const BASELINE_FRACTION = 0.75;
const BASELINE_DEADBAND = 0.012;
const VOTE_WINDOW = 3;
// Expressoes genuinas (nao exageradas) de raiva/tristeza produzem blendshapes
// bem mais fracos que os padroes de teste — os limiares antigos (0.5/0.11/3
// frames) raramente eram alcancados por elas na pratica e o motor ficava
// preso em "neutro"/"incerto". Reduzidos para o sistema comprometer-se mais
// rapido com uma leitura, aceitando um pouco mais de risco de falso positivo
// em troca de sensibilidade real.
const ENTRY_SCORE = 0.36;
const ENTRY_MARGIN = 0.05;
const ENTRY_UPDATES = 2;
const WARMUP_UPDATES = 2;
const MIN_DISPLAY_CONFIDENCE = 0.25;
const ABSTAIN_UPDATES = 2;
// "Neutro" carrega um residual (1 - evidencia de outra classe) em vez de
// evidencia direta propria, entao vence o ranking bruto com facilidade
// mesmo havendo sinal real espalhado entre 2-3 emocoes. Precisa de uma
// maioria clara (55%) pra ser aceito — abaixo disso, a segunda colocada
// tem preferencia (ver o fallback em process()).
const NEUTRAL_ENTRY_SCORE = 0.7;
const NEUTRAL_ENTRY_MARGIN = 0.15;

export const EXPRESSION_CLASSIFIER_VERSION = 'expression-v3.2.0-neutral-bias-fix';

const average = (values: number[]) =>
  values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
const clip = (input: number) => Math.min(1, Math.max(0, Number.isFinite(input) ? input : 0));

function normalize(scores: Scores): Scores {
  const sum = EXPRESSIONS.reduce((total, expression) => total + Math.max(0, scores[expression]), 0);
  if (sum <= 0) return { ...ZERO_SCORES, neutral: 1 };
  return Object.fromEntries(
    EXPRESSIONS.map((expression) => [expression, Math.max(0, scores[expression]) / sum])
  ) as Scores;
}

function value(source: Blendshapes, ...names: string[]) {
  return average(names.map((name) => clip(source[name] ?? 0)));
}

function activate(input: number, onset = 0.04, saturation = 0.72) {
  const scaled = clip((input - onset) / Math.max(0.01, saturation - onset));
  return scaled * scaled * (3 - 2 * scaled);
}

function bilateral(
  source: Blendshapes,
  left: string,
  right: string,
  onset = 0.04,
  saturation = 0.72,
  symmetryWeight = 0.2
) {
  const leftValue = activate(value(source, left), onset, saturation);
  const rightValue = activate(value(source, right), onset, saturation);
  const mean = (leftValue + rightValue) / 2;
  const symmetry = 1 - Math.abs(leftValue - rightValue);
  return clip(mean * (1 - symmetryWeight + symmetryWeight * symmetry));
}

/**
 * FACS aproximado sobre os 52 blendshapes oficiais do MediaPipe.
 *
 * A saída é uma distribuição seletiva, não uma alegação diagnóstica. Cada
 * classe combina sinais complementares e desconta sinais contraditórios.
 * Isso evita que um único coeficiente ruidoso (por exemplo mouthSmile) force
 * uma emoção e reduz as trocas entre classes visualmente parecidas.
 */
export function scoreBlendshapes(source: Blendshapes): Scores {
  // Onset/saturation mais baixos nos AUs centrais de raiva/tristeza: uma
  // expressao genuina raramente ativa um blendshape acima de ~0.5-0.6, entao
  // saturar por volta desse ponto (em vez de ~0.68-0.7) evita descontar
  // sinal real como se fosse ruido.
  // browInnerUp e noseSneer sao AUs sutis que o estimador de blendshapes do
  // MediaPipe tende a reportar bem mais fracos que AUs geometricamente
  // obvios (smile, browDown, jawOpen, eyeWide) — mesmo numa expressao real
  // e clara, o valor bruto raramente passa de ~0.3-0.4. Saturar bem mais
  // cedo (~0.38-0.45) e o que faz tristeza/nojo/medo ficarem tao sensiveis
  // quanto feliz/raiva/surpresa, que ja funcionavam bem.
  const browInner = activate(value(source, 'browInnerUp'), 0.015, 0.4);
  const browOuter = bilateral(source, 'browOuterUpLeft', 'browOuterUpRight', 0.03, 0.56);
  const browDown = bilateral(source, 'browDownLeft', 'browDownRight', 0.03, 0.55, 0.12);
  const cheekRaise = bilateral(source, 'cheekSquintLeft', 'cheekSquintRight', 0.04, 0.7);
  const noseWrinkle = bilateral(source, 'noseSneerLeft', 'noseSneerRight', 0.03, 0.42, 0.1);
  const smile = bilateral(source, 'mouthSmileLeft', 'mouthSmileRight', 0.045, 0.68, 0.3);
  const frown = bilateral(source, 'mouthFrownLeft', 'mouthFrownRight', 0.025, 0.46, 0.16);
  const mouthStretch = bilateral(source, 'mouthStretchLeft', 'mouthStretchRight', 0.04, 0.58, 0.12);
  const jawOpen = activate(value(source, 'jawOpen'), 0.04, 0.6);
  // Chorar de verdade costuma fechar os olhos com força — bem mais que um
  // piscar comum — entao satura mais devagar (onset mais alto) que os
  // outros AUs, mas ainda antes do extremo de 0.78.
  const eyesClosed = bilateral(source, 'eyeBlinkLeft', 'eyeBlinkRight', 0.08, 0.62, 0.08);
  const eyeWide = bilateral(source, 'eyeWideLeft', 'eyeWideRight', 0.03, 0.55, 0.14);
  const eyeSquint = bilateral(source, 'eyeSquintLeft', 'eyeSquintRight', 0.04, 0.58, 0.12);
  const mouthPress = bilateral(source, 'mouthPressLeft', 'mouthPressRight', 0.04, 0.58, 0.12);
  const mouthPucker = activate(value(source, 'mouthPucker'), 0.03, 0.45);
  const mouthRoll = bilateral(source, 'mouthRollLower', 'mouthRollUpper', 0.04, 0.6, 0);
  const mouthShrug = bilateral(source, 'mouthShrugLower', 'mouthShrugUpper', 0.04, 0.6, 0);
  const mouthLower = bilateral(source, 'mouthLowerDownLeft', 'mouthLowerDownRight', 0.035, 0.58, 0.12);
  const mouthUpper = bilateral(source, 'mouthUpperUpLeft', 'mouthUpperUpRight', 0.03, 0.42, 0.12);
  const dimple = bilateral(source, 'mouthDimpleLeft', 'mouthDimpleRight', 0.045, 0.7, 0.2);
  const jawLateral = activate(value(source, 'jawLeft', 'jawRight'), 0.04, 0.6);

  const happy = Math.max(
    0,
    (0.46 * smile + 0.18 * cheekRaise + 0.11 * dimple + 0.09 * eyeSquint +
      0.16 * Math.min(smile, Math.max(cheekRaise, dimple))) * (0.55 + 0.45 * smile) -
      0.24 * browDown - 0.18 * frown - 0.14 * mouthPress - 0.12 * noseWrinkle
  );

  // Duas formas de tristeza: a "quieta" (boca fechada, cantos pra baixo,
  // sobrancelha interna erguida) e a de choro de verdade (olhos apertados,
  // boca aberta num muxoxo, testa tensa). Sao AUs bem diferentes — somar as
  // duas em paralelo evita que o choro (sem frown de boca fechada) fique sem
  // pontuacao nenhuma de tristeza.
  const quietSad =
    0.32 * frown + 0.3 * browInner + 0.12 * mouthLower + 0.08 * mouthPress +
    0.06 * mouthRoll + 0.22 * Math.min(frown, browInner);
  const cryingSad =
    0.3 * eyesClosed + 0.22 * jawOpen + 0.18 * browInner + 0.1 * mouthStretch +
    0.2 * Math.min(eyesClosed, jawOpen);
  const sad = Math.max(
    0,
    Math.max(quietSad, cryingSad) + 0.1 * Math.min(quietSad, cryingSad) -
      0.24 * smile - 0.09 * cheekRaise - 0.1 * eyeWide - 0.05 * noseWrinkle
  );

  const angry = Math.max(
    0,
    0.4 * browDown + 0.24 * mouthPress + 0.18 * noseWrinkle + 0.11 * eyeSquint +
      0.07 * mouthStretch + 0.04 * jawLateral + 0.03 * mouthRoll +
      0.16 * Math.min(browDown, Math.max(mouthPress, noseWrinkle, eyeSquint)) -
      0.24 * smile - 0.14 * cheekRaise - 0.1 * browOuter -
      // Sobrancelha interna erguida e olhos fechados sao tipicos de
      // preocupacao/choro, nao de raiva (que tende a olhar fixo, olhos
      // abertos) — sem esse desconto mais forte, testa franzida + choro
      // vencia como raiva em vez de tristeza.
      0.32 * browInner - 0.22 * eyesClosed
  );

  const surprised = Math.max(
    0,
    0.25 * jawOpen + 0.22 * eyeWide + 0.18 * browOuter + 0.13 * browInner +
      0.22 * Math.min(eyeWide, Math.max(jawOpen, browOuter)) - 0.24 * eyesClosed -
      0.16 * browDown - 0.12 * mouthPress - 0.08 * noseWrinkle
  );

  const mouthTension = clip(0.55 * mouthStretch + 0.3 * mouthPress + 0.15 * browDown);
  const fearful = Math.max(
    0,
    // Sem desconto por eyesClosed aqui: eyeWide ja e naturalmente baixo
    // quando os olhos estao fechados (vem do proprio blendshape), descontar
    // os dois ao mesmo tempo penalizava medo em dobro e empurrava pra sad.
    0.26 * eyeWide + 0.22 * mouthStretch + 0.2 * browInner + 0.12 * browOuter +
      0.09 * browDown + 0.06 * mouthPress + 0.12 * mouthTension +
      0.18 * Math.min(eyeWide, mouthStretch, Math.max(browInner, browOuter)) -
      0.2 * smile - 0.1 * cheekRaise - 0.1 * noseWrinkle - 0.06 * jawOpen
  );

  const disgusted = Math.max(
    0,
    0.44 * noseWrinkle + 0.26 * mouthUpper + 0.13 * mouthPucker + 0.1 * frown +
      0.08 * browDown + 0.05 * mouthShrug + 0.03 * jawLateral +
      0.24 * Math.min(noseWrinkle, mouthUpper) - 0.2 * smile -
      0.1 * cheekRaise - 0.09 * eyeWide - 0.06 * jawOpen
  );

  const evidence = { happy, sad, angry, surprised, disgusted, fearful };
  // Uma expressao real costuma acender mais de uma classe correlata ao
  // mesmo tempo (choro ativa sad E fearful, por exemplo). Medir "o quanto a
  // cena nao e neutra" só pelo pico isolado subestimava isso — cada classe
  // ficava moderada, nenhuma "vencia" sozinha, e o residual de neutro
  // engolia o resto mesmo com bastante evidencia real somada.
  const sortedEvidence = Object.values(evidence).sort((left, right) => right - left);
  const topEvidence = clip(sortedEvidence[0] ?? 0);
  const secondEvidence = clip(sortedEvidence[1] ?? 0);
  const combinedEvidence = clip(topEvidence + 0.5 * secondEvidence);
  const activity = average([browInner, browOuter, browDown, cheekRaise, noseWrinkle, smile, frown, mouthStretch, eyeWide, mouthPress]);
  const modelNeutral = clip(Math.max(source._neutral ?? 0, source.neutral ?? 0));
  const neutral = clip(
    0.1 + 0.58 * Math.pow(1 - combinedEvidence, 1.9) * Math.max(0.25, 1 - 0.6 * activity) +
      0.2 * modelNeutral
  );
  return normalize({ ...evidence, neutral });
}

export function computeTensionSignal(source: Blendshapes) {
  return clip(
    0.3 * value(source, 'browDownLeft', 'browDownRight') +
      0.25 * value(source, 'mouthStretchLeft', 'mouthStretchRight') +
      0.2 * value(source, 'mouthPressLeft', 'mouthPressRight') +
      0.15 * value(source, 'mouthRollLower', 'mouthRollUpper') +
      0.1 * value(source, 'eyeBlinkLeft', 'eyeBlinkRight')
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export class ExpressionEngine {
  private calibrationBuffer: Blendshapes[] = [];
  private calibrationActive = false;
  private baseline: Blendshapes | null = null;
  private votes: Scores[] = [];
  private ema: Scores | null = null;
  private current: ObservedExpression | null = null;
  private pending: ObservedExpression | null = null;
  private pendingCount = 0;
  private warmupCount = 0;
  private warmupCandidate: ObservedExpression | null = null;
  private ambiguityCount = 0;

  beginCalibration() {
    this.calibrationBuffer = [];
    this.calibrationActive = true;
    this.resetTemporal();
  }

  cancelCalibration() {
    this.calibrationBuffer = [];
    this.calibrationActive = false;
  }

  clearCalibration() {
    this.cancelCalibration();
    this.baseline = null;
    this.resetTemporal();
  }

  exportBaseline() {
    return this.baseline ? { ...this.baseline } : null;
  }

  importBaseline(baseline: Blendshapes | null) {
    this.baseline = baseline
      ? Object.fromEntries(Object.entries(baseline).map(([key, score]) => [key, clip(score)]))
      : null;
    this.resetTemporal();
  }

  getCalibrationState(): CalibrationState {
    return {
      active: this.calibrationActive,
      accepted: this.calibrationBuffer.length,
      required: CALIBRATION_FRAMES,
      complete: this.baseline !== null && !this.calibrationActive,
    };
  }

  process(frame: VisionFramePayload): ExpressionEngineResult {
    if (frame.status !== 'ready') {
      this.pending = null;
      this.pendingCount = 0;
      this.warmupCount = 0;
      return this.result(frame, 'unknown', frame.status, 0, { ...ZERO_SCORES }, null);
    }

    if (this.calibrationActive) {
      this.calibrationBuffer.push({ ...frame.blendshapes });
      if (this.calibrationBuffer.length >= CALIBRATION_FRAMES) {
        const keys = new Set(this.calibrationBuffer.flatMap((snapshot) => Object.keys(snapshot)));
        this.baseline = Object.fromEntries(
          [...keys].map((key) => [key, median(this.calibrationBuffer.map((snapshot) => snapshot[key] ?? 0))])
        );
        this.calibrationActive = false;
        this.calibrationBuffer = [];
        this.resetTemporal();
      }
      return this.result(frame, 'unknown', 'warming_up', 0, { ...ZERO_SCORES }, null);
    }

    const corrected = this.subtractBaseline(frame.blendshapes);
    const rawScores = scoreBlendshapes(corrected);
    const voted = this.vote(rawScores);
    const topRaw = Math.max(...EXPRESSIONS.map((expression) => voted[expression]));
    const alpha = clip(0.38 + 0.34 * frame.qualityScore + 0.2 * topRaw);
    this.ema = this.ema
      ? normalize(
          Object.fromEntries(
            EXPRESSIONS.map((expression) => [
              expression,
              (1 - alpha) * this.ema![expression] + alpha * voted[expression],
            ])
          ) as Scores
        )
      : voted;

    const ranking = [...EXPRESSIONS].sort((left, right) => this.ema![right] - this.ema![left]);
    let candidate = ranking[0];
    let candidateScore = this.ema[candidate];
    let margin = candidateScore - this.ema[ranking[1]];
    let candidateEligible =
      candidateScore >= (candidate === 'neutral' ? NEUTRAL_ENTRY_SCORE : ENTRY_SCORE) &&
      margin >= (candidate === 'neutral' ? NEUTRAL_ENTRY_MARGIN : ENTRY_MARGIN);

    // "Neutro" carrega um residual (1 - evidencia das outras classes), entao
    // ele costuma vencer o ranking bruto mesmo quando ha sinal real de uma
    // emocao especifica, so que espalhado entre 2-3 classes correlatas. Se
    // neutro nao bate o proprio limiar (mais alto), a segunda colocada e
    // normalmente o sinal de verdade — tenta ela em vez de desistir.
    if (!candidateEligible && candidate === 'neutral') {
      const runnerUp = ranking[1];
      const runnerUpScore = this.ema[runnerUp];
      const runnerUpMargin = runnerUpScore - this.ema[ranking[2]];
      if (runnerUpScore >= ENTRY_SCORE * 0.85 && runnerUpMargin >= ENTRY_MARGIN * 0.7) {
        candidate = runnerUp;
        candidateScore = runnerUpScore;
        margin = runnerUpMargin;
        candidateEligible = true;
      }
    }

    if (!this.current) {
      if (!candidateEligible) {
        this.warmupCandidate = null;
        this.warmupCount = 0;
        return this.result(frame, 'unknown', 'uncertain', 0, this.ema, computeTensionSignal(corrected));
      }

      if (this.warmupCandidate === candidate) this.warmupCount += 1;
      else {
        this.warmupCandidate = candidate;
        this.warmupCount = 1;
      }
      if (this.warmupCount < WARMUP_UPDATES) {
        return this.result(frame, 'unknown', 'warming_up', 0, this.ema, computeTensionSignal(corrected));
      }

      this.current = candidate;
      this.warmupCandidate = null;
      this.ambiguityCount = 0;
    } else if (candidate === this.current && candidateEligible) {
      this.pending = null;
      this.pendingCount = 0;
      this.ambiguityCount = 0;
    } else if (candidateEligible) {
      this.ambiguityCount = 0;
      if (this.pending === candidate) this.pendingCount += 1;
      else {
        this.pending = candidate;
        this.pendingCount = 1;
      }
      if (
        this.pendingCount >= ENTRY_UPDATES &&
        candidateScore >= ENTRY_SCORE &&
        margin >= ENTRY_MARGIN
      ) {
        this.current = candidate;
        this.pending = null;
        this.pendingCount = 0;
      }
    } else {
      this.pending = null;
      this.pendingCount = 0;
      this.ambiguityCount += 1;
    }

    const confidence = clip(this.ema[this.current]);
    const uncertain =
      confidence < MIN_DISPLAY_CONFIDENCE ||
      this.ambiguityCount >= ABSTAIN_UPDATES;
    return this.result(
      frame,
      uncertain ? 'unknown' : this.current,
      uncertain ? 'uncertain' : 'ready',
      uncertain ? 0 : confidence,
      this.ema,
      computeTensionSignal(corrected)
    );
  }

  private subtractBaseline(source: Blendshapes): Blendshapes {
    if (!this.baseline) return source;
    return Object.fromEntries(
      Object.entries(source).map(([key, score]) => [
        key,
        clip(
          (score - (this.baseline?.[key] ?? 0) * BASELINE_FRACTION - BASELINE_DEADBAND) /
            Math.max(0.55, 1 - (this.baseline?.[key] ?? 0) * 0.45)
        ),
      ])
    );
  }

  private vote(scores: Scores): Scores {
    this.votes.push(scores);
    if (this.votes.length > VOTE_WINDOW) this.votes.shift();
    const totalWeight = this.votes.reduce((sum, _score, index) => sum + index + 1, 0);
    return normalize(
      Object.fromEntries(
        EXPRESSIONS.map((expression) => [
          expression,
          this.votes.reduce(
            (sum, score, index) => sum + (index + 1) * score[expression],
            0
          ) / totalWeight,
        ])
      ) as Scores
    );
  }

  private resetTemporal() {
    this.votes = [];
    this.ema = null;
    this.current = null;
    this.pending = null;
    this.pendingCount = 0;
    this.warmupCount = 0;
    this.warmupCandidate = null;
    this.ambiguityCount = 0;
  }

  private result(
    frame: VisionFramePayload,
    expression: EmotionKey,
    status: SignalStatus,
    confidence: number,
    scores: Scores,
    tensionSignal: number | null
  ): ExpressionEngineResult {
    const calibration = this.getCalibrationState();
    // Expressoes reais raramente sao puras — as classes mais fortes alem da
    // vencedora sao sinal de mistura real (ex.: "triste" com um pouco de
    // "medo" junto). Ate 2 entradas (junto da primaria, ate 3 emocoes no
    // total), so expostas quando ha leitura de verdade e peso suficiente
    // pra nao ser ruido.
    const secondaryEmotions: { expression: EmotionKey; confidence: number }[] =
      status === 'ready'
        ? EXPRESSIONS.filter((candidate) => candidate !== expression)
            .sort((left, right) => scores[right] - scores[left])
            .slice(0, 2)
            .filter((candidate) => scores[candidate] >= 0.16)
            .map((candidate) => ({ expression: candidate, confidence: Number(scores[candidate].toFixed(3)) }))
        : [];
    return {
      observedExpression: expression,
      signalConfidence: Number(confidence.toFixed(3)),
      signalStatus: status,
      qualityScore: Number(frame.qualityScore.toFixed(3)),
      qualityReasons: frame.qualityReasons,
      tensionSignal: tensionSignal === null ? null : Number(tensionSignal.toFixed(3)),
      capturedAtMs: frame.capturedAtMs,
      modelVersion: frame.modelVersion,
      pipelineVersion: `${frame.pipelineVersion}+${EXPRESSION_CLASSIFIER_VERSION}`,
      calibrationProgress: calibration.active
        ? calibration.accepted / calibration.required
        : calibration.complete
          ? 1
          : null,
      secondaryEmotions,
      scores,
      latencyMs: frame.latencyMs,
      droppedFrames: frame.droppedFrames,
      calibration,
    };
  }
}
