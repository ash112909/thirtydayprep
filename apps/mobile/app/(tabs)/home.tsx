import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getTodaySession } from "@/api/studyFunctions";
import { useAuth } from "@/hooks/useAuth";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { TodaySessionResponse } from "@/types/domain";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const [session, setSession] = useState<TodaySessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getTodaySession();
      setSession(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load today's session");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remaining = daysUntil(profile?.sat_date ?? null);
  const answeredCount = session?.questions?.filter((q) => q.answered).length ?? 0;
  const totalCount = session?.questions?.length ?? 0;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 26, fontWeight: "800", color: colors.text },
  countdown: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 6 },
  cardBody: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  progressText: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden", marginBottom: 20 },
  progressFill: { height: 6, backgroundColor: colors.primary },
  error: { color: colors.danger, marginTop: 20 },
});
