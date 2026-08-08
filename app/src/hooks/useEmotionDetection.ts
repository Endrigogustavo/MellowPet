import { useEffect, useRef, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { ApiService } from '../services/api';
import { useAppStore } from './useStore';

// High-precision real-time loop: 1 frame per second, higher quality capture.
const BASE_FRAME_INTERVAL_MS = 800;
const MAX_FRAME_INTERVAL_MS = 1000;
const EMOTION_SWITCH_STREAK = 1;
const CONFIDENCE_DELTA_MIN = 0.02;
const DISCONNECT_AFTER_ERRORS = 5;
const FACE_FOUND_STREAK = 1;
const FACE_LOST_STREAK = 5;
const SAME_EMOTION_UI_MIN_INTERVAL_MS = 1500;
const ENABLE_SAME_EMOTION_SYNC = true;
const NEGATIVE_STREAK_ALERT_MS = 2 * 60 * 1000;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const SUPPORT_CHAT_COOLDOWN_MS = 70 * 1000;
const SUPPORT_VOICE_INTERVAL_MS = 45 * 1000;
const MIN_EMOTION_SWITCH_INTERVAL_MS = 350;
const NO_FACE_PROBE_INTERVAL_MS = 400;
const ANDROID_MIN_CAPTURE_INTERVAL_MS = 650;

export function useEmotionDetection() {
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectionActiveRef = useRef(false);
  const cameraRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const frameCountRef = useRef(0);
  const pendingEmotionRef = useRef<string | null>(null);
  const pendingEmotionCountRef = useRef(0);
  const lastAppliedEmotionRef = useRef('neutral');
  const lastAppliedConfidenceRef = useRef(0);
  const errorStreakRef = useRef(0);
  const stableFaceDetectedRef = useRef(false);
  const faceFoundCountRef = useRef(0);
  const faceLostCountRef = useRef(0);
  const lastUiSyncRef = useRef(0);
  const negativeStreakStartRef = useRef<number | null>(null);
  const lastDangerAlertAtRef = useRef(0);
  const lastSupportChatAtRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  const lastSupportVoiceAtRef = useRef(0);
  const lastHappyVibrationAtRef = useRef(0);
  const lastEmotionSwitchAtRef = useRef(0);
  const lastNoFaceProbeAtRef = useRef(0);
  const lastCaptureAtRef = useRef(0);
  const nextApiProbeAtRef = useRef(0);
  const apiProbeBackoffMsRef = useRef(750);
  const dynamicIntervalMsRef = useRef(BASE_FRAME_INTERVAL_MS);
  const captureQualityRef = useRef(0.55);
  const notificationEnabledRef = useRef(false);
  const notificationsModuleRef = useRef<any>(null);

  const sessionId = useAppStore((state) => state.sessionId);
  const settings = useAppStore((state) => state.settings);
  const setEmotion = useAppStore((state) => state.setEmotion);
  const setConnected = useAppStore((state) => state.setConnected);
  const addChatMessage = useAppStore((state) => state.addChatMessage);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      notificationEnabledRef.current = false;
      return;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      notificationEnabledRef.current = false;
      return;
    }

    let Notifications: any;
    try {
      Notifications = require('expo-notifications');
      notificationsModuleRef.current = Notifications;
    } catch {
      notificationEnabledRef.current = false;
      return;
    }

    Notifications.requestPermissionsAsync()
      .then((permission: any) => {
        notificationEnabledRef.current = permission.status === 'granted';
      })
      .catch(() => {
        notificationEnabledRef.current = false;
      });
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    const startedAt = Date.now();
    if (isProcessingRef.current || !cameraRef.current) return;
    isProcessingRef.current = true;
    frameCountRef.current += 1;

    try {
      const nowMs = Date.now();

      // API readiness gate: avoid capturing (and triggering shutter sound) when the backend
      // is offline or still starting up. Probe /health with exponential backoff.
      if (!useAppStore.getState().isConnected) {
        if (nowMs < nextApiProbeAtRef.current) {
          return;
        }

        try {
          await ApiService.health({ timeoutMs: 2500 });
          apiProbeBackoffMsRef.current = 750;
          nextApiProbeAtRef.current = 0;
          setConnected(true);
        } catch {
          setConnected(false);
          nextApiProbeAtRef.current = nowMs + apiProbeBackoffMsRef.current;
          apiProbeBackoffMsRef.current = Math.min(apiProbeBackoffMsRef.current * 1.6, 15000);
          return;
        }
      }

      const currentSnapshot = useAppStore.getState().currentEmotion;
      const probeNow = nowMs;

      // Some Android devices play a shutter sound on each capture.
      // Keep a short floor, but do not block real-time detection.
      if (Platform.OS === 'android') {
        if (probeNow - lastCaptureAtRef.current < ANDROID_MIN_CAPTURE_INTERVAL_MS) {
          return;
        }
      }

      // Save requests: if no face is currently detected, only probe every few seconds.
      if (!currentSnapshot.faceDetected) {
        if (probeNow - lastNoFaceProbeAtRef.current < NO_FACE_PROBE_INTERVAL_MS) {
          return;
        }
        lastNoFaceProbeAtRef.current = probeNow;
      }

      const takePictureAsync = cameraRef.current?.takePictureAsync;
      const takePicture = cameraRef.current?.takePicture;

      if (typeof takePictureAsync !== 'function' && typeof takePicture !== 'function') {
        console.log('[EmotionDetection] camera not ready (no capture method on ref)');
        throw new Error('Camera is not ready yet');
      }

      const captureOptions = {
        quality: captureQualityRef.current,
        base64: true,
        ...(Platform.OS === 'android' ? { shutterSound: false, mute: true } : {}),
      };

      // SDK 54 CameraView exposes takePictureAsync; keep fallback for older refs.
      const photo = typeof takePictureAsync === 'function'
        ? await takePictureAsync.call(cameraRef.current, captureOptions)
        : await takePicture.call(cameraRef.current, captureOptions);

      lastCaptureAtRef.current = probeNow;

      if (__DEV__ && frameCountRef.current % 5 === 0) {
        console.log('[EmotionDetection] frame captured', {
          frame: frameCountRef.current,
          hasBase64: Boolean(photo?.base64),
          base64Length: photo?.base64?.length || 0,
        });
      }

      if (!photo?.base64) {
        throw new Error('Camera did not return base64 data');
      }

      if (__DEV__ && frameCountRef.current % 5 === 0) {
        console.log('[EmotionDetection] sending analyzeFrame request', {
          frame: frameCountRef.current,
          sessionId,
        });
      }

      const result = await ApiService.analyzeFrame(
        photo.base64,
        sessionId,
        settingsRef.current.userId ?? undefined,
        settingsRef.current.petName,
      );

      // Smooth face detection to avoid rapid toggling of UI state.
      if (result.face_detected) {
        faceFoundCountRef.current += 1;
        faceLostCountRef.current = 0;
        if (faceFoundCountRef.current >= FACE_FOUND_STREAK) {
          stableFaceDetectedRef.current = true;
        }
      } else {
        faceLostCountRef.current += 1;
        faceFoundCountRef.current = 0;
        if (faceLostCountRef.current >= FACE_LOST_STREAK) {
          stableFaceDetectedRef.current = false;
        }
      }

      const stableFaceDetected = stableFaceDetectedRef.current;

      errorStreakRef.current = 0;

      if (__DEV__ && frameCountRef.current % 5 === 0) {
        console.log('[EmotionDetection] analyzeFrame success', {
          frame: frameCountRef.current,
          emotion: result.emotion,
          confidence: result.confidence,
          faceDetected: result.face_detected,
          stableFaceDetected,
        });
      }

      const current = useAppStore.getState().currentEmotion;
      const lowConfidenceAnxiousLike =
        ['anxious', 'angry', 'disgusted'].includes(result.emotion) && result.confidence < 0.25;
      const veryLowConfidenceAnyEmotion = result.emotion !== 'neutral' && result.confidence < 0.08;
      const nextEmotion =
        lowConfidenceAnxiousLike || veryLowConfidenceAnyEmotion
          ? 'neutral'
          : result.emotion;
      const sameEmotionAsCurrent = nextEmotion === lastAppliedEmotionRef.current;
      const scoresEntries = Object.entries(result.all_scores || {}).sort((a, b) => b[1] - a[1]);
      const topScore = scoresEntries[0]?.[1] || 0;
      const secondScore = scoresEntries[1]?.[1] || 0;
      const dominanceGap = Math.max(0, topScore - secondScore);
      const now = nowMs;

      const lowSignal = !result.face_detected || result.confidence < 0.58 || dominanceGap < 0.1;
      const strongSignal = result.face_detected && result.confidence >= 0.78 && dominanceGap >= 0.16;
      if (lowSignal) {
        captureQualityRef.current = Math.min(0.85, captureQualityRef.current + 0.05);
      } else if (strongSignal) {
        captureQualityRef.current = Math.max(0.55, captureQualityRef.current - 0.03);
      }

      // Change spoken message only when emotion actually changes.
      let nextMessage = current.message;

      const minConfidenceForSwitch =
        nextEmotion === 'happy' || nextEmotion === 'sad'
          ? 0.30
          : nextEmotion === 'surprised'
            ? 0.35
            : nextEmotion === 'neutral'
              ? 0.10
              : 0.40;
      const signalReliable = stableFaceDetected && result.confidence >= minConfidenceForSwitch && dominanceGap >= 0.05;

      // Smooth switching: require repeated detection before changing emotion.
      let shouldApplyEmotion = false;
      if (!sameEmotionAsCurrent) {
        const isHighConfidenceImmediate = signalReliable && result.confidence >= 0.86 && dominanceGap >= 0.22;
        if (pendingEmotionRef.current === nextEmotion) {
          pendingEmotionCountRef.current += 1;
        } else {
          pendingEmotionRef.current = nextEmotion;
          pendingEmotionCountRef.current = 1;
        }
        const switchCooldownElapsed = now - lastEmotionSwitchAtRef.current >= MIN_EMOTION_SWITCH_INTERVAL_MS;
        const streakReady = pendingEmotionCountRef.current >= EMOTION_SWITCH_STREAK;
        shouldApplyEmotion = switchCooldownElapsed && signalReliable && (isHighConfidenceImmediate || streakReady);
        if (shouldApplyEmotion) {
          nextMessage = result.message;
          pendingEmotionRef.current = null;
          pendingEmotionCountRef.current = 0;
          lastEmotionSwitchAtRef.current = now;
        }
      } else {
        pendingEmotionRef.current = null;
        pendingEmotionCountRef.current = 0;
      }

      // Keep rendering stable: only switch emotion after streak or key status changes.

      const alertFlagsChanged =
        current.noFaceAlertFired !== result.no_face_alert ||
        current.shouldTriggerAlert !== result.should_trigger_alert;

      const hasMeaningfulConfidenceShift = Math.abs(result.confidence - lastAppliedConfidenceRef.current) >= CONFIDENCE_DELTA_MIN;
      const sameEmotionSyncWindowReached = now - lastUiSyncRef.current >= SAME_EMOTION_UI_MIN_INTERVAL_MS;
      const shouldSyncSameEmotion =
        sameEmotionAsCurrent &&
        stableFaceDetected &&
        ENABLE_SAME_EMOTION_SYNC &&
        ((hasMeaningfulConfidenceShift && dominanceGap >= 0.05) || sameEmotionSyncWindowReached);

      if (shouldApplyEmotion || shouldSyncSameEmotion || current.faceDetected !== stableFaceDetected || alertFlagsChanged) {
        const appliedEmotion = shouldApplyEmotion ? nextEmotion : lastAppliedEmotionRef.current;
        setEmotion({
          emotion: appliedEmotion,
          emotionVariant: shouldApplyEmotion ? result.emotion_variant : current.emotionVariant,
          emotionZone: shouldApplyEmotion ? result.emotion_zone : current.emotionZone,
          supportTip: shouldApplyEmotion ? result.support_tip : current.supportTip,
          confidence: shouldApplyEmotion ? result.confidence : (shouldSyncSameEmotion ? result.confidence : current.confidence),
          secondaryEmotion: shouldApplyEmotion ? result.secondary_emotion : current.secondaryEmotion,
          message: shouldApplyEmotion ? nextMessage : current.message,
          musicSuggestions: shouldApplyEmotion ? result.music_suggestions : current.musicSuggestions,
          faceDetected: stableFaceDetected,
          allScores: shouldApplyEmotion ? result.all_scores : current.allScores,
          noFaceAlertFired: result.no_face_alert,
          shouldTriggerAlert: result.should_trigger_alert,
          compoundEmotion: result.compound_emotion ?? null,
          emotionIntensity: result.emotion_intensity ?? 'mild',
          faceQualityScore: result.face_quality_metrics?.quality_score ?? 0,
          faceQualityTips: result.face_quality_metrics?.tips ?? [],
          emotionStreakSeconds: result.emotion_streak_seconds ?? 0,
          heartRateBpm: result.heart_rate_bpm ?? null,
          heartRateConfidence: result.heart_rate_confidence ?? 0,
          heartRateStatus: result.heart_rate_status ?? 'collecting',
        });

        if (shouldApplyEmotion || shouldSyncSameEmotion) {
          lastAppliedEmotionRef.current = appliedEmotion;
          lastAppliedConfidenceRef.current = result.confidence;
        }
        lastUiSyncRef.current = now;
      }

      if (!useAppStore.getState().isConnected) {
        setConnected(true);
      }

      // Keep cadence stable at ~1s when requests are healthy.
      dynamicIntervalMsRef.current = BASE_FRAME_INTERVAL_MS;

      const isNegative = ['sad', 'anxious', 'angry', 'disgusted', 'fearful'].includes(result.emotion);

      if (isNegative && result.confidence >= 0.55) {
        if (!negativeStreakStartRef.current) {
          negativeStreakStartRef.current = nowMs;
        }
      } else {
        negativeStreakStartRef.current = null;
      }

      const isProlongedNegative =
        negativeStreakStartRef.current !== null &&
        nowMs - negativeStreakStartRef.current >= NEGATIVE_STREAK_ALERT_MS;

      if (
        settings.voiceAssistantEnabled &&
        stableFaceDetected &&
        nowMs - lastSupportVoiceAtRef.current >= SUPPORT_VOICE_INTERVAL_MS
      ) {
        lastSupportVoiceAtRef.current = nowMs;
        const supportLine = result.emotion_zone === 'support-needed'
          ? `Estou com voce. ${result.support_tip}`
          : `Voce esta indo bem. Se quiser, eu continuo aqui te acompanhando.`;
        Speech.speak(supportLine, {
          language: 'pt-BR',
          pitch: 1,
          rate: 0.94,
        });
      }

      if (
        isProlongedNegative &&
        settingsRef.current.alertsEnabled &&
        nowMs - lastDangerAlertAtRef.current >= ALERT_COOLDOWN_MS
      ) {
        lastDangerAlertAtRef.current = nowMs;

        if (settingsRef.current.notificationsEnabled && notificationEnabledRef.current && notificationsModuleRef.current) {
          try {
            await notificationsModuleRef.current.scheduleNotificationAsync({
              content: {
                title: 'MellowPet detectou que voce pode precisar de apoio',
                body: result.support_tip || 'Vamos respirar juntos por 1 minuto?',
                sound: true,
                ...(Platform.OS === 'android' ? { channelId: 'mellowpet-alerts' } : {}),
              },
              trigger: null,
            });
          } catch (notificationError: any) {
            console.warn('[EmotionDetection] notification error', notificationError?.message || notificationError);
          }
        }

        if (settingsRef.current.hapticsEnabled) {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Vibration.vibrate([0, 220, 130, 240]);
          } catch (hapticsError: any) {
            console.warn('[EmotionDetection] haptics error', hapticsError?.message || hapticsError);
          }
        }

        const contacts = settingsRef.current.emergencyContacts;
        if (contacts.length > 0) {
          await ApiService.triggerEmotionAlert({
            session_id: sessionId,
            emotion: result.emotion_variant || result.emotion,
            duration_minutes: Math.max(2, Math.round((nowMs - (negativeStreakStartRef.current || nowMs)) / 60000)),
            contact_email: contacts[0]?.email,
          });
        }

        if (settingsRef.current.voiceAssistantEnabled) {
          try {
            Speech.speak(`Eu percebi que voce pode estar ${result.emotion_variant}. ${result.support_tip}`, {
              language: 'pt-BR',
              pitch: 1,
              rate: 0.95,
            });
          } catch (speechError: any) {
            console.warn('[EmotionDetection] speech error', speechError?.message || speechError);
          }
        }

        if (nowMs - lastSupportChatAtRef.current >= SUPPORT_CHAT_COOLDOWN_MS) {
          lastSupportChatAtRef.current = nowMs;
          addChatMessage({
            role: 'assistant',
            content: `Percebi sinais de ${result.emotion_variant}. ${result.support_tip} Se quiser, eu fico com voce por alguns minutos.`,
          });
        }
      }

      if (
        result.emotion === 'happy' &&
        result.confidence >= 0.7 &&
        stableFaceDetected &&
        nowMs - lastHappyVibrationAtRef.current >= 25000
      ) {
        lastHappyVibrationAtRef.current = nowMs;
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Vibration.vibrate([0, 70, 40, 90]);
        } catch (vibeError: any) {
          console.warn('[EmotionDetection] happy vibration error', vibeError?.message || vibeError);
        }
      }

      if (
        shouldApplyEmotion &&
        settingsRef.current.voiceAssistantEnabled &&
        nowMs - lastSpokenAtRef.current >= 12000
      ) {
        lastSpokenAtRef.current = nowMs;
        try {
          Speech.speak(`Estou percebendo um estado ${result.emotion_variant}.`, {
            language: 'pt-BR',
            pitch: 1,
            rate: 1,
          });
        } catch (speechError: any) {
          console.warn('[EmotionDetection] speech error', speechError?.message || speechError);
        }
      }

      // Fire no-face alert
      if (result.no_face_alert && settingsRef.current.alertsEnabled) {
        const contacts = settingsRef.current.emergencyContacts;
        if (contacts.length > 0) {
          await ApiService.triggerNoFaceAlert({
            session_id: sessionId,
            minutes_without_face: result.seconds_since_last_face / 60,
            contact_email: contacts[0]?.email,
          });
        }
      }

      // Fire emotion alert for persistent negative emotions
      if (result.should_trigger_alert && settingsRef.current.alertsEnabled) {
        // Persistent alerting is now handled by streak + cooldown above.
      }

    } catch (err: any) {
      errorStreakRef.current += 1;
      console.warn('[EmotionDetection] analyze loop error', err?.message || err);

      // Back off a bit on repeated errors to protect battery/network and recover gracefully.
      dynamicIntervalMsRef.current = Math.min(
        MAX_FRAME_INTERVAL_MS,
        BASE_FRAME_INTERVAL_MS + (errorStreakRef.current * 200),
      );

      // If there is no HTTP status, it's usually a connectivity issue.
      // Mark disconnected immediately so the next tick uses the health gate + backoff.
      if (!err?.response?.status) {
        setConnected(false);
        const nowMs = Date.now();
        nextApiProbeAtRef.current = Math.max(nextApiProbeAtRef.current, nowMs + apiProbeBackoffMsRef.current);
        apiProbeBackoffMsRef.current = Math.min(apiProbeBackoffMsRef.current * 1.6, 15000);
      }

      if (errorStreakRef.current >= DISCONNECT_AFTER_ERRORS) {
        setConnected(false);
      }
    } finally {
      isProcessingRef.current = false;

      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(120, dynamicIntervalMsRef.current - elapsed);
      if (detectionActiveRef.current) {
        loopTimerRef.current = setTimeout(captureAndAnalyze, waitMs);
      }
    }
  }, [sessionId, setEmotion, setConnected, addChatMessage]);

  const startDetection = useCallback(() => {
    if (detectionActiveRef.current) return;
    console.log('[EmotionDetection] startDetection');
    detectionActiveRef.current = true;
    errorStreakRef.current = 0;
    frameCountRef.current = 0;
    pendingEmotionRef.current = null;
    pendingEmotionCountRef.current = 0;
    nextApiProbeAtRef.current = 0;
    apiProbeBackoffMsRef.current = 750;
    dynamicIntervalMsRef.current = BASE_FRAME_INTERVAL_MS;
    captureQualityRef.current = 0.65;
    loopTimerRef.current = setTimeout(captureAndAnalyze, 80);
  }, [captureAndAnalyze]);

  const stopDetection = useCallback(() => {
    detectionActiveRef.current = false;
    if (loopTimerRef.current) {
      console.log('[EmotionDetection] stopDetection');
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    isProcessingRef.current = false;
    stableFaceDetectedRef.current = false;
    faceFoundCountRef.current = 0;
    faceLostCountRef.current = 0;
    negativeStreakStartRef.current = null;
    nextApiProbeAtRef.current = 0;
    apiProbeBackoffMsRef.current = 750;
    dynamicIntervalMsRef.current = BASE_FRAME_INTERVAL_MS;
    captureQualityRef.current = 0.65;
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    return () => stopDetection();
  }, [stopDetection]);

  return { cameraRef, startDetection, stopDetection };
}
