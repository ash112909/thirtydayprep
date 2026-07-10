import { supabase } from "@/lib/supabase";
import type {
  GenerateBaselineResponse,
  SubmitAttemptResponse,
  SubmitBaselineResponse,
  TodaySessionResponse,
} from "@/types/domain";

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function generateBaseline() {
  return invoke<GenerateBaselineResponse>("generate-baseline");
}

export function submitBaseline(
  baselineTestId: string,
  answers: { question_id: string; selected_choice: string; time_spent_seconds: number }[],
) {
  return invoke<SubmitBaselineResponse>("submit-baseline", {
    baseline_test_id: baselineTestId,
    answers,
  });
}

export function getTodaySession() {
  return invoke<TodaySessionResponse>("get-today-session");
}

export function submitAttempt(
  studyPlanDayQuestionId: string,
  selectedChoice: string,
  timeSpentSeconds: number,
) {
  return invoke<SubmitAttemptResponse>("submit-attempt", {
    study_plan_day_question_id: studyPlanDayQuestionId,
    selected_choice: selectedChoice,
    time_spent_seconds: timeSpentSeconds,
  });
}
