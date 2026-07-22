// The pet's state is deliberately split in two: energy reflects whether
// you're *showing up* (streak, recency), growth reflects *progress through
// the plan*. Neither is driven by accuracy — a wrong answer shouldn't make
// the pet look sad. It should feel like a tutor, not a scoreboard.

import { computeStreak } from "@/lib/planStats";
import type { StudyPlanDay } from "@/types/domain";

export type Energy = "sleepy" | "calm" | "energetic";
export type GrowthStage = "hatchling" | "adolescent" | "grown";

export function computePetEnergy(days: StudyPlanDay[]): Energy {
  const streak = computeStreak(days);
  if (streak >= 3) return "energetic";

  const completed = days.filter((d) => d.status === "completed" && d.completed_at);
  if (!completed.length) return "sleepy";

  const lastCompletedAt = completed.reduce(
    (latest, d) => (d.completed_at! > latest ? d.completed_at! : latest),
    completed[0].completed_at!,
  );
  const daysSinceLastStudy = (Date.now() - new Date(lastCompletedAt).getTime()) / 86_400_000;
  return daysSinceLastStudy <= 1.5 ? "calm" : "sleepy";
}

export function computeGrowthStage(completedDays: number, totalDays: number): GrowthStage {
  if (totalDays <= 0) return "hatchling";
  const ratio = completedDays / totalDays;
  if (ratio >= 0.9) return "grown";
  if (ratio >= 0.4) return "adolescent";
  return "hatchling";
}
