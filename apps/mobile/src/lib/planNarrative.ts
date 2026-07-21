// Turns a day's raw targets (subcategory/difficulty/count triples) into a
// short, tutor-voice explanation of what the day covers and why — composed
// algorithmically from the actual targeting data (mastery scores, question
// counts), not a canned or AI-generated blurb. Two short sentences, at most:
// this runs every single day, so it needs to read like guidance, not filler.

import type { DayTarget, MasterySnapshot, Subcategory } from "@/types/domain";

interface FocusArea {
  subcategoryId: string;
  name: string;
  count: number;
  mastery: number | null;
}

const OPENERS: Record<"low" | "mid" | "high" | "unknown", string[]> = {
  low: [
    "Today leans into {name} — it's been one of your tougher areas, so we're giving it extra reps.",
    "{name} gets the most attention today. It's an area that needs more work, so we're building it up.",
  ],
  mid: [
    "Today puts extra weight on {name} to keep building on the progress you're making there.",
    "{name} is the focus today — you're improving there, and a few more reps will keep that going.",
  ],
  high: [
    "Today gives {name} a bit of extra attention, just to keep a strong skill sharp.",
    "{name} shows up the most today — you're solid there, so this is about staying sharp, not catching up.",
  ],
  unknown: [
    "Today spends extra time on {name} to get a clearer read on where you stand.",
    "{name} is the focus today, mostly to see how you handle it before we adjust the plan around it.",
  ],
};

const SECONDARY_TEMPLATES = [
  "You'll also see {names} mixed in to keep progress moving across the board.",
  "Rounding things out, there's a bit of {names} too.",
];

const BALANCED_TEMPLATES = [
  "Today balances {names} — all worth extra reps right now.",
  "Today splits time fairly evenly across {names}.",
];

function masteryTier(mastery: number | null): "low" | "mid" | "high" | "unknown" {
  if (mastery == null) return "unknown";
  if (mastery < 40) return "low";
  if (mastery < 70) return "mid";
  return "high";
}

function pick<T>(options: T[], seed: number): T {
  return options[Math.abs(seed) % options.length];
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function buildDayNarrative(
  dayNumber: number,
  targets: DayTarget[],
  subcategories: Subcategory[],
  mastery: MasterySnapshot,
): string[] {
  if (!targets.length) return ["Nothing scheduled for this day yet."];

  const nameById = new Map(subcategories.map((s) => [s.id, s.name]));
  const countBySubcategory = new Map<string, number>();
  for (const t of targets) {
    countBySubcategory.set(t.subcategory_id, (countBySubcategory.get(t.subcategory_id) ?? 0) + t.count);
  }

  const areas: FocusArea[] = [...countBySubcategory.entries()]
    .map(([subcategoryId, count]) => ({
      subcategoryId,
      name: nameById.get(subcategoryId) ?? "a topic",
      count,
      mastery: mastery[subcategoryId] ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  const [primary, ...rest] = areas;
  const isBalanced = rest.length > 0 && rest[0].count >= primary.count - 1;

  if (isBalanced && areas.length <= 3) {
    const names = joinNames(areas.map((a) => a.name));
    return [pick(BALANCED_TEMPLATES, dayNumber).replace("{names}", names)];
  }

  const tier = masteryTier(primary.mastery);
  const opener = pick(OPENERS[tier], dayNumber).replace("{name}", primary.name);

  if (!rest.length) return [opener];

  const secondaryNames = rest.slice(0, 3).map((a) => a.name);
  const suffix = rest.length > 3 ? " and a few others" : "";
  const secondary = pick(SECONDARY_TEMPLATES, dayNumber + primary.count)
    .replace("{names}", joinNames(secondaryNames) + suffix);

  return [opener, secondary];
}
