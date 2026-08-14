import { supabase } from "@/lib/supabase";
import { QUESTION_FIELDS, type QuestionDetail } from "@/api/mistakes";

const PRACTICE_SET_SIZE = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// On-demand practice for a single subcategory, picked by the student rather
// than assigned by the daily plan. Pulls every question in that subcategory
// and hands back a shuffled slice — subcategory question banks are small
// enough that filtering/randomizing client-side is simpler than a dedicated
// edge function.
export async function fetchPracticeQuestions(subcategoryId: string): Promise<QuestionDetail[]> {
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_FIELDS)
    .eq("subcategory_id", subcategoryId);
  if (error) throw error;
  return shuffle((data ?? []) as QuestionDetail[]).slice(0, PRACTICE_SET_SIZE);
}
