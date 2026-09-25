#!/usr/bin/env node
// A handful of grid_in questions (found by semantic review, batches 67/68)
// have correct_value holding a leaked multiple-choice letter prefix like
// "C) 4" instead of a clean "4" — leftover from a source template that was
// multiple_choice before being converted to grid_in. The number itself was
// always correct; only the prefix needs stripping.
//
// Usage:
//   node scripts/fix-leaked-mc-prefix.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const PREFIX_RE = /^[A-D]\)\s*/;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-leaked-mc-prefix.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    if (q.question_type !== "grid_in" || typeof q.correct_value !== "string" || !PREFIX_RE.test(q.correct_value)) continue;
    q.correct_value = q.correct_value.replace(PREFIX_RE, "").trim();
    fixed++;
  }

  console.log(`${fixed} correct_value fields had a leaked multiple-choice prefix stripped.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
