// POST /regenerate-plan
// No body — recomputes the active plan's remaining days from the
// student's *current* profile (sat_date, daily_minutes), which the client
// updates directly (profiles RLS) just before calling this. Everything
// through the current day is left untouched: completed history, skipped
// days, and today's in-progress session all survive as-is. Only the
// not-yet-reached ("locked") days are deleted and rebuilt to fit the new
// end date and pace, using the same targeting logic as initial plan
// generation. Capped at regenerations_allowed per plan (2 by default) —
// see study_plans.regenerations_used/regenerations_allowed for the seam a
// future paid tier can raise without touching this function.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { addDays, computeDayTargets, daysBetween } from "../_shared/planEngine.ts";
import type { MasterySnapshot } from "../_shared/types.ts";

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

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("sat_date, daily_minutes")
      .eq("id", userId)
      .single();
    if (profileErr) throw profileErr;
    if (!profile.sat_date || !profile.daily_minutes) {
      return errorResponse("Set your SAT date and daily minutes first", 409);
    }

    const { data: plan, error: planErr } = await supabase
      .from("study_plans")
      .select("id, start_date, status, regenerations_used, regenerations_allowed")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) return errorResponse("No active study plan to regenerate", 404);

    if (plan.regenerations_used >= plan.regenerations_allowed) {
      return errorResponse(
        `You've used all ${plan.regenerations_allowed} plan regenerations for this plan.`,
        403,
      );
    }

    const { data: days, error: daysErr } = await supabase
      .from("study_plan_days")
      .select("id, day_number, status")
      .eq("study_plan_id", plan.id)
      .order("day_number", { ascending: true });
    if (daysErr) throw daysErr;
    if (!days?.length) return errorResponse("Plan has no days", 500);

    const keepThrough = days
      .filter((d) => d.status !== "locked")
      .reduce((max, d) => Math.max(max, d.day_number), 0);

    const newTotalDays = daysBetween(plan.start_date, profile.sat_date);
    if (newTotalDays < keepThrough) {
      return errorResponse(
        `Your new SAT date doesn't leave room for the ${keepThrough} day${keepThrough === 1 ? "" : "s"} you've already reached. Pick a later date.`,
        400,
      );
    }

    const idsToRemove = days.filter((d) => d.day_number > keepThrough).map((d) => d.id);
    if (idsToRemove.length) {
      const { error: delErr } = await supabase.from("study_plan_days").delete().in("id", idsToRemove);
      if (delErr) throw delErr;
    }

    const { data: subcategories, error: subErr } = await admin
      .from("subcategories")
      .select("id, category_id, slug, name");
    if (subErr) throw subErr;

    const { data: stats } = await supabase
      .from("user_skill_stats")
      .select("subcategory_id, mastery_score")
      .eq("user_id", userId);
    const mastery: MasterySnapshot = {};
    for (const s of stats ?? []) mastery[s.subcategory_id] = s.mastery_score;

    const newDayRows = [];
    for (let dayNumber = keepThrough + 1; dayNumber <= newTotalDays; dayNumber++) {
      newDayRows.push({
        study_plan_id: plan.id,
        day_number: dayNumber,
        date: addDays(plan.start_date, dayNumber - 1),
        target_minutes: profile.daily_minutes,
        targets: computeDayTargets(subcategories!, mastery, profile.daily_minutes),
        status: "locked",
      });
    }
    if (newDayRows.length) {
      const { error: insErr } = await supabase.from("study_plan_days").insert(newDayRows);
      if (insErr) throw insErr;
    }

    const { error: updPlanErr } = await supabase
      .from("study_plans")
      .update({
        end_date: profile.sat_date,
        total_days: newTotalDays,
        daily_minutes: profile.daily_minutes,
        regenerations_used: plan.regenerations_used + 1,
      })
      .eq("id", plan.id);
    if (updPlanErr) throw updPlanErr;

    return jsonResponse({
      total_days: newTotalDays,
      regenerations_used: plan.regenerations_used + 1,
      regenerations_allowed: plan.regenerations_allowed,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
