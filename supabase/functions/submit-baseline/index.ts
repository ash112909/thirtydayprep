// POST /submit-baseline
// body: { baseline_test_id, answers: [{ question_id, selected_choice, time_spent_seconds }] }
//
// Grades the baseline diagnostic, computes a per-subcategory mastery
// snapshot, seeds user_skill_stats, then generates the full day-by-day study
// plan (targets for every day between today and the student's SAT date) and
// materializes real questions for day 1 so they can start immediately.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { addDays, computeDayTargets, daysBetween, scoreBaseline } from "../_shared/planEngine.ts";
import { selectQuestionsForTargets } from "../_shared/questionSelection.ts";
import type { Difficulty } from "../_shared/types.ts";

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
    const baselineTestId: string = body.baseline_test_id;
    const answers: AnswerInput[] = body.answers ?? [];
    if (!baselineTestId || !answers.length) return errorResponse("Missing baseline_test_id or answers");

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, sat_date, daily_minutes")
      .eq("id", userId)
      .single();
    if (profileErr) throw profileErr;
    if (!profile.sat_date || !profile.daily_minutes) {
      return errorResponse("Complete onboarding (SAT date + daily minutes) before the baseline test", 409);
    }

    const { data: btQuestions, error: btqErr } = await admin
      .from("baseline_test_questions")
      .select("id, question_id")
      .eq("baseline_test_id", baselineTestId);
    if (btqErr) throw btqErr;
    if (!btQuestions?.length) return errorResponse("Baseline test not found", 404);

    const { data: questionRows, error: qErr } = await admin
      .from("questions")
      .select("id, subcategory_id, difficulty, correct_choice")
      .in(
        "id",
        btQuestions.map((q) => q.question_id),
      );
    if (qErr) throw qErr;
    const questionById = new Map(questionRows!.map((q) => [q.id, q]));
    const btqByQuestionId = new Map(btQuestions.map((q) => [q.question_id, q.id]));

    const scored: { subcategory_id: string; difficulty: Difficulty; is_correct: boolean }[] = [];
    const attemptRows: Record<string, unknown>[] = [];
    const btqUpdates: { id: string; selected_choice: string; is_correct: boolean; time_spent_seconds: number }[] = [];

    for (const ans of answers) {
      const q = questionById.get(ans.question_id);
      const btqId = btqByQuestionId.get(ans.question_id);
      if (!q || !btqId) continue;
      const isCorrect = ans.selected_choice === q.correct_choice;
      scored.push({ subcategory_id: q.subcategory_id, difficulty: q.difficulty as Difficulty, is_correct: isCorrect });
      btqUpdates.push({
        id: btqId,
        selected_choice: ans.selected_choice,
        is_correct: isCorrect,
        time_spent_seconds: ans.time_spent_seconds,
      });
      attemptRows.push({
        user_id: userId,
        question_id: ans.question_id,
        source: "baseline",
        baseline_test_id: baselineTestId,
        selected_choice: ans.selected_choice,
        is_correct: isCorrect,
        time_spent_seconds: ans.time_spent_seconds,
      });
    }

    for (const u of btqUpdates) {
      const { error } = await supabase
        .from("baseline_test_questions")
        .update({
          selected_choice: u.selected_choice,
          is_correct: u.is_correct,
          time_spent_seconds: u.time_spent_seconds,
          answered_at: new Date().toISOString(),
        })
        .eq("id", u.id);
      if (error) throw error;
    }

    const { error: attemptErr } = await supabase.from("question_attempts").insert(attemptRows);
    if (attemptErr) throw attemptErr;

    await supabase
      .from("baseline_tests")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", baselineTestId);

    const mastery = scoreBaseline(scored);

    const statRows = Object.entries(mastery).map(([subcategoryId, score]) => {
      const attemptsForSub = scored.filter((s) => s.subcategory_id === subcategoryId);
      const correct = attemptsForSub.filter((s) => s.is_correct).length;
      return {
        user_id: userId,
        subcategory_id: subcategoryId,
        questions_attempted: attemptsForSub.length,
        questions_correct: correct,
        mastery_score: score,
        updated_at: new Date().toISOString(),
      };
    });
    const { error: statErr } = await supabase
      .from("user_skill_stats")
      .upsert(statRows, { onConflict: "user_id,subcategory_id" });
    if (statErr) throw statErr;

    // --- Generate the study plan -------------------------------------
    const { data: subcategories, error: subErr } = await admin
      .from("subcategories")
      .select("id, category_id, slug, name");
    if (subErr) throw subErr;

    const today = new Date().toISOString().slice(0, 10);
    const totalDays = daysBetween(today, profile.sat_date);

    const { data: plan, error: planErr } = await supabase
      .from("study_plans")
      .insert({
        user_id: userId,
        baseline_test_id: baselineTestId,
        start_date: today,
        end_date: profile.sat_date,
        total_days: totalDays,
        daily_minutes: profile.daily_minutes,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;

    const dayRows = [];
    for (let dayNumber = 1; dayNumber <= totalDays; dayNumber++) {
      const targets = computeDayTargets(subcategories!, mastery, profile.daily_minutes);
      dayRows.push({
        study_plan_id: plan.id,
        day_number: dayNumber,
        date: addDays(today, dayNumber - 1),
        target_minutes: profile.daily_minutes,
        targets,
        status: dayNumber === 1 ? "available" : "locked",
      });
    }
    const { data: insertedDays, error: dayErr } = await supabase
      .from("study_plan_days")
      .insert(dayRows)
      .select("id, day_number, targets");
    if (dayErr) throw dayErr;

    const day1 = insertedDays!.find((d) => d.day_number === 1)!;
    const day1QuestionIds = await selectQuestionsForTargets(admin, userId, day1.targets);
    const day1Rows = day1QuestionIds.map((questionId, idx) => ({
      study_plan_day_id: day1.id,
      question_id: questionId,
      order_index: idx,
    }));
    if (day1Rows.length) {
      const { error: dqErr } = await supabase.from("study_plan_day_questions").insert(day1Rows);
      if (dqErr) throw dqErr;
    }
    await supabase.from("study_plan_days").update({ materialized: true }).eq("id", day1.id);

    return jsonResponse({
      mastery,
      study_plan_id: plan.id,
      total_days: totalDays,
      day_one_question_count: day1Rows.length,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
