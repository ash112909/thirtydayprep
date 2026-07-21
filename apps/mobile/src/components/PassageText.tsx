import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

interface Props {
  passage: string;
  underlineStart?: number | null;
  underlineEnd?: number | null;
}

export function PassageText({ passage, underlineStart, underlineEnd }: Props) {
  const hasUnderline =
    underlineStart != null &&
    underlineEnd != null &&
    underlineStart >= 0 &&
    underlineEnd > underlineStart &&
    underlineEnd <= passage.length;

  return (
    <View style={styles.box}>
      {hasUnderline ? (
        <Text style={styles.text}>
          {passage.slice(0, underlineStart)}
          <Text style={styles.underlined}>{passage.slice(underlineStart, underlineEnd)}</Text>
          {passage.slice(underlineEnd)}
        </Text>
      ) : (
        <Text style={styles.text}>{passage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  underlined: { textDecorationLine: "underline", color: colors.text, fontWeight: "600" },
});
