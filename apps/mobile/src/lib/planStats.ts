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

// Longest run of completed days anywhere in the plan (not just the current
// tail) — used for streak-milestone achievements.
export function computeLongestStreak(days: StudyPlanDay[]): number {
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
  let longest = 0;
  let current = 0;
  for (const day of sorted) {
    if (day.status === "completed") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}
