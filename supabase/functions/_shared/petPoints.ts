// Awards study-buddy shop points on day completion. A no-op if the student
// hasn't created a pet yet — nothing to award to.

const POINTS_PER_COMPLETED_DAY = 15;

// deno-lint-ignore no-explicit-any
export async function awardDayCompletionPoints(supabase: any, userId: string): Promise<void> {
  const { data: pet } = await supabase.from("study_pets").select("points").eq("user_id", userId).maybeSingle();
  if (!pet) return;
  await supabase
    .from("study_pets")
    .update({ points: pet.points + POINTS_PER_COMPLETED_DAY })
    .eq("user_id", userId);
}
