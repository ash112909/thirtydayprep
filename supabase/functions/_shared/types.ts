// Shared domain types for the study-plan engine and edge functions.
// Mirrored (manually) in apps/mobile/src/types/domain.ts for the client,
// since Deno edge functions and the Expo/Metro bundler don't share a build.

export type Difficulty = "easy" | "medium" | "hard";

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
}
