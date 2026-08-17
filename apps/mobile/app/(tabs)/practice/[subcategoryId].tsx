import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchPracticeQuestions } from "@/api/practice";
import { fetchCategories } from "@/api/progress";
import { submitReviewAttempt } from "@/api/studyFunctions";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StudyPet } from "@/components/StudyPet";
import { GraphingCalculatorButton } from "@/components/GraphingCalculator";
import { QuestionTimer } from "@/components/QuestionTimer";
import { findMathCategoryId } from "@/lib/mathCategory";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { pickTutorLine } from "@/lib/tutorVoice";
import { TutorBubble } from "@/components/TutorBubble";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { QuestionDetail } from "@/api/mistakes";

interface Revealed {
  correctAnswer: string;
  explanation: string | null;
  isCorrect: boolean;
  tutorLine: string;
  pointsAwarded: number;
}

export default function PracticeByTopic() {
  const router = useRouter();
  const { subcategoryId, name } = useLocalSearchParams<{ subcategoryId: string; name?: string }>();
  const { pet, celebrate, refresh: refreshPetCompanion } = usePetCompanion();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
    doneAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    doneTitle: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center" },
    doneBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 8 },
    progressRow: { marginBottom: 20 },
    progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    progressHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressText: { color: colors.textMuted, fontSize: 13 },
    topicTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
    progressBarFill: { height: 6, backgroundColor: colors.primary },
  }));

  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [answerValue, setAnswerValue] = useState("");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mathCategoryId, setMathCategoryId] = useState<string | null>(null);
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    if (!subcategoryId) return;
    Promise.all([fetchPracticeQuestions(subcategoryId), fetchCategories()])
      .then(([qs, categories]) => {
        setQuestions(qs);
        setMathCategoryId(findMathCategoryId(categories));
        questionStartedAt.current = Date.now();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load practice questions"))
      .finally(() => setLoading(false));
  }, [subcategoryId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!questions.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>No questions yet</Text>
        <Text style={styles.doneBody}>There's nothing in this topic's question bank yet — check back later.</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const question = questions[index];

  if (!question) {
    return (
      <View style={styles.center}>
        {pet && (
          <View style={styles.doneAvatar}>
            <StudyPet species={pet.species} energy="energetic" growthStage="grown" size={70} />
          </View>
        )}
        <Text style={styles.doneTitle}>Practice complete!</Text>
        <Text style={styles.doneBody}>
          {correctCount}/{questions.length} correct{pointsEarned > 0 ? `  •  +${pointsEarned} ⭐` : ""}
        </Text>
        <PrimaryButton title="Back to Progress" onPress={() => router.replace("/(tabs)/progress")} />
      </View>
    );
  }

  const canSubmit = answerValue.trim().length > 0;

  async function handleSubmitAnswer() {
    if (!canSubmit || !question) return;
    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000));
    setSubmitting(true);
    try {
      const result = await submitReviewAttempt(question.id, answerValue, timeSpent, "practice");
      setRevealed({
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        isCorrect: result.is_correct,
        tutorLine: pickTutorLine(result.is_correct),
        pointsAwarded: result.points_awarded ?? 0,
      });
      if (result.is_correct) setCorrectCount((c) => c + 1);
      if (result.points_awarded) {
        setPointsEarned((p) => p + (result.points_awarded ?? 0));
        refreshPetCompanion();
      }
      celebrate("petting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setAnswerValue("");
    setRevealed(null);
    setIndex((i) => i + 1);
    questionStartedAt.current = Date.now();
  }

  const disabled = !!revealed;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={styles.progressHeader}>
          <View>
            {!!name && <Text style={styles.topicTitle}>{name}</Text>}
            <Text style={styles.progressText}>
              Question {index + 1} of {questions.length}
            </Text>
          </View>
          <View style={styles.progressHeaderRight}>
            <QuestionTimer benchmarkSeconds={question.avg_seconds} running={!disabled} resetKey={question.id} />
            {question.category_id === mathCategoryId && <GraphingCalculatorButton />}
          </View>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
        </View>
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
        <TutorBubble
          species={pet?.species ?? "cat"}
          isCorrect={revealed.isCorrect}
          line={revealed.tutorLine}
          explanation={revealed.explanation}
          pointsAwarded={revealed.pointsAwarded}
        />
      )}

      {revealed ? (
        <PrimaryButton title={index + 1 === questions.length ? "Finish" : "Next question"} onPress={handleNext} />
      ) : (
        <PrimaryButton title="Submit answer" onPress={handleSubmitAnswer} disabled={!canSubmit} loading={submitting} />
      )}
    </View>
  );
}
