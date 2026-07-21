// GET /get-today-session
// Returns the student's next due study-plan day: the earliest day with
// date <= today that isn't completed yet (so a missed day is offered before
// today's, rather than silently skipped). Materializes real questions for
// that day on first access if it hasn't been picked yet.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { selectQuestionsForTargets } from "../_shared/questionSelection.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserIdOrThrow(req);
    const supabase = userClient(req);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan, error: planErr } = await supabase
      .from("study_plans")
      .select("id, end_date, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) return errorResponse("No active study plan. Complete the baseline test first.", 404);

    const today = new Date().toISOString().slice(0, 10);

    const { data: day, error: dayErr } = await supabase
      .from("study_plan_days")
      .select("id, day_number, date, target_minutes, targets, status, materialized")
      .eq("study_plan_id", plan.id)
      .lte("date", today)
      .is("completed_at", null)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (dayErr) throw dayErr;

    if (!day) {
      const { count } = await supabase
        .from("study_plan_days")
        .select("id", { count: "exact", head: true })
        .eq("study_plan_id", plan.id)
        .is("completed_at", null);
      if (count === 0) {
        await supabase.from("study_plans").update({ status: "completed" }).eq("id", plan.id);
        return jsonResponse({ plan_complete: true });
      }
      return jsonResponse({ waiting: true, message: "You're all caught up. Come back tomorrow!" });
    }

    if (!day.materialized) {
      const questionIds = await selectQuestionsForTargets(admin, userId, day.targets);
      const rows = questionIds.map((questionId, idx) => ({
        study_plan_day_id: day.id,
        question_id: questionId,
        order_index: idx,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from("study_plan_day_questions").insert(rows);
        if (insErr) throw insErr;
      }
      await supabase
        .from("study_plan_days")
        .update({ materialized: true, status: "available" })
        .eq("id", day.id);
    }

    const { data: dayQuestions, error: dqErr } = await supabase
      .from("study_plan_day_questions")
      .select("id, order_index, question_id, selected_choice, is_correct, time_spent_seconds")
      .eq("study_plan_day_id", day.id)
      .order("order_index", { ascending: true });
    if (dqErr) throw dqErr;

    const { data: questionDetails, error: qdErr } = await admin
      .from("questions")
      .select(
        "id, category_id, subcategory_id, difficulty, passage, stem, choices, avg_seconds, question_type, calculator_allowed, passage_underline_start, passage_underline_end",
      )
      .in(
        "id",
        (dayQuestions ?? []).map((q) => q.question_id),
      );
    if (qdErr) throw qdErr;
    const byId = new Map(questionDetails!.map((q) => [q.id, q]));

    return jsonResponse({
      study_plan_day_id: day.id,
      day_number: day.day_number,
      date: day.date,
      target_minutes: day.target_minutes,
      questions: (dayQuestions ?? []).map((dq) => ({
        study_plan_day_question_id: dq.id,
        order_index: dq.order_index,
        answered: dq.selected_choice !== null,
        selected_choice: dq.selected_choice,
        is_correct: dq.is_correct,
        ...byId.get(dq.question_id),
      })),
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
