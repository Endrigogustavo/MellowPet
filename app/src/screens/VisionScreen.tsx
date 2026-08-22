import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { PrimaryButton, Txt, Touchable } from '../components/ui';
import { ICONS } from '../data/content';
import { EMOTIONS } from '../data/emotions';
import { useApp, useTheme } from '../state/AppContext';
import { isMellowVisionAvailable } from '../../modules/mellow-vision';
import { VISION_FLAGS } from '../vision/featureFlags';
import { VISION_EVENT_UPLOAD_ENABLED } from '../vision/eventQueue';
import { beginCalibration, NATIVE_PIPELINE_AVAILABLE, submitVisionFeedback } from '../vision/VisionEngine';

const CAMERA_PATH = 'M4 7h3l1.5-2h7L17 7h3v12H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7z';
const LOCK_PATH = 'M6 10V8a6 6 0 0112 0v2M5 10h14v11H5zM12 14v3';

export function VisionScreen() {
  const { state, actions } = useApp();
  const { T } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionFeedback, setSessionFeedback] = useState<'yes' | 'no' | 'unsure' | null>(null);
  const calibration = state.calibration;

  const submitFeedback = (agreement: 'yes' | 'no' | 'unsure') => {
    if (submitVisionFeedback(agreement)) setSessionFeedback(agreement);
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]}>
        <View style={styles.permissionContent}>
          <View style={[styles.icon, { backgroundColor: T.priL }]}>
            <Icon d={CAMERA_PATH} size={32} color={T.pri} />
          </View>
          <Txt s={24} w={900} c={T.t1} style={styles.center}>
            Leitura visual
          </Txt>
          <Txt s={14} lh={1.6} c={T.t2} style={styles.center}>
            {NATIVE_PIPELINE_AVAILABLE
              ? 'Com a câmera permitida, o Mellow reage à sua expressão em qualquer tela do app, não só aqui. O processamento é local; nenhuma imagem é enviada ou armazenada.'
              : 'A câmera fica visível e ativa somente nesta tela. O processamento será local; nenhuma imagem será enviada ou armazenada.'}
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
    <View style={[styles.cameraRoot, { backgroundColor: NATIVE_PIPELINE_AVAILABLE ? 'transparent' : '#16131A' }]}>
      {NATIVE_PIPELINE_AVAILABLE ? null : <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Touchable
            onPress={() => actions.go('home')}
            style={styles.closeButton}
            accessibilityLabel="Voltar"
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
            {NATIVE_PIPELINE_AVAILABLE
              ? calibration.active
                ? `Mantenha uma expressão confortável e frontal. ${calibration.accepted}/${calibration.required} amostras aceitas.`
                : 'O motor analisa sinais faciais no aparelho, o tempo todo enquanto o app está aberto. Frames não são armazenados nem enviados.'
              : isMellowVisionAvailable
                ? 'A leitura local foi pausada pela configuração de rollout; a câmera mostra apenas a prévia.'
                : 'Este build não contém o módulo nativo. Gere um development build para ativar a análise.'}
          </Txt>
          {state.visionNativeError ? (
            <Txt s={11.5} lh={1.45} c="#FFD1D1" style={{ marginTop: 8 }}>
              {state.visionNativeError}
            </Txt>
          ) : null}
          {!state.visionNativeError && state.visionQualityHint && !calibration.active ? (
            <Txt s={11.5} lh={1.45} c="#FFE8AF" style={{ marginTop: 8 }}>
              {state.visionQualityHint}
            </Txt>
          ) : null}
          {state.visionThermalLimited ? (
            <Txt s={11.5} lh={1.45} c="#FFE8AF" style={{ marginTop: 8 }}>
              Cadência reduzida temporariamente para proteger o aparelho.
            </Txt>
          ) : null}
          {NATIVE_PIPELINE_AVAILABLE && state.signalStatus === 'ready' ? (
            <View style={styles.readingRow}>
              <Txt s={12.5} w={900} c="#FFFFFF">
                {EMOTIONS[state.observedExpression].label}
              </Txt>
              <Txt s={11.5} w={800} c="rgba(255,255,255,0.76)">
                {Math.round(state.signalConfidence * 100)}% de confiança do sinal
              </Txt>
            </View>
          ) : null}
          {NATIVE_PIPELINE_AVAILABLE &&
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
          {NATIVE_PIPELINE_AVAILABLE && !calibration.active ? (
            <Touchable onPress={beginCalibration} style={styles.calibrationButton}>
              <Txt s={12} w={900} c="#FFFFFF">
                {calibration.complete ? 'Recalibrar leitura' : 'Calibrar rosto em repouso'}
              </Txt>
            </Touchable>
          ) : null}
          <View style={styles.privacyRow}>
            <Icon d={LOCK_PATH} size={15} color="#B9F6D3" sw={2} />
            <Txt s={11.5} w={800} c="#B9F6D3">
              Leitura contínua no app • processamento no aparelho
              {VISION_EVENT_UPLOAD_ENABLED ? ' • somente métricas agregadas na fila' : ''}
              {state.visionLatencyMs === null ? '' : ` • p95 ${Math.round(state.visionLatencyMs)} ms`}
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
  cameraRoot: { flex: 1 },
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
