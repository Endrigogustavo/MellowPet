import type { VisionFramePayload } from '../../modules/mellow-vision';
import type { ExpressionEngineResult } from './expressionEngine';

const MAX_LATENCY_SAMPLES = 1_200;

export type VisionTelemetrySnapshot = {
  sampleCount: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  unknownRate: number;
  qualityCoverage: number;
  receivedFrames: number;
  processedFrames: number;
  droppedFrames: number;
  droppedRate: number;
  effectiveFps: number;
  thermalState: string;
  initializationLatencyMs: number;
  qualityReasonCounts: Record<string, number>;
};

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index];
}

export class VisionTelemetry {
  private latencies: number[] = [];
  private sampleCount = 0;
  private unknownCount = 0;
  private readyCount = 0;
  private reasonCounts: Record<string, number> = {};
  private latestNative: VisionFramePayload | null = null;

  record(native: VisionFramePayload, result: ExpressionEngineResult) {
    this.sampleCount += 1;
    this.unknownCount += result.observedExpression === 'unknown' ? 1 : 0;
    this.readyCount += result.signalStatus === 'ready' ? 1 : 0;
    this.latencies.push(Math.max(0, result.latencyMs));
    if (this.latencies.length > MAX_LATENCY_SAMPLES) {
      this.latencies.splice(0, this.latencies.length - MAX_LATENCY_SAMPLES);
    }
    result.qualityReasons.forEach((reason) => {
      this.reasonCounts[reason] = (this.reasonCounts[reason] ?? 0) + 1;
    });
    this.latestNative = native;
  }

  snapshot(): VisionTelemetrySnapshot {
    const native = this.latestNative;
    const received = native?.receivedFrames ?? 0;
    const dropped = native?.droppedFrames ?? 0;
    return {
      sampleCount: this.sampleCount,
      latencyP50Ms: percentile(this.latencies, 0.5),
      latencyP95Ms: percentile(this.latencies, 0.95),
      unknownRate: this.sampleCount > 0 ? this.unknownCount / this.sampleCount : 0,
      qualityCoverage: this.sampleCount > 0 ? this.readyCount / this.sampleCount : 0,
      receivedFrames: received,
      processedFrames: native?.processedFrames ?? 0,
      droppedFrames: dropped,
      droppedRate: received > 0 ? dropped / received : 0,
      effectiveFps: native?.effectiveFps ?? 0,
      thermalState: native?.thermalState ?? 'unknown',
      initializationLatencyMs: native?.initializationLatencyMs ?? 0,
      qualityReasonCounts: { ...this.reasonCounts },
    };
  }
}

export function qualityGuidance(status: ExpressionEngineResult['signalStatus'], reasons: string[]) {
  if (status === 'no_face') return 'Centralize o rosto na área visível da câmera.';
  if (status === 'uncertain') return 'A leitura ainda está ambígua; mantenha a expressão por um instante.';
  if (status === 'warming_up') return 'Preparando a leitura local…';
  if (reasons.includes('too_dark')) return 'Procure uma luz suave voltada para o rosto.';
  if (reasons.includes('overexposed')) return 'Afaste-se da luz direta ou reduza o brilho no rosto.';
  if (reasons.includes('blurred')) return 'Mantenha o aparelho e o rosto estáveis por um instante.';
  if (reasons.includes('face_too_small')) return 'Aproxime um pouco o aparelho do rosto.';
  if (reasons.includes('pose_out_of_range')) return 'Olhe mais de frente para a câmera.';
  if (reasons.includes('low_contrast')) return 'Melhore a iluminação uniforme do ambiente.';
  if (status === 'insufficient_quality') return 'Ajuste luz, distância ou posição para continuar.';
  return null;
}
