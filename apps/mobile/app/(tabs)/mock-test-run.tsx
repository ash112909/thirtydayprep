import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { generateMockTest, submitMockTest } from "@/api/studyFunctions";
import { fetchCategories } from "@/api/progress";
import { QuestionCard } from "@/components/QuestionCard";
import { GridInAnswer } from "@/components/GridInAnswer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GraphingCalculatorButton } from "@/components/GraphingCalculator";
import { SectionTimer } from "@/components/SectionTimer";
import { findMathCategoryId } from "@/lib/mathCategory";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { fonts } from "@/theme";
import type { MockTestQuestion } from "@/types/domain";

interface Answer {
  question_id: string;
  selected_choice: string;
  time_spent_seconds: number;
}

interface Section {
  categorySlug: string;
  timeLimitMinutes: number;
  questions: MockTestQuestion[];
}

const SECTION_LABELS: Record<string, string> = {
  "reading-writing": "Reading & Writing",
  math: "Math",
};

// Matches the real digital SAT's break between Reading & Writing and Math.
const BREAK_SECONDS = 10 * 60;

type Phase = "loading" | "section" | "break" | "submitting" | "error";

export default function MockTestRun() {
  const router = useRouter();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
    progressRow: { marginBottom: 20 },
    sectionLabel: { fontSize: 12, fontFamily: fonts.bodySemibold, color: colors.primary, marginBottom: 8 },
    progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    progressHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressText: { color: colors.textMuted, fontSize: 13 },
    progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" },
    progressBarFill: { height: 6, backgroundColor: colors.primary },
    transitionTitle: { fontSize: 24, fontFamily: fonts.display, color: colors.text, marginBottom: 12, textAlign: "center" },
    transitionBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 8, lineHeight: 20 },
    breakTimerWrap: { marginBottom: 24 },
    loadingText: { color: colors.textMuted, fontSize: 13 },
  }));

  const [sections, setSections] = useState<Section[]>([]);
  const [mockTestId, setMockTestId] = useState<string | null>(null);
  const [mathCategoryId, setMathCategoryId] = useState<string | null>(null);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answerValue, setAnswerValue] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    Promise.all([generateMockTest(), fetchCategories()])
      .then(([res, categories]) => {
        setMockTestId(res.mock_test_id);
        setMathCategoryId(findMathCategoryId(categories));
        const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
        const built: Section[] = res.sections.map((s) => ({
          categorySlug: s.category_slug,
          timeLimitMinutes: s.time_limit_minutes,
          questions: res.questions.filter((q) => q.category_id === categoryIdBySlug.get(s.category_slug)),
        }));
        setSections(built);
        setPhase("section");
        questionStartedAt.current = Date.now();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load mock test");
        setPhase("error");
      });
  }, []);

  async function submitFinal(finalAnswers: Answer[]) {
    if (!mockTestId) return;
    setPhase("submitting");
    try {
      const result = await submitMockTest(mockTestId, finalAnswers);
      router.replace({
        pathname: "/mock-test-results",
        params: {
          rw: result.rw_scaled != null ? String(result.rw_scaled) : "",
          math: result.math_scaled != null ? String(result.math_scaled) : "",
          total: result.total_scaled != null ? String(result.total_scaled) : "",
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit mock test");
      setPhase("error");
    }
  }

  function finishSection(finalAnswers: Answer[]) {
    setAnswers(finalAnswers);
    if (sectionIdx + 1 >= sections.length) {
      void submitFinal(finalAnswers);
    } else {
      setPhase("break");
    }
  }

  function startNextSection() {
    setSectionIdx((i) => i + 1);
    setQuestionIdx(0);
    setAnswerValue("");
    setPhase("section");
    questionStartedAt.current = Date.now();
  }

  function handleNext() {
    const currentSection = sections[sectionIdx];
    const question = currentSection?.questions[questionIdx];
    if (!question || !answerValue.trim()) return;
    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000));
    const nextAnswers: Answer[] = [
      ...answers,
      { question_id: question.id!, selected_choice: answerValue, time_spent_seconds: timeSpent },
    ];
    setAnswerValue("");

    if (questionIdx + 1 < currentSection.questions.length) {
      setAnswers(nextAnswers);
      setQuestionIdx((i) => i + 1);
      questionStartedAt.current = Date.now();
      return;
    }
    finishSection(nextAnswers);
  }

  function handleSectionExpire() {
    finishSection(answers);
  }

  function handleBreakExpire() {
    startNextSection();
  }

  if (phase === "loading" || !sections.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (phase === "submitting") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Grading your mock test…</Text>
      </View>
    );
  }

  if (phase === "break") {
    const finishedSection = sections[sectionIdx];
    const nextSection = sections[sectionIdx + 1];
    return (
      <View style={styles.center}>
        <Text style={styles.transitionTitle}>
          {SECTION_LABELS[finishedSection?.categorySlug ?? ""] ?? "Section"} complete
        </Text>
        <Text style={styles.transitionBody}>
          Next up: {SECTION_LABELS[nextSection?.categorySlug ?? ""] ?? "the next section"} —{" "}
          {nextSection?.questions.length} questions, {nextSection?.timeLimitMinutes} minutes.
        </Text>
        <Text style={styles.transitionBody}>Take your break. It'll move on automatically when time's up.</Text>
        <View style={styles.breakTimerWrap}>
          <SectionTimer
            totalSeconds={BREAK_SECONDS}
            running={phase === "break"}
            resetKey={`break-${sectionIdx}`}
            onExpire={handleBreakExpire}
          />
        </View>
        <PrimaryButton
          title={`Skip break, start ${SECTION_LABELS[nextSection?.categorySlug ?? ""] ?? "next section"}`}
          onPress={startNextSection}
        />
      </View>
    );
  }

  const currentSection = sections[sectionIdx];
  const question = currentSection.questions[questionIdx];
  if (!question) return null;
  const canSubmit = answerValue.trim().length > 0;
  const isLastQuestionOverall = sectionIdx + 1 === sections.length && questionIdx + 1 === currentSection.questions.length;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.sectionLabel}>{SECTION_LABELS[currentSection.categorySlug] ?? currentSection.categorySlug}</Text>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            Question {questionIdx + 1} of {currentSection.questions.length}
          </Text>
          <View style={styles.progressHeaderRight}>
            <SectionTimer
              totalSeconds={currentSection.timeLimitMinutes * 60}
              running={phase === "section"}
              resetKey={sectionIdx}
              onExpire={handleSectionExpire}
            />
            {question.category_id === mathCategoryId && <GraphingCalculatorButton />}
          </View>
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((questionIdx + 1) / currentSection.questions.length) * 100}%` },
            ]}
          />
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
        title={isLastQuestionOverall ? "Finish mock test" : questionIdx + 1 === currentSection.questions.length ? "Finish section" : "Next question"}
        onPress={handleNext}
        disabled={!canSubmit}
      />
    </View>
  );
}
