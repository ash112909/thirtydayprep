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
  // background — primary flips from a bright amber (dark mode) to a
  // deeper burnt orange (light mode), so what reads well on it flips too.
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
  // Pulled from the study buddy's own fur/collar colors, not a generic
  // dashboard blue, so the accent color reads as "the buddy's color"
  // wherever it shows up (buttons, active tab, progress fills).
  primary: "#FB923C",
  onPrimary: "#431407",
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
  primary: "#EA580C",
  onPrimary: "#FFFFFF",
  success: "#15803D",
  danger: "#DC2626",
  warning: "#B45309",
};

// A shared elevation recipe for the handful of "hero" cards that should
// read as raised above the flat background (vs. the plain bordered cards
// used everywhere else) — spread into a card's style object.
export const cardElevation = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

// A static fallback for any code that hasn't been switched over to
// useTheme() yet — always dark, so it degrades gracefully (rather than
// crashing) instead of responding to the light/dark toggle.
export const colors = darkColors;
