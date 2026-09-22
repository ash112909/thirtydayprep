import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchFriendIds,
  fetchFriendSummaries,
  fetchOrCreateFriendCode,
  redeemFriendCode,
  removeFriend,
  type FriendSummary,
} from "@/api/friends";
import { StudyPet } from "@/components/StudyPet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useThemedStyles } from "@/hooks/useThemedStyles";

export default function Friends() {
  const router = useRouter();
  const { session } = useAuth();
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 20 },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 10 },
    codeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    codeText: { fontSize: 28, fontWeight: "900", color: colors.primary, letterSpacing: 4 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 14, lineHeight: 17 },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      color: colors.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 16,
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    error: { color: colors.danger, marginBottom: 12, fontSize: 13 },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    friendAvatarWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    friendName: { color: colors.text, fontSize: 14, fontWeight: "700" },
    friendStats: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    removeText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
    emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8 },
  }));

  const [code, setCode] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [myCode, friendIds] = await Promise.all([
        fetchOrCreateFriendCode(session.user.id),
        fetchFriendIds(session.user.id),
      ]);
      setCode(myCode);
      setFriends(await fetchFriendSummaries(friendIds));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load friends.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRedeem() {
    if (!session || !redeemInput.trim()) return;
    setRedeeming(true);
    try {
      await redeemFriendCode(session.user.id, redeemInput);
      setRedeemInput("");
      await load();
    } catch (e) {
      Alert.alert("Couldn't add friend", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRedeeming(false);
    }
  }

  async function handleRemove(friendId: string) {
    if (!session) return;
    setFriends((prev) => prev.filter((f) => f.userId !== friendId));
    try {
      await removeFriend(session.user.id, friendId);
    } catch (e) {
      Alert.alert("Couldn't remove friend", e instanceof Error ? e.message : "Something went wrong.");
      load();
    }
  }

  function handleShareCode() {
    if (!code) return;
    Share.share({ message: `Add me as a study buddy on ThirtyDayPrep! My friend code is ${code}` });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Friends</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your friend code</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{code}</Text>
        </View>
        <PrimaryButton title="Share your code" variant="secondary" onPress={handleShareCode} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add a friend</Text>
        <Text style={styles.hint}>Enter a friend's code to see their streak alongside yours.</Text>
        <TextInput
          style={styles.input}
          placeholder="ABC123"
          placeholderTextColor={colors.textMuted}
          value={redeemInput}
          onChangeText={setRedeemInput}
          autoCapitalize="characters"
          maxLength={6}
        />
        <PrimaryButton title="Add friend" onPress={handleRedeem} loading={redeeming} disabled={!redeemInput.trim()} />
      </View>

      <Text style={styles.sectionTitle}>Streaks</Text>
      {friends.length === 0 ? (
        <Text style={styles.emptyText}>No friends yet — add one with their code above to start comparing streaks.</Text>
      ) : (
        friends.map((friend) => (
          <View key={friend.userId} style={styles.friendRow}>
            <View style={styles.friendAvatarWrap}>
              <StudyPet species={friend.species} energy="calm" growthStage="grown" size={36} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendName}>{friend.petName ?? "Study buddy"}</Text>
              <Text style={styles.friendStats}>
                {friend.streak > 0 ? `🔥 ${friend.streak} day streak` : "No streak yet"} · ⭐ {friend.points}
              </Text>
            </View>
            <Pressable onPress={() => handleRemove(friend.userId)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={{ marginTop: 20 }}>
        <PrimaryButton title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}
