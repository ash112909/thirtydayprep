import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { colors } from "@/theme";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

export default function Progress() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([
        fetchActivePlan(session.user.id),
        fetchSkillStats(session.user.id),
        fetchSubcategories(),
      ]).then(async ([activePlan, skillStats, subs]) => {
        if (cancelled) return;
        setPlan(activePlan);
        setStats(skillStats);
        setSubcategories(subs);
        if (activePlan) setDays(await fetchPlanDays(activePlan.id));
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  const completedDays = days.filter((d) => d.status === "completed").length;
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
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {completedDays}/{plan.total_days}
          </Text>
          <Text style={styles.summaryLabel}>days completed</Text>
        </View>
      )}

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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: { fontSize: 32, fontWeight: "800", color: colors.primary },
  summaryLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 },
  row: { marginBottom: 18 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowValue: { color: colors.textMuted, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  rowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
