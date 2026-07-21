import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import type { StudyPlanDay } from "@/types/domain";

interface Props {
  day: StudyPlanDay;
  onPress: () => void;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DayTile({ day, onPress }: Props) {
  const isAvailable = day.status === "available";
  const isCompleted = day.status === "completed";
  const isLocked = day.status === "locked";
  const questionCount = day.targets.reduce((sum, t) => sum + t.count, 0);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, isAvailable && styles.tileAvailable, isLocked && styles.tileLocked]}
    >
      <Text style={styles.dayNumber}>Day {day.day_number}</Text>
      <Text style={styles.date}>{shortDate(day.date)}</Text>
      <View style={styles.spacer} />
      {isCompleted ? (
        <Text style={styles.statusDone}>✓ Done</Text>
      ) : isAvailable ? (
        <Text style={styles.statusToday}>Today</Text>
      ) : (
        <Text style={styles.statusLocked}>🔒</Text>
      )}
      <Text style={styles.count}>{questionCount} questions</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 130,
  },
  tileAvailable: { borderColor: colors.primary, borderWidth: 1.5 },
  tileLocked: { opacity: 0.5 },
  dayNumber: { color: colors.text, fontSize: 16, fontWeight: "700" },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  spacer: { flex: 1 },
  statusDone: { color: colors.success, fontSize: 13, fontWeight: "600" },
  statusToday: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  statusLocked: { fontSize: 14 },
  count: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
});
