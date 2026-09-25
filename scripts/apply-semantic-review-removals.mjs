#!/usr/bin/env node
// Applies the final removal list from the full 73-batch semantic review:
// questions confirmed broken (wrong answer key, ambiguous, a bad
// distractor, unresolvable explanation mismatch, or low-quality/garbled
// content) get removed rather than auto-corrected — parsing a "the right
// answer is X" free-text reasoning string and writing it back is a good
// way to introduce a NEW error, so removal is the safe default here.
//
// Usage:
//   node scripts/apply-semantic-review-removals.mjs --file=./supabase/seed/firestore_questions.json --removals=./removal-list.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file || !args.removals) {
    console.error("Usage: node scripts/apply-semantic-review-removals.mjs --file=... --removals=... [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  const removals = JSON.parse(readFileSync(args.removals, "utf-8"));
  const removeIds = new Set(removals.map((r) => r.external_id));

  const kept = questions.filter((q) => !removeIds.has(q.external_id));
  const removedCount = questions.length - kept.length;

  console.log(`${questions.length} questions before, ${removedCount} removed, ${kept.length} remain.`);
  if (removedCount !== removeIds.size) {
    console.log(`Note: removal list had ${removeIds.size} unique ids but only ${removedCount} matched a row (some may already be gone).`);
  }

  if (args.write) {
    writeFileSync(args.file, JSON.stringify(kept, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
