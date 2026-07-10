// POST /submit-attempt
// body: { study_plan_day_question_id, selected_choice, time_spent_seconds }
//
// Grades one answer, records the attempt, updates the student's rolling
// mastery for that subcategory, and — if this was the last question in the
// day — marks the day complete, unlocks the next day, and rebalances the
// targets of every not-yet-materialized future day using the fresh mastery
// data (later days lean further into whatever's still weak).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { computeDayTargets, updateMastery } from "../_shared/planEngine.ts";
import type { Difficulty, MasterySnapshot } from "../_shared/types.ts";

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
    const { study_plan_day_question_id, selected_choice, time_spent_seconds } = body;
    if (!study_plan_day_question_id || !selected_choice) {
      return errorResponse("Missing study_plan_day_question_id or selected_choice");
    }

    const { data: dq, error: dqErr } = await supabase
      .from("study_plan_day_questions")
      .select("id, study_plan_day_id, question_id")
      .eq("id", study_plan_day_question_id)
      .single();
    if (dqErr) throw dqErr;

    const { data: question, error: qErr } = await admin
      .from("questions")
      .select("id, subcategory_id, difficulty, correct_choice, explanation")
      .eq("id", dq.question_id)
      .single();
    if (qErr) throw qErr;

    const isCorrect = selected_choice === question.correct_choice;

    const { error: updErr } = await supabase
      .from("study_plan_day_questions")
      .update({
        selected_choice,
        is_correct: isCorrect,
        time_spent_seconds,
        answered_at: new Date().toISOString(),
      })
      .eq("id", study_plan_day_question_id);
    if (updErr) throw updErr;

    const { data: day, error: dayErr } = await supabase
      .from("study_plan_days")
      .select("id, study_plan_id, day_number")
      .eq("id", dq.study_plan_day_id)
      .single();
    if (dayErr) throw dayErr;

    const { error: attemptErr } = await supabase.from("question_attempts").insert({
      user_id: userId,
      question_id: dq.question_id,
      source: "daily",
      study_plan_day_id: dq.study_plan_day_id,
      selected_choice,
      is_correct: isCorrect,
      time_spent_seconds,
    });
    if (attemptErr) throw attemptErr;

    // --- Update rolling mastery for this subcategory --------------------
    const { data: priorStat } = await supabase
      .from("user_skill_stats")
      .select("mastery_score, questions_attempted, questions_correct, avg_time_seconds")
      .eq("user_id", userId)
      .eq("subcategory_id", question.subcategory_id)
      .maybeSingle();

    const priorMastery = priorStat?.mastery_score ?? 50;
    const priorAttempts = priorStat?.questions_attempted ?? 0;
    const newMastery = updateMastery(priorMastery, priorAttempts, isCorrect, question.difficulty as Difficulty);
    const priorAvgTime = priorStat?.avg_time_seconds ?? time_spent_seconds;
    const newAvgTime = (priorAvgTime * priorAttempts + time_spent_seconds) / (priorAttempts + 1);

    await supabase.from("user_skill_stats").upsert(
      {
        user_id: userId,
        subcategory_id: question.subcategory_id,
        questions_attempted: priorAttempts + 1,
        questions_correct: (priorStat?.questions_correct ?? 0) + (isCorrect ? 1 : 0),
        mastery_score: newMastery,
        avg_time_seconds: Math.round(newAvgTime * 10) / 10,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,subcategory_id" },
    );

    // --- Check if the day is now complete --------------------------------
    const { count: unanswered } = await supabase
      .from("study_plan_day_questions")
      .select("id", { count: "exact", head: true })
      .eq("study_plan_day_id", dq.study_plan_day_id)
      .is("selected_choice", null);

    let dayCompleted = false;
    if (unanswered === 0) {
      dayCompleted = true;
      await supabase
        .from("study_plan_days")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", dq.study_plan_day_id);

      await supabase
        .from("study_plan_days")
        .update({ status: "available" })
        .eq("study_plan_id", day.study_plan_id)
        .eq("day_number", day.day_number + 1)
        .eq("status", "locked");

      await rebalanceFuturePlan(admin, supabase, userId, day.study_plan_id);
    }

    return jsonResponse({
      is_correct: isCorrect,
      correct_choice: question.correct_choice,
      explanation: question.explanation,
      day_completed: dayCompleted,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

// deno-lint-ignore no-explicit-any
async function rebalanceFuturePlan(admin: any, supabase: any, userId: string, studyPlanId: string) {
  const { data: subcategories } = await admin
    .from("subcategories")
    .select("id, category_id, slug, name");
  if (!subcategories?.length) return;

  const { data: stats } = await supabase
    .from("user_skill_stats")
    .select("subcategory_id, mastery_score")
    .eq("user_id", userId);
  const mastery: MasterySnapshot = {};
  for (const s of stats ?? []) mastery[s.subcategory_id] = s.mastery_score;

  const { data: plan } = await supabase
    .from("study_plans")
    .select("daily_minutes")
    .eq("id", studyPlanId)
    .single();
  if (!plan) return;

  const { data: futureDays } = await supabase
    .from("study_plan_days")
    .select("id")
    .eq("study_plan_id", studyPlanId)
    .eq("materialized", false);

  for (const d of futureDays ?? []) {
    const targets = computeDayTargets(subcategories, mastery, plan.daily_minutes);
    await supabase.from("study_plan_days").update({ targets }).eq("id", d.id);
  }
}
