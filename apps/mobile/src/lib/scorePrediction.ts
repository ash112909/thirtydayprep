// Rough score-range estimate from current mastery — not a diagnostic, just
// a motivational translation of "mastery %" into SAT-shaped numbers so
// progress feels concrete. Each section (Reading & Writing, Math) scores
// 200-800; mastery 0-100% maps linearly across that range.

import type { Category, MasterySnapshot, Subcategory } from "@/types/domain";

export interface ScorePrediction {
  bySectionSlug: Record<string, number | null>;
  total: number | null;
}

export function predictScore(
  categories: Category[],
  subcategories: Subcategory[],
  mastery: MasterySnapshot,
): ScorePrediction {
  const bySectionSlug: Record<string, number | null> = {};

  for (const cat of categories) {
    const scores = subcategories
      .filter((s) => s.category_id === cat.id)
      .map((s) => mastery[s.id])
      .filter((v): v is number => v != null);
    bySectionSlug[cat.slug] = scores.length
      ? Math.round(200 + (scores.reduce((sum, v) => sum + v, 0) / scores.length / 100) * 600)
      : null;
  }

  const sectionScores = Object.values(bySectionSlug).filter((v): v is number => v != null);
  const total =
    categories.length > 0 && sectionScores.length === categories.length
      ? sectionScores.reduce((sum, v) => sum + v, 0)
      : null;

  return { bySectionSlug, total };
}
