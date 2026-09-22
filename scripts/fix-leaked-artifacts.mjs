#!/usr/bin/env node
// Strips a leaked generation-pipeline note ("(Completing the final 45
// questions.)") that ended up embedded in a handful of question stems —
// found by the semantic review pass, not the structural one, since it's
// syntactically valid text, just not meant to be student-facing.
//
// Usage:
//   node scripts/fix-leaked-artifacts.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const LEAK_RE = /\(Completing the final \d+ questions?\.\)\s*/gi;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-leaked-artifacts.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    for (const field of ["stem", "passage", "explanation"]) {
      if (typeof q[field] === "string" && LEAK_RE.test(q[field])) {
        LEAK_RE.lastIndex = 0;
        q[field] = q[field].replace(LEAK_RE, "").trim();
        fixed++;
      }
      LEAK_RE.lastIndex = 0;
    }
  }

  console.log(`${fixed} fields had a leaked artifact stripped.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
