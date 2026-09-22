export interface SceneTheme {
  id: string;
  name: string;
  icon: string;
  cost: number;
  skyTop: string;
  skyBottom: string;
  grassTop: string;
  grassBottom: string;
}

// "classic" is the original auto day/night scene (free, always owned) —
// every other theme is a fixed aesthetic that overrides the time-of-day
// colors entirely, since picking a vibe is a deliberate choice, not a
// simulation of the actual sky outside.
export const SCENE_THEMES: SceneTheme[] = [
  {
    id: "classic",
    name: "Classic",
    icon: "🌤️",
    cost: 0,
    skyTop: "#7DD3FC",
    skyBottom: "#BAE6FD",
    grassTop: "#3F7D52",
    grassBottom: "#2F5F3E",
  },
  {
    id: "sunset",
    name: "Golden Hour",
    icon: "🌇",
    cost: 80,
    skyTop: "#FB923C",
    skyBottom: "#7C2D12",
    grassTop: "#78350F",
    grassBottom: "#451A03",
  },
  {
    id: "cotton_candy",
    name: "Cotton Candy",
    icon: "🍭",
    cost: 80,
    skyTop: "#FBCFE8",
    skyBottom: "#C4B5FD",
    grassTop: "#A78BFA",
    grassBottom: "#7C3AED",
  },
  {
    id: "neon_night",
    name: "Neon Night",
    icon: "🌃",
    cost: 100,
    skyTop: "#1E1B4B",
    skyBottom: "#4C1D95",
    grassTop: "#312E81",
    grassBottom: "#1E1B4B",
  },
];

export function findSceneTheme(id: string | null | undefined): SceneTheme {
  return SCENE_THEMES.find((t) => t.id === id) ?? SCENE_THEMES[0];
}
