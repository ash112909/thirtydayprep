import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/hooks/useAuth";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { fetchActivePlan, fetchAttempts, fetchPlanDays } from "@/api/progress";
import { computeStreak } from "@/lib/planStats";
import { StudyPet } from "@/components/StudyPet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { StudyPlanDay } from "@/types/domain";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function WrappedRecap() {
  const router = useRouter();
  const { session } = useAuth();
  const { pet } = usePetCompanion();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, alignItems: "center" },
    header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 4, alignSelf: "flex-start" },
    subheader: { fontSize: 13, color: colors.textMuted, marginBottom: 24, alignSelf: "flex-start" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    card: {
      width: 300,
      aspectRatio: 9 / 16,
      borderRadius: 28,
      overflow: "hidden",
      padding: 24,
      justifyContent: "space-between",
    },
    wordmark: { color: "#FFF7ED", fontSize: 12, fontWeight: "800", letterSpacing: 2, opacity: 0.85 },
    petBlock: { alignItems: "center", gap: 10 },
    petAvatarWrap: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    petName: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
    statsBlock: { gap: 14 },
    statRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    statValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
    statLabel: { color: "#FFF7ED", fontSize: 13, fontWeight: "600", opacity: 0.9 },
    footer: { color: "#FFF7ED", fontSize: 11, fontWeight: "700", opacity: 0.75, alignSelf: "center" },
    shareSpacer: { marginTop: 24, width: 300 },
    webNote: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 16, maxWidth: 280 },
  }));

  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [weekAnswered, setWeekAnswered] = useState(0);
  const [weekAccuracy, setWeekAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!session) return;
    Promise.all([fetchActivePlan(session.user.id), fetchAttempts(session.user.id)])
      .then(async ([plan, attempts]) => {
        setDays(plan ? await fetchPlanDays(plan.id) : []);
        const cutoff = Date.now() - WEEK_MS;
        const recent = attempts.filter((a) => new Date(a.attempted_at).getTime() >= cutoff);
        setWeekAnswered(recent.length);
        setWeekAccuracy(recent.length ? Math.round((recent.filter((a) => a.is_correct).length / recent.length) * 100) : null);
      })
      .finally(() => setLoading(false));
  }, [session]);

  const streak = computeStreak(days);

  async function handleShare() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your recap" });
    } catch (e) {
      Alert.alert("Couldn't create the share image", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Your recap</Text>
      <Text style={styles.subheader}>A shareable snapshot of your last 7 days.</Text>

      <View ref={cardRef} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["#FB923C", "#EA580C", "#7C2D12"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Text style={styles.wordmark}>THIRTYDAYPREP</Text>

        <View style={styles.petBlock}>
          <View style={styles.petAvatarWrap}>
            {pet && <StudyPet species={pet.species} energy="energetic" growthStage="grown" size={70} />}
          </View>
          <Text style={styles.petName}>{pet?.name ? `${pet.name}'s check-in` : "Your check-in"}</Text>
        </View>

        <View style={styles.statsBlock}>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{streak > 0 ? `🔥 ${streak}` : "0"}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{weekAnswered}</Text>
            <Text style={styles.statLabel}>questions this week</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{weekAccuracy != null ? `${weekAccuracy}%` : "—"}</Text>
            <Text style={styles.statLabel}>accuracy this week</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>⭐ {pet?.points ?? 0}</Text>
            <Text style={styles.statLabel}>buddy points</Text>
          </View>
        </View>

        <Text style={styles.footer}>studying with my buddy 🐾</Text>
      </View>

      <View style={styles.shareSpacer}>
        {Platform.OS === "web" ? (
          <Text style={styles.webNote}>Open the app on your phone to save or share this as an image.</Text>
        ) : (
          <PrimaryButton title="Share your recap" onPress={handleShare} loading={sharing} />
        )}
        <View style={{ marginTop: 10 }}>
          <PrimaryButton title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </ScrollView>
  );
}
