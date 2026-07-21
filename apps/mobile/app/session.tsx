import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getTodaySession, submitAttempt } from "@/api/studyFunctions";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { SessionQuestion } from "@/types/domain";

export default function Session() {
  const router = useRouter();
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [answerValue, setAnswerValue] = useState("");
  const [revealed, setRevealed] = useState<{ correctAnswer: string; explanation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayCompleted, setDayCompleted] = useState(false);
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    getTodaySession()
      .then((res) => {
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

  if (!question || dayCompleted) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>Nice work! 🎉</Text>
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
      setRevealed({ correctAnswer: result.correct_answer, explanation: result.explanation });
      if (result.day_completed) setDayCompleted(true);
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

  const disabled = !!revealed || alreadyAnswered;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Question {index + 1} of {questions.length}
        </Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
        </View>
      </View>

      {question.question_type === "grid_in" ? (
        <GridInAnswer
          passage={question.passage}
          stem={question.stem}
          value={answerValue}
          correctAnswer={revealed?.correctAnswer ?? null}
          onChange={setAnswerValue}
          disabled={disabled}
        />
      ) : (
        <QuestionCard
          passage={question.passage}
          stem={question.stem}
          choices={question.choices ?? []}
          selected={answerValue || null}
          correctChoice={revealed?.correctAnswer ?? null}
          onSelect={setAnswerValue}
          disabled={disabled}
        />
      )}

      {revealed?.explanation && <Text style={styles.explanation}>{revealed.explanation}</Text>}

      {revealed ? (
        <PrimaryButton title={index + 1 === questions.length ? "Finish" : "Next question"} onPress={handleNext} />
      ) : (
        <PrimaryButton title="Submit answer" onPress={handleSubmitAnswer} disabled={!canSubmit} loading={submitting} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
  doneTitle: { fontSize: 26, fontWeight: "800", color: colors.text },
  doneBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 8 },
  progressRow: { marginBottom: 20 },
  progressText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: colors.primary },
  explanation: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    borderRadius: 10,
  },
});
