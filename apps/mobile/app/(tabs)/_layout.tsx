import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  focusedIcon: IconName;
  unfocusedIcon: IconName;
  label: string;
  focused: boolean;
  colors: { primary: string; textMuted: string };
}

function TabIcon({ focusedIcon, unfocusedIcon, label, focused, colors }: TabIconProps) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0.9,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <View style={{ alignItems: "center", gap: 2, minWidth: 56 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={focused ? focusedIcon : unfocusedIcon} size={22} color={focused ? colors.primary : colors.textMuted} />
      </Animated.View>
      <Text style={{ fontSize: 10, fontWeight: focused ? "700" : "500", color: focused ? colors.primary : colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
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
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focusedIcon="sunny" unfocusedIcon="sunny-outline" label="Today" focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focusedIcon="calendar" unfocusedIcon="calendar-outline" label="Plan" focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focusedIcon="stats-chart"
              unfocusedIcon="stats-chart-outline"
              label="Progress"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="buddy"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focusedIcon="paw" unfocusedIcon="paw-outline" label="Buddy" focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focusedIcon="person-circle"
              unfocusedIcon="person-circle-outline"
              label="Profile"
              focused={focused}
              colors={colors}
            />
          ),
        }}
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
      <Tabs.Screen name="wrapped" options={{ href: null }} />
    </Tabs>
  );
}
