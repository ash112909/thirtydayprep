import { Text, View } from "react-native";
import { StudyPet } from "@/components/StudyPet";
import { colors } from "@/theme";
import type { PetSpecies } from "@/types/domain";

const AVATAR_CHIP_SIZE = 48;
const AVATAR_SIZE = 36;

interface Props {
  species: PetSpecies;
  isCorrect: boolean;
  line: string;
  explanation: string | null;
}

// Frames the answer explanation as the buddy talking you through it, rather
// than a plain feedback box — same visual language (avatar chip) as the
// FloatingPetBadge, so it reads as the same character showing up here too.
export function TutorBubble({ species, isCorrect, line, explanation }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 16, marginBottom: 8 }}>
      <View
        style={{
          width: AVATAR_CHIP_SIZE,
          height: AVATAR_CHIP_SIZE,
          borderRadius: AVATAR_CHIP_SIZE / 2,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 2,
          borderColor: isCorrect ? colors.primary : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StudyPet species={species} energy="calm" growthStage="grown" size={AVATAR_SIZE} />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: explanation ? 6 : 0 }}>
          {line}
        </Text>
        {explanation && <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>{explanation}</Text>}
      </View>
    </View>
  );
}
