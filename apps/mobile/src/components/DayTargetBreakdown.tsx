import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import type { DayTarget, Difficulty, Subcategory } from "@/types/domain";

interface Props {
  targets: DayTarget[];
  subcategories: Subcategory[];
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "easy", medium: "medium", hard: "hard" };
const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

export function DayTargetBreakdown({ targets, subcategories }: Props) {
  const nameById = new Map(subcategories.map((s) => [s.id, s.name]));

  const bySubcategory = new Map<string, Partial<Record<Difficulty, number>>>();
  for (const t of targets) {
    const entry = bySubcategory.get(t.subcategory_id) ?? {};
    entry[t.difficulty] = (entry[t.difficulty] ?? 0) + t.count;
    bySubcategory.set(t.subcategory_id, entry);
  }

  const rows = [...bySubcategory.entries()]
    .map(([subcategoryId, byDifficulty]) => {
      const total = DIFFICULTY_ORDER.reduce((sum, d) => sum + (byDifficulty[d] ?? 0), 0);
      const breakdown = DIFFICULTY_ORDER.filter((d) => byDifficulty[d]).map(
        (d) => `${byDifficulty[d]} ${DIFFICULTY_LABEL[d]}`,
      );
      return { subcategoryId, name: nameById.get(subcategoryId) ?? "Unknown topic", total, breakdown };
    })
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    return <Text style={styles.empty}>No questions scheduled yet.</Text>;
  }

  return (
    <View style={styles.container}>
      {rows.map((row) => (
        <View key={row.subcategoryId} style={styles.row}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.detail}>
            {row.total} question{row.total === 1 ? "" : "s"} ({row.breakdown.join(", ")})
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  detail: { color: colors.textMuted, fontSize: 12, textAlign: "right" },
  empty: { color: colors.textMuted, fontSize: 13 },
});
