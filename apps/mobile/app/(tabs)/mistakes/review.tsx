import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchQuestionById, type QuestionDetail } from "@/api/mistakes";
import { fetchCategories } from "@/api/progress";
import { submitReviewAttempt } from "@/api/studyFunctions";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GraphingCalculatorButton } from "@/components/GraphingCalculator";
import { findMathCategoryId } from "@/lib/mathCategory";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { useThemedStyles } from "@/hooks/useThemedStyles";

export default function ReviewQuestion() {
  const router = useRouter();
  const { refresh: refreshPetCompanion } = usePetCompanion();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    header: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
    correctBanner: { color: colors.success, fontSize: 14, fontWeight: "600", marginTop: 12 },
    wrongBanner: { color: colors.danger, fontSize: 14, fontWeight: "600", marginTop: 12 },
    explanation: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 10,
      marginBottom: 8,
      backgroundColor: colors.surfaceAlt,
      padding: 12,
      borderRadius: 10,
    },
  }));
  const { id } = useLocalSearchParams<{ id: string }>();
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerValue, setAnswerValue] = useState("");
  const [revealed, setRevealed] = useState<
    { correctAnswer: string; explanation: string | null; isCorrect: boolean; pointsAwarded: number } | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mathCategoryId, setMathCategoryId] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchQuestionById(id), fetchCategories()])
      .then(([q, categories]) => {
        setQuestion(q);
        setMathCategoryId(findMathCategoryId(categories));
        startedAt.current = Date.now();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load question"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Couldn't find that question."}</Text>
        <PrimaryButton title="Back to Mistake Bank" onPress={() => router.back()} />
      </View>
    );
  }

  const canSubmit = answerValue.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || !question) return;
    const timeSpent = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    setSubmitting(true);
    try {
      const result = await submitReviewAttempt(question.id, answerValue, timeSpent);
      setRevealed({
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        isCorrect: result.is_correct,
        pointsAwarded: result.points_awarded ?? 0,
      });
      if (result.points_awarded) refreshPetCompanion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = !!revealed;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Review</Text>
        {question.category_id === mathCategoryId && <GraphingCalculatorButton />}
      </View>

      {question.question_type === "grid_in" ? (
        <GridInAnswer
          passage={question.passage}
          underlineStart={question.passage_underline_start}
          underlineEnd={question.passage_underline_end}
          stem={question.stem}
          value={answerValue}
          correctAnswer={revealed?.correctAnswer ?? null}
          onChange={setAnswerValue}
          disabled={disabled}
        />
      ) : (
        <QuestionCard
          passage={question.passage}
          underlineStart={question.passage_underline_start}
          underlineEnd={question.passage_underline_end}
          stem={question.stem}
          choices={question.choices ?? []}
          selected={answerValue || null}
          correctChoice={revealed?.correctAnswer ?? null}
          onSelect={setAnswerValue}
          disabled={disabled}
        />
      )}

      {revealed && (
        <Text style={revealed.isCorrect ? styles.correctBanner : styles.wrongBanner}>
          {revealed.isCorrect ? "Got it! That one's off the list." : "Not quite — it'll stay in your Mistake Bank."}
          {revealed.pointsAwarded > 0 ? `  +${revealed.pointsAwarded} ⭐` : ""}
        </Text>
      )}
      {revealed?.explanation && <Text style={styles.explanation}>{revealed.explanation}</Text>}

      {revealed ? (
        <PrimaryButton title="Back to Mistake Bank" onPress={() => router.back()} />
      ) : (
        <PrimaryButton title="Submit answer" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
      )}
    </View>
  );
}
