#!/usr/bin/env node
// Structural/automated vetting pass over the raw question bank JSON (before
// import). Catches corruption and malformed rows deterministically — things
// an LLM review shouldn't need to spend a call on: bad answer keys, choice
// count mismatches, garbled encoding from the source export, out-of-bounds
// underline spans, exact duplicates. Doesn't judge whether an answer is
// actually *correct* — that's the LLM semantic pass's job.
//
// Usage:
//   node scripts/vet-questions-structural.mjs --file=./supabase/seed/firestore_questions.json [--out=./report.json]

import { readFileSync, writeFileSync } from "node:fs";

const VALID_SUBCATEGORIES = new Set([
  "information-and-ideas",
  "craft-and-structure",
  "expression-of-ideas",
  "standard-english-conventions",
  "algebra",
  "advanced-math",
  "problem-solving-data-analysis",
  "geometry-trigonometry",
]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_QUESTION_TYPES = new Set(["multiple_choice", "grid_in"]);
const EXPECTED_CHOICE_KEYS = ["A", "B", "C", "D"];
const MOJIBAKE_RE = /[ÃÂâ€]{2,}|�/;
const LEFTOVER_HTML_RE = /<\/?(p|br|span|div|b|i|em|strong)\b[^>]*>|&nbsp;|&amp;|&lt;|&gt;|&#\d+;/i;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/vet-questions-structural.mjs --file=./supabase/seed/firestore_questions.json");
    process.exit(1);
  }
  return args;
}

function addIssue(issues, code, detail) {
  issues.push({ code, detail });
}

function checkQuestion(q, seenExternalIds, seenFullContent) {
  const issues = [];

  if (!q.external_id || typeof q.external_id !== "string") {
    addIssue(issues, "missing_external_id", "");
  } else if (seenExternalIds.has(q.external_id)) {
    addIssue(issues, "duplicate_external_id", q.external_id);
  } else {
    seenExternalIds.add(q.external_id);
  }

  if (!VALID_SUBCATEGORIES.has(q.subcategory)) {
    addIssue(issues, "invalid_subcategory", String(q.subcategory));
  }
  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    addIssue(issues, "invalid_difficulty", String(q.difficulty));
  }
  if (!VALID_QUESTION_TYPES.has(q.question_type)) {
    addIssue(issues, "invalid_question_type", String(q.question_type));
  }

  // Grid-in math stems can legitimately be very short ("x/3 = 4"), so only
  // flag an actually empty/missing one rather than using a length floor.
  if (!q.stem || typeof q.stem !== "string" || q.stem.trim().length === 0) {
    addIssue(issues, "stem_missing", (q.stem ?? "").slice(0, 60));
  }

  if (typeof q.avg_seconds !== "number" || q.avg_seconds < 15 || q.avg_seconds > 240) {
    addIssue(issues, "avg_seconds_out_of_range", String(q.avg_seconds));
  }

  // A terse explanation ("d=2r=4.") is fine for a simple math question — only
  // flag one that's actually absent.
  if (!q.explanation || typeof q.explanation !== "string" || q.explanation.trim().length === 0) {
    addIssue(issues, "explanation_missing", "");
  }

  if (q.question_type === "multiple_choice") {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      addIssue(issues, "choice_count_not_4", Array.isArray(q.choices) ? String(q.choices.length) : typeof q.choices);
    } else {
      const keys = q.choices.map((c) => c?.key);
      const keysOk = EXPECTED_CHOICE_KEYS.every((k, i) => keys[i] === k);
      if (!keysOk) addIssue(issues, "choice_keys_not_abcd", keys.join(","));

      const texts = q.choices.map((c) => (typeof c?.text === "string" ? c.text.trim() : ""));
      if (texts.some((t) => t.length === 0)) addIssue(issues, "empty_choice_text", "");
      const uniqueTexts = new Set(texts.map((t) => t.toLowerCase()));
      if (uniqueTexts.size < texts.length) addIssue(issues, "duplicate_choice_text", "");

      if (!q.correct_choice || !keys.includes(q.correct_choice)) {
        addIssue(issues, "correct_choice_not_in_choices", String(q.correct_choice));
      }
      if (q.correct_value != null && q.correct_value !== "") {
        addIssue(issues, "mc_has_correct_value", String(q.correct_value));
      }
    }
  } else if (q.question_type === "grid_in") {
    if (q.choices != null) addIssue(issues, "grid_in_has_choices", "");
    if (!q.correct_value || typeof q.correct_value !== "string" || q.correct_value.trim().length === 0) {
      addIssue(issues, "grid_in_missing_correct_value", "");
    }
    if (q.correct_choice != null && q.correct_choice !== "") {
      addIssue(issues, "grid_in_has_correct_choice", String(q.correct_choice));
    }
  }

  if (q.passage_underline_start != null || q.passage_underline_end != null) {
    const start = q.passage_underline_start;
    const end = q.passage_underline_end;
    if (!q.passage) {
      addIssue(issues, "underline_span_without_passage", "");
    } else if (typeof start !== "number" || typeof end !== "number" || start < 0 || end <= start || end > q.passage.length) {
      addIssue(issues, "underline_span_out_of_bounds", `${start}-${end} (passage length ${q.passage?.length ?? 0})`);
    }
  }

  const textBlobs = [q.stem, q.passage, q.explanation, ...(Array.isArray(q.choices) ? q.choices.map((c) => c?.text) : [])];
  for (const blob of textBlobs) {
    if (typeof blob !== "string") continue;
    if (MOJIBAKE_RE.test(blob)) {
      addIssue(issues, "mojibake_encoding", "");
      break;
    }
  }
  for (const blob of textBlobs) {
    if (typeof blob !== "string") continue;
    if (LEFTOVER_HTML_RE.test(blob)) {
      addIssue(issues, "leftover_html_entities", "");
      break;
    }
  }

  // SAT Reading & Writing reuses a handful of boilerplate stems (e.g. "What
  // is the main idea of the passage?") across hundreds of different
  // passages, so stem text alone is a bad duplicate signal — only flag a
  // question whose stem, passage, choices, AND answer all match another
  // one, since that's genuinely redundant content, not just a shared
  // instructional template.
  if (typeof q.stem === "string" && q.stem.trim().length >= 8) {
    const contentKey = JSON.stringify([
      q.stem.trim().toLowerCase(),
      q.passage ?? null,
      q.choices ?? null,
      q.correct_choice ?? null,
      q.correct_value ?? null,
    ]);
    if (seenFullContent.has(contentKey)) {
      addIssue(issues, "duplicate_question_content", "");
    } else {
      seenFullContent.add(contentKey);
    }
  }

  return issues;
}

function main() {
  const args = parseArgs();
  const raw = readFileSync(args.file, "utf-8");
  const questions = JSON.parse(raw);

  const seenExternalIds = new Set();
  const seenFullContent = new Set();
  const counts = {};
  const flagged = [];

  for (const q of questions) {
    const issues = checkQuestion(q, seenExternalIds, seenFullContent);
    if (issues.length) {
      flagged.push({ external_id: q.external_id, issues });
      for (const issue of issues) {
        counts[issue.code] = (counts[issue.code] ?? 0) + 1;
      }
    }
  }

  console.log(`Checked ${questions.length} questions.`);
  console.log(`${flagged.length} flagged (${((flagged.length / questions.length) * 100).toFixed(1)}%).\n`);
  console.log("Issue breakdown:");
  for (const [code, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${count}`);
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify({ total: questions.length, flaggedCount: flagged.length, counts, flagged }, null, 2));
    console.log(`\nFull report written to ${args.out}`);
  }
}

main();
