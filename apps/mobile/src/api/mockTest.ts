import { supabase } from "@/lib/supabase";
import type { MockTestSummary } from "@/types/domain";

export async function fetchMockTestHistory(userId: string): Promise<MockTestSummary[]> {
  const { data, error } = await supabase
    .from("mock_tests")
    .select("id, started_at, completed_at, total_questions, rw_scaled, math_scaled, total_scaled")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MockTestSummary[];
}
