// The buddy's "voice" during a session — kept separate from petState.ts on
// purpose: petState governs the pet's mood/animation (streak-driven, never
// accuracy-driven), while this is just copy. A wrong answer still gets a
// warm, matter-of-fact line, never a scolding one — the pet's presence here
// is about coaching through the explanation, not judging the result.

const CORRECT_LINES = [
  "Nice work! 🎉",
  "That's exactly right.",
  "You nailed it.",
  "Yes! Great instinct there.",
  "Correct — nice reasoning.",
  "Got it in one.",
];

const INCORRECT_LINES = [
  "Not quite — here's the idea:",
  "Close! Let's break it down:",
  "No worries, here's why:",
  "That one's tricky. Here's what's going on:",
  "Missed it this time — here's the reasoning:",
  "All good, here's the explanation:",
];

const SESSION_COMPLETE_LINES = [
  "Great session — see you tomorrow!",
  "That's a wrap. Nice work today.",
  "Session complete. You're building real momentum.",
  "Done for today — proud of that consistency.",
  "Solid session. Rest up, we'll pick it back up tomorrow.",
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function pickTutorLine(isCorrect: boolean): string {
  return pick(isCorrect ? CORRECT_LINES : INCORRECT_LINES);
}

export function pickSessionCompleteLine(): string {
  return pick(SESSION_COMPLETE_LINES);
}

// What the buddy says on Home — the one place it should feel like an
// actual character living in the app rather than a badge that just links
// away. Priority: a real streak on the line beats a suggested topic beats
// a plain greeting, so it never nags about a weak topic while a streak is
// about to break.
function streakRiskLines(streak: number): string[] {
  return [
    `Don't let our ${streak}-day streak slip — finish today's session before you call it a day.`,
    `We're ${streak} days deep. Let's not break that tonight!`,
  ];
}

function focusTopicLines(topic: string): string[] {
  return [`Want to knock out some ${topic} together? That's where the easiest points are right now.`, `I noticed ${topic} could use some love — up for a quick round?`];
}

function streakLines(streak: number): string[] {
  return [`${streak} days in a row — you're on a roll!`, `Nice work keeping that ${streak}-day streak alive.`];
}

const GREETING_LINES = ["Ready when you are — let's make today count.", "I'll be here cheering you on today.", "Let's keep the momentum going!"];

export function pickHomeBuddyLine(opts: { streakAtRisk: boolean; streak: number; focusTopicName: string | null }): string {
  if (opts.streakAtRisk) return pick(streakRiskLines(opts.streak));
  if (opts.focusTopicName) return pick(focusTopicLines(opts.focusTopicName));
  if (opts.streak > 0) return pick(streakLines(opts.streak));
  return pick(GREETING_LINES);
}
