import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 12, color: focused ? colors.primary : colors.textMuted }}>{label}</Text>;
}

export default function TabsLayout() {
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
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Plan" focused={focused} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Progress" focused={focused} /> }}
      />
      <Tabs.Screen
        name="buddy"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Buddy" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }}
      />
    </Tabs>
  );
}
