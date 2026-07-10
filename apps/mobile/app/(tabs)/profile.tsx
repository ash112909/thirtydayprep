import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const remaining = daysUntil(profile?.sat_date ?? null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Row label="Name" value={profile?.full_name ?? "—"} />
        <Row label="Email" value={session?.user.email ?? "—"} />
        <Row label="SAT date" value={profile?.sat_date ?? "Not set"} />
        <Row label="Days remaining" value={remaining != null ? String(remaining) : "—"} />
        <Row label="Daily study time" value={profile?.daily_minutes ? `${profile.daily_minutes} min` : "—"} />
      </View>

      <PrimaryButton title="Log out" onPress={signOut} variant="secondary" />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
});
