import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchPlanDay, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { buildDayNarrative } from "@/lib/planNarrative";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { MasterySnapshot, StudyPlanDay, Subcategory } from "@/types/domain";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function PlanDayDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<StudyPlanDay | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [mastery, setMastery] = useState<MasterySnapshot>({});

  useFocusEffect(
    useCallback(() => {
      if (!session || !id) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const [dayData, subs, stats] = await Promise.all([
          fetchPlanDay(id),
          fetchSubcategories(),
          fetchSkillStats(session.user.id),
        ]);
        if (cancelled) return;
        setDay(dayData);
        setSubcategories(subs);
        const snapshot: MasterySnapshot = {};
        for (const s of stats) snapshot[s.subcategory_id] = s.mastery_score;
        setMastery(snapshot);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [session, id]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!day) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Couldn't find that day.</Text>
      </View>
    );
  }

  const nameById = new Map(subcategories.map((s) => [s.id, s.name]));
  const countBySubcategory = new Map<string, number>();
  for (const t of day.targets) {
    countBySubcategory.set(t.subcategory_id, (countBySubcategory.get(t.subcategory_id) ?? 0) + t.count);
  }
  const chips = [...countBySubcategory.entries()]
    .map(([subcategoryId, count]) => ({ name: nameById.get(subcategoryId) ?? "Topic", count }))
    .sort((a, b) => b.count - a.count);

  const narrative = buildDayNarrative(day.day_number, day.targets, subcategories, mastery);
  const totalQuestions = day.targets.reduce((sum, t) => sum + t.count, 0);
  const isAvailable = day.status === "available";
  const isCompleted = day.status === "completed";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.dayLabel}>Day {day.day_number}</Text>
      <Text style={styles.date}>{formatDate(day.date)}</Text>

      <View style={styles.narrativeBox}>
        {narrative.map((line, i) => (
          <Text key={i} style={styles.narrativeText}>
            {line}
          </Text>
        ))}
      </View>

      <Text style={styles.statLine}>
        {totalQuestions} question{totalQuestions === 1 ? "" : "s"} · ~{day.target_minutes} min
      </Text>

      <View style={styles.chips}>
        {chips.map((chip) => (
          <View key={chip.name} style={styles.chip}>
            <Text style={styles.chipText}>
              {chip.name} · {chip.count}
            </Text>
          </View>
        ))}
      </View>

      {isAvailable && (
        <PrimaryButton title="Start today's session" onPress={() => router.push("/session")} />
      )}
      {isCompleted && <Text style={styles.doneNote}>You've already completed this day. Nice work.</Text>}
      {!isAvailable && !isCompleted && (
        <Text style={styles.lockedNote}>This day unlocks once you finish the ones before it.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  dayLabel: { fontSize: 26, fontWeight: "800", color: colors.text },
  date: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  narrativeBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 8,
  },
  narrativeText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  statLine: { color: colors.textMuted, fontSize: 13, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  doneNote: { color: colors.success, fontSize: 13, textAlign: "center" },
  lockedNote: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
