import { computeLongestStreak, computeOverallAccuracy } from "@/lib/planStats";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  achieved: boolean;
  reward: number; // study-buddy points paid out the first time it's claimed
}

// Mirrored server-side in supabase/functions/_shared/achievements.ts (hand-
// kept in sync, same pattern as the rest of this project's client/edge-
// function types) — the edge function re-verifies achievement + reward
// independently rather than trusting whatever the client sends, since a
// claim pays out real points.
export const REWARD_POINTS: Record<string, number> = {
  "first-day": 20,
  "week-streak": 30,
  "two-week-streak": 50,
  halfway: 30,
  "plan-complete": 75,
  century: 25,
  sharpshooter: 35,
  "no-stone-unturned": 25,
};

export function computeAchievements(
  plan: StudyPlan | null,
  days: StudyPlanDay[],
  stats: UserSkillStat[],
  subcategories: Subcategory[],
): Achievement[] {
  const completedDays = days.filter((d) => d.status === "completed").length;
  const longestStreak = computeLongestStreak(days);
  const totalAnswered = stats.reduce((sum, s) => sum + s.questions_attempted, 0);
  const accuracy = computeOverallAccuracy(stats);
  const touchedAll =
    subcategories.length > 0 &&
    subcategories.every((sc) => (stats.find((s) => s.subcategory_id === sc.id)?.questions_attempted ?? 0) > 0);

  return [
    {
      id: "first-day",
      title: "First Steps",
      description: "Complete your first day of practice.",
      icon: "🌱",
      achieved: completedDays >= 1,
      reward: REWARD_POINTS["first-day"],
    },
    {
      id: "week-streak",
      title: "One Week In",
      description: "Complete 7 days in a row.",
      icon: "🔥",
      achieved: longestStreak >= 7,
      reward: REWARD_POINTS["week-streak"],
    },
    {
      id: "two-week-streak",
      title: "Two Weeks Strong",
      description: "Complete 14 days in a row.",
      icon: "🔥",
      achieved: longestStreak >= 14,
      reward: REWARD_POINTS["two-week-streak"],
    },
    {
      id: "halfway",
      title: "Halfway There",
      description: "Reach the midpoint of your plan.",
      icon: "🚩",
      achieved: !!plan && completedDays >= Math.ceil(plan.total_days / 2),
      reward: REWARD_POINTS.halfway,
    },
    {
      id: "plan-complete",
      title: "Plan Complete",
      description: "Finish every day of your study plan.",
      icon: "🎉",
      achieved: !!plan && completedDays >= plan.total_days,
      reward: REWARD_POINTS["plan-complete"],
    },
    {
      id: "century",
      title: "Century Club",
      description: "Answer 100 questions.",
      icon: "💯",
      achieved: totalAnswered >= 100,
      reward: REWARD_POINTS.century,
    },
    {
      id: "sharpshooter",
      title: "Sharpshooter",
      description: "Hit 90% overall accuracy.",
      icon: "🎯",
      achieved: accuracy != null && accuracy >= 90,
      reward: REWARD_POINTS.sharpshooter,
    },
    {
      id: "no-stone-unturned",
      title: "No Stone Unturned",
      description: "Practice every subcategory at least once.",
      icon: "🗺️",
      achieved: touchedAll,
      reward: REWARD_POINTS["no-stone-unturned"],
    },
  ];
}
