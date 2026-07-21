import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchAttempts, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { bucketAttemptsByDay } from "@/lib/attemptStats";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { AccuracyBars } from "@/components/AccuracyBars";
import { colors } from "@/theme";
import type { AttemptRecord } from "@/api/progress";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

export default function Progress() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([
        fetchActivePlan(session.user.id),
        fetchSkillStats(session.user.id),
        fetchSubcategories(),
        fetchAttempts(session.user.id),
      ]).then(async ([activePlan, skillStats, subs, attemptRecords]) => {
        if (cancelled) return;
        setPlan(activePlan);
        setStats(skillStats);
        setSubcategories(subs);
        setAttempts(attemptRecords);
        if (activePlan) setDays(await fetchPlanDays(activePlan.id));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  const completedDays = days.filter((d) => d.status === "completed").length;
  const streak = computeStreak(days);
  const overallAccuracy = computeOverallAccuracy(stats);
  const totalAnswered = stats.reduce((sum, s) => sum + s.questions_attempted, 0);
  const dailyAccuracy = bucketAttemptsByDay(attempts);
  const statByCategoryId = new Map(stats.map((s) => [s.subcategory_id, s]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your progress</Text>

      {plan && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak > 0 ? `🔥 ${streak}` : "—"}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {completedDays}/{plan.total_days}
            </Text>
            <Text style={styles.statLabel}>days done</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{overallAccuracy != null ? `${overallAccuracy}%` : "—"}</Text>
            <Text style={styles.statLabel}>accuracy</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalAnswered}</Text>
            <Text style={styles.statLabel}>questions</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Accuracy trend</Text>
      <View style={styles.chartCard}>
        <AccuracyBars data={dailyAccuracy} />
      </View>

      <Text style={styles.sectionTitle}>Mastery by topic</Text>
      {subcategories.map((sc) => {
        const stat = statByCategoryId.get(sc.id);
        const score = Math.round(stat?.mastery_score ?? 0);
        const attempted = stat?.questions_attempted ?? 0;
        return (
          <View key={sc.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{sc.name}</Text>
              <Text style={styles.rowValue}>{attempted > 0 ? `${score}%` : "—"}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${score}%` }, barColor(score)]} />
            </View>
            {attempted > 0 && <Text style={styles.rowMeta}>{attempted} questions attempted</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

function barColor(score: number) {
  if (score < 40) return { backgroundColor: colors.danger };
  if (score < 70) return { backgroundColor: colors.warning };
  return { backgroundColor: colors.success };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 28 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 9, marginTop: 4, textAlign: "center" },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 },
  row: { marginBottom: 18 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowValue: { color: colors.textMuted, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  rowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
