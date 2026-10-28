import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';

import {
  isMellowVisionAvailable,
  MellowVisionView,
  type VisionErrorPayload,
  type VisionFramePayload,
} from '../../modules/mellow-vision';
import { useApp } from '../state/AppContext';
import { explainReading } from './evidence';
import { applyGains } from './personalCalibration';
import { affectFromScores } from './affect';
import { HeartGate, MIN_SPAN_MS, RppgBuffer } from './rppg';
import { SignalTracker } from './signalTracker';
import { visionFps, type FpsDecision } from './fpsPolicy';
import * as Battery from 'expo-battery';
import MellowVisionNative from '../../modules/mellow-vision/src/MellowVisionModule';
import { loadCalibrationBaseline, saveCalibrationBaseline } from './calibrationStore';
import { createVisionId, VisionEventRecorder } from './eventRecorder';
import {
  enqueueVisionFeedback,
  enqueueVisionEvent,
  flushVisionQueue,
  VISION_EVENT_UPLOAD_ENABLED,
} from './eventQueue';
import { ExpressionEngine } from './expressionEngine';
import { VISION_FLAGS } from './featureFlags';
import { qualityGuidance, VisionTelemetry } from './telemetry';
import { setBackgroundVision } from './backgroundVision';

/** Lê bateria e temperatura a cada 30 s e decide o ritmo da análise. */
function useVisionBudget(base: number): FpsDecision {
  const [decision, setDecision] = useState<FpsDecision>({ fps: base, reason: null });
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const [level, state, lowPower] = await Promise.all([
        Battery.getBatteryLevelAsync().catch(() => -1),
        Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
        Battery.isLowPowerModeEnabledAsync().catch(() => false),
      ]);
      let thermal: number | null = null;
      try {
        const t = MellowVisionNative?.thermalStatus() ?? -1;
        thermal = t >= 0 ? t : null;
      } catch {
        thermal = null;
      }
      if (!alive) return;
      setDecision(
        visionFps({
          base,
          battery: level >= 0 ? level : null,
          charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
          lowPowerMode: lowPower,
          thermal,
        })
      );
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [base]);
  return decision;
}

const APP_STATE_INTERVAL_MS = 250;
const TELEMETRY_INTERVAL_MS = 500;

export const NATIVE_PIPELINE_AVAILABLE = isMellowVisionAvailable && VISION_FLAGS.v2Enabled;

// Instâncias imperativas do motor — vivem fora do React porque a tela de
// câmera (UI) e o motor (roda o tempo todo, montado uma vez na raiz do app)
// são componentes diferentes agora. `beginCalibration`/`submitVisionFeedback`
// deixam a VisionScreen acionar o motor sem precisar levantar tudo pro
// contexto global.
let engineSingleton: ExpressionEngine | null = null;
let eventRecorderSingleton: VisionEventRecorder | null = null;
let baselineSavedForUser: string | null = null;

export function beginCalibration() {
  if (!engineSingleton) return;
  engineSingleton.beginCalibration();
  baselineSavedForUser = null;
}

export function submitVisionFeedback(agreement: 'yes' | 'no' | 'unsure'): boolean {
  const eventId = eventRecorderSingleton?.currentEventId;
  const userId = eventRecorderSingleton?.currentUserId;
  if (!eventId || !userId || !VISION_FLAGS.feedbackEnabled || !VISION_EVENT_UPLOAD_ENABLED) return false;
  enqueueVisionFeedback({
    feedback_id: createVisionId('feedback'),
    event_id: eventId,
    user_id: userId,
    agreement,
    created_at: new Date().toISOString(),
  })
    .then(() => flushVisionQueue())
    .catch(() => undefined);
  return true;
}

/**
 * Motor de visão real. Montado uma vez na raiz do app (RootNavigator) e roda
 * enquanto o app está aberto, não só numa tela dedicada de câmera — é o que
 * faz o bichinho reagir à expressão em qualquer tela. Sem o módulo nativo
 * (Expo Go), não renderiza nada; a simulação de demonstração já roda à parte,
 * no intervalo do AppContext.
 */
