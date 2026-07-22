import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { createPet, fetchPet, updatePetAccessories, updatePetColor } from "@/api/pet";
import { computeAchievements } from "@/lib/achievements";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { computeGrowthStage, computePetEnergy } from "@/lib/petState";
import { ACCESSORIES } from "@/lib/accessories";
import { StudyPet } from "@/components/StudyPet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { PetSpecies, StudyPet as StudyPetData, StudyPlan, StudyPlanDay, Subcategory, UserSkillStat } from "@/types/domain";

const COLOR_OPTIONS = ["#F59E0B", "#38BDF8", "#F472B6", "#4ADE80", "#A78BFA", "#FB923C"];

export default function BuddyScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<StudyPetData | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [pickerSpecies, setPickerSpecies] = useState<PetSpecies>("cat");
  const [pickerColor, setPickerColor] = useState(COLOR_OPTIONS[0]);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const [petData, activePlan, skillStats, subs] = await Promise.all([
          fetchPet(session.user.id),
          fetchActivePlan(session.user.id),
          fetchSkillStats(session.user.id),
          fetchSubcategories(),
        ]);
        if (cancelled) return;
        setPet(petData);
        setPlan(activePlan);
        setStats(skillStats);
        setSubcategories(subs);
        setDays(activePlan ? await fetchPlanDays(activePlan.id) : []);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  async function handleCreatePet() {
    if (!session) return;
    setCreating(true);
    try {
      const created = await createPet(session.user.id, pickerSpecies, pickerColor);
      setPet(created);
    } finally {
      setCreating(false);
    }
  }

  async function handleChangeColor(color: string) {
    if (!session || !pet) return;
    setPet({ ...pet, color });
    await updatePetColor(session.user.id, color);
  }

  async function toggleAccessory(id: string) {
    if (!session || !pet) return;
    const has = pet.equipped_accessories.includes(id);
    const next = has ? pet.equipped_accessories.filter((a) => a !== id) : [...pet.equipped_accessories, id];
    setPet({ ...pet, equipped_accessories: next });
    await updatePetAccessories(session.user.id, next);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!pet) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>Pick your study buddy</Text>
        <Text style={styles.subtitle}>They'll grow alongside your prep — no separate grinding, just show up.</Text>

        <View style={styles.speciesRow}>
          <Pressable
            style={[styles.speciesButton, pickerSpecies === "cat" && styles.speciesButtonActive]}
            onPress={() => setPickerSpecies("cat")}
          >
            <Text style={styles.speciesEmoji}>🐱</Text>
            <Text style={styles.speciesLabel}>Cat</Text>
          </Pressable>
          <Pressable
            style={[styles.speciesButton, pickerSpecies === "dog" && styles.speciesButtonActive]}
            onPress={() => setPickerSpecies("dog")}
          >
            <Text style={styles.speciesEmoji}>🐶</Text>
            <Text style={styles.speciesLabel}>Dog</Text>
          </Pressable>
        </View>

        <StudyPet
          species={pickerSpecies}
          color={pickerColor}
          energy="calm"
          growthStage="hatchling"
          equippedAccessories={[]}
          size={180}
        />

        <View style={styles.colorRow}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable
              key={c}
              style={[styles.colorSwatch, { backgroundColor: c }, pickerColor === c && styles.colorSwatchActive]}
              onPress={() => setPickerColor(c)}
            />
          ))}
        </View>

        <PrimaryButton title="This is my buddy" onPress={handleCreatePet} loading={creating} />
      </ScrollView>
    );
  }

  const streak = computeStreak(days);
  const completedDays = days.filter((d) => d.status === "completed").length;
  const accuracy = computeOverallAccuracy(stats);
  const energy = computePetEnergy(days);
  const growthStage = computeGrowthStage(completedDays, plan?.total_days ?? 0);
  const achievements = computeAchievements(plan, days, stats, subcategories);
  const achievedIds = new Set(achievements.filter((a) => a.achieved).map((a) => a.id));

  const energyLabel = energy === "energetic" ? "Full of energy!" : energy === "calm" ? "Doing alright" : "Waiting for you";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your study buddy</Text>
      <Text style={styles.energyLabel}>{energyLabel}</Text>

      <View style={styles.petWrap}>
        <StudyPet
          species={pet.species}
          color={pet.color}
          energy={energy}
          growthStage={growthStage}
          equippedAccessories={pet.equipped_accessories}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{streak > 0 ? `🔥 ${streak}` : "—"}</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{completedDays}</Text>
          <Text style={styles.statLabel}>days done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{accuracy != null ? `${accuracy}%` : "—"}</Text>
          <Text style={styles.statLabel}>accuracy</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Color</Text>
      <View style={styles.colorRow}>
        {COLOR_OPTIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.colorSwatch, { backgroundColor: c }, pet.color === c && styles.colorSwatchActive]}
            onPress={() => handleChangeColor(c)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Accessories</Text>
      <View style={styles.accessoryGrid}>
        {ACCESSORIES.map((a) => {
          const unlocked = achievedIds.has(a.achievementId);
          const equipped = pet.equipped_accessories.includes(a.id);
          return (
            <Pressable
              key={a.id}
              disabled={!unlocked}
              onPress={() => toggleAccessory(a.id)}
              style={[styles.accessoryCard, equipped && styles.accessoryCardEquipped, !unlocked && styles.accessoryCardLocked]}
            >
              <Text style={styles.accessoryIcon}>{unlocked ? a.icon : "🔒"}</Text>
              <Text style={styles.accessoryName}>{a.name}</Text>
              {equipped && <Text style={styles.accessoryEquippedTag}>Equipped</Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  pickerContent: { padding: 24, paddingTop: 60, paddingBottom: 40, alignItems: "center", gap: 16 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 8 },
  energyLabel: { fontSize: 13, color: colors.primary, fontWeight: "600", marginBottom: 12 },
  petWrap: { marginBottom: 20 },
  speciesRow: { flexDirection: "row", gap: 12 },
  speciesButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speciesButtonActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  speciesEmoji: { fontSize: 28, marginBottom: 4 },
  speciesLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  colorRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: colors.text },
  statsRow: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 24 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, alignSelf: "flex-start", marginBottom: 12 },
  accessoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" },
  accessoryCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  accessoryCardEquipped: { borderColor: colors.primary },
  accessoryCardLocked: { opacity: 0.45 },
  accessoryIcon: { fontSize: 24, marginBottom: 6 },
  accessoryName: { color: colors.text, fontSize: 12, fontWeight: "600", textAlign: "center" },
  accessoryEquippedTag: { color: colors.primary, fontSize: 10, fontWeight: "700", marginTop: 4 },
});
