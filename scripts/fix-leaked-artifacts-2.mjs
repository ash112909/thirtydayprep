#!/usr/bin/env node
// Second wave of leaked generation-pipeline text found by the semantic
// review (batches 33/35): two more shapes of the same underlying problem
// as fix-leaked-artifacts.mjs — a parenthetical progress note prepended to
// the stem, or (in 2 cases) a whole preamble sentence ("Of course. Here are
// 85 SAT-style Math questions for the ... section...") before the real
// question starts.
//
// Usage:
//   node scripts/fix-leaked-artifacts-2.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const CONTINUING_RE = /^\(Continuing to generate[^)]*\)\s*/i;
const PREAMBLE_RE = /^Of course\.?\s*Here are.*?s\s*\d+-\d+\s+/is;
const FINAL_N_RE = /^\(Final \d+ questions? to follow\)\s*/i;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-leaked-artifacts-2.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    if (typeof q.stem !== "string") continue;
    const before = q.stem;
    let after = before.replace(CONTINUING_RE, "").replace(PREAMBLE_RE, "").replace(FINAL_N_RE, "");
    after = after.trim();
    if (after !== before) {
      q.stem = after;
      fixed++;
    }
  }

  console.log(`${fixed} stems had leaked generation text stripped.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