export function VisionEngine() {
  const { state, actions } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [engine] = useState(() => new ExpressionEngine());
  const [tracker] = useState(() => new SignalTracker());
  const [pulse] = useState(() => ({ buffer: new RppgBuffer(), gate: new HeartGate(), nextAt: 0 }));
  // Tensão somada desde o último check-in (divergência gentil).
  const [tense] = useState(() => ({ ms: 0, lastAt: 0, since: 0 }));
  const stateRef = useRef(state);
  stateRef.current = state;

  // Calibração pessoal: cada mudança nos ganhos vale a partir do próximo quadro.
  useEffect(() => {
    const gains = state.personalGains;
    engine.setScoreAdjuster((scores) => applyGains(scores, gains));
  }, [engine, state.personalGains]);
  const [telemetry] = useState(() => new VisionTelemetry());
  const [eventRecorder] = useState(
    () =>
      new VisionEventRecorder(
        createVisionId('session'),
        createVisionId('device'),
        state.userId ?? undefined
      )
  );
  const [appForeground, setAppForeground] = useState(() => AppState.currentState === 'active');
  const baselineLoadedRef = useRef<string | null>(null);
  const baselineSaveInFlightRef = useRef<Promise<void> | null>(null);
  const currentUserIdRef = useRef(state.userId);
  currentUserIdRef.current = state.userId;
  const lastSignalCommitRef = useRef({
    expression: 'unknown',
    status: 'warming_up',
    confidence: 0,
    quality: 0,
    atMs: 0,
  });
  const lastTelemetryCommitAtRef = useRef(0);

  const finishRecorder = useCallback(() => {
    const event = eventRecorder.finish();
    if (!event) return;
    enqueueVisionEvent(event)
      .then(() => flushVisionQueue())
      .catch(() => undefined);
  }, [eventRecorder]);

  useEffect(() => {
    eventRecorder.setUserId(state.userId ?? undefined);
    return finishRecorder;
  }, [eventRecorder, finishRecorder, state.userId]);

  useEffect(() => {
    // O Android pode revogar o acesso à câmera quando o app vai pra segundo
    // plano (a MIUI em particular derruba a sessão do Camera2 nesse momento).
    // A view nativa nunca é desmontada só por trocar de aba — sem isto, uma
    // sessão derrubada em background nunca tinha um novo gatilho pra reabrir
    // e o erro ficava travado até o usuário fechar e reabrir o app inteiro.
    // Soltar `active` no background e religar no foreground força o módulo
    // nativo a fechar e reconstruir a sessão do zero (mesmo caminho de
    // `updateActive`), o que resolve sozinho.
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') finishRecorder();
      setAppForeground(nextState === 'active');
    });
    return () => {
      subscription.remove();
      finishRecorder();
    };
  }, [finishRecorder]);

  useEffect(() => {
    engineSingleton = engine;
    eventRecorderSingleton = eventRecorder;
    return () => {
      if (engineSingleton === engine) engineSingleton = null;
      if (eventRecorderSingleton === eventRecorder) eventRecorderSingleton = null;
    };
  }, [engine, eventRecorder]);

  useEffect(() => {
    // Uma conta puramente cuidadora nunca rastreia a própria expressão —
    // não faz sentido pedir permissão de câmera nem rodar o pipeline até a
    // pessoa entrar no "modo pessoal" (ver actions.setRole em AppContext).
    if (!NATIVE_PIPELINE_AVAILABLE || !state.userId || state.role !== 'user') return;
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => undefined);
    }
  }, [permission, requestPermission, state.role, state.userId]);

  useEffect(() => {
    const userId = state.userId;
    if (!userId) {
      baselineLoadedRef.current = null;
      baselineSavedForUser = null;
      engine.clearCalibration();
      actions.set({ calibration: engine.getCalibrationState() });
      return;
    }
    if (baselineLoadedRef.current === userId) return;
    baselineLoadedRef.current = userId;
    baselineSavedForUser = null;
    engine.clearCalibration();
    loadCalibrationBaseline(userId)
      .then((baseline) => {
        if (currentUserIdRef.current !== userId) return;
        if (!baseline) return;
        engine.importBaseline(baseline);
        baselineSavedForUser = userId;
        actions.set({ calibration: engine.getCalibrationState() });
      })
      .catch(() => undefined);
  }, [actions, engine, state.userId]);

  useEffect(() => {
    // Não apague o opt-in persistido antes de restaurar a sessão.
    if (!state.authRestored) return;
    if (state.userId && state.role === 'user') return;
    setBackgroundVision(false);
  }, [state.authRestored, state.role, state.userId]);

  useEffect(() => {
    if (state.role !== 'user') finishRecorder();
  }, [finishRecorder, state.role]);

  useEffect(() => {
    if (!VISION_EVENT_UPLOAD_ENABLED) return;
    flushVisionQueue().catch(() => undefined);
    const timer = setInterval(() => flushVisionQueue().catch(() => undefined), 15_000);
    return () => clearInterval(timer);
  }, []);

  const onVisionResult = useCallback(
    ({ nativeEvent }: { nativeEvent: VisionFramePayload }) => {
      const result = engine.process(nativeEvent);

      // Sinais sustentados: tensão, piscadas e olhar fora da tela no foco.
      const bs = nativeEvent.blendshapes ?? {};
      const kind = tracker.push(
        {
          atMs: nativeEvent.capturedAtMs ?? Date.now(),
          ready: result.signalStatus === 'ready',
          tension: result.tensionSignal,
          blink: ((bs.eyeBlinkLeft ?? 0) + (bs.eyeBlinkRight ?? 0)) / 2,
          yaw: nativeEvent.yaw ?? 0,
          lookOut: Math.max(bs.eyeLookOutLeft ?? 0, bs.eyeLookOutRight ?? 0),
        },
        stateRef.current.focus
      );
      if (kind) actions.set({ nudge: kind });

      // Batimento: só na tela da câmera, onde a taxa de quadros é a maior e a
      // pessoa está parada olhando. Rosto virado conta como quadro perdido.
      if (stateRef.current.screen === 'vision') {
        const at = nativeEvent.capturedAtMs ?? Date.now();
        const usable = result.signalStatus === 'ready' && Math.abs(nativeEvent.yaw ?? 0) < 20;
        pulse.buffer.push({ t: at, rgb: usable ? (nativeEvent.skinRgb ?? null) : null });
        if (at >= pulse.nextAt) {
          pulse.nextAt = at + 2000;
          const bpm = pulse.gate.push(pulse.buffer.estimate());
          const progress = Math.min(1, pulse.buffer.spanMs() / MIN_SPAN_MS);
          const prev = stateRef.current.heart;
          if (!prev || prev.bpm !== bpm || Math.abs(prev.progress - progress) >= 0.1) {
            actions.set({ heart: { bpm, progress } });
          }
        }
      } else if (stateRef.current.heart) {
        pulse.buffer.reset();
        pulse.gate.reset();
        actions.set({ heart: null });
      }

      // Divergência gentil: soma o tempo de rosto tenso desde o check-in.
      const checkinAt = stateRef.current.lastCheckin?.at ?? 0;
      if (checkinAt !== tense.since) {
        tense.since = checkinAt;
        tense.ms = 0;
      }
      const frameAt = nativeEvent.capturedAtMs ?? Date.now();
      if (checkinAt && result.signalStatus === 'ready' && (result.tensionSignal ?? 0) >= 0.5 && tense.lastAt) {
        tense.ms += Math.min(2000, Math.max(0, frameAt - tense.lastAt));
        const minutes = Math.floor(tense.ms / 60_000);
        if (minutes !== stateRef.current.tenseSinceCheckin) actions.set({ tenseSinceCheckin: minutes });
      }
      tense.lastAt = frameAt;

      // Jogo de ninar: a tensão precisa chegar mais fina que o rótulo.
      if (stateRef.current.screen === 'lullaby') {
        const t = result.signalStatus === 'ready' ? result.tensionSignal : null;
        const prev = stateRef.current.tension;
        if ((t === null) !== (prev === null) || (t !== null && prev !== null && Math.abs(t - prev) >= 0.03)) {
          actions.set({ tension: t });
        }
      }

      telemetry.record(nativeEvent, result);
      const intervalEvents = eventRecorder.record(result);
      if (intervalEvents.length > 0) {
        Promise.all(intervalEvents.map((event) => enqueueVisionEvent(event)))
          .then(() => flushVisionQueue())
          .catch(() => undefined);
      }

      const now = Date.now();
      const previous = lastSignalCommitRef.current;
      const discreteStateChanged =
        result.observedExpression !== previous.expression || result.signalStatus !== previous.status;
      const metricChanged =
        Math.abs(result.signalConfidence - previous.confidence) >= 0.03 ||
        Math.abs(result.qualityScore - previous.quality) >= 0.04;
      const appStateDue = now - previous.atMs >= APP_STATE_INTERVAL_MS;

      if (discreteStateChanged || (appStateDue && metricChanged)) {
        actions.set({
          visionMode: 'device',
          observedExpression: result.observedExpression,
          signalStatus: result.signalStatus,
          signalConfidence: result.signalConfidence,
          qualityScore: result.qualityScore,
          secondaryEmotions: result.secondaryEmotions,
          // Calculado no mesmo ritmo da leitura, nao a cada quadro: a tela so
          // precisa dos sinais que sustentam o rotulo que ela esta mostrando.
          affect:
            result.signalStatus === 'ready'
              ? affectFromScores(result.scores, result.tensionSignal)
              : null,
          readingEvidence:
            result.signalStatus === 'ready' && result.actionUnits
              ? explainReading(result.actionUnits, result.observedExpression)
              : [],
          ...(result.signalStatus === 'ready' ? { streak: 0 } : null),
        });
        lastSignalCommitRef.current = {
          expression: result.observedExpression,
          status: result.signalStatus,
          confidence: result.signalConfidence,
          quality: result.qualityScore,
          atMs: now,
        };
      }

      actions.set((s) =>
        s.calibration.active === result.calibration.active &&
        s.calibration.accepted === result.calibration.accepted &&
        s.calibration.required === result.calibration.required &&
        s.calibration.complete === result.calibration.complete
          ? {}
          : { calibration: result.calibration }
      );

      if (lastTelemetryCommitAtRef.current === 0 || now - lastTelemetryCommitAtRef.current >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryCommitAtRef.current = now;
        const snapshot = telemetry.snapshot();
        actions.set({
          visionLatencyMs: snapshot.latencyP95Ms ?? result.latencyMs,
          visionThermalLimited: ['moderate', 'severe', 'critical', 'emergency', 'shutdown', 'serious'].includes(
            snapshot.thermalState
          ),
          visionScores: result.scores,
        });
      }

      actions.set((s) => {
        const next = qualityGuidance(result.signalStatus, result.qualityReasons);
        return s.visionQualityHint === next ? {} : { visionQualityHint: next };
      });
      actions.set((s) => (s.visionNativeError === null ? {} : { visionNativeError: null }));

      if (
        result.calibration.complete &&
        state.userId &&
        baselineSavedForUser !== state.userId &&
        !baselineSaveInFlightRef.current
      ) {
        const baseline = engine.exportBaseline();
        if (baseline) {
          const userId = state.userId;
          const save = saveCalibrationBaseline(userId, baseline)
            .then(() => {
              if (currentUserIdRef.current === userId) baselineSavedForUser = userId;
            })
            .catch(() => undefined)
            .finally(() => {
              baselineSaveInFlightRef.current = null;
            });
          baselineSaveInFlightRef.current = save;
        }
      }
    },
    [actions, engine, eventRecorder, pulse, state.userId, telemetry, tense, tracker]
  );

  const onVisionError = useCallback(
    ({ nativeEvent }: { nativeEvent: VisionErrorPayload }) => {
      lastSignalCommitRef.current = {
        expression: 'unknown',
        status: 'camera_unavailable',
        confidence: 0,
        quality: 0,
        atMs: Date.now(),
      };
      actions.set({
        observedExpression: 'unknown',
        signalConfidence: 0,
        qualityScore: 0,
        signalStatus: 'camera_unavailable',
        visionNativeError: nativeEvent.message,
      });
    },
    [actions]
  );

  // Antes de qualquer retorno antecipado: hooks não podem ser condicionais.
  const budget = useVisionBudget(state.screen === 'vision' ? 10 : 5);

  if (!NATIVE_PIPELINE_AVAILABLE || !permission?.granted || !state.userId || state.role !== 'user') return null;

  // Em qualquer tela fora da de câmera, fica minúsculo e fora da área
  // visível — o pipeline continua rodando (é isso que faz o bichinho reagir
  // no app inteiro), só a prévia não aparece. Na tela de câmera, preenche o
  // espaço atrás da UI da VisionScreen.
  const onVisionScreen = state.screen === 'vision';

  return (
    <View
      style={onVisionScreen ? StyleSheet.absoluteFill : styles.hidden}
      pointerEvents="none"
    >
      <MellowVisionView
        active={appForeground && budget.fps > 0}
        maxFps={Math.max(1, budget.fps)}
        mirror
        showPreview={onVisionScreen}
        onVisionResult={onVisionResult}
        onVisionError={onVisionError}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    width: 4,
    height: 4,
    opacity: 0,
  },
});
