import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchDayRecap, fetchPlanDay, fetchSubcategories, type RecapQuestion } from "@/api/progress";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StudyPet } from "@/components/StudyPet";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { colors } from "@/theme";
import type { StudyPlanDay, Subcategory } from "@/types/domain";

interface SubcategoryBreakdown {
  subcategoryId: string;
  name: string;
  correct: number;
  total: number;
}

export default function SessionRecap() {
  const router = useRouter();
  const { pet } = usePetCompanion();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<StudyPlanDay | null>(null);
  const [questions, setQuestions] = useState<RecapQuestion[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    if (!dayId) return;
    Promise.all([fetchPlanDay(dayId), fetchDayRecap(dayId), fetchSubcategories()]).then(
      ([dayData, recap, subs]) => {
        setDay(dayData);
        setQuestions(recap);
        setSubcategories(subs);
        setLoading(false);
      },
    );
  }, [dayId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const nameById = new Map(subcategories.map((s) => [s.id, s.name]));
  const total = questions.length;
  const correct = questions.filter((q) => q.is_correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const totalTime = questions.reduce((sum, q) => sum + (q.time_spent_seconds ?? 0), 0);
  const totalBenchmark = questions.reduce((sum, q) => sum + q.avg_seconds, 0);
  const paceDelta = totalBenchmark ? Math.round(((totalTime - totalBenchmark) / totalBenchmark) * 100) : 0;
  const missedCount = total - correct;

  const bySubcategory = new Map<string, SubcategoryBreakdown>();
  for (const q of questions) {
    const existing = bySubcategory.get(q.subcategory_id) ?? {
      subcategoryId: q.subcategory_id,
      name: nameById.get(q.subcategory_id) ?? "Topic",
      correct: 0,
      total: 0,
    };
    existing.total += 1;
    if (q.is_correct) existing.correct += 1;
    bySubcategory.set(q.subcategory_id, existing);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        {pet && (
          <View style={styles.titleAvatar}>
            <StudyPet species={pet.species} energy="energetic" growthStage="grown" size={44} />
          </View>
        )}
        <View>
          <Text style={styles.title}>Day {day?.day_number} complete 🎉</Text>
          <Text style={styles.subtitle}>Here's how it went.</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{accuracy}%</Text>
          <Text style={styles.statLabel}>accuracy</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {correct}/{total}
          </Text>
          <Text style={styles.statLabel}>correct</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {paceDelta === 0 ? "on pace" : paceDelta > 0 ? `+${paceDelta}%` : `${paceDelta}%`}
          </Text>
          <Text style={styles.statLabel}>vs. expected time</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>By topic</Text>
      {[...bySubcategory.values()].map((sc) => (
        <View key={sc.subcategoryId} style={styles.row}>
          <Text style={styles.rowLabel}>{sc.name}</Text>
          <Text style={styles.rowValue}>
            {sc.correct}/{sc.total}
          </Text>
        </View>
      ))}

      {missedCount > 0 && (
        <View style={styles.mistakeCard}>
          <Text style={styles.mistakeText}>
            {missedCount} question{missedCount === 1 ? "" : "s"} to revisit — they're waiting in your Mistake Bank.
          </Text>
          <PrimaryButton title="Go to Mistake Bank" variant="secondary" onPress={() => router.push("/mistakes")} />
        </View>
      )}

      <PrimaryButton title="Back to Today" onPress={() => router.replace("/(tabs)/home")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  titleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 4, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.text, fontSize: 14 },
  rowValue: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  mistakeCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    marginBottom: 8,
    gap: 12,
  },
  mistakeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
});
