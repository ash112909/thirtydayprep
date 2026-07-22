// Maps each existing achievement (src/lib/achievements.ts) to a cosmetic
// accessory for the study pet, so unlocking one thing (a real achievement)
// unlocks the other (something to show off) — no separate unlock system.

export interface AccessoryDef {
  id: string;
  achievementId: string;
  name: string;
  icon: string; // emoji shown in list UI, not the pet itself (that's SVG)
}

export const ACCESSORIES: AccessoryDef[] = [
  { id: "bandana", achievementId: "first-day", name: "Bandana", icon: "🧣" },
  { id: "sunglasses", achievementId: "week-streak", name: "Sunglasses", icon: "🕶️" },
  { id: "bowtie", achievementId: "two-week-streak", name: "Bow Tie", icon: "🎀" },
  { id: "backpack", achievementId: "halfway", name: "Backpack", icon: "🎒" },
  { id: "gradcap", achievementId: "plan-complete", name: "Graduation Cap", icon: "🎓" },
  { id: "scarf", achievementId: "century", name: "Scarf", icon: "🧶" },
  { id: "medal", achievementId: "sharpshooter", name: "Medal", icon: "🏅" },
  { id: "explorerhat", achievementId: "no-stone-unturned", name: "Explorer Hat", icon: "🪖" },
];
