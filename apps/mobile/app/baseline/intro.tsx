import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";

export default function BaselineIntro() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Baseline check-in</Text>
      <Text style={styles.body}>
        24 questions covering every SAT topic — Reading &amp; Writing and Math, easy through hard. There's
        no time pressure; answer as you normally would. This tells us exactly where to focus your plan.
      </Text>
      <View style={styles.stats}>
        <Stat label="Questions" value="24" />
        <Stat label="Est. time" value="20-30 min" />
        <Stat label="Topics" value="8" />
      </View>
      <PrimaryButton title="Start baseline test" onPress={() => router.push("/baseline/test")} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 12 },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: 32 },
  stats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
