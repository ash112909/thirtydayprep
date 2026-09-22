import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TrophyIcon } from "@/components/icons";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { fonts } from "@/theme";

export default function MockTestResults() {
  const router = useRouter();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80, alignItems: "center" },
    icon: { marginBottom: 16 },
    title: { fontSize: 15, color: colors.textMuted, marginBottom: 4 },
    total: { fontSize: 56, fontFamily: fonts.display, color: colors.primary, marginBottom: 24 },
    sectionRow: { flexDirection: "row", gap: 12, marginBottom: 48, width: "100%" },
    sectionBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 18,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionValue: { fontSize: 26, fontFamily: fonts.displaySemibold, color: colors.text },
    sectionLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" },
    buttons: { gap: 12, width: "100%" },
  }));
  const { rw, math, total } = useLocalSearchParams<{ rw: string; math: string; total: string }>();

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <TrophyIcon size={40} color={colors.primary} />
      </View>
      <Text style={styles.title}>Your mock test score</Text>
      <Text style={styles.total}>{total || "—"}</Text>
      <View style={styles.sectionRow}>
        <View style={styles.sectionBox}>
          <Text style={styles.sectionValue}>{rw || "—"}</Text>
          <Text style={styles.sectionLabel}>Reading & Writing</Text>
        </View>
        <View style={styles.sectionBox}>
          <Text style={styles.sectionValue}>{math || "—"}</Text>
          <Text style={styles.sectionLabel}>Math</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <PrimaryButton title="Back to mock tests" onPress={() => router.replace("/(tabs)/mock-test")} />
        <PrimaryButton title="Back home" variant="secondary" onPress={() => router.replace("/(tabs)/home")} />
      </View>
    </View>
  );
}
