import { supabase } from "@/lib/supabase";
import type { PetSpecies, StudyPet } from "@/types/domain";

const PET_FIELDS = "user_id, species, color, equipped_accessories, points";

export async function fetchPet(userId: string): Promise<StudyPet | null> {
  const { data, error } = await supabase.from("study_pets").select(PET_FIELDS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as StudyPet | null;
}

export async function createPet(userId: string, species: PetSpecies, color: string): Promise<StudyPet> {
  const { data, error } = await supabase
    .from("study_pets")
    .insert({ user_id: userId, species, color, equipped_accessories: [] })
    .select(PET_FIELDS)
    .single();
  if (error) throw error;
  return data as StudyPet;
}

export async function updatePetColor(userId: string, color: string): Promise<void> {
  const { error } = await supabase.from("study_pets").update({ color }).eq("user_id", userId);
  if (error) throw error;
}

export async function updatePetAccessories(userId: string, accessories: string[]): Promise<void> {
  const { error } = await supabase
    .from("study_pets")
    .update({ equipped_accessories: accessories })
    .eq("user_id", userId);
  if (error) throw error;
}

// Points are only ever *earned* server-side (submit-attempt, on day
// completion) — this setter is for spending them (purchases), which is
// low-stakes enough (cosmetic, single-player) to go through ordinary
// client RLS like the rest of this file.
export async function setPetPoints(userId: string, points: number): Promise<void> {
  const { error } = await supabase.from("study_pets").update({ points }).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchInventory(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("pet_inventory").select("item_id, quantity").eq("user_id", userId);
  if (error) throw error;
  const inventory: Record<string, number> = {};
  for (const row of data ?? []) inventory[row.item_id] = row.quantity;
  return inventory;
}

export async function setItemQuantity(userId: string, itemId: string, quantity: number): Promise<void> {
  const { error } = await supabase
    .from("pet_inventory")
    .upsert(
      { user_id: userId, item_id: itemId, quantity, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" },
    );
  if (error) throw error;
}
