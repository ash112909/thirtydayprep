// POST /submit-mock-test
// body: { mock_test_id, answers: [{ question_id, selected_choice, time_spent_seconds }] }
//
// Grades a completed (or time-expired) mock exam into two 200-800 section
// scores plus a combined total, using the same difficulty-weighted approach
// as the baseline diagnostic. A question the clock ran out on is scored as
// missed but is NOT recorded as a real attempt (no question_attempts row, no
// mastery update) — the student didn't actually answer it, so it shouldn't
// look like they did.
//
// Every question they did answer feeds back into question_attempts and
// user_skill_stats exactly like a Mistake Bank retry or practice session, so
// a mock test's results move the adaptive plan too, not just the score.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { recordMasteryUpdate } from "../_shared/mastery.ts";
import { scoreMockTestSection } from "../_shared/mockTestEngine.ts";
import { isCorrectAnswer, type Difficulty } from "../_shared/types.ts";

interface AnswerInput {
  question_id: string;
  selected_choice: string;
  time_spent_seconds: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdOrThrow(req);
    const supabase = userClient(req);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const mockTestId: string = body.mock_test_id;
    const answers: AnswerInput[] = body.answers ?? [];
    if (!mockTestId) return errorResponse("Missing mock_test_id");

    const { data: mtQuestions, error: mtqErr } = await admin
      .from("mock_test_questions")
      .select("id, question_id")
      .eq("mock_test_id", mockTestId);
    if (mtqErr) throw mtqErr;
    if (!mtQuestions?.length) return errorResponse("Mock test not found", 404);

    const { data: questionRows, error: qErr } = await admin
      .from("questions")
      .select("id, category_id, subcategory_id, difficulty, question_type, correct_choice, correct_value")
      .in(
        "id",
        mtQuestions.map((q) => q.question_id),
      );
    if (qErr) throw qErr;
    const questionById = new Map(questionRows!.map((q) => [q.id, q]));
    const answerByQuestionId = new Map(answers.map((a) => [a.question_id, a]));

    const { data: categories, error: catErr } = await admin.from("categories").select("id, slug");
    if (catErr) throw catErr;
    const rwCategoryId = categories?.find((c) => c.slug === "reading-writing")?.id;
    const mathCategoryId = categories?.find((c) => c.slug === "math")?.id;

    const scoredBySection = new Map<string, { difficulty: Difficulty; is_correct: boolean }[]>();
    const mtqUpdates: { id: string; selected_choice: string; is_correct: boolean; time_spent_seconds: number }[] = [];
    const attemptRows: Record<string, unknown>[] = [];
    const masteryUpdates: { subcategory_id: string; is_correct: boolean; difficulty: Difficulty; time_spent_seconds: number }[] =
      [];

    for (const mtq of mtQuestions) {
      const q = questionById.get(mtq.question_id);
      if (!q) continue;
      const ans = answerByQuestionId.get(mtq.question_id);
      const isCorrect = ans ? isCorrectAnswer(q, ans.selected_choice) : false;

      const bucket = scoredBySection.get(q.category_id) ?? [];
      bucket.push({ difficulty: q.difficulty as Difficulty, is_correct: isCorrect });
      scoredBySection.set(q.category_id, bucket);

      if (!ans) continue;

      mtqUpdates.push({
        id: mtq.id,
        selected_choice: ans.selected_choice,
        is_correct: isCorrect,
        time_spent_seconds: ans.time_spent_seconds,
      });
      attemptRows.push({
        user_id: userId,
        question_id: mtq.question_id,
        source: "mock_test",
        selected_choice: ans.selected_choice,
        is_correct: isCorrect,
        time_spent_seconds: ans.time_spent_seconds,
      });
      masteryUpdates.push({
        subcategory_id: q.subcategory_id,
        is_correct: isCorrect,
        difficulty: q.difficulty as Difficulty,
        time_spent_seconds: ans.time_spent_seconds,
      });
    }

    for (const u of mtqUpdates) {
      const { error } = await supabase
        .from("mock_test_questions")
        .update({
          selected_choice: u.selected_choice,
          is_correct: u.is_correct,
          time_spent_seconds: u.time_spent_seconds,
          answered_at: new Date().toISOString(),
        })
        .eq("id", u.id);
      if (error) throw error;
    }

    if (attemptRows.length) {
      const { error: attemptErr } = await supabase.from("question_attempts").insert(attemptRows);
      if (attemptErr) throw attemptErr;
    }

    for (const m of masteryUpdates) {
      await recordMasteryUpdate(supabase, userId, m.subcategory_id, m.is_correct, m.difficulty, m.time_spent_seconds);
    }

    const rwScaled = rwCategoryId ? scoreMockTestSection(scoredBySection.get(rwCategoryId) ?? []) : null;
    const mathScaled = mathCategoryId ? scoreMockTestSection(scoredBySection.get(mathCategoryId) ?? []) : null;
    const totalScaled = rwScaled != null && mathScaled != null ? rwScaled + mathScaled : null;

    const { error: updErr } = await supabase
      .from("mock_tests")
      .update({
        completed_at: new Date().toISOString(),
        rw_scaled: rwScaled,
        math_scaled: mathScaled,
        total_scaled: totalScaled,
      })
      .eq("id", mockTestId);
    if (updErr) throw updErr;

    return jsonResponse({ rw_scaled: rwScaled, math_scaled: mathScaled, total_scaled: totalScaled });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
