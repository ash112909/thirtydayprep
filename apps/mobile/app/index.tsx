import { ActivityIndicator, View } from "react-native";
import { colors } from "@/theme";

// The root layout's redirect effect sends the user to sign-in, onboarding,
// or the home tab based on auth/profile state — this screen is just the
// brief frame shown while that decision is made.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
