import { supabase } from "@/lib/supabase";
import { computeStreak } from "@/lib/planStats";
import type { PetSpecies, StudyPlanDay } from "@/types/domain";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud/type

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

// Every user gets one stable, shareable code (not a one-time invite) —
// created lazily the first time the Friends screen is opened.
export async function fetchOrCreateFriendCode(userId: string): Promise<string> {
  const { data: existing, error } = await supabase.from("friend_codes").select("code").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error: insertErr } = await supabase.from("friend_codes").insert({ user_id: userId, code });
    if (!insertErr) return code;
    if (insertErr.code !== "23505") throw insertErr; // anything but a unique-code collision is unexpected
  }
  throw new Error("Couldn't generate a unique friend code — try again.");
}

export async function redeemFriendCode(userId: string, code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  const { data: owner, error } = await supabase.from("friend_codes").select("user_id").eq("code", normalized).maybeSingle();
  if (error) throw error;
  if (!owner) throw new Error("That code doesn't match anyone.");
  if (owner.user_id === userId) throw new Error("That's your own code.");

  const { error: insertErr } = await supabase.from("friendships").insert({ user_id: userId, friend_id: owner.user_id });
  if (insertErr && insertErr.code !== "23505") throw insertErr; // 23505 = already friends, treat as success
}

export interface FriendSummary {
  userId: string;
  petName: string | null;
  species: PetSpecies;
  points: number;
  streak: number;
}

export async function fetchFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw error;
  return (data ?? []).map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  if (error) throw error;
}

// One round-trip per friend (pet + active plan + that plan's days) —
// friend lists here are small, so N+1 is simpler than a joined view.
export async function fetchFriendSummaries(friendIds: string[]): Promise<FriendSummary[]> {
  const summaries = await Promise.all(
    friendIds.map(async (friendId): Promise<FriendSummary> => {
      const { data: pet } = await supabase
        .from("study_pets")
        .select("name, species, points")
        .eq("user_id", friendId)
        .maybeSingle();
      const { data: plan } = await supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", friendId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let days: Pick<StudyPlanDay, "day_number" | "status">[] = [];
      if (plan) {
        const { data: planDays } = await supabase
          .from("study_plan_days")
          .select("day_number, status")
          .eq("study_plan_id", plan.id);
        days = planDays ?? [];
      }

      return {
        userId: friendId,
        petName: pet?.name ?? null,
        species: pet?.species ?? "cat",
        points: pet?.points ?? 0,
        streak: computeStreak(days),
      };
    }),
  );
  return summaries.sort((a, b) => b.streak - a.streak || b.points - a.points);
}
