// POST /submit-review-attempt
// body: { question_id, selected_choice, time_spent_seconds }
//
// Grades a Mistake Bank retry: a question the student already answered
// wrong at some point, being re-attempted outside of any study plan day.
// Records the attempt (source: "review") and updates rolling mastery just
// like a normal day's answer, so working through missed questions actually
// feeds back into the adaptive plan.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { recordMasteryUpdate } from "../_shared/mastery.ts";
import { isCorrectAnswer } from "../_shared/types.ts";

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
    const { question_id, selected_choice, time_spent_seconds } = body;
    if (!question_id || !selected_choice) {
      return errorResponse("Missing question_id or selected_choice");
    }

    const { data: question, error: qErr } = await admin
      .from("questions")
      .select("id, subcategory_id, difficulty, question_type, correct_choice, correct_value, explanation")
      .eq("id", question_id)
      .single();
    if (qErr) throw qErr;

    const isCorrect = isCorrectAnswer(question, selected_choice);

    const { error: attemptErr } = await supabase.from("question_attempts").insert({
      user_id: userId,
      question_id,
      source: "review",
      selected_choice,
      is_correct: isCorrect,
      time_spent_seconds,
    });
    if (attemptErr) throw attemptErr;

    await recordMasteryUpdate(
      supabase,
      userId,
      question.subcategory_id,
      isCorrect,
      question.difficulty,
      time_spent_seconds,
    );

    return jsonResponse({
      is_correct: isCorrect,
      correct_answer: question.question_type === "grid_in" ? question.correct_value : question.correct_choice,
      explanation: question.explanation,
      day_completed: false,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
