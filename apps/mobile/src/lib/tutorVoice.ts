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
