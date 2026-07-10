// Core adaptive study-plan algorithm. Pure functions, no I/O, so they're
// easy to unit test and to reuse from both submit-baseline (initial plan)
// and submit-attempt (rebalancing remaining days after new mastery data).

import type { DayTarget, Difficulty, MasterySnapshot, Subcategory } from "./types.ts";

// Approximate digital SAT domain weighting (fraction of the overall test),
// used to seed how many questions of each subcategory a student sees before
// their own performance data starts pulling the distribution toward their
// weak areas. Reading & Writing and Math are each ~50% of the exam.
export const BASE_SUBCATEGORY_WEIGHTS: Record<string, number> = {
  "information-and-ideas": 0.13,
  "craft-and-structure": 0.14,
  "expression-of-ideas": 0.1,
  "standard-english-conventions": 0.13,
  algebra: 0.175,
  "advanced-math": 0.175,
  "problem-solving-data-analysis": 0.075,
  "geometry-trigonometry": 0.075,
};

// Expected seconds/question by subcategory, used only for pacing the daily
// question budget from the student's available minutes (actual observed
// avg_seconds on question rows is used once attempts start rolling in).
const AVG_SECONDS_BY_SUBCATEGORY: Record<string, number> = {
  "information-and-ideas": 70,
  "craft-and-structure": 65,
  "expression-of-ideas": 60,
  "standard-english-conventions": 55,
  algebra: 90,
  "advanced-math": 100,
  "problem-solving-data-analysis": 95,
  "geometry-trigonometry": 95,
};

// How aggressively weak subcategories get over-weighted relative to the
// exam's real proportions. 0 = ignore performance entirely (pure exam
// weighting); higher = more remediation-focused.
const WEAKNESS_EMPHASIS = 1.5;

export const BASELINE_QUESTIONS_PER_SUBCATEGORY = 3; // one easy, one medium, one hard
export const BASELINE_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

/**
 * Score a completed baseline test into a per-subcategory mastery snapshot
 * (0-100). Weights correct answers by difficulty so getting a hard question
 * right counts for more than an easy one, and vice versa for confidence in
 * a low score.
 */
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
    mastery[subcategoryId] = round1(((earned[subcategoryId] ?? 0) / total) * 100);
  }
  return mastery;
}

/** Recency-weighted update of a running mastery score with one new attempt. */
export function updateMastery(
  priorMastery: number,
  priorAttempts: number,
  isCorrect: boolean,
  difficulty: Difficulty,
): number {
  const pts = DIFFICULTY_POINTS[difficulty];
  const observed = isCorrect ? 100 : 0;
  // Newer attempts matter more than the accumulated history once a student
  // has seen a fair number of questions, so mastery reflects current skill
  // rather than being anchored to the baseline forever.
  const weight = Math.min(0.35, pts / (priorAttempts + 6));
  return round1(priorMastery * (1 - weight) + observed * weight);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Difficulty mix for a subcategory given current mastery: weaker students
 * get more easy/medium questions to build fundamentals; stronger students
 * get pushed toward hard questions.
 */
function difficultyMix(mastery: number): Record<Difficulty, number> {
  if (mastery < 40) return { easy: 0.6, medium: 0.3, hard: 0.1 };
  if (mastery < 70) return { easy: 0.3, medium: 0.45, hard: 0.25 };
  return { easy: 0.15, medium: 0.35, hard: 0.5 };
}

/**
 * Compute today's (or any single day's) question targets: how many
 * questions of each subcategory x difficulty the student should get, given
 * their available minutes and current mastery per subcategory.
 *
 * Blends the SAT's real domain weighting with a weakness boost so every
 * subcategory still gets covered over time, but weak areas get more reps.
 */
export function computeDayTargets(
  subcategories: Subcategory[],
  mastery: MasterySnapshot,
  dailyMinutes: number,
): DayTarget[] {
  const weights: Record<string, number> = {};
  let weightSum = 0;
  for (const sc of subcategories) {
    const base = BASE_SUBCATEGORY_WEIGHTS[sc.slug] ?? 1 / subcategories.length;
    const m = mastery[sc.id] ?? 50; // assume average until we have data
    const weakness = (100 - m) / 100; // 0 (mastered) .. 1 (no signal yet)
    const w = base * (1 + weakness * WEAKNESS_EMPHASIS);
    weights[sc.id] = w;
    weightSum += w;
  }

  const blendedAvgSeconds =
    subcategories.reduce((sum, sc) => sum + (AVG_SECONDS_BY_SUBCATEGORY[sc.slug] ?? 80), 0) /
    Math.max(subcategories.length, 1);
  const totalBudget = Math.max(4, Math.round((dailyMinutes * 60) / blendedAvgSeconds));

  // Every subcategory gets at least one question per day once the daily
  // budget can support it, so nothing goes untouched for long stretches.
  const floorEligible = totalBudget >= subcategories.length;
  const counts: Record<string, number> = {};
  let allocated = 0;

  for (const sc of subcategories) {
    const share = weightSum > 0 ? weights[sc.id] / weightSum : 1 / subcategories.length;
    let count = floorEligible ? 1 : 0;
    count += Math.round(share * (totalBudget - (floorEligible ? subcategories.length : 0)));
    counts[sc.id] = Math.max(floorEligible ? 1 : 0, count);
    allocated += counts[sc.id];
  }

  // Trim/pad rounding drift against the target budget, adjusting the
  // weakest-weighted subcategories first (they can most afford +/-1).
  const bySlackDesc = [...subcategories].sort(
    (a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0),
  );
  let drift = allocated - totalBudget;
  let i = 0;
  while (drift !== 0 && bySlackDesc.length > 0) {
    const sc = bySlackDesc[i % bySlackDesc.length];
    const min = floorEligible ? 1 : 0;
    if (drift > 0 && counts[sc.id] > min) {
      counts[sc.id]--;
      drift--;
    } else if (drift < 0) {
      counts[sc.id]++;
      drift++;
    }
    i++;
    if (i > 200) break; // safety valve
  }

  const targets: DayTarget[] = [];
  for (const sc of subcategories) {
    const total = counts[sc.id] ?? 0;
    if (total <= 0) continue;
    const mix = difficultyMix(mastery[sc.id] ?? 50);
    const splits = splitByRatio(total, mix);
    for (const [difficulty, count] of Object.entries(splits) as [Difficulty, number][]) {
      if (count > 0) targets.push({ subcategory_id: sc.id, difficulty, count });
    }
  }
  return targets;
}

function splitByRatio(
  total: number,
  mix: Record<Difficulty, number>,
): Record<Difficulty, number> {
  const order: Difficulty[] = ["easy", "medium", "hard"];
  const raw = order.map((d) => total * mix[d]);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const fracIdx = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result: Record<Difficulty, number> = { easy: floors[0], medium: floors[1], hard: floors[2] };
  let fi = 0;
  while (remainder > 0 && fi < fracIdx.length) {
    result[order[fracIdx[fi].idx]]++;
    remainder--;
    fi++;
  }
  return result;
}

/** Total calendar days between two ISO dates (inclusive of the start day). */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z").getTime();
  const end = new Date(endDate + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
