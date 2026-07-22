import { computeLongestStreak, computeOverallAccuracy } from "@/lib/planStats";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  achieved: boolean;
}

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
    },
    {
      id: "week-streak",
      title: "One Week In",
      description: "Complete 7 days in a row.",
      icon: "🔥",
      achieved: longestStreak >= 7,
    },
    {
      id: "two-week-streak",
      title: "Two Weeks Strong",
      description: "Complete 14 days in a row.",
      icon: "🔥",
      achieved: longestStreak >= 14,
    },
    {
      id: "halfway",
      title: "Halfway There",
      description: "Reach the midpoint of your plan.",
      icon: "🚩",
      achieved: !!plan && completedDays >= Math.ceil(plan.total_days / 2),
    },
    {
      id: "plan-complete",
      title: "Plan Complete",
      description: "Finish every day of your study plan.",
      icon: "🎉",
      achieved: !!plan && completedDays >= plan.total_days,
    },
    {
      id: "century",
      title: "Century Club",
      description: "Answer 100 questions.",
      icon: "💯",
      achieved: totalAnswered >= 100,
    },
    {
      id: "sharpshooter",
      title: "Sharpshooter",
      description: "Hit 90% overall accuracy.",
      icon: "🎯",
      achieved: accuracy != null && accuracy >= 90,
    },
    {
      id: "no-stone-unturned",
      title: "No Stone Unturned",
      description: "Practice every subcategory at least once.",
      icon: "🗺️",
      achieved: touchedAll,
    },
  ];
}
