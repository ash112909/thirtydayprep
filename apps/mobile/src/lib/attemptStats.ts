import type { AttemptRecord } from "@/api/progress";

export interface DailyAccuracy {
  date: string; // YYYY-MM-DD
  attempted: number;
  correct: number;
  accuracy: number; // 0-100
}

// Buckets attempts by calendar day (UTC) and returns the most recent `limit`
// days that actually had activity, oldest first — feeds the trend sparkline.
export function bucketAttemptsByDay(attempts: AttemptRecord[], limit = 14): DailyAccuracy[] {
  const byDate = new Map<string, { attempted: number; correct: number }>();
  for (const a of attempts) {
    const date = a.attempted_at.slice(0, 10);
    const bucket = byDate.get(date) ?? { attempted: 0, correct: 0 };
    bucket.attempted += 1;
    if (a.is_correct) bucket.correct += 1;
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([date, { attempted, correct }]) => ({
      date,
      attempted,
      correct,
      accuracy: Math.round((correct / attempted) * 100),
    }));
}
