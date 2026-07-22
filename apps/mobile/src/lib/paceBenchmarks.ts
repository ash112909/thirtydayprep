import type { Subcategory, UserSkillStat } from "@/types/domain";

// Mirrors supabase/functions/_shared/planEngine.ts#AVG_SECONDS_BY_SUBCATEGORY
// (kept in sync by hand, same as the rest of this app's domain logic) — used
// to compare a student's actual pace against expected time per question.
export const AVG_SECONDS_BY_SUBCATEGORY: Record<string, number> = {
  "information-and-ideas": 70,
  "craft-and-structure": 65,
  "expression-of-ideas": 60,
  "standard-english-conventions": 55,
  algebra: 90,
  "advanced-math": 100,
  "problem-solving-data-analysis": 95,
  "geometry-trigonometry": 95,
};

// Positive = slower than expected on average, negative = faster. Null if
// there's not enough data yet (no attempts with a recorded avg time).
export function computePaceDelta(stats: UserSkillStat[], subcategories: Subcategory[]): number | null {
  const slugById = new Map(subcategories.map((s) => [s.id, s.slug]));
  let actualWeighted = 0;
  let benchmarkWeighted = 0;
  let totalWeight = 0;

  for (const s of stats) {
    if (!s.avg_time_seconds || !s.questions_attempted) continue;
    const slug = slugById.get(s.subcategory_id);
    const benchmark = slug ? AVG_SECONDS_BY_SUBCATEGORY[slug] : undefined;
    if (!benchmark) continue;
    actualWeighted += s.avg_time_seconds * s.questions_attempted;
    benchmarkWeighted += benchmark * s.questions_attempted;
    totalWeight += s.questions_attempted;
  }

  if (!totalWeight || !benchmarkWeighted) return null;
  return Math.round(((actualWeighted - benchmarkWeighted) / benchmarkWeighted) * 100);
}
