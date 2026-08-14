import { Stack } from "expo-router";

// A normal push/back stack for the list -> retry flow, nested one level
// inside the Tabs navigator (rather than a sibling route entirely outside
// it) so the bottom tab bar stays visible while reviewing missed questions.
export default function MistakesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
