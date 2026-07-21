import type { StudyPlanDay, UserSkillStat } from "@/types/domain";

// Consecutive completed days counting back from the most recent day in the
// plan, so a student who's caught up sees a real "streak" rather than just
// a raw completed-day count.
export function computeStreak(days: StudyPlanDay[]): number {
  const sorted = [...days].sort((a, b) => b.day_number - a.day_number);
  let streak = 0;
  for (const day of sorted) {
    if (day.status !== "completed") {
      if (day.status === "available" || day.status === "locked") continue;
      break;
    }
    streak += 1;
  }
  return streak;
}

export function computeOverallAccuracy(stats: UserSkillStat[]): number | null {
  const attempted = stats.reduce((sum, s) => sum + s.questions_attempted, 0);
  if (attempted === 0) return null;
  const correct = stats.reduce((sum, s) => sum + s.questions_correct, 0);
  return Math.round((correct / attempted) * 100);
}
