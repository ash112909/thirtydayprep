import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { generateBaseline, submitBaseline } from "@/api/studyFunctions";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme";
import type { BaselineQuestion } from "@/types/domain";

interface Answer {
  question_id: string;
  selected_choice: string;
  time_spent_seconds: number;
}

export default function BaselineTest() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [baselineTestId, setBaselineTestId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answerValue, setAnswerValue] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    generateBaseline()
      .then((res) => {
        setBaselineTestId(res.baseline_test_id);
        setQuestions(res.questions);
        questionStartedAt.current = Date.now();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load baseline test"))
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
      </View>
    );
  }

  const question = questions[index];
  if (!question) return null;

  const canSubmit = answerValue.trim().length > 0;

  async function handleNext() {
    if (!canSubmit) return;
    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000));
    const nextAnswers = [
      ...answers,
      { question_id: question.id!, selected_choice: answerValue, time_spent_seconds: timeSpent },
    ];
    setAnswers(nextAnswers);
    setAnswerValue("");

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      questionStartedAt.current = Date.now();
      return;
    }

    if (!baselineTestId) return;
    setSubmitting(true);
    try {
      const result = await submitBaseline(baselineTestId, nextAnswers);
      await refreshProfile();
      router.replace({
        pathname: "/baseline/results",
        params: { mastery: JSON.stringify(result.mastery), totalDays: String(result.total_days) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit baseline test");
      setSubmitting(false);
    }
  }

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
          underlineStart={question.passage_underline_start}
          underlineEnd={question.passage_underline_end}
          stem={question.stem}
          value={answerValue}
          onChange={setAnswerValue}
        />
      ) : (
        <QuestionCard
          passage={question.passage}
          underlineStart={question.passage_underline_start}
          underlineEnd={question.passage_underline_end}
          stem={question.stem}
          choices={question.choices ?? []}
          selected={answerValue || null}
          onSelect={setAnswerValue}
        />
      )}

      <PrimaryButton
        title={index + 1 === questions.length ? "Finish baseline test" : "Next question"}
        onPress={handleNext}
        disabled={!canSubmit}
        loading={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, padding: 24, textAlign: "center" },
  progressRow: { marginBottom: 20 },
  progressText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: colors.primary },
});
