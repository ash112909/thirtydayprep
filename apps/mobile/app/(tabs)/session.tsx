import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getTodaySession, submitAttempt } from "@/api/studyFunctions";
import { fetchCategories } from "@/api/progress";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StudyPet } from "@/components/StudyPet";
import { GraphingCalculatorButton } from "@/components/GraphingCalculator";
import { findMathCategoryId } from "@/lib/mathCategory";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { pickSessionCompleteLine, pickTutorLine } from "@/lib/tutorVoice";
import { TutorBubble } from "@/components/TutorBubble";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { SessionQuestion } from "@/types/domain";

interface Revealed {
  correctAnswer: string;
  explanation: string | null;
  isCorrect: boolean;
  tutorLine: string;
  pointsAwarded: number;
}

export default function Session() {
  const router = useRouter();
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
    progressText: { color: colors.textMuted, fontSize: 13 },
    progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
    progressBarFill: { height: 6, backgroundColor: colors.primary },
  }));
  const { pet, celebrate, refresh: refreshPetCompanion } = usePetCompanion();
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [answerValue, setAnswerValue] = useState("");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [sessionCompleteLine] = useState(pickSessionCompleteLine);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDayId, setCompletedDayId] = useState<string | null>(null);
  const [mathCategoryId, setMathCategoryId] = useState<string | null>(null);
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    Promise.all([getTodaySession(), fetchCategories()])
      .then(([res, categories]) => {
        setMathCategoryId(findMathCategoryId(categories));
        if (!res.questions) {
          setError(res.message ?? "No session available right now.");
          return;
        }
        setDayNumber(res.day_number ?? null);
        const firstUnanswered = res.questions.findIndex((q) => !q.answered);
        setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
        setQuestions(res.questions);
        questionStartedAt.current = Date.now();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load session"))
      .finally(() => setLoading(false));
  }, []);

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
        <PrimaryButton title="Back to today" onPress={() => router.back()} />
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
        <Text style={styles.doneTitle}>{sessionCompleteLine}</Text>
        <Text style={styles.doneBody}>
          {dayNumber ? `Day ${dayNumber} complete.` : "Session complete."} Come back tomorrow for your next
          session.
        </Text>
        <PrimaryButton title="Back to today" onPress={() => router.replace("/(tabs)/home")} />
      </View>
    );
  }

  const alreadyAnswered = question.answered ?? false;
  const canSubmit = answerValue.trim().length > 0;

  async function handleSubmitAnswer() {
    if (!canSubmit || !question.study_plan_day_question_id) return;
    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000));
    setSubmitting(true);
    try {
      const result = await submitAttempt(question.study_plan_day_question_id, answerValue, timeSpent);
      setRevealed({
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        isCorrect: result.is_correct,
        tutorLine: pickTutorLine(result.is_correct),
        pointsAwarded: result.points_awarded ?? 0,
      });
      if (result.day_completed && result.study_plan_day_id) {
        setCompletedDayId(result.study_plan_day_id);
        // A bigger reaction for finishing the day (a bonus was just awarded
        // server-side on top of the per-question points), vs. a small
        // supportive one for just answering — the pet reacts the same way
        // whether the answer was right or wrong, since its role here is to
        // walk through it with you, not to grade you.
        celebrate("playing");
      } else {
        celebrate("petting");
      }
      // Points changed (a correct answer and/or a completed day both award
      // them), so the floating badge and Buddy screen shouldn't go stale.
      if (result.points_awarded) refreshPetCompanion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (completedDayId) {
      router.replace(`/session-recap/${completedDayId}`);
      return;
    }
    setAnswerValue("");
    setRevealed(null);
    setIndex((i) => i + 1);
    questionStartedAt.current = Date.now();
  }

  const disabled = !!revealed || alreadyAnswered;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            Question {index + 1} of {questions.length}
          </Text>
          {question.category_id === mathCategoryId && <GraphingCalculatorButton />}
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
