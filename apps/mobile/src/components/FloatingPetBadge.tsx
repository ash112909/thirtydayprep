import { Pressable } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { StudyPet } from "@/components/StudyPet";
import { useTheme } from "@/hooks/useTheme";

const BADGE_SIZE = 76;
const AVATAR_SIZE = 56;

// A persistent, tappable version of the study buddy that floats above every
// screen (not just the Buddy tab), so the companion feels like it's actually
// around while you study rather than locked behind a separate mini-game.
export function FloatingPetBadge() {
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const { pet, energy, growthStage, reactionAction, clearReaction } = usePetCompanion();

  const onBuddyTab = segments[segments.length - 1] === "buddy";
  const inTabs = segments[0] === "(tabs)";

  if (!pet || onBuddyTab) return null;

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/buddy")}
      style={{
        position: "absolute",
        right: 16,
        bottom: inTabs ? 78 : 24,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: BADGE_SIZE / 2,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 50,
      }}
    >
      <StudyPet
        species={pet.species}
        energy={energy}
        growthStage={growthStage}
        size={AVATAR_SIZE}
        activeAction={reactionAction}
        onActionComplete={clearReaction}
      />
    </Pressable>
  );
}
