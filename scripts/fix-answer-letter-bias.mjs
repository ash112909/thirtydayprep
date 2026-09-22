#!/usr/bin/env node
// Reshuffles each multiple_choice question's choice order (A/B/C/D slots
// stay fixed; which choice TEXT lands in which slot is randomized) so the
// correct answer's letter isn't predictable. Several skill tags in the raw
// bank were badly skewed — e.g. source-integration was correct_choice="A"
// on 480/480 questions — which lets a student "solve" those by pattern
// rather than by reading the passage, undermining both practice and the
// mock-test score's validity for that skill.
//
// The shuffle is seeded per-question (from external_id), not from Math.random,
// so re-running this script against the same input is a no-op after the
// first pass — safe to re-run without re-scrambling already-fixed data.
//
// Usage:
//   node scripts/fix-answer-letter-bias.mjs --file=./supabase/seed/firestore_questions.json [--write]

import { readFileSync, writeFileSync } from "node:fs";

const KEYS = ["A", "B", "C", "D"];

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-answer-letter-bias.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

// FNV-1a string hash -> deterministic 32-bit seed per question.
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 PRNG — small, deterministic, good enough for a shuffle.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleTexts(texts, rand) {
  const arr = [...texts];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function reshuffleQuestion(q, stats) {
  if (q.question_type !== "multiple_choice" || !Array.isArray(q.choices) || q.choices.length !== 4) return;
  const keys = q.choices.map((c) => c.key);
  if (!KEYS.every((k, i) => keys[i] === k)) return; // already-flagged malformed row — leave to manual review

  const correctIdx = q.choices.findIndex((c) => c.key === q.correct_choice);
  if (correctIdx === -1) return; // unresolved answer key — leave to manual review

  const texts = q.choices.map((c) => c.text);
  if (new Set(texts).size !== texts.length) return; // duplicate choice text — already flagged for manual review; indexOf below would be ambiguous

  const rand = mulberry32(hashSeed(q.external_id ?? JSON.stringify(q.stem)));
  const shuffled = shuffleTexts(texts, rand);

  const newCorrectIdx = shuffled.indexOf(texts[correctIdx]);

  q.choices = KEYS.map((key, i) => ({ key, text: shuffled[i] }));
  q.correct_choice = KEYS[newCorrectIdx];

  if (newCorrectIdx !== correctIdx) stats.reshuffled++;
}

function main() {
  const args = parseArgs();
  const questions = JSON.parse(readFileSync(args.file, "utf-8"));
  const stats = { reshuffled: 0 };

  for (const q of questions) reshuffleQuestion(q, stats);

  const mc = questions.filter((q) => q.question_type === "multiple_choice");
  const dist = {};
  for (const q of mc) dist[q.correct_choice] = (dist[q.correct_choice] ?? 0) + 1;

  console.log(`${questions.length} questions processed, ${stats.reshuffled} had their correct answer's letter moved.`);
  console.log("New overall correct_choice distribution:", dist);

  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`\nWrote reshuffled data back to ${args.file}`);
  } else {
    console.log("\nDry run — pass --write to save changes.");
  }
}

main();
