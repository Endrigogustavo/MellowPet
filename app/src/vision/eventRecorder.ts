import type { EmotionKey } from '../data/emotions';
import type { ExpressionEngineResult } from './expressionEngine';
import type {
  KnownVisualExpression,
  VisionEventEnvelope,
  VisionEventKind,
  VisionIntervalEvent,
} from './eventContracts';

const HEARTBEAT_INTERVAL_MS = 15_000;
const QUALITY_CONFIG_VERSION = 'quality@1.0.0';
const EXPRESSIONS: KnownVisualExpression[] = [
  'happy',
  'sad',
  'angry',
  'neutral',
  'surprised',
  'disgusted',
  'fearful',
];

let idSequence = 0;

export function createVisionId(prefix = 'evt') {
  idSequence = (idSequence + 1) % 1_679_616;
  const time = Date.now().toString(36);
  const sequence = idSequence.toString(36).padStart(4, '0');
  const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `${prefix}_${time}_${sequence}_${random}`.slice(0, 64);
}

type IntervalAccumulator = {
  eventId: string;
  expression: EmotionKey;
  status: ExpressionEngineResult['signalStatus'];
  startedAtMs: number;
  startedAtMonotonicMs: number;
  lastAtMs: number;
  lastMonotonicMs: number;
  samples: number;
  acceptedSamples: number;
  confidenceSum: number;
  qualitySum: number;
  tensionSum: number;
  tensionSamples: number;
  scoreSums: Record<KnownVisualExpression, number>;
  reasons: Set<string>;
  modelVersion: string;
  pipelineVersion: string;
  calibrated: boolean;
};

const zeroScores = () =>
  Object.fromEntries(EXPRESSIONS.map((expression) => [expression, 0])) as Record<
    KnownVisualExpression,
    number
  >;

const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now();
const mean = (sum: number, count: number) => (count > 0 ? sum / count : 0);
const clip = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export class VisionEventRecorder {
  private current: IntervalAccumulator | null = null;
  private readonly sessionId: string;
  private readonly deviceSessionId: string;
  private userId?: string;

  constructor(sessionId: string, deviceSessionId: string, userId?: string) {
    this.sessionId = sessionId;
    this.deviceSessionId = deviceSessionId;
    this.userId = userId;
  }

  /** `VisionEngine` monta uma vez na raiz do app, antes do login terminar —
   * o construtor sempre recebe `userId` vazio. Isso deixa o recorder pegar
   * o id real assim que a sessão fica disponível, em vez de gravar todo
   * evento da sessão inteira sem dono (e cair no descarte do eventQueue). */
  setUserId(userId: string | undefined) {
    this.userId = userId;
  }

  get currentEventId() {
    return this.current?.eventId ?? null;
  }

  record(result: ExpressionEngineResult): VisionEventEnvelope[] {
    const nowMono = monotonicNow();
    const events: VisionEventEnvelope[] = [];
    const changed =
      this.current !== null &&
      (this.current.expression !== result.observedExpression ||
        this.current.status !== result.signalStatus);
    const heartbeatDue =
      this.current !== null &&
      nowMono - this.current.startedAtMonotonicMs >= HEARTBEAT_INTERVAL_MS;

    if (changed || heartbeatDue) {
      const finished = this.finalize(changed ? 'transition' : 'heartbeat');
      if (finished) events.push(finished);
    }

    if (!this.current) this.current = this.start(result, nowMono);
    this.accumulate(this.current, result, nowMono);
    return events;
  }

  finish(): VisionEventEnvelope | null {
    return this.finalize('session_end');
  }

  private start(result: ExpressionEngineResult, nowMono: number): IntervalAccumulator {
    return {
      eventId: createVisionId(),
      expression: result.observedExpression,
      status: result.signalStatus,
      startedAtMs: result.capturedAtMs,
      startedAtMonotonicMs: nowMono,
      lastAtMs: result.capturedAtMs,
      lastMonotonicMs: nowMono,
      samples: 0,
      acceptedSamples: 0,
      confidenceSum: 0,
      qualitySum: 0,
      tensionSum: 0,
      tensionSamples: 0,
      scoreSums: zeroScores(),
      reasons: new Set(),
      modelVersion: result.modelVersion,
      pipelineVersion: result.pipelineVersion,
      calibrated: result.calibration.complete,
    };
  }

  private accumulate(
    accumulator: IntervalAccumulator,
    result: ExpressionEngineResult,
    nowMono: number
  ) {
    accumulator.lastAtMs = Math.max(accumulator.lastAtMs, result.capturedAtMs);
    accumulator.lastMonotonicMs = Math.max(accumulator.lastMonotonicMs, nowMono);
    accumulator.samples += 1;
    accumulator.acceptedSamples += result.signalStatus === 'ready' ? 1 : 0;
    accumulator.confidenceSum += clip(result.signalConfidence);
    accumulator.qualitySum += clip(result.qualityScore);
    if (result.tensionSignal !== null) {
      accumulator.tensionSum += clip(result.tensionSignal);
      accumulator.tensionSamples += 1;
    }
    EXPRESSIONS.forEach((expression) => {
      accumulator.scoreSums[expression] += clip(result.scores[expression]);
    });
    result.qualityReasons.forEach((reason) => accumulator.reasons.add(reason));
    accumulator.modelVersion = result.modelVersion;
    accumulator.pipelineVersion = result.pipelineVersion;
    accumulator.calibrated ||= result.calibration.complete;
  }

  private finalize(kind: VisionEventKind): VisionEventEnvelope | null {
    const interval = this.current;
    this.current = null;
    if (!interval || interval.samples === 0) return null;

    let distribution: VisionIntervalEvent['expression_distribution'] = {};
    if (interval.expression !== 'unknown') {
      const averaged = Object.fromEntries(
        EXPRESSIONS.map((expression) => [
          expression,
          mean(interval.scoreSums[expression], interval.samples),
        ])
      ) as Record<KnownVisualExpression, number>;
      const total = Object.values(averaged).reduce((sum, value) => sum + value, 0);
      distribution = Object.fromEntries(
        EXPRESSIONS.map((expression) => [
          expression,
          total > 0 ? averaged[expression] / total : expression === 'neutral' ? 1 : 0,
        ])
      );
    }

    const event: VisionIntervalEvent = {
      event_id: interval.eventId,
      kind,
      started_at: new Date(interval.startedAtMs).toISOString(),
      ended_at: new Date(interval.lastAtMs).toISOString(),
      duration_ms: Math.max(
        0,
        Math.round(interval.lastMonotonicMs - interval.startedAtMonotonicMs)
      ),
      observed_expression: interval.expression,
      expression_distribution: distribution,
      signal_confidence: clip(mean(interval.confidenceSum, interval.samples)),
      quality: {
        mean: clip(mean(interval.qualitySum, interval.samples)),
        accepted_coverage: clip(mean(interval.acceptedSamples, interval.samples)),
        reasons: [...interval.reasons].slice(0, 16),
      },
      tension_signal:
        interval.tensionSamples > 0
          ? clip(mean(interval.tensionSum, interval.tensionSamples))
          : null,
      model_version: interval.modelVersion,
      pipeline_version: interval.pipelineVersion,
      quality_config_version: QUALITY_CONFIG_VERSION,
      calibration_version: interval.calibrated ? 'personal-baseline@1' : null,
      source: 'mobile',
    };
    return {
      session_id: this.sessionId,
      device_session_id: this.deviceSessionId,
      ...(this.userId ? { user_id: this.userId } : null),
      event,
    };
  }
}
