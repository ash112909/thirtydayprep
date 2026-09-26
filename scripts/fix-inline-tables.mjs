#!/usr/bin/env node
// A handful of questions have a markdown pipe table collapsed onto a
// single line within their stem (no real newlines between rows), which is
// exactly why it rendered as run-together inline text in the app. This
// reformats those stems to put each table row on its own line, using the
// separator row ("| :---: | :---: |") to determine the column count N,
// then extracting exactly-N-cell "|...|" runs before and after it as the
// header/data rows — since row boundaries in the collapsed text are just a
// single space between one row's closing "|" and the next row's opening
// "|", which is otherwise indistinguishable from an empty cell.
//
// Usage:
//   node scripts/fix-inline-tables.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const SEPARATOR_RE = /\|(?:\s*:?-{2,}:?\s*\|)+/;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-inline-tables.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function reformat(text) {
  const sepMatch = text.match(SEPARATOR_RE);
  if (!sepMatch) return null;

  const columnCount = (sepMatch[0].match(/\|/g) || []).length - 1;
  const rowRe = new RegExp(`\\|(?:[^|]*\\|){${columnCount}}`, "g");

  const before = text.slice(0, sepMatch.index);
  const beforeRows = [...before.matchAll(rowRe)];
  if (!beforeRows.length) return null;
  const headerMatch = beforeRows[beforeRows.length - 1];
  const leadingProse = before.slice(0, headerMatch.index).trim();
  const headerRow = headerMatch[0].trim();
  const separatorRow = sepMatch[0].trim();

  let rest = text.slice(sepMatch.index + sepMatch[0].length);
  const dataRows = [];
  while (true) {
    const m = rest.match(new RegExp(`^\\s*(\\|(?:[^|]*\\|){${columnCount}})`));
    if (!m) break;
    dataRows.push(m[1].trim());
    rest = rest.slice(m[0].length);
  }
  const trailingProse = rest.trim();

  const lines = [leadingProse, headerRow, separatorRow, ...dataRows, trailingProse].filter((l) => l.length > 0);
  return lines.join("\n");
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fixed = 0;

  for (const q of questions) {
    if (typeof q.stem !== "string" || !SEPARATOR_RE.test(q.stem)) continue;
    const reformatted = reformat(q.stem);
    if (!reformatted) {
      console.log(`Could not parse table in ${q.external_id} — left unchanged.`);
      continue;
    }
    console.log(`=== ${q.external_id} ===`);
    console.log(reformatted);
    console.log();
    q.stem = reformatted;
    fixed++;
  }

  console.log(`${fixed} stems reformatted with real newlines.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
