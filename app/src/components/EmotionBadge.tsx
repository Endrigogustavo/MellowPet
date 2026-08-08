import React from 'react';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMOTION_COLORS, Colors, Typography, Spacing, Radius, Shadow } from '../theme';

interface EmotionBadgeProps {
  emotion: string;
  confidence: number;
  emotionVariant?: string | null;
  emotionZone?: string | null;
  supportTip?: string | null;
  message?: string | null;
}

export const EmotionBadge: React.FC<EmotionBadgeProps> = ({
  emotion,
  confidence,
  emotionVariant,
  emotionZone,
  supportTip,
  message,
}) => {
  const meta = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  const pct = Math.round(confidence * 100);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: meta.light },
        Shadow.sm,
      ]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={meta.icon as any}
          size={28}
          color={meta.bg}
        />
        <View style={styles.labelRow}>
          <Text style={styles.label}>{meta.label}</Text>
          {emotionVariant ? (
            <View style={styles.variantRow}>
              <Text style={styles.variantText}>{emotionVariant}</Text>
              {emotionZone ? <Text style={styles.zoneText}>{emotionZone}</Text> : null}
            </View>
          ) : null}
          <View style={[styles.confBar, { backgroundColor: Colors.borderLight }]}>
            <View
              style={[
                styles.confFill,
                { width: `${pct}%`, backgroundColor: meta.bg },
              ]}
            />
          </View>
          <Text style={[styles.confText, { color: meta.bg }]}>{pct}%</Text>
        </View>
      </View>

      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
      {supportTip ? (
        <View style={styles.tipRow}>
          <MaterialCommunityIcons name="heart-plus" size={14} color={Colors.primary} />
          <Text style={styles.tipText}>{supportTip}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  labelRow: {
    flex: 1,
    gap: 4,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  variantText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  zoneText: {
    fontSize: Typography.xs,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  label: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  confBar: {
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  confText: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  message: {
    marginTop: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tipRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
