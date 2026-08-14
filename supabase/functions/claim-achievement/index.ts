// POST /claim-achievement
// body: { achievement_id }
//
// Pays out the points reward for an achievement the student has earned.
// Independently re-verifies the achievement against the database (not just
// trusting whatever the client sends) and is idempotent — claiming the same
// achievement twice only pays out once, enforced by the primary key on
// user_achievements.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { userClient, getUserIdOrThrow } from "../_shared/client.ts";
import { awardPoints } from "../_shared/petPoints.ts";
import { isAchievementEarned, REWARD_POINTS } from "../_shared/achievements.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdOrThrow(req);
    const supabase = userClient(req);

    const body = await req.json();
    const { achievement_id } = body;
    if (!achievement_id || !(achievement_id in REWARD_POINTS)) {
      return errorResponse("Unknown achievement_id");
    }

    const { data: existing } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
      .eq("achievement_id", achievement_id)
      .maybeSingle();
    if (existing) {
      return jsonResponse({ already_claimed: true, points_awarded: 0 });
    }

    const earned = await isAchievementEarned(supabase, userId, achievement_id);
    if (!earned) {
      return errorResponse("Achievement not yet earned", 400);
    }

    const { error: insertErr } = await supabase
      .from("user_achievements")
      .insert({ user_id: userId, achievement_id });
    if (insertErr) throw insertErr;

    const pointsAwarded = await awardPoints(supabase, userId, REWARD_POINTS[achievement_id]);

    return jsonResponse({ already_claimed: false, points_awarded: pointsAwarded });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
