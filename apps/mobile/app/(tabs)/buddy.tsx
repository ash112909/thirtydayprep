import { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats } from "@/api/progress";
import { createPet, fetchInventory, fetchPet, setItemQuantity, setPetPoints, updatePetName, updatePetSpecies } from "@/api/pet";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { computeGrowthStage, computePetEnergy } from "@/lib/petState";
import { SHOP_ITEMS } from "@/lib/petShop";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { StudyPet, type PetAction } from "@/components/StudyPet";
import { PetScene } from "@/components/PetScene";
import { PrimaryButton } from "@/components/PrimaryButton";
import { MAX_APP_WIDTH, colors } from "@/theme";
import type { PetSpecies, StudyPet as StudyPetData, StudyPlan, StudyPlanDay, UserSkillStat } from "@/types/domain";

// Pets are fixed-art illustrations now, not recolorable — this just
// satisfies the not-null color column from the earlier SVG-pet era.
const DEFAULT_PET_COLOR = "#F59E0B";
// Matches the app-wide column cap in the root layout — PetScene needs an
// actual pixel width (for its SVG canvas), which Dimensions can't derive
// from the surrounding layout, so it's computed the same way here too.
const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, MAX_APP_WIDTH);
// The pet's world fills the top of the screen edge-to-edge instead of
// sitting in a boxed card — taller on bigger screens, capped so it never
// crowds out the shop below.
const HERO_HEIGHT = Math.min(Dimensions.get("window").height * 0.5, 460);
const PET_SIZE = Math.round(HERO_HEIGHT * 0.52);

