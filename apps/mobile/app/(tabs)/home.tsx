import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getTodaySession } from "@/api/studyFunctions";
import { fetchActivePlan, fetchPlanDays, fetchSkillStats, fetchSubcategories } from "@/api/progress";
import { createPet, fetchInventory, fetchPet, setItemQuantity, setPetPoints, updatePetName, updatePetSpecies, updatePetTheme } from "@/api/pet";
import { useAuth } from "@/hooks/useAuth";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { buildDayNarrative } from "@/lib/planNarrative";
import { computeStreak, computeOverallAccuracy } from "@/lib/planStats";
import { computeGrowthStage, computePetEnergy } from "@/lib/petState";
import { pickFocusTopic } from "@/lib/insights";
import { pickHomeBuddyLine } from "@/lib/tutorVoice";
import { SHOP_ITEMS } from "@/lib/petShop";
import { SCENE_THEMES, findSceneTheme } from "@/lib/sceneThemes";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StudyPet, type PetAction } from "@/components/StudyPet";
import { PetScene } from "@/components/PetScene";
import { LevelRing } from "@/components/LevelRing";
import { FlameIcon, StarIcon, SparkleIcon } from "@/components/icons";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { MAX_APP_WIDTH, cardElevation, fonts } from "@/theme";
import type {
  DayTarget,
  MasterySnapshot,
  PetSpecies,
  StudyPet as StudyPetData,
  StudyPlan,
  StudyPlanDay,
  Subcategory,
  TodaySessionResponse,
  UserSkillStat,
} from "@/types/domain";

// Pets are fixed-art illustrations now, not recolorable — this just
// satisfies the not-null color column from the earlier SVG-pet era.
const DEFAULT_PET_COLOR = "#F59E0B";
// Matches the app-wide column cap in the root layout — PetScene needs an
// actual pixel width (for its SVG canvas), which Dimensions can't derive
// from the surrounding layout, so it's computed the same way here too.
const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, MAX_APP_WIDTH);
// The pet's world fills the top of the screen edge-to-edge instead of
// sitting in a boxed card — taller on bigger screens, capped so it never
// crowds out everything below.
const HERO_HEIGHT = Math.min(Dimensions.get("window").height * 0.42, 380);
const PET_SIZE = Math.round(HERO_HEIGHT * 0.5);

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

// No push notifications yet, so this is the in-app stand-in: a visible
// nudge once it's late enough in the day that a streak is genuinely at
// risk, rather than nagging first thing in the morning.
function isLateInDay(): boolean {
  return new Date().getHours() >= 18;
}

