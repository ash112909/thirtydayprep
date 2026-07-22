import { supabase } from "@/lib/supabase";
import type { PetSpecies, StudyPet } from "@/types/domain";

const PET_FIELDS = "user_id, species, color, equipped_accessories";

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
