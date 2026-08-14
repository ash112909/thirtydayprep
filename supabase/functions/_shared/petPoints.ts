// Awards study-buddy shop points for two things: a small amount for each
// correct answer (so the reward loop is immediate, not just once a day) and
// a bigger bonus for finishing the whole day. Both are no-ops if the student
// hasn't created a pet yet — nothing to award to. Each returns the amount
// actually awarded (0 if there was no pet) so callers can report a total.

const POINTS_PER_CORRECT_ANSWER = 2;
const POINTS_PER_COMPLETED_DAY = 15;

// deno-lint-ignore no-explicit-any
async function awardPoints(supabase: any, userId: string, amount: number): Promise<number> {
  const { data: pet } = await supabase.from("study_pets").select("points").eq("user_id", userId).maybeSingle();
  if (!pet) return 0;
  await supabase
    .from("study_pets")
    .update({ points: pet.points + amount })
    .eq("user_id", userId);
  return amount;
}

// deno-lint-ignore no-explicit-any
export async function awardCorrectAnswerPoints(supabase: any, userId: string): Promise<number> {
  return awardPoints(supabase, userId, POINTS_PER_CORRECT_ANSWER);
}

// deno-lint-ignore no-explicit-any
export async function awardDayCompletionPoints(supabase: any, userId: string): Promise<number> {
  return awardPoints(supabase, userId, POINTS_PER_COMPLETED_DAY);
}
