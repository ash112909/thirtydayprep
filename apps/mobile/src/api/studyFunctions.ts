import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  GenerateBaselineResponse,
  SubmitAttemptResponse,
  SubmitBaselineResponse,
  TodaySessionResponse,
} from "@/types/domain";

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  // supabase-js's functions client does not reliably auto-attach the
  // signed-in user's JWT, so it's passed explicitly on every call — without
  // it, edge functions that call getUserIdOrThrow() reject the request at
  // the gateway before the function code (and its logs) ever run.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) {
    // The generic error.message ("Edge Function returned a non-2xx status
    // code") hides the actual reason; the real message is in the response
    // body our functions return via errorResponse().
    if (error instanceof FunctionsHttpError) {
      let message = `${error.context.status}: ${error.message}`;
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        // response body wasn't JSON; keep the generic fallback above
      }
      throw new Error(message);
    }
    throw new Error(error.message);
  }
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

export function submitReviewAttempt(questionId: string, selectedChoice: string, timeSpentSeconds: number) {
  return invoke<SubmitAttemptResponse>("submit-review-attempt", {
    question_id: questionId,
    selected_choice: selectedChoice,
    time_spent_seconds: timeSpentSeconds,
  });
}

export function skipDay(studyPlanDayId: string) {
  return invoke<{ skipped: boolean }>("skip-day", { study_plan_day_id: studyPlanDayId });
}
