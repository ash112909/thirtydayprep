import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/hooks/useTheme";

function TabIcon({ label, focused, colors }: { label: string; focused: boolean; colors: { primary: string; textMuted: string } }) {
  return <Text style={{ fontSize: 12, color: focused ? colors.primary : colors.textMuted }}>{label}</Text>;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Today" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Plan" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Progress" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen
        name="buddy"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Buddy" focused={focused} colors={colors} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} colors={colors} /> }}
      />
      {/* These aren't destinations you'd tap a tab-bar button to reach — they're
          "inside" screens (a session, its recap, a plan day, Mistake Bank
          review) reached by pushing from one of the tabs above. Registering
          them here (with href: null so they get no tab-bar button) keeps them
          part of the same Tabs navigator, so the bottom tab bar stays visible
          instead of disappearing the way it would as a sibling top-level route. */}
      <Tabs.Screen name="session" options={{ href: null }} />
      <Tabs.Screen name="session-recap/[dayId]" options={{ href: null }} />
      <Tabs.Screen name="plan-day/[id]" options={{ href: null }} />
      <Tabs.Screen name="mistakes" options={{ href: null }} />
      <Tabs.Screen name="practice" options={{ href: null }} />
    </Tabs>
  );
}
