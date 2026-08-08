import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, CameraView } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeEmotionPanel } from '../components/HomeEmotionPanel';
import { MellowMark } from '../components/MellowMark';
import { useAppStore } from '../hooks/useStore';
import { useEmotionDetection } from '../hooks/useEmotionDetection';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

const { width, height } = Dimensions.get('window');

const HiddenCamera = React.memo(function HiddenCamera({
  cameraRef,
  onCameraReady,
  onMountError,
}: {
  cameraRef: any;
  onCameraReady: () => void;
  onMountError: (event: any) => void;
}) {
  return (
    <CameraView
      ref={cameraRef}
      style={styles.hiddenCamera}
      facing="front"
      mode="picture"
      animateShutter={false}
      mute={true}
      active={true}
      onCameraReady={onCameraReady}
      onMountError={onMountError}
    />
  );
});

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const petName = useAppStore((state) => state.settings.petName);
  const isConnected = useAppStore((state) => state.isConnected);
  const { cameraRef, startDetection, stopDetection } = useEmotionDetection();

  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [cameraReady, setCameraReady] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const messageAnim = useRef(new Animated.Value(0)).current;
  const breathingAnim = useRef(new Animated.Value(0.92)).current;

  const onCameraReady = useCallback(() => {
    console.log('[HomeScreen] camera ready');
    setCameraReady(true);
  }, []);

  const onMountError = useCallback((event: any) => {
    console.warn('[HomeScreen] camera mount error', event);
    setCameraReady(false);
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then((response) => {
      console.log('[HomeScreen] camera permission:', response.status, 'granted=', response.granted);
      setCameraPermission(response.granted ? 'granted' : 'denied');
    });
    return () => stopDetection();
  }, []);

  useEffect(() => {
    console.log('[HomeScreen] detection gate', { cameraPermission, cameraReady });
    if (cameraPermission === 'granted' && cameraReady) {
      startDetection();
    }
  }, [cameraPermission, cameraReady, startDetection]);

  useEffect(() => {
    if (!breathingActive) {
      breathingAnim.setValue(0.92);
      return;
    }

    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: 1.08,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(breathingAnim, {
          toValue: 0.92,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );

    breathingLoop.start();
    return () => breathingLoop.stop();
  }, [breathingActive]);

  const gradientColors = useMemo(() => ['#F8F9FB', '#EEF2FF', '#F8F9FB'] as const, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Hidden camera — runs in background */}
      {cameraPermission === 'granted' && (
        <HiddenCamera
          cameraRef={cameraRef}
          onCameraReady={onCameraReady}
          onMountError={onMountError}
        />
      )}

      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.markBadge}>
              <MellowMark size={26} color={Colors.primary} detail={Colors.surface} />
            </View>
            <View>
              <Text style={styles.petName}>{petName}</Text>
              <View style={styles.statusRow}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? Colors.success : Colors.textTertiary }
                ]} />
                <Text style={styles.statusText}>
                  {isConnected ? 'detectando emoções' : 'conectando...'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Controls */}
          <View style={[styles.controlsCard, Shadow.sm]}>
            <TouchableOpacity
              style={[styles.controlItem, focusMode && styles.controlItemActive]}
              onPress={() => {
                setFocusMode((prev) => !prev);
                setBreathingActive(false);
              }}
            >
              <MaterialCommunityIcons
                name={focusMode ? 'pause-circle' : 'play-circle-outline'}
                size={18}
                color={focusMode ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.controlText, focusMode && styles.controlTextActive]}>
                Modo foco
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlItem, breathingActive && styles.controlItemActive]}
              onPress={() => {
                setBreathingActive((prev) => !prev);
                setFocusMode(false);
              }}
            >
              <MaterialCommunityIcons
                name="meditation"
                size={18}
                color={breathingActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.controlText, breathingActive && styles.controlTextActive]}>
                Respiração guiada
              </Text>
            </TouchableOpacity>
          </View>

          <HomeEmotionPanel
            breathingActive={breathingActive}
            breathingAnim={breathingAnim}
            messageAnim={messageAnim}
          />

        </ScrollView>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  markBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petName: {
    fontSize: Typography.xl,
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  petStage: {
    minHeight: height * 0.36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  controlsCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: 6,
    gap: 8,
  },
  toolkitCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    gap: Spacing.base,
    ...Shadow.sm,
  },
  toolkitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolkitTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  toolkitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolButton: {
    width: '48%',
    minHeight: 82,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  toolButtonAccent: {
    backgroundColor: Colors.primaryLight,
  },
  toolButtonTextWrap: {
    flex: 1,
    gap: 2,
  },
  toolButtonLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  toolButtonHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  controlItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  controlItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  controlText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  controlTextActive: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  kpiLabel: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  kpiSub: {
    marginTop: 2,
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textTransform: 'capitalize',
  },
  scorePanel: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    gap: 8,
  },
  scorePanelTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreName: {
    width: 72,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  scoreTrack: {
    flex: 1,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  scorePct: {
    width: 34,
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  noFaceContainer: {
    marginHorizontal: Spacing.base,
    padding: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
  },
  noFaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noFaceText: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  musicCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    padding: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  musicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  musicTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  musicSuggestion: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  assistRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  assistBtn: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  assistText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  bottomActionsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 12,
    backgroundColor: 'rgba(248,249,251,0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    gap: 4,
    ...Shadow.sm,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primaryLight,
  },
  actionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
});