export default function BuddyScreen() {
  const { session } = useAuth();
  // This screen keeps its own copy of pet/plan/inventory state (it needs
  // finer-grained data than the floating companion does elsewhere in the
  // app), so every mutation here also pings the shared context to refresh —
  // otherwise the floating badge on other screens would go stale.
  const { refresh: refreshPetCompanion } = usePetCompanion();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<StudyPetData | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [activeAction, setActiveAction] = useState<PetAction | null>(null);
  const [selectedToyId, setSelectedToyId] = useState<string | null>(null);

  const [pickerSpecies, setPickerSpecies] = useState<PetSpecies>("cat");
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

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
      refreshPetCompanion();
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitchSpecies(species: PetSpecies) {
    if (!session || !pet || pet.species === species) return;
    setPet({ ...pet, species });
    await updatePetSpecies(session.user.id, species);
    refreshPetCompanion();
  }

  function openNameModal() {
    setNameDraft(pet?.name ?? "");
    setNameModalVisible(true);
  }

  async function handleSaveName() {
    if (!session || !pet) return;
    const trimmed = nameDraft.trim().slice(0, 20);
    setPet({ ...pet, name: trimmed || null });
    setNameModalVisible(false);
    await updatePetName(session.user.id, trimmed);
    refreshPetCompanion();
  }

  // Testing-only: grants points without requiring completed study days, so
  // the shop/feed/play flow can be exercised without grinding through real
  // plan days first. Not gated — pull this before shipping to real users.
  async function handleGrantTestPoints() {
    if (!session || !pet) return;
    const newPoints = pet.points + 500;
    setPet({ ...pet, points: newPoints });
    await setPetPoints(session.user.id, newPoints);
    refreshPetCompanion();
  }

  async function handlePurchase(itemId: string, cost: number) {
    if (!session || !pet || pet.points < cost) return;
    const newPoints = pet.points - cost;
    const newQty = (inventory[itemId] ?? 0) + 1;
    setPet({ ...pet, points: newPoints });
    setInventory((prev) => ({ ...prev, [itemId]: newQty }));
    await setPetPoints(session.user.id, newPoints);
    await setItemQuantity(session.user.id, itemId, newQty);
    refreshPetCompanion();
  }

  // Tapping a toy directly in the scene (or the Play button, which reuses
  // whichever toy was last chosen) both selects it and starts the reaction —
  // there's no separate "confirm" step.
  function handlePlayToy(toyId: string) {
    setSelectedToyId(toyId);
    setActiveAction("playing");
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
  const ownedToyIds = SHOP_ITEMS.filter((item) => item.kind === "toy" && (inventory[item.id] ?? 0) > 0).map((item) => item.id);
  const hasToy = ownedToyIds.length > 0;
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
    <View style={styles.screen}>
      <View style={[styles.appColumn, { width: SCREEN_WIDTH }]}>
      <View style={[styles.hero, { height: HERO_HEIGHT }]}>
        <PetScene
          species={pet.species}
          ownedItems={ownedItems}
          isPlaying={activeAction === "playing"}
          playingToyId={selectedToyId}
          onToyPress={handlePlayToy}
          width={SCREEN_WIDTH}
          height={HERO_HEIGHT}
        >
          <StudyPet
            species={pet.species}
            energy={energy}
            growthStage={growthStage}
            size={PET_SIZE}
            activeAction={activeAction}
            onActionComplete={() => setActiveAction(null)}
          />
        </PetScene>

        <View style={styles.hudTopRow} pointerEvents="box-none">
          <Pressable style={styles.glassPill} onPress={openNameModal}>
            <Text style={styles.heroTitle}>{pet.name || "Your study buddy"} ✏️</Text>
            <Text style={styles.heroSubtitle}>{energyLabel}</Text>
          </Pressable>
          <View style={[styles.glassPill, styles.pointsPill]}>
            <Text style={styles.pointsText}>⭐ {pet.points}</Text>
          </View>
        </View>

        <View style={styles.hudBottomRow} pointerEvents="box-none">
            <Pressable style={styles.hudButton} onPress={() => setActiveAction("petting")}>
              <Text style={styles.hudButtonEmoji}>🤚</Text>
              <Text style={styles.hudButtonLabel}>Pet</Text>
            </Pressable>
            <Pressable style={[styles.hudButton, !hasFood && styles.hudButtonDisabled]} disabled={!hasFood} onPress={handleFeed}>
              <Text style={styles.hudButtonEmoji}>🍖</Text>
              <Text style={styles.hudButtonLabel}>Feed</Text>
            </Pressable>
            <Pressable
              style={[styles.hudButton, !hasToy && styles.hudButtonDisabled]}
              disabled={!hasToy}
              onPress={() => {
                const toyId = selectedToyId && ownedToyIds.includes(selectedToyId) ? selectedToyId : ownedToyIds[0];
                if (toyId) handlePlayToy(toyId);
              }}
            >
              <Text style={styles.hudButtonEmoji}>🎾</Text>
              <Text style={styles.hudButtonLabel}>Play</Text>
            </Pressable>
        </View>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <View style={styles.sheetHandle} />

        {(!hasFood || !hasToy) && (
          <Text style={styles.actionHint}>
            {!hasFood && !hasToy ? "Buy food and toys from the shop below." : !hasFood ? "Buy food from the shop below." : "Buy a toy from the shop below."}
          </Text>
        )}
        {ownedToyIds.length > 1 && <Text style={styles.actionHint}>Tip: tap any toy on the ground to play with that one.</Text>}

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
        <Text style={styles.shopHint}>Earn 2 points per correct answer, plus 15 for finishing the day.</Text>
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
      </View>

      <Modal visible={nameModalVisible} transparent animationType="fade" onRequestClose={() => setNameModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name your buddy</Text>
            <TextInput
              style={styles.modalInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="e.g. Biscuit"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setNameModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={handleSaveName}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // On phones the app column fills the full (narrow) window, so this is a
  // no-op; on wide desktop web it keeps the pet's world at a sensible
  // app-sized column instead of stretching edge-to-edge into a flat strip.
  screen: { flex: 1, backgroundColor: colors.background, alignItems: "center" },
  appColumn: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  pickerContent: { padding: 24, paddingTop: 60, paddingBottom: 40, alignItems: "center", gap: 16 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 8 },

  // Full-bleed pet world — no card, no border, sky bleeds to the screen edges.
  hero: { width: "100%", overflow: "hidden" },
  // Each HUD row is independently absolute-positioned (not nested inside a
  // shared full-fill wrapper) so there's no invisible box-none container
  // stacked over the whole hero — that pattern was silently swallowing taps
  // on the toys underneath on web. The button row is also anchored to the
  // right rather than centered, so its own hit area never reaches over the
  // toy pile on the left at all, regardless of platform.
  hudTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  hudBottomRow: { position: "absolute", right: 20, bottom: 30, flexDirection: "row", gap: 14 },
  glassPill: {
    backgroundColor: "rgba(15,23,42,0.55)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800" },
  heroSubtitle: { color: colors.primary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  pointsPill: { alignSelf: "flex-start" },
  pointsText: { color: "#F8FAFC", fontSize: 14, fontWeight: "700" },
  hudButton: {
    width: 66,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  hudButtonDisabled: { opacity: 0.35 },
  hudButtonEmoji: { fontSize: 20, marginBottom: 2 },
  hudButtonLabel: { color: "#F8FAFC", fontSize: 11, fontWeight: "700" },

  // The scroll sheet overlaps the hero's bottom edge, so the world feels
  // continuous with the panel resting on top of it rather than stacked below.
  sheet: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
  sheetContent: { padding: 24, paddingTop: 16, paddingBottom: 40, alignItems: "center" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 },

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
  actionHint: { color: colors.textMuted, fontSize: 11, marginBottom: 16, textAlign: "center" },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 340, backgroundColor: colors.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalCancelButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalCancelText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  modalSaveButton: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  modalSaveText: { color: colors.background, fontSize: 14, fontWeight: "700" },
});
