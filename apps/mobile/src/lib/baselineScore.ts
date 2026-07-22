// Mirrors supabase/functions/_shared/planEngine.ts#scoreBaseline (kept in
// sync by hand — the Expo app and Deno edge functions don't share a build
// pipeline). Used client-side to recompute a student's baseline mastery
// snapshot for the "how far you've come" comparison on the Progress tab.

import type { Difficulty, MasterySnapshot } from "@/types/domain";

const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

export function scoreBaseline(
  answers: { subcategory_id: string; difficulty: Difficulty; is_correct: boolean }[],
): MasterySnapshot {
  const earned: Record<string, number> = {};
  const possible: Record<string, number> = {};

  for (const a of answers) {
    const pts = DIFFICULTY_POINTS[a.difficulty];
    possible[a.subcategory_id] = (possible[a.subcategory_id] ?? 0) + pts;
    if (a.is_correct) {
      earned[a.subcategory_id] = (earned[a.subcategory_id] ?? 0) + pts;
    }
  }

  const mastery: MasterySnapshot = {};
  for (const subcategoryId of Object.keys(possible)) {
    const total = possible[subcategoryId] || 1;
    mastery[subcategoryId] = Math.round(((earned[subcategoryId] ?? 0) / total) * 1000) / 10;
  }
  return mastery;
}
