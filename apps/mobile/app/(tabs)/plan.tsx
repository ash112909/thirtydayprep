import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays } from "@/api/progress";
import { DayTile } from "@/components/DayTile";
import { colors } from "@/theme";
import type { StudyPlan, StudyPlanDay } from "@/types/domain";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function Plan() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const activePlan = await fetchActivePlan(session.user.id);
        if (cancelled) return;
        setPlan(activePlan);
        setDays(activePlan ? await fetchPlanDays(activePlan.id) : []);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Your plan will show up here once you finish the baseline test.</Text>
      </View>
    );
  }

  const completedCount = days.filter((d) => d.status === "completed").length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your study plan</Text>
        <Text style={styles.subtitle}>
          {completedCount}/{plan.total_days} days done · ends {formatDate(plan.end_date)}
        </Text>
        <Text style={styles.hint}>Tap a day to see what's on it and why.</Text>
      </View>
      <FlatList
        data={days}
        keyExtractor={(d) => d.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <DayTile day={item} onPress={() => router.push(`/plan-day/${item.id}`)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  header: { padding: 24, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  grid: { paddingHorizontal: 16, paddingBottom: 24 },
  cell: { flex: 1, padding: 8 },
});
