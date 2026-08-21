const enabled = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === 'true';

/**
 * Rollback granular do pipeline. Flags ausentes usam o caminho local seguro:
 * V2 ligado, upload/feedback/fallback de frames desligados.
 */
export const VISION_FLAGS = Object.freeze({
  v2Enabled: enabled(process.env.EXPO_PUBLIC_VISION_V2_ENABLED, true),
  pixelClassifierEnabled: enabled(
    process.env.EXPO_PUBLIC_VISION_V2_PIXEL_CLASSIFIER_ENABLED,
    false
  ),
  eventUploadEnabled: enabled(
    process.env.EXPO_PUBLIC_VISION_V2_EVENT_UPLOAD_ENABLED,
    false
  ),
  feedbackEnabled: enabled(process.env.EXPO_PUBLIC_VISION_V2_FEEDBACK_ENABLED, false),
  supportRulesEnabled: enabled(
    process.env.EXPO_PUBLIC_VISION_V2_SUPPORT_RULES_ENABLED,
    false
  ),
  legacyServerFallbackEnabled: enabled(
    process.env.EXPO_PUBLIC_LEGACY_SERVER_FALLBACK_ENABLED,
    false
  ),
});
