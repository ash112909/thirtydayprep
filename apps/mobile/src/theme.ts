// Every screen is capped to this width and centered on wide viewports (web
// browsers, large tablets) so the app reads as a mobile app throughout,
// rather than only the Buddy tab having that treatment.
export const MAX_APP_WIDTH = 480;

// Bricolage Grotesque for display type (greetings, stat numbers, section
// headlines) — Plus Jakarta Sans for everything else. Loaded via
// @expo-google-fonts in app/_layout.tsx; these are the exact family names
// that package registers with the RN font system.
export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displaySemibold: "BricolageGrotesque_700Bold",
  displayMedium: "BricolageGrotesque_600SemiBold",
  body: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
  bodyExtraBold: "PlusJakartaSans_800ExtraBold",
};

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
  // A citrus-and-pink duotone alongside the buddy's orange, not just one
  // muted accent on gray — secondary (lime) and accentPop (pink) are used
  // for the second-tier CTA/highlight moments (e.g. the shareable recap).
  secondary: string;
  onSecondary: string;
  accentPop: string;
  onAccentPop: string;
  success: string;
  danger: string;
  warning: string;
}

export const darkColors: ColorTokens = {
  // A warm near-black instead of a cool corporate slate — reads as a
  // designed consumer app rather than an admin dashboard.
  background: "#17130E",
  surface: "#221C14",
  surfaceAlt: "#2C241A",
  border: "#3A3225",
  text: "#FFF8EE",
  textMuted: "#B8AC9C",
  // Pulled from the study buddy's own fur/collar colors, not a generic
  // dashboard blue, so the accent color reads as "the buddy's color"
  // wherever it shows up (buttons, active tab, progress fills).
  primary: "#FF7A1A",
  onPrimary: "#17130E",
  secondary: "#C6FF3D",
  onSecondary: "#17130E",
  accentPop: "#FF3D81",
  onAccentPop: "#17130E",
  success: "#4ADE80",
  danger: "#FF5470",
  warning: "#FFC93D",
};

export const lightColors: ColorTokens = {
  background: "#FFF9F0",
  surface: "#FFFFFF",
  surfaceAlt: "#FDF1E1",
  border: "#F0E4D0",
  text: "#241A0D",
  textMuted: "#8A7A63",
  primary: "#E8600A",
  onPrimary: "#FFFFFF",
  // Darker than dark mode's lime — the bright version has too little
  // contrast to use as text/icon color on a light background, only ever
  // safe as a fill with dark text on top.
  secondary: "#5C8A0A",
  onSecondary: "#FFFFFF",
  accentPop: "#D6216B",
  onAccentPop: "#FFFFFF",
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
