import { supabase } from "@/lib/supabase";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

export async function fetchActivePlan(userId: string): Promise<StudyPlan | null> {
  const { data, error } = await supabase
    .from("study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as StudyPlan | null;
}

// Whether the user has ever finished a baseline test — checked against
// baseline_tests directly (rather than study_plans.status='active') so a
// student who's completed their whole plan isn't mistaken for one who
// never took the baseline.
export async function hasCompletedBaseline(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("baseline_tests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function fetchPlanDays(planId: string): Promise<StudyPlanDay[]> {
  const { data, error } = await supabase
    .from("study_plan_days")
    .select("id, day_number, date, status, completed_at, target_minutes, targets, materialized")
    .eq("study_plan_id", planId)
    .order("day_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudyPlanDay[];
}

export async function fetchPlanDay(dayId: string): Promise<StudyPlanDay | null> {
  const { data, error } = await supabase
    .from("study_plan_days")
    .select("id, day_number, date, status, completed_at, target_minutes, targets, materialized")
    .eq("id", dayId)
    .maybeSingle();
  if (error) throw error;
  return data as StudyPlanDay | null;
}

export interface AttemptRecord {
  attempted_at: string;
  is_correct: boolean;
}

export async function fetchAttempts(userId: string): Promise<AttemptRecord[]> {
  const { data, error } = await supabase
    .from("question_attempts")
    .select("attempted_at, is_correct")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttemptRecord[];
}

export async function fetchSkillStats(userId: string): Promise<UserSkillStat[]> {
  const { data, error } = await supabase
    .from("user_skill_stats")
    .select("subcategory_id, questions_attempted, questions_correct, mastery_score")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UserSkillStat[];
}

export async function fetchSubcategories(): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from("subcategories")
    .select("id, category_id, slug, name")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subcategory[];
}
