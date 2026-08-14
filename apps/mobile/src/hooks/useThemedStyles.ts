import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import type { ColorTokens } from "@/theme";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

// Screens build their styles from a factory (colors) => ({...}) instead of a
// module-scope StyleSheet.create, since a module only runs once — a static
// style object baked at import time can't react to the theme toggling later.
// Recomputes only when the resolved color tokens actually change.
export function useThemedStyles<T extends NamedStyles<T>>(factory: (colors: ColorTokens) => T) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  return { styles, colors };
}
