#!/usr/bin/env node
// "No change is needed." is a multiple_choice answer option's text (for
// punctuation/grammar questions), but the semantic review (batch 45) found
// it leaking onto the END of the passage text itself in 166 questions —
// bad on its own (confusing, reads like a non-sequitur), and in 107 of
// those cases it also happens to be the actual correct answer, which
// straight-up hands the student the answer before they've read the
// choices. Always trails cleanly at the end (never mid-passage, verified),
// so a plain trailing strip is safe.
//
// Usage:
//   node scripts/fix-leaked-no-change.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const TRAILING_RE = /\s*No change is needed\.?\s*$/i;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-leaked-no-change.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    if (typeof q.passage !== "string" || !TRAILING_RE.test(q.passage)) continue;
    q.passage = q.passage.replace(TRAILING_RE, "").trim();
    fixed++;
  }

  console.log(`${fixed} passages had a leaked "No change is needed." trailer stripped.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
