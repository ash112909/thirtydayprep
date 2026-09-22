import { Pressable, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { usePetCompanion } from "@/hooks/usePetCompanion";
import { StudyPet } from "@/components/StudyPet";
import { useTheme } from "@/hooks/useTheme";

type IconName = keyof typeof Ionicons.glyphMap;

const SIDE_ICONS: Record<string, { focused: IconName; unfocused: IconName; label: string }> = {
  plan: { focused: "calendar", unfocused: "calendar-outline", label: "Plan" },
  progress: { focused: "stats-chart", unfocused: "stats-chart-outline", label: "Progress" },
  "mock-test": { focused: "clipboard", unfocused: "clipboard-outline", label: "Test" },
  profile: { focused: "person-circle", unfocused: "person-circle-outline", label: "Profile" },
};

// Left-to-right visual order regardless of Tabs.Screen registration order.
const SIDE_ORDER = ["plan", "progress", "mock-test", "profile"];

const BAR_HEIGHT = 62;
const BUTTON_SIZE = 66;
const WRAP_HEIGHT = BAR_HEIGHT + BUTTON_SIZE / 2;

// A fully custom tab bar, not just custom icons — the raised center button
// IS the study buddy's own avatar (not a generic icon), so "go home" reads
// as "go see your buddy" rather than a plain nav destination. Home is
// intentionally left out of the side-icon set: it's the button, not a row item.
export function FloatingTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { pet, energy, growthStage } = usePetCompanion();

  const homeRoute = state.routes.find((r) => r.name === "home");
  const homeFocused = homeRoute ? state.routes[state.index].key === homeRoute.key : false;

  const sideRoutes = SIDE_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => !!r,
  );
  const leftSide = sideRoutes.slice(0, 2);
  const rightSide = sideRoutes.slice(2);

  function goTo(routeName: string, key: string, focused: boolean) {
    const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
  }

  function renderSideIcon(route: (typeof sideRoutes)[number]) {
    const icon = SIDE_ICONS[route.name];
    const focused = state.routes[state.index].key === route.key;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityLabel={icon.label}
        hitSlop={10}
        onPress={() => goTo(route.name, route.key, focused)}
      >
        <Ionicons name={focused ? icon.focused : icon.unfocused} size={22} color={focused ? colors.primary : colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: colors.background, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ height: WRAP_HEIGHT, alignItems: "center" }}>
        <View
          style={{
            position: "absolute",
            bottom: 0,
            width: 330,
            maxWidth: "94%",
            height: BAR_HEIGHT,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          {leftSide.map(renderSideIcon)}
          <View style={{ width: BUTTON_SIZE - 10 }} />
          {rightSide.map(renderSideIcon)}
        </View>

        {homeRoute && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Home — your buddy"
            onPress={() => goTo("home", homeRoute.key, homeFocused)}
            style={{
              position: "absolute",
              top: 0,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: BUTTON_SIZE / 2,
              backgroundColor: colors.primary,
              borderWidth: 5,
              borderColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.primary,
              shadowOpacity: homeFocused ? 0.55 : 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 12,
            }}
          >
            {pet ? (
              <StudyPet species={pet.species} energy={energy} growthStage={growthStage} size={44} />
            ) : (
              <Ionicons name="paw" size={26} color={colors.onPrimary} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
