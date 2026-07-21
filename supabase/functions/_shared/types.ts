// Shared domain types for the study-plan engine and edge functions.
// Mirrored (manually) in apps/mobile/src/types/domain.ts for the client,
// since Deno edge functions and the Expo/Metro bundler don't share a build.

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "multiple_choice" | "grid_in";

export interface Subcategory {
  id: string;
  category_id: string;
  slug: string;
  name: string;
}

export interface MasterySnapshot {
  // subcategory_id -> mastery score 0-100 (higher = stronger)
  [subcategoryId: string]: number;
}

export interface DayTarget {
  subcategory_id: string;
  difficulty: Difficulty;
  count: number;
}

export interface Question {
  id: string;
  category_id: string;
  subcategory_id: string;
  difficulty: Difficulty;
  avg_seconds: number;
  question_type: QuestionType;
}

/** True if `submitted` matches the question's correct answer, branching on question_type. */
export function isCorrectAnswer(
  question: { question_type: QuestionType; correct_choice: string | null; correct_value: string | null },
  submitted: string,
): boolean {
  if (question.question_type === "grid_in") {
    return normalizeAnswer(submitted) === normalizeAnswer(question.correct_value ?? "");
  }
  return submitted === question.correct_choice;
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
