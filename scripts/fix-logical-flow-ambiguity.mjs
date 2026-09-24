#!/usr/bin/env node
// Sentence-placement ("logical-flow") questions present a numbered passage
// like "(1)... (2)... (3)... (4)..." and ask where Sentence N should move.
// A generation bug: when both "No change" and "After Sentence {N-1}" appear
// as separate answer choices, they describe the byte-identical resulting
// paragraph (Sentence N already sits right after Sentence N-1 in the
// original numbering) — yet only one is marked correct. Found by the
// semantic review (batches 24-25 flagged 118 of these before this script
// existed); this scans the whole "logical-flow" skill tag (480 questions)
// to find every instance.
//
// Where the graded correct_choice is one of the two colliding options,
// grading is genuinely broken (a student picking the "wrong" one of the
// pair produces an identical passage but gets marked incorrect) — those
// questions are removed rather than patched, since fixing them well needs
// a genuinely new distractor, not a mechanical edit. Where correct_choice
// is a different (non-colliding) option, the question is still answerable
// correctly; those are left alone.
//
// Usage:
//   node scripts/fix-logical-flow-ambiguity.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-logical-flow-ambiguity.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function detectCollision(q) {
  if (q.skill_tag !== "logical-flow") return null;
  const m = (q.stem ?? "").match(/Sentence (\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n <= 1) return null;
  const naturalAfter = `after sentence ${n - 1}`;
  const choices = q.choices ?? [];
  const noChangeChoice = choices.find((c) => /no change/i.test(c.text ?? ""));
  const afterChoice = choices.find((c) => (c.text ?? "").trim().toLowerCase() === naturalAfter);
  if (!noChangeChoice || !afterChoice) return null;
  return { noChangeChoice, afterChoice };
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));

  const kept = [];
  let brokenGradingRemoved = 0;
  let collidingButGradingOk = 0;

  for (const q of questions) {
    const collision = detectCollision(q);
    if (!collision) {
      kept.push(q);
      continue;
    }
    const correctIsColliding = q.correct_choice === collision.noChangeChoice.key || q.correct_choice === collision.afterChoice.key;
    if (correctIsColliding) {
      brokenGradingRemoved++;
      continue; // drop the question
    }
    collidingButGradingOk++;
    kept.push(q); // grading is still fine; leave the redundant distractor as-is
  }

  console.log(`${questions.length} questions total.`);
  console.log(`${brokenGradingRemoved} logical-flow questions removed (correct answer was one of two choices describing the identical outcome).`);
  console.log(`${collidingButGradingOk} logical-flow questions have the same duplicate-choice quirk but a correct answer outside the colliding pair — left in place.`);
  console.log(`${kept.length} questions remain.`);

  if (args.write) {
    writeFileSync(args.file, JSON.stringify(kept, null, 2));
    console.log(`\nWrote fixed data back to ${args.file}`);
  } else {
    console.log("\nDry run — pass --write to save changes.");
  }
}

main();
