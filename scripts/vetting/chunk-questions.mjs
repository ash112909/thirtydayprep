#!/usr/bin/env node
// Splits the question bank into fixed-size batches for LLM semantic review
// (see scripts/vetting/README.md). Each batch is a plain JSON array written
// to --out-dir, named batch-0001.json, batch-0002.json, etc.
//
// Usage:
//   node scripts/vetting/chunk-questions.mjs --file=./supabase/seed/firestore_questions.json --out-dir=/tmp/batches --size=200

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file || !args["out-dir"]) {
    console.error("Usage: node scripts/vetting/chunk-questions.mjs --file=... --out-dir=... [--size=200]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const size = Number(args.size ?? 200);
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  mkdirSync(args["out-dir"], { recursive: true });

  const batchCount = Math.ceil(questions.length / size);
  const manifest = [];
  for (let i = 0; i < batchCount; i++) {
    const batch = questions.slice(i * size, (i + 1) * size);
    const name = `batch-${String(i + 1).padStart(4, "0")}.json`;
    // Only the fields a content review actually needs — leaves out nothing
    // relevant, but keeps each batch file (and therefore the reviewing
    // agent's prompt) as lean as possible.
    const slim = batch.map((q) => ({
      external_id: q.external_id,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      question_type: q.question_type,
      passage: q.passage,
      stem: q.stem,
      choices: q.choices,
      correct_choice: q.correct_choice,
      correct_value: q.correct_value,
      explanation: q.explanation,
    }));
    writeFileSync(`${args["out-dir"]}/${name}`, JSON.stringify(slim, null, 2));
    manifest.push({ file: name, count: batch.length });
  }

  writeFileSync(`${args["out-dir"]}/manifest.json`, JSON.stringify({ batchSize: size, total: questions.length, batches: manifest }, null, 2));
  console.log(`Wrote ${batchCount} batches (size ${size}) of ${questions.length} questions to ${args["out-dir"]}`);
}

main();
