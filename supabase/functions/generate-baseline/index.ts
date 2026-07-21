// POST /generate-baseline
// Creates a fresh baseline diagnostic for the calling user: 3 questions
// (easy/medium/hard) from each of the 8 SAT subcategories, 24 total. Returns
// the test id and questions (without answers) for the client to render.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { BASELINE_DIFFICULTIES, BASELINE_QUESTIONS_PER_SUBCATEGORY } from "../_shared/planEngine.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdOrThrow(req);
    const supabase = userClient(req);

    // Service-role client only for the parts RLS would otherwise block
    // (reading the full question bank isn't blocked, but we insert rows on
    // behalf of the user under their own RLS context via `supabase` above).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subcategories, error: subErr } = await admin
      .from("subcategories")
      .select("id, category_id, slug, name");
    if (subErr) throw subErr;
    if (!subcategories?.length) return errorResponse("Subcategory taxonomy not seeded", 500);

    const questionRows: { id: string; subcategory_id: string; difficulty: string }[] = [];
    for (const sc of subcategories) {
      for (const difficulty of BASELINE_DIFFICULTIES) {
        const { data: pool, error: poolErr } = await admin
          .from("questions")
          .select("id, subcategory_id, difficulty")
          .eq("subcategory_id", sc.id)
          .eq("difficulty", difficulty)
          .eq("active", true)
          .limit(20);
        if (poolErr) throw poolErr;
        if (!pool?.length) continue;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        questionRows.push(pick);
      }
    }

    if (questionRows.length < subcategories.length) {
      return errorResponse(
        "Question bank doesn't yet have coverage for every subcategory/difficulty. Import more questions before starting a baseline test.",
        409,
      );
    }

    // Interleave rather than grouping by subcategory so the diagnostic
    // doesn't feel like 8 mini-blocks back to back.
    const ordered = shuffle(questionRows);

    const { data: test, error: testErr } = await supabase
      .from("baseline_tests")
      .insert({ user_id: userId, total_questions: ordered.length })
      .select("id")
      .single();
    if (testErr) throw testErr;

    const rows = ordered.map((q, idx) => ({
      baseline_test_id: test.id,
      question_id: q.id,
      order_index: idx,
    }));
    const { error: insErr } = await supabase.from("baseline_test_questions").insert(rows);
    if (insErr) throw insErr;

    const { data: full, error: fullErr } = await admin
      .from("questions")
      .select(
        "id, category_id, subcategory_id, difficulty, passage, stem, choices, avg_seconds, question_type, calculator_allowed, passage_underline_start, passage_underline_end",
      )
      .in(
        "id",
        ordered.map((q) => q.id),
      );
    if (fullErr) throw fullErr;
    const byId = new Map(full!.map((q) => [q.id, q]));

    return jsonResponse({
      baseline_test_id: test.id,
      questions: ordered.map((q, idx) => ({
        order_index: idx,
        ...byId.get(q.id),
      })),
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
