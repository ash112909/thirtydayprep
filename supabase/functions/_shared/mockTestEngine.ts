// Fixed-form mock exam question mix + scoring. Deliberately not adaptive —
// a mock test's whole point is a stable, repeatable measuring stick a
// student can retake and compare against, unlike the daily plan which
// leans into their weak spots on purpose.

import { BASE_SUBCATEGORY_WEIGHTS, DIFFICULTY_POINTS, splitByRatio } from "./planEngine.ts";
import type { DayTarget, Difficulty, Subcategory } from "./types.ts";

export interface MockTestSection {
  categorySlug: string;
  totalQuestions: number;
  timeLimitMinutes: number;
}

// Matches the digital SAT's real section lengths/timing so the scaled score
// this produces is at least shaped like the real thing, even though the
// underlying grading (see scoreMockTestSection) is a simplified stand-in
// for College Board's actual item-calibrated equating.
export const MOCK_TEST_SECTIONS: MockTestSection[] = [
  { categorySlug: "reading-writing", totalQuestions: 54, timeLimitMinutes: 64 },
  { categorySlug: "math", totalQuestions: 44, timeLimitMinutes: 70 },
];

const EVEN_DIFFICULTY_MIX: Record<Difficulty, number> = { easy: 1 / 3, medium: 1 / 3, hard: 1 / 3 };

/** Question mix for one section: proportioned across that section's
 * subcategories using the SAT's real domain weighting, split evenly across
 * difficulty within each. */
export function computeMockTestTargets(
  subcategories: Subcategory[],
  categoryId: string,
  totalQuestions: number,
): DayTarget[] {
  const sectionSubs = subcategories.filter((s) => s.category_id === categoryId);
  if (!sectionSubs.length) return [];

  const weights = sectionSubs.map((s) => BASE_SUBCATEGORY_WEIGHTS[s.slug] ?? 1 / sectionSubs.length);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const counts = sectionSubs.map((_, i) => Math.round((weights[i] / weightSum) * totalQuestions));

  let drift = counts.reduce((a, b) => a + b, 0) - totalQuestions;
  let i = 0;
  while (drift !== 0) {
    const idx = i % counts.length;
    if (drift > 0 && counts[idx] > 0) {
      counts[idx]--;
      drift--;
    } else if (drift < 0) {
      counts[idx]++;
      drift++;
    }
    i++;
    if (i > 400) break; // safety valve
  }

  const targets: DayTarget[] = [];
  sectionSubs.forEach((sc, idx) => {
    const splits = splitByRatio(counts[idx], EVEN_DIFFICULTY_MIX);
    for (const [difficulty, count] of Object.entries(splits) as [Difficulty, number][]) {
      if (count > 0) targets.push({ subcategory_id: sc.id, difficulty, count });
    }
  });
  return targets;
}

/** Scores one completed section into a 200-800 scaled number, weighting
 * correct answers by difficulty the same way scoreBaseline does. A question
 * the clock ran out on (no answer submitted) still counts toward the
 * possible points, so it's scored as missed rather than simply excluded —
 * matching how leaving a real SAT question blank works. */
export function scoreMockTestSection(
  answers: { difficulty: Difficulty; is_correct: boolean }[],
): number | null {
  if (!answers.length) return null;
  let earned = 0;
  let possible = 0;
  for (const a of answers) {
    const pts = DIFFICULTY_POINTS[a.difficulty];
    possible += pts;
    if (a.is_correct) earned += pts;
  }
  if (possible === 0) return null;
  return Math.round(200 + (earned / possible) * 600);
}
