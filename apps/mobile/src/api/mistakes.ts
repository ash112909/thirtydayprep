import { supabase } from "@/lib/supabase";
import type { Choice, Difficulty, QuestionType } from "@/types/domain";

export interface QuestionDetail {
  id: string;
  category_id: string;
  subcategory_id: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  stem: string;
  passage: string | null;
  passage_underline_start: number | null;
  passage_underline_end: number | null;
  choices: Choice[] | null;
  correct_choice: string | null;
  correct_value: string | null;
  explanation: string | null;
}

export interface MistakeQuestion extends QuestionDetail {
  attempts: number;
  last_attempted_at: string;
}

export const QUESTION_FIELDS =
  "id, category_id, subcategory_id, difficulty, question_type, stem, passage, passage_underline_start, passage_underline_end, choices, correct_choice, correct_value, explanation";

// A question belongs in the Mistake Bank if the student's most recent
// attempt at it (of any source — baseline, daily, or a prior review) was
// wrong. No separate "resolved" flag to maintain: once they answer it
// right, its most recent attempt flips and it drops out on its own.
export async function fetchMistakes(userId: string): Promise<MistakeQuestion[]> {
  const { data: attempts, error } = await supabase
    .from("question_attempts")
    .select("question_id, is_correct, attempted_at")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: true });
  if (error) throw error;

  const byQuestion = new Map<string, { lastCorrect: boolean; lastAt: string; attempts: number }>();
  for (const a of attempts ?? []) {
    const existing = byQuestion.get(a.question_id);
    byQuestion.set(a.question_id, {
      lastCorrect: a.is_correct,
      lastAt: a.attempted_at,
      attempts: (existing?.attempts ?? 0) + 1,
    });
  }

  const missedIds = [...byQuestion.entries()].filter(([, v]) => !v.lastCorrect).map(([id]) => id);
  if (!missedIds.length) return [];

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select(QUESTION_FIELDS)
    .in("id", missedIds);
  if (qErr) throw qErr;

  return (questions ?? [])
    .map((q) => {
      const info = byQuestion.get(q.id)!;
      return { ...(q as QuestionDetail), attempts: info.attempts, last_attempted_at: info.lastAt };
    })
    .sort((a, b) => b.last_attempted_at.localeCompare(a.last_attempted_at));
}

export async function fetchQuestionById(id: string): Promise<QuestionDetail | null> {
  const { data, error } = await supabase.from("questions").select(QUESTION_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as QuestionDetail | null;
}
