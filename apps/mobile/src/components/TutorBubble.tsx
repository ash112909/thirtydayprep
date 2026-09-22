import { Text, View } from "react-native";
import { StudyPet } from "@/components/StudyPet";
import { StarIcon } from "@/components/icons";
import { useTheme } from "@/hooks/useTheme";
import { fonts } from "@/theme";
import type { PetSpecies } from "@/types/domain";

const AVATAR_CHIP_SIZE = 48;
const AVATAR_SIZE = 36;

interface Props {
  species: PetSpecies;
  isCorrect: boolean;
  line: string;
  explanation: string | null;
  pointsAwarded?: number;
}

// Frames the answer explanation as the buddy talking you through it, rather
// than a plain feedback box — same visual language (avatar chip) as the
// buddy hub on Home, so it reads as the same character showing up here too.
export function TutorBubble({ species, isCorrect, line, explanation, pointsAwarded = 0 }: Props) {
  const { colors } = useTheme();
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
      <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 18, padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontSize: 13, fontFamily: fonts.bodyBold, flexShrink: 1 }}>{line}</Text>
          {pointsAwarded > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.background,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                marginLeft: 8,
              }}
            >
              <StarIcon size={11} color={colors.warning} />
              <Text style={{ color: colors.warning, fontSize: 12, fontFamily: fonts.bodyExtraBold }}>+{pointsAwarded}</Text>
            </View>
          )}
        </View>
        {explanation && (
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{explanation}</Text>
        )}
      </View>
    </View>
  );
}
