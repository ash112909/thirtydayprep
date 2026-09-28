#!/usr/bin/env node
// Chunks the reading-writing "quantitative-information" questions (data
// tables serialized with no delimiter at all, e.g. "Month Attendance 1825
// Attendance 1826 January 320 340...") into batches for LLM-based table
// reconstruction. A regex can't reliably parse these: row labels are
// sometimes words ("January") and sometimes numbers ("1776", "100"), and
// column headers themselves often contain embedded numbers ("Attendance
// 1825"), so telling header from data requires actually reading the text.
//
// Usage:
//   node scripts/vetting/chunk-tables.mjs --file=... --out-dir=... [--size=25]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file || !args["out-dir"]) {
    console.error("Usage: node scripts/vetting/chunk-tables.mjs --file=... --out-dir=... [--size=25]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const size = Number(args.size ?? 25);
  const all = JSON.parse(readFileSync(args.file, "utf-8"));
  const questions = all.filter((q) => q.skill_tag === "quantitative-information");
  mkdirSync(args["out-dir"], { recursive: true });

  const batchCount = Math.ceil(questions.length / size);
  for (let i = 0; i < batchCount; i++) {
    const batch = questions.slice(i * size, (i + 1) * size).map((q) => ({
      external_id: q.external_id,
      stem: q.stem,
      passage: q.passage,
    }));
    const name = `table-batch-${String(i + 1).padStart(3, "0")}.json`;
    writeFileSync(`${args["out-dir"]}/${name}`, JSON.stringify(batch, null, 2));
  }

  console.log(`Wrote ${batchCount} batches (size ${size}) of ${questions.length} quantitative-information questions to ${args["out-dir"]}`);
}

main();
