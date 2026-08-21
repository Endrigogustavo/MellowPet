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
const BASELINE_FRACTION = 0.6;
const VOTE_WINDOW = 3;
const ENTRY_SCORE = 0.55;
const ENTRY_MARGIN = 0.15;
const ENTRY_UPDATES = 3;
const WARMUP_UPDATES = 3;
const MIN_DISPLAY_CONFIDENCE = 0.25;

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

function amplify(input: number, gate = 0.025) {
  if (input <= gate) return 0;
  return clip(Math.pow((input - gate) / (1 - gate), 0.5) * 1.25);
}

/** FACS aproximado sobre os blendshapes oficiais do MediaPipe. */
export function scoreBlendshapes(source: Blendshapes): Scores {
  const browInner = amplify(value(source, 'browInnerUp'));
  const browOuter = amplify(value(source, 'browOuterUpLeft', 'browOuterUpRight'));
  const browDown = amplify(value(source, 'browDownLeft', 'browDownRight'));
  const cheekRaise = amplify(value(source, 'cheekSquintLeft', 'cheekSquintRight'));
  const noseWrinkle = amplify(value(source, 'noseSneerLeft', 'noseSneerRight'), 0.03);
  const smile = amplify(value(source, 'mouthSmileLeft', 'mouthSmileRight'), 0.03);
  const frown = amplify(value(source, 'mouthFrownLeft', 'mouthFrownRight'));
  const mouthStretch = amplify(value(source, 'mouthStretchLeft', 'mouthStretchRight'), 0.03);
  const jawOpen = amplify(value(source, 'jawOpen'), 0.03);
  const eyesClosed = amplify(value(source, 'eyeBlinkLeft', 'eyeBlinkRight'), 0.03);
  const eyeWide = amplify(value(source, 'eyeWideLeft', 'eyeWideRight'));
  const eyeSquint = amplify(value(source, 'eyeSquintLeft', 'eyeSquintRight'), 0.03);
  const mouthPress = amplify(value(source, 'mouthPressLeft', 'mouthPressRight'), 0.03);
  const mouthPucker = amplify(value(source, 'mouthPucker'), 0.03);
  const mouthRoll = amplify(value(source, 'mouthRollLower', 'mouthRollUpper'), 0.03);
  const mouthShrug = amplify(value(source, 'mouthShrugLower', 'mouthShrugUpper'), 0.03);
  const mouthLower = amplify(value(source, 'mouthLowerDownLeft', 'mouthLowerDownRight'), 0.03);
  const mouthUpper = amplify(value(source, 'mouthUpperUpLeft', 'mouthUpperUpRight'), 0.03);
  const dimple = amplify(value(source, 'mouthDimpleLeft', 'mouthDimpleRight'), 0.03);
  const jawLateral = amplify(value(source, 'jawLeft', 'jawRight'), 0.03);

  const happy = Math.max(
    0,
    0.42 * smile + 0.24 * Math.min(smile, cheekRaise) + 0.18 * cheekRaise +
      0.1 * eyeSquint + 0.06 * dimple - 0.1 * browDown - 0.07 * frown
  );
  let sad =
    1.45 *
    (0.28 * frown + 0.22 * browInner + 0.13 * eyesClosed + 0.12 * browDown +
      0.09 * mouthStretch + 0.08 * mouthPress + 0.05 * mouthRoll + 0.07 * mouthLower);
  if (frown > 0 && browInner > 0) sad += 0.18 * Math.min(frown, browInner);
  sad = Math.max(0, sad - 0.1 * smile);

  let angry =
    1.45 *
    (0.31 * browDown + 0.22 * noseWrinkle + 0.15 * mouthStretch + 0.12 * mouthPress +
      0.08 * jawLateral + 0.07 * mouthShrug + 0.05 * mouthRoll);
  if (browDown > 0 && mouthPress > 0) angry += 0.14 * Math.min(browDown, mouthPress);
  angry = Math.max(0, angry - 0.1 * smile - 0.04 * browInner);

  const surprised = Math.max(
    0,
    0.22 * browInner + 0.2 * browOuter + 0.24 * jawOpen + 0.22 * eyeWide +
      0.06 * mouthShrug - 0.15 * eyesClosed
  );
  const mouthTension = Math.max(0, mouthStretch + mouthPress - 0.5 * jawOpen);
  let fearful =
    1.4 *
    (0.2 * browInner + 0.22 * eyeWide + 0.18 * mouthStretch + 0.14 * browDown +
      0.1 * browOuter + 0.1 * mouthPress + 0.14 * mouthTension);
  if (browInner > 0 && eyeWide > 0 && mouthStretch > 0) {
    fearful += 0.16 * Math.min(browInner, eyeWide, mouthStretch);
  }
  fearful = Math.max(0, fearful - 0.08 * smile - 0.04 * cheekRaise);

  let disgusted =
    1.45 *
    (0.3 * noseWrinkle + 0.16 * frown + 0.14 * browDown + 0.15 * mouthPucker +
      0.09 * mouthShrug + 0.12 * mouthUpper + 0.04 * jawLateral);
  if (noseWrinkle > 0 && mouthUpper > 0) {
    disgusted += 0.18 * Math.min(noseWrinkle, mouthUpper);
  }
  disgusted = Math.max(0, disgusted - 0.08 * smile - 0.04 * eyeWide);

  const evidence = { happy, sad, angry, surprised, disgusted, fearful };
  const maxEvidence = clip(Math.max(...Object.values(evidence)));
  const activity = average([
    browInner,
    browOuter,
    browDown,
    cheekRaise,
    noseWrinkle,
    smile,
    frown,
    mouthStretch,
    eyeWide,
    mouthPress,
  ]);
  const neutral = clip(0.5 * Math.pow(1 - maxEvidence, 1.6) * Math.max(0.25, 1 - activity));
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
    const alpha = topRaw >= 0.5 ? 0.78 : 0.68;
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
    const candidate = ranking[0];
    const candidateScore = this.ema[candidate];
    const margin = candidateScore - this.ema[ranking[1]];

    if (!this.current) {
      this.warmupCount += 1;
      if (this.warmupCount < WARMUP_UPDATES) {
        return this.result(frame, 'unknown', 'warming_up', 0, this.ema, computeTensionSignal(corrected));
      }
      this.current = candidate;
    } else if (candidate === this.current) {
      this.pending = null;
      this.pendingCount = 0;
    } else {
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
    }

    const confidence = clip(this.ema[this.current]);
    const uncertain = confidence < MIN_DISPLAY_CONFIDENCE;
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
        clip(score - (this.baseline?.[key] ?? 0) * BASELINE_FRACTION),
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
    return {
      observedExpression: expression,
      signalConfidence: Number(confidence.toFixed(3)),
      signalStatus: status,
      qualityScore: Number(frame.qualityScore.toFixed(3)),
      qualityReasons: frame.qualityReasons,
      tensionSignal: tensionSignal === null ? null : Number(tensionSignal.toFixed(3)),
      capturedAtMs: frame.capturedAtMs,
      modelVersion: frame.modelVersion,
      pipelineVersion: frame.pipelineVersion,
      calibrationProgress: calibration.active
        ? calibration.accepted / calibration.required
        : calibration.complete
          ? 1
          : null,
      scores,
      latencyMs: frame.latencyMs,
      droppedFrames: frame.droppedFrames,
      calibration,
    };
  }
}
