// POST /generate-mock-test
// Creates a fresh fixed-form mock exam for the calling user: two timed,
// non-adaptive sections (Reading & Writing, then Math) built from the SAT's
// real domain weighting. Question selection reuses the same "prefer
// questions the student hasn't seen before" logic as the daily plan, so
// retakes stay fresh without any extra bookkeeping. Returns the test id,
// each section's time limit, and the questions (without answers).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { MOCK_TEST_SECTIONS, computeMockTestTargets } from "../_shared/mockTestEngine.ts";
import { selectQuestionsForTargets } from "../_shared/questionSelection.ts";

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

    const { data: categories, error: catErr } = await admin.from("categories").select("id, slug");
    if (catErr) throw catErr;
    const { data: subcategories, error: subErr } = await admin
      .from("subcategories")
      .select("id, category_id, slug, name");
    if (subErr) throw subErr;
    if (!categories?.length || !subcategories?.length) return errorResponse("Taxonomy not seeded", 500);

    const orderedQuestionIds: string[] = [];
    for (const section of MOCK_TEST_SECTIONS) {
      const category = categories.find((c) => c.slug === section.categorySlug);
      if (!category) continue;
      const targets = computeMockTestTargets(subcategories, category.id, section.totalQuestions);
      const picked = await selectQuestionsForTargets(admin, userId, targets);
      orderedQuestionIds.push(...picked);
    }

    if (orderedQuestionIds.length < MOCK_TEST_SECTIONS.reduce((sum, s) => sum + s.totalQuestions, 0) * 0.5) {
      return errorResponse(
        "Question bank doesn't yet have enough coverage to build a full mock test. Import more questions first.",
        409,
      );
    }

    const { data: test, error: testErr } = await supabase
      .from("mock_tests")
      .insert({ user_id: userId, total_questions: orderedQuestionIds.length })
      .select("id")
      .single();
    if (testErr) throw testErr;

    const rows = orderedQuestionIds.map((questionId, idx) => ({
      mock_test_id: test.id,
      question_id: questionId,
      order_index: idx,
    }));
    const { error: insErr } = await supabase.from("mock_test_questions").insert(rows);
    if (insErr) throw insErr;

    const { data: full, error: fullErr } = await admin
      .from("questions")
      .select(
        "id, category_id, subcategory_id, difficulty, passage, stem, choices, avg_seconds, question_type, calculator_allowed, passage_underline_start, passage_underline_end",
      )
      .in("id", orderedQuestionIds);
    if (fullErr) throw fullErr;
    const byId = new Map(full!.map((q) => [q.id, q]));

    return jsonResponse({
      mock_test_id: test.id,
      sections: MOCK_TEST_SECTIONS.map((s) => ({
        category_slug: s.categorySlug,
        time_limit_minutes: s.timeLimitMinutes,
      })),
      questions: orderedQuestionIds.map((id, idx) => ({ order_index: idx, ...byId.get(id) })),
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
