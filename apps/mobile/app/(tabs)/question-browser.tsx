import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  fetchAllCategories,
  fetchAllSubcategories,
  fetchQuestionDetail,
  fetchQuestionIndex,
  type QuestionBrowserDetail,
  type QuestionIndexEntry,
} from "@/api/questionBrowser";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { fonts } from "@/theme";
import type { Category, Subcategory } from "@/types/domain";

// Temporary QA screen: pages through every question in the bank, one at a
// time, rendered with the exact same components the real quiz uses — so
// content/formatting issues show up exactly as a student would see them,
// not as raw rows in the Supabase table editor. Not linked from the tab
// bar; reached only via the "Question bank (QA)" button on Profile. Meant
// to be removed once the manual review pass is done.
export default function QuestionBrowserScreen() {
  const router = useRouter();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: 24, paddingTop: 60 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    title: { fontSize: 20, fontFamily: fonts.display, color: colors.text },
    position: { color: colors.textMuted, fontSize: 13 },
    closeText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
    metaStrip: { marginBottom: 10 },
    metaId: { color: colors.text, fontSize: 12, fontWeight: "700" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    metaText: { color: colors.textMuted, fontSize: 11 },
    questionArea: { flex: 1 },
    navRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    navButton: { flex: 1 },
    jumpRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
    jumpInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: colors.text,
      fontSize: 14,
    },
    jumpButton: { paddingHorizontal: 18 },
    errorText: { color: colors.danger, fontSize: 13, marginTop: 8 },
    loadingText: { color: colors.textMuted, fontSize: 13 },
    modalBackdrop: { flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" },
    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      maxHeight: "70%",
    },
    modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    modalTitle: { fontSize: 16, fontFamily: fonts.displaySemibold, color: colors.text },
    modalClose: { color: colors.primary, fontSize: 14, fontWeight: "600" },
    modalText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  }));

  const [indexList, setIndexList] = useState<QuestionIndexEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [position, setPosition] = useState(0);
  const [current, setCurrent] = useState<QuestionBrowserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [jumpText, setJumpText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchQuestionIndex(), fetchAllCategories(), fetchAllSubcategories()])
      .then(([entries, cats, subs]) => {
        if (cancelled) return;
        setIndexList(entries);
        setCategories(cats);
        setSubcategories(subs);
      })
      .catch((e) => {
        if (cancelled) return;
        setIndexError(e instanceof Error ? e.message : "Failed to load the question bank.");
      })
      .finally(() => {
        if (!cancelled) setLoadingIndex(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentId = indexList[position]?.id ?? null;

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    fetchQuestionDetail(currentId)
      .then((detail) => {
        if (!cancelled) setCurrent(detail);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : "Failed to load this question.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories]);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(indexList.length - 1, next));
    setPosition(clamped);
    setSearchError(null);
    setShowExplanation(false);
  }

  function handleJump() {
    const n = parseInt(jumpText, 10);
    if (!n || n < 1 || n > indexList.length) return;
    goTo(n - 1);
    setJumpText("");
  }

  function handleSearch() {
    const query = searchText.trim().toLowerCase();
    if (!query) return;
    const len = indexList.length;
    for (let offset = 1; offset <= len; offset++) {
      const idx = (position + offset) % len;
      if (indexList[idx].external_id?.toLowerCase().includes(query)) {
        goTo(idx);
        return;
      }
    }
    setSearchError(`No question with an ID containing "${searchText}"`);
  }

  if (loadingIndex) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading question bank index…</Text>
      </View>
    );
  }

  if (indexError || !indexList.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{indexError ?? "The question bank is empty."}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const category = current ? categoryById.get(current.category_id) : null;
  const subcategory = current ? subcategoryById.get(current.subcategory_id) : null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Question Browser</Text>
            <Text style={styles.position}>
              {position + 1} / {indexList.length}
            </Text>
          </View>
          <Text style={styles.closeText} onPress={() => router.back()}>
            Close
          </Text>
        </View>

        {current && (
          <View style={styles.metaStrip}>
            <Text style={styles.metaId}>{current.external_id}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {category?.name ?? "—"} › {subcategory?.name ?? "—"}
              </Text>
              <Text style={styles.metaText}>· {current.skill_tag ?? "no skill tag"}</Text>
              <Text style={styles.metaText}>· {current.difficulty}</Text>
              <Text style={styles.metaText}>· {current.question_type}</Text>
              <Text style={styles.metaText}>· {current.avg_seconds}s</Text>
              {current.calculator_allowed != null && (
                <Text style={styles.metaText}>· calc {current.calculator_allowed ? "allowed" : "not allowed"}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.questionArea}>
          {loadingDetail || !current ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : detailError ? (
            <Text style={styles.errorText}>{detailError}</Text>
          ) : current.question_type === "grid_in" ? (
            <GridInAnswer
              passage={current.passage}
              underlineStart={current.passage_underline_start}
              underlineEnd={current.passage_underline_end}
              stem={current.stem}
              value={current.correct_value ?? ""}
              correctAnswer={current.correct_value}
              onChange={() => {}}
              disabled
            />
          ) : (
            <QuestionCard
              passage={current.passage}
              underlineStart={current.passage_underline_start}
              underlineEnd={current.passage_underline_end}
              stem={current.stem}
              choices={current.choices ?? []}
              selected={current.correct_choice}
              correctChoice={current.correct_choice}
              onSelect={() => {}}
              disabled
            />
          )}
        </View>

        <View style={styles.navRow}>
          <View style={styles.navButton}>
            <PrimaryButton title="◀ Prev" variant="secondary" onPress={() => goTo(position - 1)} disabled={position === 0} />
          </View>
          <View style={styles.navButton}>
            <PrimaryButton
              title="Explanation"
              variant="secondary"
              onPress={() => setShowExplanation(true)}
              disabled={!current}
            />
          </View>
          <View style={styles.navButton}>
            <PrimaryButton
              title="Next ▶"
              onPress={() => goTo(position + 1)}
              disabled={position === indexList.length - 1}
            />
          </View>
        </View>

        <View style={styles.jumpRow}>
          <TextInput
            style={styles.jumpInput}
            placeholder={`Go to # (1–${indexList.length})`}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={jumpText}
            onChangeText={setJumpText}
            onSubmitEditing={handleJump}
          />
          <View style={styles.jumpButton}>
            <PrimaryButton title="Go" variant="secondary" onPress={handleJump} />
          </View>
        </View>

        <View style={styles.jumpRow}>
          <TextInput
            style={styles.jumpInput}
            placeholder="Search by question ID"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={searchText}
            onChangeText={(t) => {
              setSearchText(t);
              setSearchError(null);
            }}
            onSubmitEditing={handleSearch}
          />
          <View style={styles.jumpButton}>
            <PrimaryButton title="Find" variant="secondary" onPress={handleSearch} />
          </View>
        </View>
        {searchError && <Text style={styles.errorText}>{searchError}</Text>}
      </View>

      <Modal visible={showExplanation} transparent animationType="slide" onRequestClose={() => setShowExplanation(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowExplanation(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Explanation</Text>
              <Text style={styles.modalClose} onPress={() => setShowExplanation(false)}>
                Close
              </Text>
            </View>
            <ScrollView>
              <Text style={styles.modalText}>{current?.explanation ?? "No explanation available for this question."}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
