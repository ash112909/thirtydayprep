import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchCategories, fetchPlanDayResults, fetchPlanDays, fetchSubcategories } from "@/api/progress";
import { DayTile } from "@/components/DayTile";
import { PlanCalendar } from "@/components/PlanCalendar";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { ColorTokens } from "@/theme";
import type { DayResult } from "@/api/progress";
import type { Category, StudyPlan, StudyPlanDay, Subcategory } from "@/types/domain";

type ViewMode = "grid" | "calendar";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function segmentColor(categorySlug: string, colors: ColorTokens) {
  return categorySlug === "math" ? { backgroundColor: colors.primary } : { backgroundColor: colors.success };
}

export default function Plan() {
  const router = useRouter();
  const { session } = useAuth();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
    header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 },
    subtitle: { fontSize: 13, color: colors.textMuted },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
    rollupCard: {
      marginHorizontal: 20,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rollupTitle: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 10 },
    rollupBar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10 },
    rollupSegment: { height: 8 },
    rollupLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    rollupLegendText: { color: colors.textMuted, fontSize: 11 },
    toggleRow: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginBottom: 16 },
    toggle: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    toggleText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    toggleTextActive: { color: colors.primary },
    grid: { paddingHorizontal: 16, paddingBottom: 24 },
    calendarContent: { paddingBottom: 24 },
    cell: { flex: 1, padding: 8 },
  }));
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [dayResults, setDayResults] = useState<Map<string, DayResult>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const [activePlan, cats, subs] = await Promise.all([
          fetchActivePlan(session.user.id),
          fetchCategories(),
          fetchSubcategories(),
        ]);
        if (cancelled) return;
        setPlan(activePlan);
        setCategories(cats);
        setSubcategories(subs);
        if (activePlan) {
          const planDays = await fetchPlanDays(activePlan.id);
          if (cancelled) return;
          setDays(planDays);
          const completedIds = planDays.filter((d) => d.status === "completed").map((d) => d.id);
          setDayResults(await fetchPlanDayResults(completedIds));
        } else {
          setDays([]);
        }
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

  const completedCount = days.filter((d) => d.status === "completed").length;
  const subcategoryById = new Map(subcategories.map((s) => [s.id, s]));
  const categoryTotals = new Map<string, number>();
  let totalQuestions = 0;
  for (const day of days) {
    for (const t of day.targets) {
      const sub = subcategoryById.get(t.subcategory_id);
      if (!sub) continue;
      categoryTotals.set(sub.category_id, (categoryTotals.get(sub.category_id) ?? 0) + t.count);
      totalQuestions += t.count;
    }
  }

  const goToDay = (day: StudyPlanDay) => router.push(`/plan-day/${day.id}`);

  const header = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Your study plan</Text>
        <Text style={styles.subtitle}>
          {completedCount}/{plan.total_days} days done · ends {formatDate(plan.end_date)}
        </Text>
        <Text style={styles.hint}>Tap a day to see what's on it and why.</Text>
      </View>

      {totalQuestions > 0 && (
        <View style={styles.rollupCard}>
          <Text style={styles.rollupTitle}>Whole-plan breakdown</Text>
          <View style={styles.rollupBar}>
            {categories.map((cat) => {
              const count = categoryTotals.get(cat.id) ?? 0;
              const pct = totalQuestions ? (count / totalQuestions) * 100 : 0;
              return <View key={cat.id} style={[styles.rollupSegment, { flex: pct || 0.001 }, segmentColor(cat.slug, colors)]} />;
            })}
          </View>
          <View style={styles.rollupLegend}>
            {categories.map((cat) => {
              const count = categoryTotals.get(cat.id) ?? 0;
              const pct = totalQuestions ? Math.round((count / totalQuestions) * 100) : 0;
              return (
                <Text key={cat.id} style={styles.rollupLegendText}>
                  {cat.name}: {count} ({pct}%)
                </Text>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, viewMode === "grid" && styles.toggleActive]} onPress={() => setViewMode("grid")}>
          <Text style={[styles.toggleText, viewMode === "grid" && styles.toggleTextActive]}>Grid</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, viewMode === "calendar" && styles.toggleActive]}
          onPress={() => setViewMode("calendar")}
        >
          <Text style={[styles.toggleText, viewMode === "calendar" && styles.toggleTextActive]}>Calendar</Text>
        </Pressable>
      </View>
    </>
  );

  if (viewMode === "calendar") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.calendarContent}>
        {header}
        <PlanCalendar days={days} onDayPress={goToDay} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={days}
        keyExtractor={(d) => d.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const result = dayResults.get(item.id);
          const accuracy = result && result.total > 0 ? Math.round((result.correct / result.total) * 100) : null;
          return (
            <View style={styles.cell}>
              <DayTile day={item} accuracy={accuracy} onPress={() => goToDay(item)} />
            </View>
          );
        }}
      />
    </View>
  );
}
