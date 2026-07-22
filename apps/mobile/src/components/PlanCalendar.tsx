import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import type { StudyPlanDay } from "@/types/domain";

interface Props {
  days: StudyPlanDay[];
  onDayPress: (day: StudyPlanDay) => void;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusColor(status: StudyPlanDay["status"]): string | null {
  if (status === "completed") return colors.success;
  if (status === "available") return colors.primary;
  if (status === "skipped") return colors.danger;
  return null; // locked days get no dot — nothing to highlight yet
}

export function PlanCalendar({ days, onDayPress }: Props) {
  const byMonth = new Map<string, StudyPlanDay[]>();
  for (const day of days) {
    const key = monthKey(day.date);
    const arr = byMonth.get(key) ?? [];
    arr.push(day);
    byMonth.set(key, arr);
  }
  const months = [...byMonth.keys()].sort();

  return (
    <View style={styles.container}>
      {months.map((key) => {
        const monthDays = byMonth.get(key)!;
        const byDate = new Map(monthDays.map((d) => [d.date, d]));
        const first = new Date(`${key}-01T00:00:00Z`);
        const firstWeekday = first.getUTCDay();
        const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();

        const cells: { dateStr: string; day: StudyPlanDay | null }[] = [];
        for (let i = 0; i < firstWeekday; i++) cells.push({ dateStr: "", day: null });
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${key}-${String(d).padStart(2, "0")}`;
          cells.push({ dateStr, day: byDate.get(dateStr) ?? null });
        }

        return (
          <View key={key} style={styles.month}>
            <Text style={styles.monthLabel}>{monthLabel(key)}</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Text key={i} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((cell, idx) => {
                if (!cell.dateStr) return <View key={idx} style={styles.cell} />;
                const dot = cell.day ? statusColor(cell.day.status) : null;
                const cellDay = Number(cell.dateStr.slice(-2));
                return (
                  <Pressable
                    key={idx}
                    style={styles.cell}
                    disabled={!cell.day}
                    onPress={() => cell.day && onDayPress(cell.day)}
                  >
                    <Text style={[styles.cellText, !cell.day && styles.cellTextMuted]}>{cellDay}</Text>
                    {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  month: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthLabel: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { color: colors.text, fontSize: 13 },
  cellTextMuted: { color: colors.textMuted, opacity: 0.4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
});
