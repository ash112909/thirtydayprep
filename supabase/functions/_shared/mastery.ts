// Shared by submit-attempt (plan-day answers) and submit-review-attempt
// (Mistake Bank retries) — both need the same rolling mastery update after
// grading one answer, just from different callers.

import { updateMastery } from "./planEngine.ts";
import type { Difficulty } from "./types.ts";

// deno-lint-ignore no-explicit-any
export async function recordMasteryUpdate(
  supabase: any,
  userId: string,
  subcategoryId: string,
  isCorrect: boolean,
  difficulty: Difficulty,
  timeSpentSeconds: number,
): Promise<void> {
  const { data: priorStat } = await supabase
    .from("user_skill_stats")
    .select("mastery_score, questions_attempted, questions_correct, avg_time_seconds")
    .eq("user_id", userId)
    .eq("subcategory_id", subcategoryId)
    .maybeSingle();

  const priorMastery = priorStat?.mastery_score ?? 50;
  const priorAttempts = priorStat?.questions_attempted ?? 0;
  const newMastery = updateMastery(priorMastery, priorAttempts, isCorrect, difficulty);
  const priorAvgTime = priorStat?.avg_time_seconds ?? timeSpentSeconds;
  const newAvgTime = (priorAvgTime * priorAttempts + timeSpentSeconds) / (priorAttempts + 1);

  await supabase.from("user_skill_stats").upsert(
    {
      user_id: userId,
      subcategory_id: subcategoryId,
      questions_attempted: priorAttempts + 1,
      questions_correct: (priorStat?.questions_correct ?? 0) + (isCorrect ? 1 : 0),
      mastery_score: newMastery,
      avg_time_seconds: Math.round(newAvgTime * 10) / 10,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subcategory_id" },
  );
}
