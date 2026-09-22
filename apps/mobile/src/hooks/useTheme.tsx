import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ColorTokens } from "@/theme";
import { findSceneTheme } from "@/lib/sceneThemes";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "thirtydayprep.themeMode";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorTokens;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  // Called by PetCompanionProvider whenever the pet's equipped scene theme
  // changes, so a theme with its own accent (see sceneThemes.ts) recolors
  // the whole app, not just the backyard scene.
  setAccentTheme: (themeId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // Starts from the device's own preference, then a saved manual override
  // (if any) applies once AsyncStorage resolves a moment later.
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === "light" ? "light" : "dark");
  const [accentThemeId, setAccentThemeId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setModeState(saved);
    });
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  function toggleTheme() {
    setMode(mode === "dark" ? "light" : "dark");
  }

  const setAccentTheme = useCallback((themeId: string | null) => setAccentThemeId(themeId), []);

  const colors = useMemo<ColorTokens>(() => {
    const base = mode === "light" ? lightColors : darkColors;
    const accent = accentThemeId ? findSceneTheme(accentThemeId).accent : undefined;
    return accent ? { ...base, primary: accent.primary, onPrimary: accent.onPrimary } : base;
  }, [mode, accentThemeId]);

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setMode, setAccentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
