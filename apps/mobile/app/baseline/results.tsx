import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchSubcategories } from "@/api/progress";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { MasterySnapshot, Subcategory } from "@/types/domain";

export default function BaselineResults() {
  const router = useRouter();
  const { mastery: masteryParam, totalDays } = useLocalSearchParams<{ mastery: string; totalDays: string }>();
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const mastery: MasterySnapshot = masteryParam ? JSON.parse(masteryParam) : {};

  useEffect(() => {
    fetchSubcategories()
      .then(setSubcategories)
      .finally(() => setLoading(false));
  }, []);

  const overall =
    Object.values(mastery).length > 0
      ? Math.round(Object.values(mastery).reduce((a, b) => a + b, 0) / Object.values(mastery).length)
      : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Here's where you stand</Text>
      <Text style={styles.subtitle}>
        Overall baseline score: <Text style={styles.overall}>{overall}%</Text>. Your {totalDays}-day plan is
        built to focus on your weakest topics first.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ScrollView style={styles.list}>
          {subcategories.map((sc) => {
            const score = Math.round(mastery[sc.id] ?? 0);
            return (
              <View key={sc.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowLabel}>{sc.name}</Text>
                  <Text style={styles.rowValue}>{score}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${score}%` }, barColor(score)]} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.buttons}>
        <PrimaryButton title="View your full plan" variant="secondary" onPress={() => router.replace("/(tabs)/plan")} />
        <PrimaryButton title="Start Day 1" onPress={() => router.replace("/(tabs)/home")} />
      </View>
    </View>
  );
}

function barColor(score: number) {
  if (score < 40) return { backgroundColor: colors.danger };
  if (score < 70) return { backgroundColor: colors.warning };
  return { backgroundColor: colors.success };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 24 },
  overall: { color: colors.primary, fontWeight: "700" },
  list: { flex: 1, marginBottom: 16 },
  row: { marginBottom: 16 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowValue: { color: colors.textMuted, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  buttons: { gap: 12 },
});
