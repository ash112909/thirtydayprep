// Mirrors supabase/functions/_shared/types.ts. Kept in sync by hand since
// the Expo app and the Deno edge functions don't share a build pipeline.

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "multiple_choice" | "grid_in";

export interface Choice {
  key: string;
  text: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  sat_date: string | null;
  daily_minutes: number | null;
  onboarding_complete: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  slug: string;
  name: string;
}

export interface SessionQuestion {
  study_plan_day_question_id?: string;
  order_index: number;
  question_id?: string;
  id?: string; // present when returned directly from the questions table
  category_id: string;
  subcategory_id: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  calculator_allowed?: boolean | null;
  passage: string | null;
  // Character offsets into `passage` marking the text the question refers
  // to as "underlined" — null when no such span could be detected (see
  // scripts/export-firestore-questions.mjs).
  passage_underline_start?: number | null;
  passage_underline_end?: number | null;
  stem: string;
  choices: Choice[] | null; // null for grid_in questions
  avg_seconds: number;
  answered?: boolean;
  selected_choice?: string | null;
  is_correct?: boolean | null;
}

export interface TodaySessionResponse {
  waiting?: boolean;
  plan_complete?: boolean;
  message?: string;
  study_plan_day_id?: string;
  day_number?: number;
  date?: string;
  target_minutes?: number;
  questions?: SessionQuestion[];
}

export interface BaselineQuestion extends SessionQuestion {}

export interface GenerateBaselineResponse {
  baseline_test_id: string;
  questions: BaselineQuestion[];
}

export interface MasterySnapshot {
  [subcategoryId: string]: number;
}

export interface SubmitBaselineResponse {
  mastery: MasterySnapshot;
  study_plan_id: string;
  total_days: number;
  day_one_question_count: number;
}

export interface SubmitAttemptResponse {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  day_completed: boolean;
}

export interface UserSkillStat {
  subcategory_id: string;
  questions_attempted: number;
  questions_correct: number;
  mastery_score: number;
}

export interface StudyPlan {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  daily_minutes: number;
  status: "active" | "completed" | "abandoned";
}

export interface DayTarget {
  subcategory_id: string;
  difficulty: Difficulty;
  count: number;
}

export interface StudyPlanDay {
  id: string;
  day_number: number;
  date: string;
  status: "locked" | "available" | "completed" | "skipped";
  completed_at: string | null;
  target_minutes: number;
  targets: DayTarget[];
  materialized: boolean;
}
