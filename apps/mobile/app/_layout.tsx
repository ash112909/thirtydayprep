import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PetCompanionProvider } from "@/hooks/usePetCompanion";
import { FloatingPetBadge } from "@/components/FloatingPetBadge";
import { MAX_APP_WIDTH, colors } from "@/theme";

function RootNavigation() {
  const { session, profile, hasCompletedBaseline, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inBaseline = segments[0] === "baseline";

    if (!session) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }

    if (!profile?.onboarding_complete) {
      if (!inOnboarding && !inBaseline) router.replace("/onboarding");
      return;
    }

    // Still resolving whether a baseline test has been completed — wait
    // rather than risk a wrong redirect before this settles.
    if (hasCompletedBaseline === null) return;

    if (!hasCompletedBaseline) {
      if (!inBaseline) router.replace("/baseline/intro");
      return;
    }

    if (inAuthGroup || inOnboarding || !segments[0]) {
      router.replace("/(tabs)/home");
    }
  }, [loading, session, profile, hasCompletedBaseline, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PetCompanionProvider>
        <StatusBar style="light" />
        {/* Every screen lives inside this capped, centered column — on a
            phone it's a no-op (already narrower than the cap), but on a
            wide web browser or tablet it keeps the whole app looking like a
            mobile app instead of a website stretched full-width. */}
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: MAX_APP_WIDTH }}>
            <RootNavigation />
            <FloatingPetBadge />
          </View>
        </View>
      </PetCompanionProvider>
    </AuthProvider>
  );
}
