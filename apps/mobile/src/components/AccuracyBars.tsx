import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import type { DailyAccuracy } from "@/lib/attemptStats";

interface Props {
  data: DailyAccuracy[];
}

function barColor(accuracy: number) {
  if (accuracy < 40) return colors.danger;
  if (accuracy < 70) return colors.warning;
  return colors.success;
}

function shortLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AccuracyBars({ data }: Props) {
  if (!data.length) {
    return <Text style={styles.empty}>Complete a few sessions to see your accuracy trend here.</Text>;
  }

  return (
    <View>
      <View style={styles.chart}>
        {data.map((d) => (
          <View key={d.date} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(d.accuracy, 4)}%`, backgroundColor: barColor(d.accuracy) },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{shortLabel(d.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barTrack: {
    width: "100%",
    height: 80,
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
});
