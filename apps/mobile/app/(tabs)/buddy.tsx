import { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats } from "@/api/progress";
import { createPet, fetchInventory, fetchPet, setItemQuantity, setPetPoints, updatePetSpecies } from "@/api/pet";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { computeGrowthStage, computePetEnergy } from "@/lib/petState";
import { SHOP_ITEMS } from "@/lib/petShop";
import { StudyPet, type PetAction } from "@/components/StudyPet";
import { PetScene } from "@/components/PetScene";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";
import type { PetSpecies, StudyPet as StudyPetData, StudyPlan, StudyPlanDay, UserSkillStat } from "@/types/domain";

// Pets are fixed-art illustrations now, not recolorable — this just
// satisfies the not-null color column from the earlier SVG-pet era.
const DEFAULT_PET_COLOR = "#F59E0B";
const SCENE_WIDTH = Math.min(Dimensions.get("window").width - 48, 400);

export default function BuddyScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<StudyPetData | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [activeAction, setActiveAction] = useState<PetAction | null>(null);

  const [pickerSpecies, setPickerSpecies] = useState<PetSpecies>("cat");
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      (async () => {
        const [petData, activePlan, skillStats, inv] = await Promise.all([
          fetchPet(session.user.id),
          fetchActivePlan(session.user.id),
          fetchSkillStats(session.user.id),
          fetchInventory(session.user.id),
        ]);
        if (cancelled) return;
        setPet(petData);
        setPlan(activePlan);
        setStats(skillStats);
        setInventory(inv);
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
      const created = await createPet(session.user.id, pickerSpecies, DEFAULT_PET_COLOR);
      setPet(created);
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitchSpecies(species: PetSpecies) {
    if (!session || !pet || pet.species === species) return;
    setPet({ ...pet, species });
    await updatePetSpecies(session.user.id, species);
  }

  // Testing-only: grants points without requiring completed study days, so
  // the shop/feed/play flow can be exercised without grinding through real
  // plan days first. Not gated — pull this before shipping to real users.
  async function handleGrantTestPoints() {
    if (!session || !pet) return;
    const newPoints = pet.points + 500;
    setPet({ ...pet, points: newPoints });
    await setPetPoints(session.user.id, newPoints);
  }

  async function handlePurchase(itemId: string, cost: number) {
    if (!session || !pet || pet.points < cost) return;
    const newPoints = pet.points - cost;
    const newQty = (inventory[itemId] ?? 0) + 1;
    setPet({ ...pet, points: newPoints });
    setInventory((prev) => ({ ...prev, [itemId]: newQty }));
    await setPetPoints(session.user.id, newPoints);
    await setItemQuantity(session.user.id, itemId, newQty);
  }

  async function handleFeed() {
    if (!session) return;
    const foodItem = SHOP_ITEMS.find((item) => item.kind === "food" && (inventory[item.id] ?? 0) > 0);
    if (!foodItem) return;
    const newQty = (inventory[foodItem.id] ?? 0) - 1;
    setInventory((prev) => ({ ...prev, [foodItem.id]: newQty }));
    setActiveAction("eating");
    await setItemQuantity(session.user.id, foodItem.id, newQty);
  }

  const hasFood = SHOP_ITEMS.some((item) => item.kind === "food" && (inventory[item.id] ?? 0) > 0);
  const hasToy = SHOP_ITEMS.some((item) => item.kind === "toy" && (inventory[item.id] ?? 0) > 0);
  // Everything currently in stock — toys (permanent) and unfed food — shown
  // as props set down beside the doghouse/cathouse.
  const ownedItems = SHOP_ITEMS.filter((item) => (inventory[item.id] ?? 0) > 0).map((item) => item.id);

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

        <StudyPet species={pickerSpecies} energy="calm" growthStage="hatchling" size={200} />

        <PrimaryButton title="This is my buddy" onPress={handleCreatePet} loading={creating} />
      </ScrollView>
    );
  }

  const streak = computeStreak(days);
  const completedDays = days.filter((d) => d.status === "completed").length;
  const accuracy = computeOverallAccuracy(stats);
  const energy = computePetEnergy(days);
  const growthStage = computeGrowthStage(completedDays, plan?.total_days ?? 0);

  const energyLabel = energy === "energetic" ? "Full of energy!" : energy === "calm" ? "Doing alright" : "Waiting for you";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Your study buddy</Text>
          <Text style={styles.energyLabel}>{energyLabel}</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>⭐ {pet.points}</Text>
        </View>
      </View>

      <View style={styles.testingPanel}>
        <Text style={styles.testingLabel}>🧪 Testing tools</Text>
        <View style={styles.testingRow}>
          <Pressable
            style={[styles.speciesToggle, pet.species === "cat" && styles.speciesToggleActive]}
            onPress={() => handleSwitchSpecies("cat")}
          >
            <Text style={styles.speciesToggleText}>🐱 Cat</Text>
          </Pressable>
          <Pressable
            style={[styles.speciesToggle, pet.species === "dog" && styles.speciesToggleActive]}
            onPress={() => handleSwitchSpecies("dog")}
          >
            <Text style={styles.speciesToggleText}>🐶 Dog</Text>
          </Pressable>
          <Pressable style={styles.testingButton} onPress={handleGrantTestPoints}>
            <Text style={styles.testingButtonText}>+500 ⭐</Text>
          </Pressable>
        </View>
      </View>

      <PetScene species={pet.species} ownedItems={ownedItems} width={SCENE_WIDTH} height={280}>
        <StudyPet
          species={pet.species}
          energy={energy}
          growthStage={growthStage}
          activeAction={activeAction}
          onActionComplete={() => setActiveAction(null)}
        />
      </PetScene>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={() => setActiveAction("petting")}>
          <Text style={styles.actionEmoji}>🤚</Text>
          <Text style={styles.actionLabel}>Pet</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, !hasFood && styles.actionButtonDisabled]} disabled={!hasFood} onPress={handleFeed}>
          <Text style={styles.actionEmoji}>🍖</Text>
          <Text style={styles.actionLabel}>Feed</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, !hasToy && styles.actionButtonDisabled]}
          disabled={!hasToy}
          onPress={() => setActiveAction("playing")}
        >
          <Text style={styles.actionEmoji}>🎾</Text>
          <Text style={styles.actionLabel}>Play</Text>
        </Pressable>
      </View>
      {(!hasFood || !hasToy) && (
        <Text style={styles.actionHint}>
          {!hasFood && !hasToy ? "Buy food and toys from the shop below." : !hasFood ? "Buy food from the shop below." : "Buy a toy from the shop below."}
        </Text>
      )}

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

      <Text style={styles.sectionTitle}>Shop</Text>
      <Text style={styles.shopHint}>Earn 15 points every day you complete.</Text>
      <View style={styles.shopGrid}>
        {SHOP_ITEMS.map((item) => {
          const owned = inventory[item.id] ?? 0;
          const isToy = item.kind === "toy";
          const alreadyOwned = isToy && owned > 0;
          const canAfford = pet.points >= item.cost;
          return (
            <View key={item.id} style={styles.shopCard}>
              <Text style={styles.shopIcon}>{item.icon}</Text>
              <Text style={styles.shopName}>{item.name}</Text>
              {!isToy && owned > 0 && <Text style={styles.shopOwned}>Have: {owned}</Text>}
              {alreadyOwned ? (
                <Text style={styles.shopOwnedTag}>Owned ✓</Text>
              ) : (
                <Pressable
                  style={[styles.shopBuyButton, !canAfford && styles.shopBuyButtonDisabled]}
                  disabled={!canAfford}
                  onPress={() => handlePurchase(item.id, item.cost)}
                >
                  <Text style={styles.shopBuyText}>⭐ {item.cost}</Text>
                </Pressable>
              )}
            </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 8 },
  energyLabel: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  pointsBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pointsText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  testingPanel: {
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    borderStyle: "dashed",
    padding: 12,
    marginBottom: 16,
  },
  testingLabel: { color: colors.warning, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  testingRow: { flexDirection: "row", gap: 8 },
  speciesToggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speciesToggleActive: { borderColor: colors.primary, backgroundColor: colors.background },
  speciesToggleText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  testingButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  testingButtonText: { color: colors.warning, fontSize: 12, fontWeight: "700" },
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
  actionRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 16, marginBottom: 6 },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonDisabled: { opacity: 0.4 },
  actionEmoji: { fontSize: 20, marginBottom: 2 },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: "600" },
  actionHint: { color: colors.textMuted, fontSize: 11, marginBottom: 16, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 24, marginTop: 16 },
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, alignSelf: "flex-start", marginBottom: 4 },
  shopHint: { fontSize: 11, color: colors.textMuted, alignSelf: "flex-start", marginBottom: 12 },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%", marginBottom: 24 },
  shopCard: {
    width: "30%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopIcon: { fontSize: 22, marginBottom: 4 },
  shopName: { color: colors.text, fontSize: 11, fontWeight: "600", textAlign: "center", marginBottom: 6 },
  shopOwned: { color: colors.textMuted, fontSize: 10, marginBottom: 6 },
  shopOwnedTag: { color: colors.success, fontSize: 11, fontWeight: "700" },
  shopBuyButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  shopBuyButtonDisabled: { borderColor: colors.border, opacity: 0.5 },
  shopBuyText: { color: colors.text, fontSize: 11, fontWeight: "700" },
});
