import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { MellowMark } from '../components/MellowMark';
import { ApiService, DashboardData } from '../services/api';
import { useAppStore } from '../hooks/useStore';
import { Colors, Typography, Spacing, Radius, Shadow, EMOTION_COLORS } from '../theme';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - Spacing.xl * 2;

const PERIODS = [
  { label: '24h', hours: 24 },
  { label: '3 dias', hours: 72 },
  { label: '7 dias', hours: 168 },
];

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const sessionId = useAppStore((state) => state.sessionId);
  const userId = useAppStore((state) => state.settings.userId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(0);

  const fetchData = useCallback(async (hours: number) => {
    try {
      const result = await ApiService.getDashboard({
        sessionId,
        userId: userId ?? undefined,
        hours,
      });
      setData(result);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, userId]);

  useEffect(() => {
    setLoading(true);
    fetchData(PERIODS[selectedPeriod].hours);
  }, [selectedPeriod, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(PERIODS[selectedPeriod].hours);
  }, [fetchData, selectedPeriod]);

  const wellbeingColor = (score: number) => {
    if (score >= 70) return Colors.success;
    if (score >= 40) return Colors.warning;
    return Colors.error;
  };

  // Build pie chart data
  const pieData = useMemo(() => data
    ? Object.entries(data.emotion_distribution)
        .filter(([, pct]) => pct > 0)
        .map(([emotion, pct]) => ({
          name: EMOTION_COLORS[emotion]?.label || emotion,
          population: pct,
          color: EMOTION_COLORS[emotion]?.bg || Colors.neutral,
          legendFontColor: Colors.textSecondary,
          legendFontSize: 12,
        }))
    : [], [data]);

  // Build bar chart data from timeline
  const barData = useMemo(() => data?.timeline.length
    ? {
        labels: data.timeline.slice(-8).map((t) => `${t.hour}h`),
        datasets: [{
          data: data.timeline.slice(-8).map((t) => t.total),
        }],
      }
    : null, [data]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Seu Bem-Estar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map((p, i) => (
          <TouchableOpacity
            key={p.hours}
            style={[styles.periodBtn, i === selectedPeriod && styles.periodBtnActive]}
            onPress={() => setSelectedPeriod(i)}
          >
            <Text style={[styles.periodLabel, i === selectedPeriod && styles.periodLabelActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
        ) : !data || data.total_events === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MellowMark size={64} color={Colors.textTertiary} detail={Colors.background} />
            </View>
            <Text style={styles.emptyTitle}>Sem dados ainda</Text>
            <Text style={styles.emptySubtitle}>
              Continue usando o MellowPet para ver seus padrões emocionais aqui!
            </Text>
          </View>
        ) : (
          <>
            {/* Wellbeing Score Card */}
            <View style={[styles.card, Shadow.md]}>
              <Text style={styles.cardTitle}>Índice de Bem-Estar</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreNumber, { color: wellbeingColor(data.wellbeing_score) }]}>
                  {data.wellbeing_score.toFixed(0)}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreFill,
                    {
                      width: `${data.wellbeing_score}%`,
                      backgroundColor: wellbeingColor(data.wellbeing_score),
                    },
                  ]}
                />
              </View>
              <Text style={styles.totalReadings}>{data.total_events} leituras realizadas</Text>
            </View>

            {/* AI Insight Card */}
            <View style={[styles.card, styles.insightCard, Shadow.md]}>
              <View style={styles.insightHeader}>
                <MaterialCommunityIcons name="robot-outline" size={22} color={Colors.primary} />
                <Text style={styles.insightTitle}>Insight da IA</Text>
              </View>
              <Text style={styles.insightText}>{data.ai_insight}</Text>
              <Text style={styles.insightProvider}>
                {data.ai_provider === 'openai'
                  ? 'Gerado por OpenAI'
                  : data.ai_provider === 'anthropic'
                    ? 'Gerado por Anthropic'
                    : 'Gerado em modo fallback'}
              </Text>
            </View>

            {/* Dominant emotion */}
            <View style={styles.dominantRow}>
              {data.peak_emotions.slice(0, 3).map(([emotion, count]) => {
                const meta = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
                return (
                  <View
                    key={emotion}
                    style={[styles.dominantChip, { backgroundColor: meta.light }, Shadow.sm]}
                  >
                    <MaterialCommunityIcons name={meta.icon as any} size={24} color={meta.bg} />
                    <Text style={styles.dominantLabel}>{meta.label}</Text>
                    <Text style={[styles.dominantCount, { color: meta.bg }]}>{count}x</Text>
                  </View>
                );
              })}
            </View>

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <View style={[styles.card, Shadow.sm]}>
                <Text style={styles.cardTitle}>Distribuição Emocional</Text>
                <PieChart
                  data={pieData}
                  width={CHART_WIDTH - Spacing.xl}
                  height={180}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  hasLegend={true}
                />
              </View>
            )}

            {/* Bar Chart */}
            {barData && (
              <View style={[styles.card, Shadow.sm]}>
                <Text style={styles.cardTitle}>Atividade por Hora</Text>
                <BarChart
                  data={barData}
                  width={CHART_WIDTH - Spacing.xl}
                  height={180}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  showValuesOnTopOfBars
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const chartConfig = {
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
  labelColor: () => Colors.textSecondary,
  strokeWidth: 2,
  barPercentage: 0.7,
  propsForLabels: { fontSize: 11 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    padding: 3,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  periodLabel: { fontSize: Typography.sm, color: Colors.textTertiary, fontWeight: Typography.medium },
  periodLabelActive: { color: Colors.textPrimary, fontWeight: Typography.semibold },
  scroll: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  scoreNumber: { fontSize: Typography.display1, fontWeight: Typography.extrabold, lineHeight: 56 },
  scoreMax: { fontSize: Typography.lg, color: Colors.textTertiary, marginBottom: 8 },
  scoreBar: {
    height: 8, borderRadius: Radius.full,
    backgroundColor: Colors.borderLight, marginTop: Spacing.sm, overflow: 'hidden',
  },
  scoreFill: { height: '100%', borderRadius: Radius.full },
  totalReadings: {
    marginTop: Spacing.sm, fontSize: Typography.sm, color: Colors.textTertiary,
  },
  insightCard: { backgroundColor: Colors.primaryLight },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  insightTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.primary },
  insightText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  insightProvider: { marginTop: 8, fontSize: Typography.xs, color: Colors.textTertiary },
  dominantRow: { flexDirection: 'row', gap: Spacing.sm },
  dominantChip: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  dominantLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  dominantCount: { fontSize: Typography.sm, fontWeight: Typography.bold },
  chart: { marginTop: -8, borderRadius: Radius.md },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xxl },
  emptyIcon: { marginBottom: Spacing.base },
  emptyTitle: {
    fontSize: Typography.xl, fontWeight: Typography.bold,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
});
