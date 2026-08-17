import type { Subcategory, UserSkillStat } from "@/types/domain";

export interface FocusTopic {
  subcategory: Subcategory;
  masteryScore: number;
}

// The single subcategory most worth practicing right now: lowest mastery
// among topics the student has actually attempted (so a topic they simply
// haven't touched yet, with no signal, doesn't drown out one they're
// genuinely struggling with). Null once there's no attempt data at all.
export function pickFocusTopic(stats: UserSkillStat[], subcategories: Subcategory[]): FocusTopic | null {
  const subcategoryById = new Map(subcategories.map((s) => [s.id, s]));
  let weakest: FocusTopic | null = null;

  for (const stat of stats) {
    if (stat.questions_attempted <= 0) continue;
    const subcategory = subcategoryById.get(stat.subcategory_id);
    if (!subcategory) continue;
    if (!weakest || stat.mastery_score < weakest.masteryScore) {
      weakest = { subcategory, masteryScore: Math.round(stat.mastery_score) };
    }
  }

  return weakest;
}
