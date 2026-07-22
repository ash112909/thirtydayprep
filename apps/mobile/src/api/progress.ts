import { supabase } from "@/lib/supabase";
import { scoreBaseline } from "@/lib/baselineScore";
import type { Category, Difficulty, MasterySnapshot, StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

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
    .select("subcategory_id, questions_attempted, questions_correct, mastery_score, avg_time_seconds")
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

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export interface RecapQuestion {
  question_id: string;
  subcategory_id: string;
  difficulty: Difficulty;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  avg_seconds: number;
}

// Manual client-side join (question details fetched separately, merged by
// id) rather than PostgREST embedding — matches how the rest of this file
// resolves subcategory/question references.
export async function fetchDayRecap(dayId: string): Promise<RecapQuestion[]> {
  const { data: dayQuestions, error } = await supabase
    .from("study_plan_day_questions")
    .select("question_id, is_correct, time_spent_seconds")
    .eq("study_plan_day_id", dayId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  if (!dayQuestions?.length) return [];

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, subcategory_id, difficulty, avg_seconds")
    .in(
      "id",
      dayQuestions.map((q) => q.question_id),
    );
  if (qErr) throw qErr;
  const byId = new Map(questions?.map((q) => [q.id, q]) ?? []);

  return dayQuestions.map((dq) => {
    const q = byId.get(dq.question_id);
    return {
      question_id: dq.question_id,
      subcategory_id: q?.subcategory_id ?? "",
      difficulty: (q?.difficulty ?? "medium") as Difficulty,
      is_correct: dq.is_correct,
      time_spent_seconds: dq.time_spent_seconds,
      avg_seconds: q?.avg_seconds ?? 75,
    };
  });
}

export interface DayResult {
  study_plan_day_id: string;
  correct: number;
  total: number;
}

// Per-completed-day accuracy, for the small badge on Plan tab tiles.
export async function fetchPlanDayResults(dayIds: string[]): Promise<Map<string, DayResult>> {
  const results = new Map<string, DayResult>();
  if (!dayIds.length) return results;

  const { data, error } = await supabase
    .from("study_plan_day_questions")
    .select("study_plan_day_id, is_correct")
    .in("study_plan_day_id", dayIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const existing = results.get(row.study_plan_day_id) ?? {
      study_plan_day_id: row.study_plan_day_id,
      correct: 0,
      total: 0,
    };
    existing.total += 1;
    if (row.is_correct) existing.correct += 1;
    results.set(row.study_plan_day_id, existing);
  }
  return results;
}

// Recomputes mastery from the student's first completed baseline test, for
// the "baseline vs now" comparison on the Progress tab. Mirrors
// supabase/functions/_shared/planEngine.ts#scoreBaseline (kept in sync by
// hand, same as the rest of this app's domain types).
export async function fetchBaselineMastery(userId: string): Promise<MasterySnapshot> {
  const { data: baseline, error: bErr } = await supabase
    .from("baseline_tests")
    .select("id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!baseline) return {};

  const { data: rows, error: rowErr } = await supabase
    .from("baseline_test_questions")
    .select("question_id, is_correct")
    .eq("baseline_test_id", baseline.id);
  if (rowErr) throw rowErr;
  if (!rows?.length) return {};

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, subcategory_id, difficulty")
    .in(
      "id",
      rows.map((r) => r.question_id),
    );
  if (qErr) throw qErr;
  const byId = new Map(questions?.map((q) => [q.id, q]) ?? []);

  const answers = rows
    .map((r) => {
      const q = byId.get(r.question_id);
      if (!q) return null;
      return { subcategory_id: q.subcategory_id, difficulty: q.difficulty as Difficulty, is_correct: !!r.is_correct };
    })
    .filter((a): a is { subcategory_id: string; difficulty: Difficulty; is_correct: boolean } => a != null);

  return scoreBaseline(answers);
}
