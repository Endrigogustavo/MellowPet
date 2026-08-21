import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isMellowVisionAvailable,
  MellowVisionView,
  type VisionErrorPayload,
  type VisionFramePayload,
} from '../../modules/mellow-vision';
import { Icon } from '../components/Icon';
import { PrimaryButton, Txt, Touchable } from '../components/ui';
import { ICONS } from '../data/content';
import { EMOTIONS } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { loadCalibrationBaseline, saveCalibrationBaseline } from '../vision/calibrationStore';
import { createVisionId, VisionEventRecorder } from '../vision/eventRecorder';
import {
  enqueueVisionFeedback,
  enqueueVisionEvent,
  flushVisionQueue,
  VISION_EVENT_UPLOAD_ENABLED,
} from '../vision/eventQueue';
import { ExpressionEngine, type CalibrationState } from '../vision/expressionEngine';
import { VISION_FLAGS } from '../vision/featureFlags';
import { qualityGuidance, VisionTelemetry } from '../vision/telemetry';

const CAMERA_PATH = 'M4 7h3l1.5-2h7L17 7h3v12H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7z';
const LOCK_PATH = 'M6 10V8a6 6 0 0112 0v2M5 10h14v11H5zM12 14v3';
const APP_STATE_INTERVAL_MS = 250;
const TELEMETRY_INTERVAL_MS = 500;

