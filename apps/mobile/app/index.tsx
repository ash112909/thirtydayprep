import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";

// The root layout's redirect effect sends the user to sign-in, onboarding,
// or the home tab based on auth/profile state — this screen is just the
// brief frame shown while that decision is made.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
