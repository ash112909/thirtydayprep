// Server-side mirror of apps/mobile/src/lib/achievements.ts — same
// thresholds and reward amounts, hand-kept in sync (same pattern as the
// rest of this project's client/edge-function duplication). This is the
// version that actually pays out, so it independently re-derives whether
// an achievement is earned from the database rather than trusting the
// client's claim.

export const REWARD_POINTS: Record<string, number> = {
  "first-day": 20,
  "week-streak": 30,
  "two-week-streak": 50,
  halfway: 30,
  "plan-complete": 75,
  century: 25,
  sharpshooter: 35,
  "no-stone-unturned": 25,
};

function computeLongestStreak(days: { day_number: number; status: string }[]): number {
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
  let longest = 0;
  let current = 0;
  for (const day of sorted) {
    if (day.status === "completed") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

// deno-lint-ignore no-explicit-any
export async function isAchievementEarned(supabase: any, userId: string, achievementId: string): Promise<boolean> {
  if (!(achievementId in REWARD_POINTS)) return false;

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id, total_days")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: days } = plan
    ? await supabase.from("study_plan_days").select("day_number, status").eq("study_plan_id", plan.id)
    : { data: [] };
  const completedDays = (days ?? []).filter((d: { status: string }) => d.status === "completed").length;

  switch (achievementId) {
    case "first-day":
      return completedDays >= 1;
    case "week-streak":
      return computeLongestStreak(days ?? []) >= 7;
    case "two-week-streak":
      return computeLongestStreak(days ?? []) >= 14;
    case "halfway":
      return !!plan && completedDays >= Math.ceil(plan.total_days / 2);
    case "plan-complete":
      return !!plan && completedDays >= plan.total_days;
  }

  // Remaining achievements need mastery stats rather than plan days.
  const { data: stats } = await supabase
    .from("user_skill_stats")
    .select("subcategory_id, questions_attempted, questions_correct")
    .eq("user_id", userId);
  const rows = stats ?? [];

  if (achievementId === "century") {
    const totalAnswered = rows.reduce((sum: number, s: { questions_attempted: number }) => sum + s.questions_attempted, 0);
    return totalAnswered >= 100;
  }

  if (achievementId === "sharpshooter") {
    const attempted = rows.reduce((sum: number, s: { questions_attempted: number }) => sum + s.questions_attempted, 0);
    if (attempted === 0) return false;
    const correct = rows.reduce((sum: number, s: { questions_correct: number }) => sum + s.questions_correct, 0);
    return Math.round((correct / attempted) * 100) >= 90;
  }

  if (achievementId === "no-stone-unturned") {
    const { data: subcategories } = await supabase.from("subcategories").select("id");
    if (!subcategories?.length) return false;
    const attemptedIds = new Set(
      rows.filter((s: { questions_attempted: number }) => s.questions_attempted > 0).map((s: { subcategory_id: string }) => s.subcategory_id),
    );
    return subcategories.every((sc: { id: string }) => attemptedIds.has(sc.id));
  }

  return false;
}
