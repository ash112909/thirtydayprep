import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {/* Home is the raised center button in FloatingTabBar, not a side
          icon — it's the buddy's own avatar, registered here so expo-router
          and the tab bar's navigation state both know about the route. */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="mock-test" />
      <Tabs.Screen name="profile" />
      {/* These aren't destinations the custom tab bar renders a button for —
          they're "inside" screens (a session, its recap, a plan day, Mistake
          Bank review, practice-by-topic, the Wrapped recap) reached by
          pushing from one of the tabs above. Registering them here keeps
          them part of the same Tabs navigator, so the bottom tab bar stays
          visible instead of disappearing the way it would as a sibling
          top-level route. */}
      <Tabs.Screen name="session" options={{ href: null }} />
      <Tabs.Screen name="session-recap/[dayId]" options={{ href: null }} />
      <Tabs.Screen name="plan-day/[id]" options={{ href: null }} />
      <Tabs.Screen name="mistakes" options={{ href: null }} />
      <Tabs.Screen name="practice" options={{ href: null }} />
      <Tabs.Screen name="wrapped" options={{ href: null }} />
      <Tabs.Screen name="mock-test-run" options={{ href: null }} />
      <Tabs.Screen name="mock-test-results" options={{ href: null }} />
    </Tabs>
  );
}
