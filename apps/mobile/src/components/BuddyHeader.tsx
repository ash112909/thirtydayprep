import { Text, View } from "react-native";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { StudyPet } from "@/components/StudyPet";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { fonts } from "@/theme";

interface Props {
  line: string;
}

// The small, persistent version of the buddy that rides along on screens
// other than Home — a reactive line instead of a plain section title, so
// the character doesn't disappear the moment you leave the hub.
export function BuddyHeader({ line }: Props) {
  const { pet, energy, growthStage } = usePetCompanion();
  const { styles } = useThemedStyles((colors) => ({
    row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
    avatarWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    bubble: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: { color: colors.text, fontSize: 12, lineHeight: 17, fontFamily: fonts.bodyBold },
  }));

  if (!pet) return null;

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        <StudyPet species={pet.species} energy={energy} growthStage={growthStage} size={30} />
      </View>
      <View style={styles.bubble}>
        <Text style={styles.text}>{line}</Text>
      </View>
    </View>
  );
}