export function VisionScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [engine] = useState(() => new ExpressionEngine());
  const [telemetry] = useState(() => new VisionTelemetry());
  const [visionSessionId] = useState(() => createVisionId('session'));
  const [deviceSessionId] = useState(() => createVisionId('device'));
  const [eventRecorder] = useState(
    () => new VisionEventRecorder(visionSessionId, deviceSessionId)
  );
  const baselineSavedRef = useRef(false);
  const lastSignalCommitRef = useRef({
    expression: 'unknown',
    status: 'warming_up',
    confidence: 0,
    quality: 0,
    atMs: 0,
  });
  const lastTelemetryCommitAtRef = useRef(0);
  const [calibration, setCalibration] = useState<CalibrationState>(engine.getCalibrationState());
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [qualityHint, setQualityHint] = useState<string | null>('Preparando a leitura local…');
  const [thermalLimited, setThermalLimited] = useState(false);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState<'yes' | 'no' | 'unsure' | null>(
    null
  );
  const nativePipelineAvailable = isMellowVisionAvailable && VISION_FLAGS.v2Enabled;

  useEffect(() => {
    let alive = true;
    loadCalibrationBaseline()
      .then((baseline) => {
        if (!alive || !baseline) return;
        engine.importBaseline(baseline);
        baselineSavedRef.current = true;
        setCalibration(engine.getCalibrationState());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine]);

  useEffect(() => {
    if (!permission) {
      actions.set({ visionMode: 'device', signalStatus: 'warming_up' });
      return;
    }
    actions.set({
      visionMode: 'device',
      signalStatus:
        permission.granted && nativePipelineAvailable ? 'warming_up' :
          permission.granted ? 'camera_unavailable' : 'permission_denied',
      observedExpression: 'unknown',
      signalConfidence: 0,
      qualityScore: 0,
    });
  }, [actions, nativePipelineAvailable, permission]);

  useEffect(
    () => () => {
      const finalEvent = eventRecorder.finish();
      if (finalEvent) {
        enqueueVisionEvent(finalEvent)
          .then(() => flushVisionQueue())
          .catch(() => undefined);
      }
      actions.set({ signalStatus: 'camera_unavailable' });
    },
    [actions, eventRecorder]
  );

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
      const currentEventId = eventRecorder.currentEventId;
      if (currentEventId !== feedbackEventId) {
        setFeedbackEventId(currentEventId);
        setSessionFeedback(null);
      }
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

      // A inferencia e o filtro temporal continuam em 10 fps. O estado global,
      // que redesenha varias telas, recebe no maximo 4 commits/s salvo quando
      // expressao/status mudam e precisam aparecer imediatamente.
      if (discreteStateChanged || (appStateDue && metricChanged)) {
        actions.set({
          visionMode: 'device',
          observedExpression: result.observedExpression,
          signalStatus: result.signalStatus,
          signalConfidence: result.signalConfidence,
          qualityScore: result.qualityScore,
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

      setCalibration((current) =>
        current.active === result.calibration.active &&
        current.accepted === result.calibration.accepted &&
        current.required === result.calibration.required &&
        current.complete === result.calibration.complete
          ? current
          : result.calibration
      );
      if (lastTelemetryCommitAtRef.current === 0 || now - lastTelemetryCommitAtRef.current >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryCommitAtRef.current = now;
        const snapshot = telemetry.snapshot();
        setLatencyMs(snapshot.latencyP95Ms ?? result.latencyMs);
        setThermalLimited(
          ['moderate', 'severe', 'critical', 'emergency', 'shutdown', 'serious'].includes(
            snapshot.thermalState
          )
        );
      }
      setQualityHint((current) => {
        const next = qualityGuidance(result.signalStatus, result.qualityReasons);
        return current === next ? current : next;
      });
      setNativeError((current) => (current === null ? current : null));

      if (result.calibration.complete && !baselineSavedRef.current) {
        const baseline = engine.exportBaseline();
        if (baseline) {
          baselineSavedRef.current = true;
          saveCalibrationBaseline(baseline).catch(() => {
            baselineSavedRef.current = false;
          });
        }
      }
    },
    [actions, engine, eventRecorder, feedbackEventId, telemetry]
  );

  const onVisionError = useCallback(
    ({ nativeEvent }: { nativeEvent: VisionErrorPayload }) => {
      setNativeError(nativeEvent.message);
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
      });
    },
    [actions]
  );

  const beginCalibration = useCallback(() => {
    engine.beginCalibration();
    baselineSavedRef.current = false;
    setCalibration(engine.getCalibrationState());
  }, [engine]);

  const submitFeedback = useCallback(
    (agreement: 'yes' | 'no' | 'unsure') => {
      const eventId = eventRecorder.currentEventId;
      if (!eventId || !VISION_FLAGS.feedbackEnabled || !VISION_EVENT_UPLOAD_ENABLED) return;
      setSessionFeedback(agreement);
      enqueueVisionFeedback({
        feedback_id: createVisionId('feedback'),
        event_id: eventId,
        agreement,
        created_at: new Date().toISOString(),
      })
        .then(() => flushVisionQueue())
        .catch(() => undefined);
    },
    [eventRecorder]
  );

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
        <View style={styles.permissionContent}>
          <View style={[styles.icon, { backgroundColor: T.priL }]}>
            <Icon d={CAMERA_PATH} size={32} color={T.pri} />
          </View>
          <Txt s={24} w={900} c={T.t1} style={styles.center}>
            Sessão de leitura visual
          </Txt>
          <Txt s={14} lh={1.6} c={T.t2} style={styles.center}>
            A câmera fica visível e ativa somente nesta tela. O processamento será local; nenhuma
            imagem será enviada ou armazenada.
          </Txt>
          {permission?.canAskAgain === false ? (
            <Txt s={12.5} lh={1.5} c={T.t3} style={styles.center}>
              A permissão foi bloqueada. Você pode reativá-la nos ajustes do aparelho e continuar
              usando todo o restante do MellowPet sem câmera.
            </Txt>
          ) : (
            <PrimaryButton label="Permitir câmera" onPress={requestPermission} />
          )}
          <Touchable onPress={() => actions.go('home')} style={styles.secondaryButton}>
            <Txt s={14} w={800} c={T.t2}>
              Continuar sem câmera
            </Txt>
          </Touchable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      {nativePipelineAvailable ? (
        <MellowVisionView
          active
          maxFps={10}
          mirror
          onVisionResult={onVisionResult}
          onVisionError={onVisionError}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />
      )}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Touchable
            onPress={() => actions.go('home')}
            style={styles.closeButton}
            accessibilityLabel="Encerrar sessão de câmera"
          >
            <Icon d={ICONS.close} size={20} color="#FFFFFF" sw={2.2} />
          </Touchable>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Txt s={12} w={900} c="#FFFFFF">
              CÂMERA ATIVA
            </Txt>
          </View>
        </View>

        <View style={styles.bottomCard}>
          <Txt s={16} w={900} c="#FFFFFF">
            {calibration.active ? 'Calibrando rosto em repouso' : 'Leitura local em andamento'}
          </Txt>
          <Txt s={12.5} lh={1.5} c="rgba(255,255,255,0.82)" style={{ marginTop: 4 }}>
            {nativePipelineAvailable
              ? calibration.active
                ? `Mantenha uma expressão confortável e frontal. ${calibration.accepted}/${calibration.required} amostras aceitas.`
                : 'O motor analisa sinais faciais no aparelho. Frames não são armazenados nem enviados.'
              : isMellowVisionAvailable
                ? 'A leitura local foi pausada pela configuração de rollout; a câmera mostra apenas a prévia.'
                : 'Este build não contém o módulo nativo. Gere um development build para ativar a análise.'}
          </Txt>
          {nativeError ? (
            <Txt s={11.5} lh={1.45} c="#FFD1D1" style={{ marginTop: 8 }}>
              {nativeError}
            </Txt>
          ) : null}
          {!nativeError && qualityHint && !calibration.active ? (
            <Txt s={11.5} lh={1.45} c="#FFE8AF" style={{ marginTop: 8 }}>
              {qualityHint}
            </Txt>
          ) : null}
          {thermalLimited ? (
            <Txt s={11.5} lh={1.45} c="#FFE8AF" style={{ marginTop: 8 }}>
              Cadência reduzida temporariamente para proteger o aparelho.
            </Txt>
          ) : null}
          {nativePipelineAvailable && state.signalStatus === 'ready' ? (
            <View style={styles.readingRow}>
              <Txt s={12.5} w={900} c="#FFFFFF">
                {EMOTIONS[state.observedExpression].label}
              </Txt>
              <Txt s={11.5} w={800} c="rgba(255,255,255,0.76)">
                {Math.round(state.signalConfidence * 100)}% de confiança do sinal
              </Txt>
            </View>
          ) : null}
          {nativePipelineAvailable &&
          state.signalStatus === 'ready' &&
          VISION_FLAGS.feedbackEnabled &&
          VISION_EVENT_UPLOAD_ENABLED ? (
            <View style={styles.feedbackBlock}>
              <Txt s={11.5} w={800} c="rgba(255,255,255,0.82)">
                Essa leitura combinou com o que você percebeu?
              </Txt>
              {sessionFeedback ? (
                <Txt s={11.5} w={800} c="#B9F6D3">
                  Feedback registrado para avaliação; o modelo não é alterado automaticamente.
                </Txt>
              ) : (
                <View style={styles.feedbackButtons}>
                  <Touchable onPress={() => submitFeedback('yes')} style={styles.feedbackButton}>
                    <Txt s={11.5} w={900} c="#FFFFFF">
                      Sim
                    </Txt>
                  </Touchable>
                  <Touchable onPress={() => submitFeedback('no')} style={styles.feedbackButton}>
                    <Txt s={11.5} w={900} c="#FFFFFF">
                      Não
                    </Txt>
                  </Touchable>
                  <Touchable onPress={() => submitFeedback('unsure')} style={styles.feedbackButton}>
                    <Txt s={11.5} w={900} c="#FFFFFF">
                      Não sei
                    </Txt>
                  </Touchable>
                </View>
              )}
            </View>
          ) : null}
          {nativePipelineAvailable && !calibration.active ? (
            <Touchable onPress={beginCalibration} style={styles.calibrationButton}>
              <Txt s={12} w={900} c="#FFFFFF">
                {calibration.complete ? 'Recalibrar leitura' : 'Calibrar rosto em repouso'}
              </Txt>
            </Touchable>
          ) : null}
          <View style={styles.privacyRow}>
            <Icon d={LOCK_PATH} size={15} color="#B9F6D3" sw={2} />
            <Txt s={11.5} w={800} c="#B9F6D3">
              Sessão visível • processamento no aparelho
              {VISION_EVENT_UPLOAD_ENABLED ? ' • somente métricas agregadas na fila' : ''}
              {latencyMs === null ? '' : ` • p95 ${Math.round(latencyMs)} ms`}
            </Txt>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 18,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  secondaryButton: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  cameraRoot: { flex: 1, backgroundColor: '#16131A' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6262' },
  bottomCard: {
    borderRadius: 22,
    padding: 17,
    backgroundColor: 'rgba(25,20,30,0.78)',
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  calibrationButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  feedbackBlock: { marginTop: 11, gap: 8 },
  feedbackButtons: { flexDirection: 'row', gap: 8 },
  feedbackButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
