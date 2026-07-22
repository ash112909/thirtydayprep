// POST /skip-day
// body: { study_plan_day_id }
//
// Lets a student deliberately skip the current available day (a scheduling
// miss, not a mistake to hide) rather than let it silently pile up. Marks
// the day 'skipped' and unlocks the next one, same sequential-unlock model
// submit-attempt uses for completed days. No mastery/rebalance changes —
// the student didn't answer anything, so there's nothing new to learn from.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    await getUserIdOrThrow(req); // throws if the caller isn't authenticated
    const supabase = userClient(req);

    const body = await req.json();
    const { study_plan_day_id } = body;
    if (!study_plan_day_id) return errorResponse("Missing study_plan_day_id");

    // Scoped to the caller's JWT, so RLS already guarantees this day (if
    // returned at all) belongs to them.
    const { data: day, error: dayErr } = await supabase
      .from("study_plan_days")
      .select("id, study_plan_id, day_number, status")
      .eq("id", study_plan_day_id)
      .single();
    if (dayErr) throw dayErr;
    if (day.status !== "available") {
      return errorResponse("Only the current available day can be skipped", 400);
    }

    const { error: updErr } = await supabase
      .from("study_plan_days")
      .update({ status: "skipped" })
      .eq("id", study_plan_day_id);
    if (updErr) throw updErr;

    await supabase
      .from("study_plan_days")
      .update({ status: "available" })
      .eq("study_plan_id", day.study_plan_id)
      .eq("day_number", day.day_number + 1)
      .eq("status", "locked");

    return jsonResponse({ skipped: true });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
