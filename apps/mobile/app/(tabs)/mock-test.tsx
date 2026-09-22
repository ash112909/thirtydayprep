import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchMockTestHistory } from "@/api/mockTest";
import { BuddyHeader } from "@/components/BuddyHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TrophyIcon } from "@/components/icons";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { fonts } from "@/theme";
import type { MockTestSummary } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MockTestHome() {
  const router = useRouter();
  const { session } = useAuth();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 20 },
    title: { fontSize: 26, fontFamily: fonts.display, color: colors.text, marginBottom: 6 },
    subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    scoreCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scoreLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    scoreValue: { fontSize: 44, fontFamily: fonts.display, color: colors.text },
    scoreDelta: { fontSize: 13, fontFamily: fonts.bodySemibold, marginTop: 2, marginBottom: 16 },
    scoreDeltaUp: { color: colors.success },
    scoreDeltaDown: { color: colors.danger },
    sectionRow: { flexDirection: "row", gap: 12 },
    sectionBox: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    sectionValue: { fontSize: 20, fontFamily: fonts.displaySemibold, color: colors.text },
    sectionLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 24,
      marginBottom: 20,
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
    historySection: { marginTop: 28 },
    historyTitle: { fontSize: 15, fontFamily: fonts.displaySemibold, color: colors.text, marginBottom: 12 },
    historyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyDate: { fontSize: 13, color: colors.textMuted },
    historyScore: { fontSize: 14, fontFamily: fonts.bodySemibold, color: colors.text },
  }));
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MockTestSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      fetchMockTestHistory(session.user.id)
        .then((rows) => {
          if (!cancelled) setHistory(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
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

  const latest = history[0];
  const prior = history[1];
  const delta =
    latest?.total_scaled != null && prior?.total_scaled != null ? latest.total_scaled - prior.total_scaled : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BuddyHeader line={history.length ? "Let's see where you stand." : "Ready for a full-length run?"} />
        <Text style={styles.title}>Mock test</Text>
        <Text style={styles.subtitle}>
          A timed, full-length practice exam — Reading &amp; Writing, then Math — scored 200-800 per section, just
          like test day.
        </Text>
      </View>

      {latest ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Latest score</Text>
          <Text style={styles.scoreValue}>{latest.total_scaled ?? "—"}</Text>
          {delta != null && (
            <Text style={[styles.scoreDelta, delta >= 0 ? styles.scoreDeltaUp : styles.scoreDeltaDown]}>
              {delta >= 0 ? `+${delta}` : delta} vs. last time
            </Text>
          )}
          <View style={styles.sectionRow}>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionValue}>{latest.rw_scaled ?? "—"}</Text>
              <Text style={styles.sectionLabel}>Reading & Writing</Text>
            </View>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionValue}>{latest.math_scaled ?? "—"}</Text>
              <Text style={styles.sectionLabel}>Math</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <TrophyIcon size={28} color={colors.primary} />
          <Text style={styles.emptyText}>
            98 questions, about 2 hours, timed just like the real thing. Take one every week or so to watch your
            score move.
          </Text>
        </View>
      )}

      <PrimaryButton
        title={history.length ? "Start a new mock test" : "Start your first mock test"}
        onPress={() => router.push("/mock-test-run")}
      />

      {history.length > 1 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>History</Text>
          {history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{h.completed_at ? formatDate(h.completed_at) : ""}</Text>
              <Text style={styles.historyScore}>{h.total_scaled ?? "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