function sessionTargets(session: TodaySessionResponse): DayTarget[] {
  const map = new Map<string, DayTarget>();
  for (const q of session.questions ?? []) {
    const key = `${q.subcategory_id}:${q.difficulty}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { subcategory_id: q.subcategory_id, difficulty: q.difficulty, count: 1 });
  }
  return [...map.values()];
}

export default function Home() {
  const router = useRouter();
  const { session: auth, profile } = useAuth();
  const { refresh: refreshPetCompanion } = usePetCompanion();
  const { styles, colors } = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.background, alignItems: "center" },
    appColumn: { flex: 1 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
    pickerContent: { padding: 24, paddingTop: 60, paddingBottom: 40, alignItems: "center", gap: 16 },
    title: { fontSize: 26, fontFamily: fonts.display, color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 8 },
    error: { color: colors.danger, marginTop: 20 },

    hero: { width: "100%", overflow: "hidden" },
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
    heroTitle: { color: "#F8FAFC", fontSize: 17, fontFamily: fonts.displaySemibold },
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

    sheet: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
    sheetContent: { padding: 24, paddingTop: 16, paddingBottom: 130, alignItems: "center" },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 20 },

    levelRingWrap: { alignItems: "center", marginBottom: 14 },
    levelBadge: {
      position: "absolute",
      right: -2,
      bottom: 4,
      backgroundColor: colors.secondary,
      borderWidth: 4,
      borderColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    levelBadgeText: { color: colors.onSecondary, fontSize: 12, fontFamily: fonts.bodyExtraBold },
    buddyName: { fontSize: 24, fontFamily: fonts.display, color: colors.text, marginTop: 10, letterSpacing: -0.4 },
    buddyMeta: { fontSize: 12, fontFamily: fonts.bodySemibold, color: colors.textMuted, marginTop: 2 },

    buddyBubble: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderBottomLeftRadius: 6,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    buddyBubbleText: { color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: fonts.bodyBold, textAlign: "center" },

    chipRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
    chipPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 12,
    },
    chipSecondary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.secondary,
      borderRadius: 18,
      paddingVertical: 12,
    },
    chipNeutral: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingVertical: 12,
    },
    chipTextOnPrimary: { color: colors.onPrimary, fontSize: 13, fontFamily: fonts.bodyExtraBold },
    chipTextOnSecondary: { color: colors.onSecondary, fontSize: 13, fontFamily: fonts.bodyExtraBold },
    chipText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyExtraBold },

    card: {
      width: "100%",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 26,
      borderWidth: 3,
      borderColor: colors.primary,
      padding: 22,
      marginBottom: 20,
      ...cardElevation,
    },
    cardTitle: { fontSize: 20, fontFamily: fonts.displaySemibold, color: colors.text, marginBottom: 6 },
    narrativeText: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    cardBody: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
    progressText: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    progressTrack: { height: 10, borderRadius: 999, backgroundColor: colors.background, overflow: "hidden", marginBottom: 18 },
    progressFill: { height: 10, backgroundColor: colors.primary, borderRadius: 999 },

    recapBanner: {
      width: "100%",
      backgroundColor: colors.accentPop,
      borderRadius: 24,
      paddingVertical: 16,
      paddingHorizontal: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    recapBannerText: { color: colors.onAccentPop, fontSize: 14, fontFamily: fonts.bodyExtraBold },

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
    sectionTitle: { fontSize: 16, fontFamily: fonts.displaySemibold, color: colors.text, alignSelf: "flex-start", marginBottom: 4 },
    shopHint: { fontSize: 11, color: colors.textMuted, alignSelf: "flex-start", marginBottom: 12 },
    shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%", marginBottom: 24 },
    shopCard: {
      width: "30%",
      backgroundColor: colors.surface,
      borderRadius: 18,
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
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
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
    modalSaveText: { color: colors.onPrimary, fontSize: 14, fontWeight: "700" },
  }));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [pet, setPet] = useState<StudyPetData | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [activeAction, setActiveAction] = useState<PetAction | null>(null);
  const [selectedToyId, setSelectedToyId] = useState<string | null>(null);
  const [pickerSpecies, setPickerSpecies] = useState<PetSpecies>("cat");
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [session, setSession] = useState<TodaySessionResponse | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [days, setDays] = useState<StudyPlanDay[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [stats, setStats] = useState<UserSkillStat[]>([]);
  const [mastery, setMastery] = useState<MasterySnapshot>({});
  const [sessionError, setSessionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoadError(null);
    setSessionError(null);
    try {
      const [petData, inv, todaySession, activePlan, skillStats, subs] = await Promise.all([
        fetchPet(auth.user.id),
        fetchInventory(auth.user.id),
        getTodaySession().catch((e) => {
          setSessionError(e instanceof Error ? e.message : "Couldn't load today's session");
          return null;
        }),
        fetchActivePlan(auth.user.id),
        fetchSkillStats(auth.user.id),
        fetchSubcategories(),
      ]);
      setPet(petData);
      setInventory(inv);
      setSession(todaySession);
      setPlan(activePlan);
      setSubcategories(subs);
      setStats(skillStats);
      const snapshot: MasterySnapshot = {};
      for (const s of skillStats) snapshot[s.subcategory_id] = s.mastery_score;
      setMastery(snapshot);
      setDays(activePlan ? await fetchPlanDays(activePlan.id) : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your buddy.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth, retryToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleCreatePet() {
    if (!auth) return;
    setCreating(true);
    try {
      const created = await createPet(auth.user.id, pickerSpecies, DEFAULT_PET_COLOR);
      setPet(created);
      refreshPetCompanion();
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitchSpecies(species: PetSpecies) {
    if (!auth || !pet || pet.species === species) return;
    setPet({ ...pet, species });
    await updatePetSpecies(auth.user.id, species);
    refreshPetCompanion();
  }

  function openNameModal() {
    setNameDraft(pet?.name ?? "");
    setNameModalVisible(true);
  }

  async function handleSaveName() {
    if (!auth || !pet) return;
    const trimmed = nameDraft.trim().slice(0, 20);
    setPet({ ...pet, name: trimmed || null });
    setNameModalVisible(false);
    await updatePetName(auth.user.id, trimmed);
    refreshPetCompanion();
  }

  // Testing-only: grants points without requiring completed study days, so
  // the shop/feed/play flow can be exercised without grinding through real
  // plan days first. Not gated — pull this before shipping to real users.
  async function handleGrantTestPoints() {
    if (!auth || !pet) return;
    const newPoints = pet.points + 500;
    setPet({ ...pet, points: newPoints });
    await setPetPoints(auth.user.id, newPoints);
    refreshPetCompanion();
  }

  async function handlePurchase(itemId: string, cost: number) {
    if (!auth || !pet || pet.points < cost) return;
    const newPoints = pet.points - cost;
    const newQty = (inventory[itemId] ?? 0) + 1;
    setPet({ ...pet, points: newPoints });
    setInventory((prev) => ({ ...prev, [itemId]: newQty }));
    await setPetPoints(auth.user.id, newPoints);
    await setItemQuantity(auth.user.id, itemId, newQty);
    refreshPetCompanion();
  }

  async function handleEquipTheme(themeId: string) {
    if (!auth || !pet) return;
    setPet({ ...pet, equipped_theme: themeId });
    await updatePetTheme(auth.user.id, themeId);
    refreshPetCompanion();
  }

  async function handleBuyTheme(themeId: string, cost: number) {
    await handlePurchase(themeId, cost);
    await handleEquipTheme(themeId);
  }

  function handlePlayToy(toyId: string) {
    setSelectedToyId(toyId);
    setActiveAction("playing");
  }

  async function handleFeed() {
    if (!auth) return;
    const foodItem = SHOP_ITEMS.find((item) => item.kind === "food" && (inventory[item.id] ?? 0) > 0);
    if (!foodItem) return;
    const newQty = (inventory[foodItem.id] ?? 0) - 1;
    setInventory((prev) => ({ ...prev, [foodItem.id]: newQty }));
    setActiveAction("eating");
    await setItemQuantity(auth.user.id, foodItem.id, newQty);
  }

  const hasFood = SHOP_ITEMS.some((item) => item.kind === "food" && (inventory[item.id] ?? 0) > 0);
  const ownedToyIds = SHOP_ITEMS.filter((item) => item.kind === "toy" && (inventory[item.id] ?? 0) > 0).map((item) => item.id);
  const hasToy = ownedToyIds.length > 0;
  const ownedItems = SHOP_ITEMS.filter((item) => (inventory[item.id] ?? 0) > 0).map((item) => item.id);

  const remaining = daysUntil(profile?.sat_date ?? null);
  const answeredCount = session?.questions?.filter((q) => q.answered).length ?? 0;
  const totalCount = session?.questions?.length ?? 0;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;
  const needsBaseline = !!sessionError?.toLowerCase().includes("baseline test");

  const streak = computeStreak(days);
  const completedDays = days.filter((d) => d.status === "completed").length;
  const overallAccuracy = computeOverallAccuracy(stats);
  const energy = computePetEnergy(days);
  const growthStage = computeGrowthStage(completedDays, plan?.total_days ?? 0);
  const energyLabel = energy === "energetic" ? "Full of energy!" : energy === "calm" ? "Doing alright" : "Waiting for you";

  // There's no separate stored "level" system — this is completion ratio
  // through the current plan, framed as buddy leveling (a ring + a level
  // number) rather than a plain percentage, since that reads as pet
  // progress rather than a settings-screen stat.
  const planRatio = plan && plan.total_days > 0 ? Math.min(1, completedDays / plan.total_days) : 0;
  const buddyLevel = 1 + Math.floor(completedDays / 3);

  const narrative =
    session?.questions && session.day_number != null
      ? buildDayNarrative(session.day_number, sessionTargets(session), subcategories, mastery)
      : [];
  const streakAtRisk = !loading && streak > 0 && !!session?.questions && !allAnswered && isLateInDay();
  const focusTopic = pickFocusTopic(stats, subcategories);
  const focusTopicId = focusTopic?.subcategory.id ?? null;
  const buddyLine = useMemo(
    () => pickHomeBuddyLine({ streakAtRisk, streak, focusTopicName: focusTopic?.subcategory.name ?? null }),
    [streakAtRisk, streak, focusTopicId],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Couldn't load your buddy</Text>
        <Text style={styles.subtitle}>{loadError}</Text>
        <PrimaryButton title="Try again" onPress={() => setRetryToken((n) => n + 1)} />
      </View>
    );
  }

  if (!pet) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.pickerContent}>
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
            theme={findSceneTheme(pet.equipped_theme)}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <StarIcon size={14} color="#F8FAFC" />
                <Text style={styles.pointsText}>{pet.points}</Text>
              </View>
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

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.levelRingWrap}>
            <LevelRing progress={planRatio} size={104} strokeWidth={9} color={colors.primary} trackColor={colors.surfaceAlt}>
              <StudyPet species={pet.species} energy="energetic" growthStage="grown" size={70} />
            </LevelRing>
            <View style={[styles.levelBadge, { right: 0 }]}>
              <Text style={styles.levelBadgeText}>Lv. {buddyLevel}</Text>
            </View>
          </View>
          <Text style={styles.buddyName}>{pet.name || "Your buddy"}</Text>
          {remaining != null && (
            <Text style={styles.buddyMeta}>
              {remaining > 0 ? `${remaining} days until your SAT` : "Your SAT is today — good luck!"}
            </Text>
          )}

          <View style={{ height: 16 }} />

          <View style={styles.buddyBubble}>
            <Text style={styles.buddyBubbleText}>{buddyLine}</Text>
          </View>

          <View style={styles.chipRow}>
            <View style={styles.chipPrimary}>
              <FlameIcon size={13} color={colors.onPrimary} />
              <Text style={styles.chipTextOnPrimary}>{streak}</Text>
            </View>
            <View style={styles.chipSecondary}>
              <Text style={styles.chipTextOnSecondary}>{overallAccuracy != null ? `${overallAccuracy}%` : "—"}</Text>
            </View>
            <View style={styles.chipNeutral}>
              <StarIcon size={13} color={colors.secondary} />
              <Text style={styles.chipText}>{pet.points}</Text>
            </View>
          </View>

          {needsBaseline ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Take your baseline test</Text>
              <Text style={styles.cardBody}>We need a quick 24-question diagnostic to build your study plan.</Text>
              <PrimaryButton title="Start baseline test" onPress={() => router.push("/baseline/intro")} />
            </View>
          ) : sessionError ? (
            <Text style={styles.error}>{sessionError}</Text>
          ) : session?.plan_complete ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Plan complete 🎉</Text>
              <Text style={styles.cardBody}>You've finished every day of your study plan. Check Progress for a full recap.</Text>
            </View>
          ) : session?.waiting ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>All caught up</Text>
              <Text style={styles.cardBody}>{session.message}</Text>
            </View>
          ) : session?.questions ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Day {session.day_number}</Text>
              {narrative.map((line, i) => (
                <Text key={i} style={styles.narrativeText}>
                  {line}
                </Text>
              ))}
              <Text style={styles.cardBody}>
                {totalCount} questions · ~{session.target_minutes} min
              </Text>
              <Text style={styles.progressText}>
                {answeredCount}/{totalCount} answered
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%` }]} />
              </View>
              <PrimaryButton
                title={allAnswered ? "Review today's session" : answeredCount > 0 ? "Continue session" : "Start today's session"}
                onPress={() => router.push("/session")}
              />
            </View>
          ) : null}

          <Pressable style={styles.recapBanner} onPress={() => router.push("/wrapped")}>
            <Text style={styles.recapBannerText}>{pet.name ? `${pet.name}'s week — share it` : "Your week — share it"}</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.onAccentPop} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 6l6 6-6 6" />
            </Svg>
          </Pressable>

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

          <Text style={styles.sectionTitle}>Scene themes</Text>
          <Text style={styles.shopHint}>Buying a theme equips it right away.</Text>
          <View style={styles.shopGrid}>
            {SCENE_THEMES.map((themeOption) => {
              const owned = themeOption.cost === 0 || (inventory[themeOption.id] ?? 0) > 0;
              const equipped = (pet.equipped_theme ?? "classic") === themeOption.id;
              const canAfford = pet.points >= themeOption.cost;
              return (
                <View key={themeOption.id} style={styles.shopCard}>
                  <Text style={styles.shopIcon}>{themeOption.icon}</Text>
                  <Text style={styles.shopName}>{themeOption.name}</Text>
                  {equipped ? (
                    <Text style={styles.shopOwnedTag}>Equipped ✓</Text>
                  ) : owned ? (
                    <Pressable style={styles.shopBuyButton} onPress={() => handleEquipTheme(themeOption.id)}>
                      <Text style={styles.shopBuyText}>Equip</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.shopBuyButton, !canAfford && styles.shopBuyButtonDisabled]}
                      disabled={!canAfford}
                      onPress={() => handleBuyTheme(themeOption.id, themeOption.cost)}
                    >
                      <Text style={styles.shopBuyText}>⭐ {themeOption.cost}</Text>
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
