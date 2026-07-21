// Turns a day's raw targets (subcategory/difficulty/count triples) into a
// short, tutor-voice explanation of what the day covers and why — composed
// algorithmically from the actual targeting data (mastery scores, question
// counts), not a canned or AI-generated blurb. Two short sentences, at most:
// this runs every single day, so it needs to read like guidance, not filler.
//
// Selection is seeded off day number + subcategory + count (not just day
// number) so wording doesn't fall into an obvious every-other-day pattern —
// two days with the same focus area still tend to read differently because
// the underlying numbers differ.

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
    "{name} gets the most attention today. It's still catching up, so we're building it up with more practice.",
    "We're doubling down on {name} today since it's been a sticking point — a bit more repetition should help it click.",
    "Today's mix is weighted toward {name}. You're at {score}% there right now, so there's real room to grow.",
    "{name} takes the lead today. It's one of the spots that needs the most work, so expect a bigger dose of it.",
  ],
  mid: [
    "Today puts extra weight on {name} to keep building on the progress you're making there.",
    "{name} is the focus today — you're improving there, and a few more reps will keep that going.",
    "We're keeping the pressure on {name} today. You're around {score}% there, trending in the right direction.",
    "Today leans on {name} a bit more than usual, right where you're mid-climb and making steady gains.",
    "{name} shows up most today — solid progress so far, and today keeps that momentum going.",
  ],
  high: [
    "Today gives {name} a bit of extra attention, just to keep a strong skill sharp.",
    "{name} shows up the most today — you're solid there, so this is about staying sharp, not catching up.",
    "You've got {name} pretty well handled, around {score}%, so today's about keeping it that way.",
    "Today spends a little extra time on {name}, mostly as maintenance for a skill you've already got down.",
    "{name} leads today's lineup — less about catching up, more about staying consistent.",
  ],
  unknown: [
    "Today spends extra time on {name} to get a clearer read on where you stand.",
    "{name} is the focus today, mostly to see how you handle it before we adjust the plan around it.",
    "We haven't seen much of {name} from you yet, so today digs in to get a real read on it.",
    "Today puts {name} front and center — partly practice, partly a chance to see where you actually stand.",
    "{name} takes priority today while we build a clearer picture of your skills there.",
  ],
};

const SECONDARY_TEMPLATES = [
  "You'll also see {names} mixed in to keep progress moving across the board.",
  "Rounding things out, there's a bit of {names} too.",
  "Today also touches on {names}, just enough to keep them warm.",
  "There's a lighter dose of {names} in the mix as well.",
  "You'll get a few {names} questions too, to keep other areas from going stale.",
];

const BALANCED_TEMPLATES = [
  "Today balances {names} — all worth extra reps right now.",
  "Today splits time fairly evenly across {names}.",
  "No single focus today — {names} all get roughly equal attention.",
  "Today's a mixed bag: {names}, split about evenly.",
  "You'll work through {names} today in roughly equal measure.",
];

function masteryTier(mastery: number | null): "low" | "mid" | "high" | "unknown" {
  if (mastery == null) return "unknown";
  if (mastery < 40) return "low";
  if (mastery < 70) return "mid";
  return "high";
}

// Small FNV-1a style string hash — deterministic, but spreads similar inputs
// (e.g. consecutive day numbers) far enough apart that template selection
// doesn't visibly alternate or cycle.
function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

function pick<T>(options: T[], seed: number): T {
  return options[seed % options.length];
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
    const seed = hashSeed(dayNumber, "balanced", areas.map((a) => a.subcategoryId).join(","));
    return [pick(BALANCED_TEMPLATES, seed).replace("{names}", names)];
  }

  const tier = masteryTier(primary.mastery);
  const openerSeed = hashSeed(dayNumber, tier, primary.subcategoryId, primary.count);
  let opener = pick(OPENERS[tier], openerSeed).replace(/\{name\}/g, primary.name);
  if (primary.mastery != null) {
    opener = opener.replace(/\{score\}/g, String(Math.round(primary.mastery)));
  }

  if (!rest.length) return [opener];

  const secondaryNames = rest.slice(0, 3).map((a) => a.name);
  const suffix = rest.length > 3 ? " and a few others" : "";
  const secondarySeed = hashSeed(dayNumber, "secondary", rest[0].subcategoryId, rest[0].count);
  const secondary = pick(SECONDARY_TEMPLATES, secondarySeed).replace(
    "{names}",
    joinNames(secondaryNames) + suffix,
  );

  return [opener, secondary];
}
