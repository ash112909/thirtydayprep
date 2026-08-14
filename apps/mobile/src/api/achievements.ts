import { supabase } from "@/lib/supabase";

export async function fetchClaimedAchievementIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("user_achievements").select("achievement_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.achievement_id));
}
