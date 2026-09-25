#!/usr/bin/env node
// Semantic review (batches 55 and others) found a systemic bug across
// several multiple_choice skill tags (sentence-structure, logical-
// transitions, supporting-evidence, and a handful of math ones): the
// explanation names a single "Option X" and describes real content that
// justifies the correct answer — but X is the wrong letter. Verified by
// hand across 6 samples spanning 3 skill tags: in every case the content
// described in the explanation actually belongs to the choice already
// stored in correct_choice, not to the letter the explanation names —
// grading was never wrong, just the label shown to the student. Since
// each affected explanation mentions exactly one distinct "Option X" (only
// 1 exception, skipped), the safe fix is a straight relabel to whichever
// letter correct_choice already holds.
//
// Usage:
//   node scripts/fix-explanation-letter-mismatch.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-explanation-letter-mismatch.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;
  let skippedAmbiguous = 0;

  for (const q of questions) {
    if (q.question_type !== "multiple_choice" || typeof q.explanation !== "string" || !q.correct_choice) continue;
    const matches = q.explanation.match(/\bOption [A-D]\b/g);
    if (!matches || matches.length === 0) continue;
    const distinct = new Set(matches);
    if (distinct.size > 1) {
      skippedAmbiguous++;
      continue;
    }
    const cited = matches[0].slice(-1);
    if (cited === q.correct_choice) continue;
    q.explanation = q.explanation.split(matches[0]).join(`Option ${q.correct_choice}`);
    fixed++;
  }

  console.log(`${fixed} explanations relabeled to cite the actual correct_choice letter.`);
  console.log(`${skippedAmbiguous} skipped (explanation references more than one distinct option letter — needs manual review).`);

  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`\nWrote fixed data back to ${args.file}`);
  } else {
    console.log("\nDry run — pass --write to save changes.");
  }
}

main();
