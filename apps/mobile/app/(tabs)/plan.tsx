import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays, fetchSubcategories } from "@/api/progress";
import { DayTargetBreakdown } from "@/components/DayTargetBreakdown";
import { colors } from "@/theme";
import type { StudyPlan, StudyPlanDay, Subcategory } from "@/types/domain";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
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
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const [activePlan, subs] = await Promise.all([fetchActivePlan(session.user.id), fetchSubcategories()]);
        if (cancelled) return;
        setPlan(activePlan);
        setSubcategories(subs);
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={days}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Your study plan</Text>
          <Text style={styles.subtitle}>
            {plan.total_days} days · ~{plan.daily_minutes} min/day · ends {formatDate(plan.end_date)}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isAvailable = item.status === "available";
        const isCompleted = item.status === "completed";
        const isLocked = item.status === "locked";

        const card = (
          <View style={[styles.card, isAvailable && styles.cardAvailable, isLocked && styles.cardLocked]}>
            <View style={styles.cardHeader}>
              <Text style={styles.dayLabel}>
                Day {item.day_number} · {formatDate(item.date)}
              </Text>
              <Text style={[styles.badge, isCompleted && styles.badgeCompleted, isAvailable && styles.badgeAvailable]}>
                {isCompleted ? "Completed" : isAvailable ? "Today" : "Locked"}
              </Text>
            </View>
            <Text style={styles.minutes}>~{item.target_minutes} min</Text>
            <DayTargetBreakdown targets={item.targets} subcategories={subcategories} />
          </View>
        );

        return isAvailable ? (
          <Pressable onPress={() => router.push("/session")}>{card}</Pressable>
        ) : (
          card
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60, gap: 12 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardAvailable: { borderColor: colors.primary },
  cardLocked: { opacity: 0.55 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  dayLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  minutes: { color: colors.textMuted, fontSize: 12, marginBottom: 12 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  badgeAvailable: { color: colors.primary, borderColor: colors.primary },
  badgeCompleted: { color: colors.success, borderColor: colors.success },
});
