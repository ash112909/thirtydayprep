import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { updateStudyGoals } from "@/api/profile";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { fetchClaimedAchievementIds } from "@/api/achievements";
import { claimAchievement, regeneratePlan } from "@/api/studyFunctions";
import { computeAchievements, type Achievement } from "@/lib/achievements";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { refresh: refreshPetCompanion } = usePetCompanion();
  const { mode, toggleTheme } = useTheme();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
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
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { color: colors.textMuted, fontSize: 14 },
    rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
    editButtonSpacer: { marginTop: 16 },
    cancelSpacer: { marginTop: 10 },
    label: { color: colors.text, marginBottom: 8, fontWeight: "600" },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      color: colors.text,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    error: { color: colors.danger, marginBottom: 12 },
    editHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    appearanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    appearanceLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
    appearanceHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    themeToggle: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeOption: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    themeOptionActive: { backgroundColor: colors.primary },
    themeOptionText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    themeOptionTextActive: { color: colors.onPrimary },
    achievementsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    achievementsCount: { fontSize: 13, color: colors.textMuted },
    achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
    badge: {
      width: "47%",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    badgeLocked: { borderColor: colors.border, opacity: 0.5 },
    badgeIcon: { fontSize: 22, marginBottom: 6 },
    badgeTitle: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 2 },
    badgeDescription: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
    badgeClaimed: { color: colors.success, fontSize: 11, fontWeight: "700", marginTop: 8 },
    claimButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: "center",
      marginTop: 8,
    },
    claimButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
    logoutSpacer: { marginTop: 8 },
  }));
  const remaining = daysUntil(profile?.sat_date ?? null);

  const [editing, setEditing] = useState(false);
  const [satDate, setSatDate] = useState(profile?.sat_date ?? "");
  const [dailyMinutes, setDailyMinutes] = useState(String(profile?.daily_minutes ?? ""));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      Promise.all([
        fetchActivePlan(session.user.id),
        fetchSkillStats(session.user.id),
        fetchSubcategories(),
        fetchClaimedAchievementIds(session.user.id),
      ]).then(async ([activePlan, skillStats, subs, claimed]) => {
        if (cancelled) return;
        setPlan(activePlan);
        setStats(skillStats);
        setSubcategories(subs);
        setClaimedIds(claimed);
        if (activePlan) setDays(await fetchPlanDays(activePlan.id));
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  async function handleClaim(achievementId: string, reward: number) {
    setClaimingId(achievementId);
    try {
      const result = await claimAchievement(achievementId);
      setClaimedIds((prev) => new Set(prev).add(achievementId));
      if (!result.already_claimed && result.points_awarded > 0) {
        await refreshPetCompanion();
        Alert.alert("Achievement claimed!", `Your buddy earned +${result.points_awarded} points.`);
      }
    } catch (e) {
      Alert.alert("Couldn't claim achievement", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setClaimingId(null);
    }
  }

  function startEditing() {
    setSatDate(profile?.sat_date ?? "");
    setDailyMinutes(String(profile?.daily_minutes ?? ""));
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!session) return;
    setSaveError(null);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(satDate)) {
      setSaveError("Enter your SAT date as YYYY-MM-DD.");
      return;
    }
    const minutes = parseInt(dailyMinutes, 10);
    if (!minutes || minutes < 10) {
      setSaveError("Enter at least 10 minutes a day.");
      return;
    }
    const goalsChanged = satDate !== profile?.sat_date || minutes !== profile?.daily_minutes;

    setSaving(true);
    try {
      await updateStudyGoals(session.user.id, satDate, minutes);
      await refreshProfile();
      setEditing(false);

      if (goalsChanged && plan) {
        try {
          const result = await regeneratePlan();
          setPlan(await fetchActivePlan(session.user.id));
          Alert.alert(
            "Plan updated",
            `Your plan now runs ${result.total_days} days. Regenerations used: ${result.regenerations_used}/${result.regenerations_allowed}.`,
          );
        } catch (e) {
          Alert.alert(
            "Goals saved, plan unchanged",
            e instanceof Error ? e.message : "Couldn't regenerate your plan.",
          );
        }
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const achievements: Achievement[] = computeAchievements(plan, days, stats, subcategories);
  const achievedCount = achievements.filter((a) => a.achieved).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      {editing ? (
        <View style={styles.card}>
          {plan && (
            <Text style={styles.editHint}>
              Changing either of these will regenerate the rest of your plan (
              {plan.regenerations_allowed - plan.regenerations_used} regeneration
              {plan.regenerations_allowed - plan.regenerations_used === 1 ? "" : "s"} left).
            </Text>
          )}
          <Text style={styles.label}>When is your SAT?</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
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
          {saveError && <Text style={styles.error}>{saveError}</Text>}
          <PrimaryButton title="Save" onPress={handleSave} loading={saving} />
          <View style={styles.cancelSpacer}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Row label="Name" value={profile?.full_name ?? "—"} />
          <Row label="Email" value={session?.user.email ?? "—"} />
          <Row label="SAT date" value={profile?.sat_date ?? "Not set"} />
          <Row label="Days remaining" value={remaining != null ? String(remaining) : "—"} />
          <Row
            label="Daily study time"
            value={profile?.daily_minutes ? `${profile.daily_minutes} min` : "—"}
            last={!plan}
          />
          {plan && (
            <Row
              label="Plan regenerations"
              value={`${plan.regenerations_used}/${plan.regenerations_allowed} used`}
              last
            />
          )}
          <View style={styles.editButtonSpacer}>
            <PrimaryButton title="Edit goals" variant="secondary" onPress={startEditing} />
          </View>
        </View>
      )}

      <View style={styles.appearanceRow}>
        <View>
          <Text style={styles.appearanceLabel}>Appearance</Text>
          <Text style={styles.appearanceHint}>{mode === "dark" ? "Dark" : "Light"} mode</Text>
        </View>
        <View style={styles.themeToggle}>
          <Pressable
            style={[styles.themeOption, mode === "dark" && styles.themeOptionActive]}
            onPress={() => mode !== "dark" && toggleTheme()}
          >
            <Text style={[styles.themeOptionText, mode === "dark" && styles.themeOptionTextActive]}>Dark</Text>
          </Pressable>
          <Pressable
            style={[styles.themeOption, mode === "light" && styles.themeOptionActive]}
            onPress={() => mode !== "light" && toggleTheme()}
          >
            <Text style={[styles.themeOptionText, mode === "light" && styles.themeOptionTextActive]}>Light</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.achievementsHeader}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text style={styles.achievementsCount}>
          {achievedCount}/{achievements.length}
        </Text>
      </View>
      <View style={styles.achievementsGrid}>
        {achievements.map((a) => {
          const claimed = claimedIds.has(a.id);
          return (
            <View key={a.id} style={[styles.badge, !a.achieved && styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>{a.icon}</Text>
              <Text style={styles.badgeTitle}>{a.title}</Text>
              <Text style={styles.badgeDescription}>{a.description}</Text>
              {a.achieved && claimed && <Text style={styles.badgeClaimed}>✓ +{a.reward} claimed</Text>}
              {a.achieved && !claimed && (
                <Pressable style={styles.claimButton} onPress={() => handleClaim(a.id, a.reward)} disabled={claimingId === a.id}>
                  <Text style={styles.claimButtonText}>
                    {claimingId === a.id ? "Claiming…" : `Claim +${a.reward} ⭐`}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.logoutSpacer}>
        <PrimaryButton title="Log out" onPress={signOut} variant="secondary" />
      </View>
    </ScrollView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { styles } = useThemedStyles((colors) => ({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { color: colors.textMuted, fontSize: 14 },
    rowValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  }));
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
