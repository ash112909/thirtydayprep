#!/usr/bin/env node
// 2 questions have a simple 2-column "x | y" data table collapsed with no
// row delimiter at all (not even the "| |" boundary the other inline-table
// bug had) — just "x | y" as a bare header followed by space-joined
// "num | num" pairs. Reformats them into proper multi-line markdown tables
// so StemText's table renderer picks them up.
//
// Usage:
//   node scripts/fix-xy-table-stems.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const HEADER_RE = /\b([A-Za-z])\s*\|\s*([A-Za-z])\b/;
const rowRe = () => /(-?\d+(?:\.\d+)?)\s*\|\s*(-?\d+(?:\.\d+)?)/g;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-xy-table-stems.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function reformat(text) {
  const headerMatch = text.match(HEADER_RE);
  if (!headerMatch) return null;

  const leadingProse = text.slice(0, headerMatch.index).trim();
  const afterHeader = text.slice(headerMatch.index + headerMatch[0].length);

  const matches = [...afterHeader.matchAll(rowRe())];
  if (!matches.length) return null;
  const rows = matches.map((m) => [m[1], m[2]]);

  const lastRowMatch = matches[matches.length - 1];
  const trailingProse = afterHeader.slice(lastRowMatch.index + lastRowMatch[0].length).trim();

  const lines = [
    leadingProse,
    `| ${headerMatch[1]} | ${headerMatch[2]} |`,
    "| :---: | :---: |",
    ...rows.map(([a, b]) => `| ${a} | ${b} |`),
    trailingProse,
  ].filter((l) => l.length > 0);
  return lines.join("\n");
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    if (typeof q.stem !== "string" || !HEADER_RE.test(q.stem) || !rowRe().test(q.stem)) continue;
    const reformatted = reformat(q.stem);
    if (!reformatted) {
      console.log(`Could not parse ${q.external_id} — left unchanged.`);
      continue;
    }
    console.log(`=== ${q.external_id} ===`);
    console.log(reformatted);
    console.log();
    q.stem = reformatted;
    fixed++;
  }

  console.log(`${fixed} stems reformatted.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
