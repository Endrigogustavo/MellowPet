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
import { updateWidgetMood } from '../widget/widgetClient';

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
let baselineSaved = false;

export function beginCalibration() {
  if (!engineSingleton) return;
  engineSingleton.beginCalibration();
  baselineSaved = false;
}

export function submitVisionFeedback(agreement: 'yes' | 'no' | 'unsure'): boolean {
  const eventId = eventRecorderSingleton?.currentEventId;
  if (!eventId || !VISION_FLAGS.feedbackEnabled || !VISION_EVENT_UPLOAD_ENABLED) return false;
  enqueueVisionFeedback({
    feedback_id: createVisionId('feedback'),
    event_id: eventId,
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
  const baselineLoadedRef = useRef(false);
  const lastSignalCommitRef = useRef({
    expression: 'unknown',
    status: 'warming_up',
    confidence: 0,
    quality: 0,
    atMs: 0,
  });
  const lastTelemetryCommitAtRef = useRef(0);

  useEffect(() => {
    eventRecorder.setUserId(state.userId ?? undefined);
  }, [eventRecorder, state.userId]);

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
      setAppForeground(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

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
    if (!NATIVE_PIPELINE_AVAILABLE || state.role !== 'user') return;
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => undefined);
    }
  }, [permission, requestPermission, state.role]);

  useEffect(() => {
    if (baselineLoadedRef.current) return;
    baselineLoadedRef.current = true;
    loadCalibrationBaseline()
      .then((baseline) => {
        if (!baseline) return;
        engine.importBaseline(baseline);
        baselineSaved = true;
        actions.set({ calibration: engine.getCalibrationState() });
      })
      .catch(() => undefined);
  }, [actions, engine]);

  useEffect(() => {
    if (!VISION_EVENT_UPLOAD_ENABLED) return;
    flushVisionQueue().catch(() => undefined);
    const timer = setInterval(() => flushVisionQueue().catch(() => undefined), 15_000);
    return () => clearInterval(timer);
  }, []);

  const onVisionResult = useCallback(
    ({ nativeEvent }: { nativeEvent: VisionFramePayload }) => {
      const result = engine.process(nativeEvent);
      telemetry.record(nativeEvent, result);
      const intervalEvents = eventRecorder.record(result);
      intervalEvents.forEach((event) => {
        enqueueVisionEvent(event)
          .then(() => flushVisionQueue())
          .catch(() => undefined);
      });

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
          ...(result.signalStatus === 'ready' ? { streak: 0 } : null),
        });
        if (result.signalStatus === 'ready') updateWidgetMood(result.observedExpression);
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

      if (result.calibration.complete && !baselineSaved) {
        const baseline = engine.exportBaseline();
        if (baseline) {
          baselineSaved = true;
          saveCalibrationBaseline(baseline).catch(() => {
            baselineSaved = false;
          });
        }
      }
    },
    [actions, engine, eventRecorder, telemetry]
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

  if (!NATIVE_PIPELINE_AVAILABLE || !permission?.granted || state.role !== 'user') return null;

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
        active={appForeground}
        maxFps={10}
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
