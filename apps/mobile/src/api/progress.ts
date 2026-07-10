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

export async function fetchPlanDays(planId: string): Promise<StudyPlanDay[]> {
  const { data, error } = await supabase
    .from("study_plan_days")
    .select("id, day_number, date, status, completed_at")
    .eq("study_plan_id", planId)
    .order("day_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudyPlanDay[];
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
