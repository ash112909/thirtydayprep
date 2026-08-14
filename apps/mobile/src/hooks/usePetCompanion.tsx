import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays } from "@/api/progress";
import { fetchPet } from "@/api/pet";
import { computeGrowthStage, computePetEnergy, type Energy, type GrowthStage } from "@/lib/petState";
import type { PetAction } from "@/components/StudyPet";
import type { StudyPet as StudyPetData } from "@/types/domain";

interface PetCompanionContextValue {
  pet: StudyPetData | null;
  energy: Energy;
  growthStage: GrowthStage;
  loading: boolean;
  // Re-fetches pet + plan progress from the server. Screens that mutate pet
  // state locally (species switch, points spend, day completion) call this
  // afterward so the floating companion elsewhere in the app stays in sync,
  // without those screens needing to know the companion exists.
  refresh: () => Promise<void>;
  reactionAction: PetAction | null;
  celebrate: (action: PetAction) => void;
  clearReaction: () => void;
}

const PetCompanionContext = createContext<PetCompanionContextValue | undefined>(undefined);

export function PetCompanionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [pet, setPet] = useState<StudyPetData | null>(null);
  const [energy, setEnergy] = useState<Energy>("calm");
  const [growthStage, setGrowthStage] = useState<GrowthStage>("hatchling");
  const [loading, setLoading] = useState(true);
  const [reactionAction, setReactionAction] = useState<PetAction | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setPet(null);
      setLoading(false);
      return;
    }
    try {
      const [petData, activePlan] = await Promise.all([fetchPet(session.user.id), fetchActivePlan(session.user.id)]);
      const days = activePlan ? await fetchPlanDays(activePlan.id) : [];
      setPet(petData);
      setEnergy(computePetEnergy(days));
      setGrowthStage(computeGrowthStage(days.filter((d) => d.status === "completed").length, activePlan?.total_days ?? 0));
    } catch (err) {
      // The companion is decorative — a fetch failure here (e.g. a pending
      // migration) shouldn't break the rest of the app. Log it and just
      // leave the badge hidden (pet stays whatever it last was) rather than
      // getting stuck in a permanent loading state.
      console.error("PetCompanionProvider refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const celebrate = useCallback((action: PetAction) => setReactionAction(action), []);
  const clearReaction = useCallback(() => setReactionAction(null), []);

  return (
    <PetCompanionContext.Provider
      value={{ pet, energy, growthStage, loading, refresh, reactionAction, celebrate, clearReaction }}
    >
      {children}
    </PetCompanionContext.Provider>
  );
}

export function usePetCompanion(): PetCompanionContextValue {
  const ctx = useContext(PetCompanionContext);
  if (!ctx) throw new Error("usePetCompanion must be used within a PetCompanionProvider");
  return ctx;
}
