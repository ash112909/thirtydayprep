// Picks concrete question rows to satisfy a set of DayTargets, preferring
// questions the student hasn't seen before. Lives separately from
// planEngine.ts because it talks to the database; planEngine stays pure.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { DayTarget } from "./types.ts";

const CANDIDATE_POOL_SIZE = 60;

export async function selectQuestionsForTargets(
  supabase: SupabaseClient,
  userId: string,
  targets: DayTarget[],
): Promise<string[]> {
  const { data: attempted, error: attemptedErr } = await supabase
    .from("question_attempts")
    .select("question_id")
    .eq("user_id", userId);
  if (attemptedErr) throw attemptedErr;
  const seen = new Set((attempted ?? []).map((r) => r.question_id as string));

  const selected: string[] = [];

  for (const target of targets) {
    const { data: candidates, error } = await supabase
      .from("questions")
      .select("id")
      .eq("subcategory_id", target.subcategory_id)
      .eq("difficulty", target.difficulty)
      .eq("active", true)
      .limit(CANDIDATE_POOL_SIZE);
    if (error) throw error;

    const ids = (candidates ?? []).map((c) => c.id as string);
    const unseen = shuffle(ids.filter((id) => !seen.has(id) && !selected.includes(id)));
    const rest = shuffle(ids.filter((id) => seen.has(id) && !selected.includes(id)));
    const pick = [...unseen, ...rest].slice(0, target.count);
    selected.push(...pick);
  }

  return selected;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
