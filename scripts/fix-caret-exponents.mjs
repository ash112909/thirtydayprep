#!/usr/bin/env node
// 1,122 questions in the bank already use proper unicode superscript
// digits (x², x³) for exponents — a separate ~89 questions (concentrated
// in advanced-math/factoring) instead use a literal caret ("x^2"), which
// renders as a bare "^" character since nothing in the app interprets
// caret notation. Converts the purely-numeric cases (x^2, x^10, etc.) to
// the same unicode superscript convention the rest of the bank already
// uses. Leaves variable exponents (e.g. "(1+r)^t") untouched — silently
// dropping those from the sweep is safer than guessing a rendering for a
// non-numeric superscript.
//
// Usage:
//   node scripts/fix-caret-exponents.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const SUPERSCRIPT_DIGITS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const CARET_EXPONENT_RE = /(?<=[A-Za-z0-9\)])\^(\d+)/g;

function toSuperscript(digits) {
  return digits.split("").map((d) => SUPERSCRIPT_DIGITS[d]).join("");
}

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-caret-exponents.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  let fieldsFixed = 0;
  let questionsFixed = 0;

  for (const q of questions) {
    let changed = false;
    for (const field of ["stem", "explanation"]) {
      const text = q[field];
      if (typeof text !== "string" || !/[A-Za-z0-9\)]\^\d+/.test(text)) continue;
      const replaced = text.replace(CARET_EXPONENT_RE, (_, digits) => toSuperscript(digits));
      if (replaced !== text) {
        q[field] = replaced;
        fieldsFixed++;
        changed = true;
      }
    }
    if (Array.isArray(q.choices)) {
      for (const c of q.choices) {
        if (typeof c.text !== "string" || !/[A-Za-z0-9\)]\^\d+/.test(c.text)) continue;
        const replaced = c.text.replace(CARET_EXPONENT_RE, (_, digits) => toSuperscript(digits));
        if (replaced !== c.text) {
          c.text = replaced;
          fieldsFixed++;
          changed = true;
        }
      }
    }
    if (changed) questionsFixed++;
  }

  console.log(`${fieldsFixed} fields across ${questionsFixed} questions had caret exponents converted to unicode superscript.`);
  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`Wrote fixed data back to ${args.file}`);
  } else {
    console.log("Dry run — pass --write to save changes.");
  }
}

main();
