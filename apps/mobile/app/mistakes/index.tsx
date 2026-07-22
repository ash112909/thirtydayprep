import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchMistakes, type MistakeQuestion } from "@/api/mistakes";
import { fetchSubcategories } from "@/api/progress";
import { colors } from "@/theme";
import type { Subcategory } from "@/types/domain";

function difficultyColor(difficulty: string) {
  if (difficulty === "hard") return colors.danger;
  if (difficulty === "medium") return colors.warning;
  return colors.success;
}

export default function MistakeBank() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mistakes, setMistakes] = useState<MistakeQuestion[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([fetchMistakes(session.user.id), fetchSubcategories()]).then(([m, subs]) => {
        if (cancelled) return;
        setMistakes(m);
        setSubcategories(subs);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  const nameById = new Map(subcategories.map((s) => [s.id, s.name]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mistake Bank</Text>
        <Text style={styles.subtitle}>
          {mistakes.length
            ? `${mistakes.length} question${mistakes.length === 1 ? "" : "s"} worth another look.`
            : "Nothing to review right now — nice."}
        </Text>
      </View>

      <FlatList
        data={mistakes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/mistakes/review?id=${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.subcategory}>{nameById.get(item.subcategory_id) ?? "Topic"}</Text>
              <View style={[styles.difficultyDot, { backgroundColor: difficultyColor(item.difficulty) }]} />
            </View>
            <Text style={styles.stem} numberOfLines={2}>
              {item.stem}
            </Text>
            <Text style={styles.meta}>
              Missed {item.attempts > 1 ? `${item.attempts} times` : "once"}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            As you answer questions, anything you get wrong will show up here so you can circle back.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { padding: 24, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textMuted },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  subcategory: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  difficultyDot: { width: 8, height: 8, borderRadius: 4 },
  stem: { color: colors.text, fontSize: 14, lineHeight: 19, marginBottom: 8 },
  meta: { color: colors.textMuted, fontSize: 11 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 40 },
});
