import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { completeOnboarding } from "@/api/profile";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";

function todayPlusMinDays(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const router = useRouter();
  const [satDate, setSatDate] = useState(""); // YYYY-MM-DD
  const [dailyMinutes, setDailyMinutes] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setError(null);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(satDate)) {
      setError("Enter your SAT date as YYYY-MM-DD.");
      return;
    }
    if (satDate <= new Date().toISOString().slice(0, 10)) {
      setError("Your SAT date needs to be in the future.");
      return;
    }
    const minutes = parseInt(dailyMinutes, 10);
    if (!minutes || minutes < 10) {
      setError("Enter at least 10 minutes a day.");
      return;
    }
    if (!session) return;

    setLoading(true);
    try {
      await completeOnboarding(session.user.id, satDate, minutes);
      await refreshProfile();
      router.replace("/baseline/intro");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Let's build your plan</Text>
      <Text style={styles.subtitle}>
        We use your test date and available time each day to size your daily sessions.
      </Text>

      <Text style={styles.label}>When is your SAT?</Text>
      <TextInput
        style={styles.input}
        placeholder={`e.g. ${todayPlusMinDays()}`}
        placeholderTextColor={colors.textMuted}
        value={satDate}
        onChangeText={setSatDate}
      />

      <Text style={styles.label}>Minutes you can study per day</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={dailyMinutes}
        onChangeText={setDailyMinutes}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton title="Continue to baseline test" onPress={handleContinue} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 28, lineHeight: 20 },
  label: { color: colors.text, marginBottom: 8, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, marginBottom: 12 },
});
