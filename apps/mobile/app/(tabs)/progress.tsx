import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchActivePlan,
  fetchAttempts,
  fetchBaselineMastery,
  fetchCategories,
  fetchPlanDays,
  fetchSkillStats,
  fetchSubcategories,
} from "@/api/progress";
import { fetchMistakes } from "@/api/mistakes";
import { bucketAttemptsByDay } from "@/lib/attemptStats";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { computePaceDelta } from "@/lib/paceBenchmarks";
import { predictScore } from "@/lib/scorePrediction";
import { AccuracyBars } from "@/components/AccuracyBars";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { ColorTokens } from "@/theme";
import type { AttemptRecord } from "@/api/progress";
import type { Category, MasterySnapshot, StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

function barColor(score: number, colors: ColorTokens) {
  if (score < 40) return { backgroundColor: colors.danger };
  if (score < 70) return { backgroundColor: colors.warning };
  return { backgroundColor: colors.success };
}

export default function Progress() {
  const router = useRouter();
  const { session } = useAuth();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 20 },
    statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
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
    mistakeCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      gap: 12,
    },
    mistakeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    scoreCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      marginBottom: 8,
    },
    scoreTotal: { color: colors.primary, fontSize: 36, fontWeight: "800" },
    scoreCaption: { color: colors.textMuted, fontSize: 11, marginTop: 4, marginBottom: 16, textAlign: "center" },
    scoreBreakdown: { flexDirection: "row", gap: 24 },
    scoreSection: { alignItems: "center" },
    scoreSectionValue: { color: colors.text, fontSize: 16, fontWeight: "700" },
    scoreSectionLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    paceCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    paceText: { color: colors.text, fontSize: 13, lineHeight: 19 },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 28,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16, marginTop: 12 },
    row: { marginBottom: 18 },
    rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
    rowValue: { color: colors.textMuted, fontSize: 13 },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4 },
    rowMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    rowMeta: { color: colors.textMuted, fontSize: 11 },
    deltaUp: { color: colors.success },
    deltaDown: { color: colors.danger },
  }));
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [baselineMastery, setBaselineMastery] = useState<MasterySnapshot>({});
  const [mistakeCount, setMistakeCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([
        fetchActivePlan(session.user.id),
        fetchSkillStats(session.user.id),
        fetchCategories(),
        fetchSubcategories(),
        fetchAttempts(session.user.id),
        fetchBaselineMastery(session.user.id),
        fetchMistakes(session.user.id),
      ]).then(async ([activePlan, skillStats, cats, subs, attemptRecords, baseline, mistakes]) => {
        if (cancelled) return;
        setPlan(activePlan);
        setStats(skillStats);
        setCategories(cats);
        setSubcategories(subs);
        setAttempts(attemptRecords);
        setBaselineMastery(baseline);
        setMistakeCount(mistakes.length);
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
  const paceDelta = computePaceDelta(stats, subcategories);
  const statByCategoryId = new Map(stats.map((s) => [s.subcategory_id, s]));
  const mastery: MasterySnapshot = {};
  for (const s of stats) mastery[s.subcategory_id] = s.mastery_score;
  const score = predictScore(categories, subcategories, mastery);
  const hasBaselineComparison = Object.keys(baselineMastery).length > 0;

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

      {mistakeCount > 0 && (
        <View style={styles.mistakeCard}>
          <Text style={styles.mistakeText}>
            {mistakeCount} question{mistakeCount === 1 ? "" : "s"} waiting in your Mistake Bank.
          </Text>
          <PrimaryButton title="Review now" variant="secondary" onPress={() => router.push("/mistakes")} />
        </View>
      )}

      {score.total != null && (
        <>
          <Text style={styles.sectionTitle}>Estimated score</Text>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreTotal}>{score.total}</Text>
            <Text style={styles.scoreCaption}>Rough estimate from current mastery — not an official score.</Text>
            <View style={styles.scoreBreakdown}>
              {categories.map((c) => (
                <View key={c.id} style={styles.scoreSection}>
                  <Text style={styles.scoreSectionValue}>{score.bySectionSlug[c.slug] ?? "—"}</Text>
                  <Text style={styles.scoreSectionLabel}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {paceDelta != null && (
        <>
          <Text style={styles.sectionTitle}>Pace</Text>
          <View style={styles.paceCard}>
            <Text style={styles.paceText}>
              {Math.abs(paceDelta) <= 5
                ? "You're right on pace with expected timing."
                : paceDelta > 0
                  ? `You're averaging about ${paceDelta}% slower than expected per question.`
                  : `You're averaging about ${Math.abs(paceDelta)}% faster than expected per question.`}
            </Text>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Accuracy trend</Text>
      <View style={styles.chartCard}>
        <AccuracyBars data={dailyAccuracy} />
      </View>

      <Text style={styles.sectionTitle}>By section</Text>
      {categories.map((cat) => {
        const subs = subcategories.filter((s) => s.category_id === cat.id);
        const scores = subs.map((s) => mastery[s.id]).filter((v): v is number => v != null);
        const avg = scores.length ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length) : null;
        return (
          <View key={cat.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{cat.name}</Text>
              <Text style={styles.rowValue}>{avg != null ? `${avg}%` : "—"}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${avg ?? 0}%` }, barColor(avg ?? 0, colors)]} />
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Mastery by topic</Text>
      {subcategories.map((sc) => {
        const stat = statByCategoryId.get(sc.id);
        const masteryScore = Math.round(stat?.mastery_score ?? 0);
        const attempted = stat?.questions_attempted ?? 0;
        const baseline = baselineMastery[sc.id];
        const delta =
          hasBaselineComparison && baseline != null && attempted > 0 ? Math.round(masteryScore - baseline) : null;
        return (
          <View key={sc.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{sc.name}</Text>
              <Text style={styles.rowValue}>{attempted > 0 ? `${masteryScore}%` : "—"}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${masteryScore}%` }, barColor(masteryScore, colors)]} />
            </View>
            <View style={styles.rowMetaRow}>
              {attempted > 0 && <Text style={styles.rowMeta}>{attempted} questions attempted</Text>}
              {delta != null && delta !== 0 && (
                <Text style={[styles.rowMeta, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
                  {delta > 0 ? `+${delta}` : delta} since baseline
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
