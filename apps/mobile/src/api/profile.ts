import { supabase } from "@/lib/supabase";

// A profiles row is created automatically by a DB trigger on signup
// (see supabase/migrations/0003_profile_trigger.sql), so onboarding only
// ever needs to update it.
export async function completeOnboarding(userId: string, satDate: string, dailyMinutes: number) {
  const { error } = await supabase
    .from("profiles")
    .update({
      sat_date: satDate,
      daily_minutes: dailyMinutes,
      onboarding_complete: true,
    })
    .eq("id", userId);
  if (error) throw error;
}

// Updates just the goal fields after onboarding — doesn't touch or resize
// an already-generated study plan, so changing daily minutes here affects
// future adaptive rebalancing but not the plan's existing day count.
export async function updateStudyGoals(userId: string, satDate: string, dailyMinutes: number) {
  const { error } = await supabase
    .from("profiles")
    .update({ sat_date: satDate, daily_minutes: dailyMinutes })
    .eq("id", userId);
  if (error) throw error;
}
