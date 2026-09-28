import { supabase } from "@/lib/supabase";
import type { Category, Choice, Difficulty, QuestionType, Subcategory } from "@/types/domain";

// QA tool: lets a human page through the entire question bank one by one,
// rendered with the exact same components the real quiz screens use
// (QuestionCard / GridInAnswer / PassageText / StemText), rather than
// reading raw rows in the Supabase table editor.

export interface QuestionIndexEntry {
  id: string;
  external_id: string | null;
}

export interface QuestionBrowserDetail {
  id: string;
  external_id: string | null;
  category_id: string;
  subcategory_id: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  skill_tag: string | null;
  stem: string;
  passage: string | null;
  passage_underline_start: number | null;
  passage_underline_end: number | null;
  choices: Choice[] | null;
  correct_choice: string | null;
  correct_value: string | null;
  explanation: string | null;
  avg_seconds: number;
  calculator_allowed: boolean | null;
}

const PAGE_SIZE = 1000;

// The full bank is ~14k rows — too many for one request (PostgREST caps a
// single response), so this pages through with .range() once up front.
// Ordered by external_id, which groups questions by skill/source set
// (e.g. all "Circles_..." together), making a systematic read-through
// sensible.
export async function fetchQuestionIndex(): Promise<QuestionIndexEntry[]> {
  const all: QuestionIndexEntry[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, external_id")
      .order("external_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as QuestionIndexEntry[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function fetchQuestionDetail(id: string): Promise<QuestionBrowserDetail | null> {
  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, external_id, category_id, subcategory_id, difficulty, question_type, skill_tag, stem, passage, passage_underline_start, passage_underline_end, choices, correct_choice, correct_value, explanation, avg_seconds, calculator_allowed",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as QuestionBrowserDetail | null;
}

export async function fetchAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("id, slug, name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchAllSubcategories(): Promise<Subcategory[]> {
  const { data, error } = await supabase.from("subcategories").select("id, category_id, slug, name");
  if (error) throw error;
  return (data ?? []) as Subcategory[];
}
