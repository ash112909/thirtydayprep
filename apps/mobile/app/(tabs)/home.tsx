import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getTodaySession } from "@/api/studyFunctions";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { useAuth } from "@/hooks/useAuth";
import { buildDayNarrative } from "@/lib/planNarrative";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type {
  DayTarget,
  MasterySnapshot,
  StudyPlan,
  StudyPlanDay,
  Subcategory,
  TodaySessionResponse,
  UserSkillStat,
} from "@/types/domain";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function sessionTargets(session: TodaySessionResponse): DayTarget[] {
  const map = new Map<string, DayTarget>();
  for (const q of session.questions ?? []) {
    const key = `${q.subcategory_id}:${q.difficulty}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { subcategory_id: q.subcategory_id, difficulty: q.difficulty, count: 1 });
  }
  return [...map.values()];
}

export default function Home() {
  const router = useRouter();
  const { session: auth, profile } = useAuth();
  const [session, setSession] = useState<TodaySessionResponse | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [mastery, setMastery] = useState<MasterySnapshot>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setError(null);
    try {
      const [todaySession, activePlan, skillStats, subs] = await Promise.all([
        getTodaySession(),
        fetchActivePlan(auth.user.id),
        fetchSkillStats(auth.user.id),
        fetchSubcategories(),
      ]);
      setSession(todaySession);
      setPlan(activePlan);
      setSubcategories(subs);
      setStats(skillStats);
      const snapshot: MasterySnapshot = {};
      for (const s of skillStats) snapshot[s.subcategory_id] = s.mastery_score;
      setMastery(snapshot);
      setDays(activePlan ? await fetchPlanDays(activePlan.id) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load today's session");
      setSession(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remaining = daysUntil(profile?.sat_date ?? null);
  const answeredCount = session?.questions?.filter((q) => q.answered).length ?? 0;
  const totalCount = session?.questions?.length ?? 0;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;
  const needsBaseline = !!error?.toLowerCase().includes("baseline test");

  const streak = computeStreak(days);
  const overallAccuracy = computeOverallAccuracy(stats);
  const completedDays = days.filter((d) => d.status === "completed").length;

  const narrative =
    session?.questions && session.day_number != null
      ? buildDayNarrative(session.day_number, sessionTargets(session), subcategories, mastery)
      : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.greeting}>Hi{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋</Text>
      {remaining != null && (
        <Text style={styles.countdown}>
          {remaining > 0 ? `${remaining} days until your SAT` : "Your SAT is today — good luck!"}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
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
            </View>
          )}

          {needsBaseline ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Take your baseline test</Text>
              <Text style={styles.cardBody}>
                We need a quick 24-question diagnostic to build your study plan.
              </Text>
              <PrimaryButton title="Start baseline test" onPress={() => router.push("/baseline/intro")} />
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : session?.plan_complete ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Plan complete 🎉</Text>
              <Text style={styles.cardBody}>You've finished every day of your study plan. Check Progress for a full recap.</Text>
            </View>
          ) : session?.waiting ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>All caught up</Text>
              <Text style={styles.cardBody}>{session.message}</Text>
            </View>
          ) : session?.questions ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Day {session.day_number}</Text>
              {narrative.map((line, i) => (
                <Text key={i} style={styles.narrativeText}>
                  {line}
                </Text>
              ))}
              <Text style={styles.cardBody}>
                {totalCount} questions · ~{session.target_minutes} min
              </Text>
              <Text style={styles.progressText}>
                {answeredCount}/{totalCount} answered
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%` }]} />
              </View>
              <PrimaryButton
                title={allAnswered ? "Review today's session" : answeredCount > 0 ? "Continue session" : "Start today's session"}
                onPress={() => router.push("/session")}
              />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 26, fontWeight: "800", color: colors.text },
  countdown: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 6 },
  narrativeText: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  cardBody: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  progressText: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden", marginBottom: 20 },
  progressFill: { height: 6, backgroundColor: colors.primary },
  error: { color: colors.danger, marginTop: 20 },
});
