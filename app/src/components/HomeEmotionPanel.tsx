import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VirtualPet } from './VirtualPet';
import { EmotionBadge } from './EmotionBadge';
import { EmotionState, useAppStore } from '../hooks/useStore';
import { Colors, Typography, Spacing, Radius, Shadow, EMOTION_COLORS } from '../theme';

const { width, height } = Dimensions.get('window');

type Props = {
  breathingActive: boolean;
  breathingAnim: Animated.Value;
  messageAnim: Animated.Value;
};

export const HomeEmotionPanel = React.memo(function HomeEmotionPanel({
  breathingActive,
  breathingAnim,
  messageAnim,
}: Props) {
  const readCurrentEmotion = () => useAppStore.getState().currentEmotion as EmotionState;
  const petType = useAppStore((state) => state.settings.petType);
  const musicEnabled = useAppStore((state) => state.settings.musicEnabled);
  const voiceAssistantEnabled = useAppStore((state) => state.settings.voiceAssistantEnabled);
  const [displayedEmotion, setDisplayedEmotion] = useState<EmotionState>(() => readCurrentEmotion());
  const displayedEmotionRef = useRef<EmotionState>(displayedEmotion);
  const lastUiSwapAtRef = useRef(0);

  useEffect(() => {
    displayedEmotionRef.current = displayedEmotion;
  }, [displayedEmotion]);

  useEffect(() => {
    // Subscribe to store updates instead of polling on an interval.
    // This prevents the Home UI from "updating" just because requests are happening.
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      const currentEmotion = state.currentEmotion as EmotionState;
      if (prevState.currentEmotion === currentEmotion) {
        return;
      }

      const prev = displayedEmotionRef.current;
      const now = Date.now();

      // 1) Emotion change: apply immediately (the hook/store already has hysteresis).
      if (currentEmotion.emotion !== prev.emotion) {
        const uiCooldownOk = now - lastUiSwapAtRef.current >= 450;
        if (!uiCooldownOk) return;
        lastUiSwapAtRef.current = now;
        displayedEmotionRef.current = currentEmotion;
        setDisplayedEmotion(currentEmotion);
        return;
      }

      // 2) Same emotion: update if confidence, intensity, quality, streak, or face status changed.
      const significantChange =
        currentEmotion.faceDetected !== prev.faceDetected ||
        Math.abs(currentEmotion.confidence - prev.confidence) >= 0.03 ||
        currentEmotion.emotionIntensity !== prev.emotionIntensity ||
        currentEmotion.compoundEmotion !== prev.compoundEmotion ||
        Math.abs((currentEmotion.faceQualityScore ?? 0) - (prev.faceQualityScore ?? 0)) >= 0.03 ||
        Math.abs((currentEmotion.emotionStreakSeconds ?? 0) - (prev.emotionStreakSeconds ?? 0)) >= 1 ||
        currentEmotion.heartRateBpm !== prev.heartRateBpm ||
        currentEmotion.heartRateStatus !== prev.heartRateStatus;

      if (significantChange) {
        const uiCooldownOk = now - lastUiSwapAtRef.current >= 300;
        if (!uiCooldownOk) return;
        lastUiSwapAtRef.current = now;
        displayedEmotionRef.current = currentEmotion;
        setDisplayedEmotion(currentEmotion);
      }
    });

    return () => unsubscribe();
  }, []);

  const emotionMeta = useMemo(
    () => EMOTION_COLORS[displayedEmotion.emotion] || EMOTION_COLORS.neutral,
    [displayedEmotion.emotion],
  );

  const confidencePct = Math.round(displayedEmotion.confidence * 100);
  const qualityPct = Math.round((displayedEmotion.faceQualityScore ?? 0) * 100);
  const streakMin = Math.floor((displayedEmotion.emotionStreakSeconds ?? 0) / 60);
  const streakSec = Math.round((displayedEmotion.emotionStreakSeconds ?? 0) % 60);

  const heartBpm = displayedEmotion.heartRateBpm;
  const heartStatus = displayedEmotion.heartRateStatus ?? 'collecting';
  const heartReady = heartStatus === 'ready' && heartBpm != null;
  const heartColor = heartReady
    ? heartBpm! > 100 ? Colors.error : heartBpm! < 60 ? '#4A90D9' : Colors.success
    : Colors.textTertiary;

  const INTENSITY_LABELS: Record<string, string> = {
    calm: 'Calmo',
    mild: 'Leve',
    moderate: 'Moderado',
    intense: 'Intenso',
    extreme: 'Extremo',
  };
  const INTENSITY_COLORS: Record<string, string> = {
    calm: Colors.textTertiary,
    mild: Colors.success,
    moderate: Colors.warning,
    intense: '#FF8C00',
    extreme: Colors.error,
  };
  const intensityLabel = INTENSITY_LABELS[displayedEmotion.emotionIntensity] ?? 'Leve';
  const intensityColor = INTENSITY_COLORS[displayedEmotion.emotionIntensity] ?? Colors.textTertiary;

  const COMPOUND_LABELS: Record<string, string> = {
    bittersweet: 'Agridoce',
    frustrated: 'Frustrado(a)',
    awe: 'Encantado(a)',
    anxious_sad: 'Triste e ansioso(a)',
    nervous_excited: 'Empolgado(a) nervoso(a)',
    contempt: 'Desdém',
    apprehensive: 'Apreensivo(a)',
    melancholic: 'Melancólico(a)',
    embarrassed: 'Envergonhado(a)',
  };

  const topScores = useMemo(() => {
    const entries = Object.entries(displayedEmotion.allScores || {});
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [displayedEmotion.allScores]);

  return (
    <View style={styles.panelRoot}>
      <View style={styles.petStage}>
        <View style={[styles.glowCircle, { backgroundColor: emotionMeta.light }]} />

        {breathingActive && (
          <Animated.View
            style={[
              styles.breathingHalo,
              {
                borderColor: emotionMeta.bg,
                transform: [{ scale: breathingAnim }],
              },
            ]}
          />
        )}

        <VirtualPet
          emotion={displayedEmotion.emotion}
          petType={petType}
          size={width * 0.62}
          animate={true}
          faceDetected={displayedEmotion.faceDetected}
        />
      </View>

      <View style={styles.sectionGap}>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Precisão</Text>
            <Text style={[styles.kpiValue, { color: emotionMeta.bg }]}>{confidencePct}%</Text>
            <Text style={styles.kpiSub}>{displayedEmotion.emotionVariant}</Text>
          </View>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Intensidade</Text>
            <Text style={[styles.kpiValue, { color: intensityColor }]}>{intensityLabel}</Text>
            <Text style={styles.kpiSub}>
              {displayedEmotion.faceDetected ? 'Detectado' : 'Ausente'}
            </Text>
          </View>
        </View>
        <View style={[styles.kpiRow, { marginTop: Spacing.xs }]}>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Qualidade</Text>
            <Text style={[styles.kpiValue, { color: qualityPct >= 50 ? Colors.success : Colors.warning }]}>
              {qualityPct > 0 ? `${qualityPct}%` : '—'}
            </Text>
            {displayedEmotion.faceQualityTips?.length > 0 && (
              <Text style={styles.kpiSub} numberOfLines={1}>
                {displayedEmotion.faceQualityTips[0]}
              </Text>
            )}
          </View>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Duração</Text>
            <Text style={[styles.kpiValue, { color: emotionMeta.bg }]}>
              {streakMin > 0 ? `${streakMin}m ${streakSec}s` : `${streakSec}s`}
            </Text>
            <Text style={styles.kpiSub}>mesma emoção</Text>
          </View>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>❤️ Batimento</Text>
            <Text style={[styles.kpiValue, { color: heartColor }]}>
              {heartReady ? `${Math.round(heartBpm!)}` : '...'}
            </Text>
            <Text style={styles.kpiSub}>
              {heartReady ? 'bpm' : heartStatus === 'collecting' ? 'medindo' : 'instável'}
            </Text>
          </View>
        </View>
      </View>

      {displayedEmotion.compoundEmotion && (
        <View style={[styles.compoundBadge, styles.sectionGap, Shadow.sm]}>
          <MaterialCommunityIcons name="heart-pulse" size={16} color={Colors.primary} />
          <Text style={styles.compoundText}>
            Emoção mista: {COMPOUND_LABELS[displayedEmotion.compoundEmotion] ?? displayedEmotion.compoundEmotion}
          </Text>
        </View>
      )}

      {topScores.length > 0 && (
        <View style={[styles.scorePanel, styles.sectionGap, Shadow.sm]}>
          <Text style={styles.scorePanelTitle}>Leitura detalhada</Text>
          {topScores.map(([name, score]) => {
            const scorePct = Math.round(score * 100);
            return (
              <View key={name} style={styles.scoreRow}>
                <Text style={styles.scoreName}>{name}</Text>
                <View style={styles.scoreTrack}>
                  <View style={[styles.scoreFill, { width: `${scorePct}%`, backgroundColor: emotionMeta.bg }]} />
                </View>
                <Text style={styles.scorePct}>{scorePct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.sectionGap}>
        {displayedEmotion.faceDetected ? (
          <EmotionBadge
            emotion={displayedEmotion.emotion}
            confidence={displayedEmotion.confidence}
            emotionVariant={displayedEmotion.emotionVariant}
            emotionZone={displayedEmotion.emotionZone}
            supportTip={displayedEmotion.supportTip}
            message={breathingActive ? 'Inspire por 4s e expire por 4s no seu ritmo.' : displayedEmotion.message}
          />
        ) : (
          <View style={styles.noFaceContainer}>
            <View style={styles.noFaceRow}>
              <MaterialCommunityIcons
                name="face-recognition"
                size={18}
                color={Colors.textTertiary}
              />
              <Text style={styles.noFaceText}>Aguardando seu rosto...</Text>
            </View>
          </View>
        )}
      </View>

      {musicEnabled && displayedEmotion.musicSuggestions.length > 0 && (
        <Animated.View style={[styles.musicCard, styles.sectionGap, { opacity: messageAnim }, Shadow.sm]}>
          <View style={styles.musicTitleRow}>
            <MaterialCommunityIcons name="music-note-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.musicTitle}>Para o seu momento</Text>
          </View>
          <Text style={styles.musicSuggestion}>{displayedEmotion.musicSuggestions[0]}</Text>
          {voiceAssistantEnabled && displayedEmotion.emotion === 'happy' ? (
            <Text style={styles.musicCaption}>Seu pet pode comentar isso em voz quando você quiser.</Text>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  petStage: {
    minHeight: height * 0.36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  panelRoot: {
    gap: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  sectionGap: {
    marginTop: Spacing.sm,
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: width * 0.36,
  },
  breathingHalo: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    borderWidth: 2,
    opacity: 0.28,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
  },
  kpiLabel: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: Typography.xl,
    fontWeight: Typography.extrabold,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scorePanel: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: 10,
  },
  scorePanelTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreName: {
    width: 76,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  scoreTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  scorePct: {
    width: 36,
    textAlign: 'right',
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
  noFaceContainer: {
    marginHorizontal: Spacing.base,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  noFaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noFaceText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  musicCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: 6,
  },
  musicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  musicTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
  musicSuggestion: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  musicCaption: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
  compoundBadge: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compoundText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
});