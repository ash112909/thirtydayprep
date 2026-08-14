// Every screen is capped to this width and centered on wide viewports (web
// browsers, large tablets) so the app reads as a mobile app throughout,
// rather than only the Buddy tab having that treatment.
export const MAX_APP_WIDTH = 480;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  // Text/icon color for content placed on top of a `primary`-colored
  // background — primary flips from a light cyan (dark mode) to a
  // saturated blue (light mode), so what reads well on it flips too.
  onPrimary: string;
  success: string;
  danger: string;
  warning: string;
}

export const darkColors: ColorTokens = {
  background: "#0F172A",
  surface: "#1E293B",
  surfaceAlt: "#273449",
  border: "#334155",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  primary: "#38BDF8",
  onPrimary: "#0F172A",
  success: "#4ADE80",
  danger: "#F87171",
  warning: "#FBBF24",
};

export const lightColors: ColorTokens = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  primary: "#0284C7",
  onPrimary: "#FFFFFF",
  success: "#15803D",
  danger: "#DC2626",
  warning: "#B45309",
};

// A static fallback for any code that hasn't been switched over to
// useTheme() yet — always dark, so it degrades gracefully (rather than
// crashing) instead of responding to the light/dark toggle.
export const colors = darkColors;
