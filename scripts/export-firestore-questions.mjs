#!/usr/bin/env node
// Exports the question bank from a Firestore `questions` collection and
// transforms it into the JSON shape scripts/import-questions.mjs expects.
//
// Usage:
//   node scripts/export-firestore-questions.mjs \
//     --key=./firebase-service-account.json \
//     --out=./firestore_questions.json
//
// Expects each Firestore document to look like:
//   { section, topic, subtopic, difficulty (1-5), type ("multiple_choice" |
//     "student_produced_response"), question_text (HTML, may embed
//     "Question:" to separate a passage from the stem), options (array,
//     multiple_choice only), answer (letter for MC, number/string for SPR),
//     explanation, time_expected_sec, calculator_allowed }
//
// section "Writing" and "Math" map to the app's two categories; topic maps
// to one of the 8 SAT domains (subcategory) via TOPIC_TO_SUBCATEGORY below —
// extend that map if your Firestore data uses different topic names.

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.key || !args.out) {
    console.error(
      "Usage: node scripts/export-firestore-questions.mjs --key=./service-account.json --out=./firestore_questions.json",
    );
    process.exit(1);
  }
  return args;
}

const SECTION_TO_CATEGORY = {
  writing: "reading-writing",
  math: "math",
};

// topic -> subcategory slug. Keys are lowercased for matching.
const TOPIC_TO_SUBCATEGORY = Object.fromEntries(
  [
    // Math
    ["One Variable", "algebra"],
    ["Two Variable", "algebra"],
    ["Elimination", "algebra"],
    ["Substitution", "algebra"],
    ["Real World Modeling", "algebra"],
    ["Graph Interpretation", "algebra"],
    ["Factoring", "advanced-math"],
    ["Parabolas", "advanced-math"],
    ["Roots", "advanced-math"],
    ["Percents", "problem-solving-data-analysis"],
    ["Ratios", "problem-solving-data-analysis"],
    ["Probabilities", "problem-solving-data-analysis"],
    ["Mean Median Mode", "problem-solving-data-analysis"],
    ["Unit Conversion", "problem-solving-data-analysis"],
    ["Angles", "geometry-trigonometry"],
    ["Circles", "geometry-trigonometry"],
    ["Right Triangles", "geometry-trigonometry"],
    // Reading & Writing (Firestore section "Writing" covers both)
    ["Main Idea", "information-and-ideas"],
    ["Inference", "information-and-ideas"],
    ["Command Of Evidence", "information-and-ideas"],
    ["Supporting Evidence", "information-and-ideas"],
    ["Text Support", "information-and-ideas"],
    ["Quantitative Information", "information-and-ideas"],
    ["Interpreting Charts And Tables", "information-and-ideas"],
    ["Vocabulary Meaning", "craft-and-structure"],
    ["Author'S Intent", "craft-and-structure"],
    ["Author’S Purpose", "craft-and-structure"], // curly apostrophe, as stored in Firestore
    ["Point Of View", "craft-and-structure"],
    ["Tone", "craft-and-structure"],
    ["Paired Passages", "craft-and-structure"],
    ["Logical Flow", "expression-of-ideas"],
    ["Logical Transitions", "expression-of-ideas"],
    ["Precision", "expression-of-ideas"],
    ["Source Integration", "expression-of-ideas"],
    ["Grammar", "standard-english-conventions"],
    ["Punctuation", "standard-english-conventions"],
    ["Sentence Boundaries", "standard-english-conventions"],
    ["Sentence Structure", "standard-english-conventions"],
  ].map(([topic, sub]) => [topic.toLowerCase(), sub]),
);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitPassageAndStem(questionText) {
  const plain = stripHtml(questionText);
  const match = plain.match(/question:/i);
  if (!match) return { passage: null, stem: plain };
  const idx = match.index;
  const passage = plain.slice(0, idx).trim();
  const stem = plain.slice(idx + match[0].length).trim();
  return { passage: passage || null, stem };
}

function bucketDifficulty(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "medium";
  if (n <= 2) return "easy";
  if (n === 3) return "medium";
  return "hard";
}

// Many questions reference "the underlined portion" of the passage, but the
// source data never actually marks which text that is (verified: zero
// documents contain any underline markup). This recovers it only where
// there's real evidence: Grammar/Punctuation/Sentence Boundaries questions
// give 4 answer choices that are variants of the *same underlying text*, so
// whichever one appears verbatim (modulo punctuation) in the passage must be
// the current/underlined version — that's checkable, not guessed.
//
// An earlier version of this also special-cased Add/Delete/Revise questions
// by assuming the underlined sentence is always the passage's last sentence.
// That produced a span every time, but cross-checking against the
// explanation text showed the assumption is often wrong (the real sentence
// varies unpredictably) — positional guessing isn't evidence, so it was
// dropped rather than ship a confidently-wrong underline. Those questions
// (like word-choice "Precision" questions, which have the same problem)
// are left without a detected span.
function fuzzyFindSpan(passage, option) {
  const words = option
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "")) // strip punctuation stuck to each word
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return null;
  const pattern = words.join('[\\s,;:."\'-]*');
  const match = passage.match(new RegExp(pattern, "i"));
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length };
}

function detectUnderlineSpan(passage, stem, options) {
  if (!passage) return null;
  // Only attempt detection when the question actually references an
  // underline — otherwise an answer choice that merely echoes passage
  // wording (very common in ordinary reading-comprehension questions) gets
  // mistaken for the referenced span. Confirmed against real data: without
  // this gate, ~1,400 unrelated Inference/Craft questions got a bogus
  // "detected" span just because a choice happened to quote the passage.
  if (!/underline/i.test(stem)) return null;
  for (const option of options ?? []) {
    const span = fuzzyFindSpan(passage, option);
    if (span) return span;
  }
  return null;
}

async function main() {
  const args = parseArgs();
  const serviceAccount = JSON.parse(readFileSync(args.key, "utf-8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  console.log("Fetching all documents from 'questions'...");
  const snap = await db.collection("questions").get();
  console.log(`Fetched ${snap.size} documents. Transforming...`);

  const out = [];
  const skipped = [];
  let missingDifficultyCount = 0;
  let underlineMentioned = 0;
  let underlineDetected = 0;
  const unmappedTopics = new Set();

  snap.forEach((doc) => {
    const d = doc.data();
    const id = doc.id;

    if (!d.question_text) {
      skipped.push({ id, reason: "missing question_text" });
      return;
    }
    if (d.answer === undefined || d.answer === null || d.answer === "") {
      skipped.push({ id, reason: "missing answer" });
      return;
    }
    if (!d.topic) {
      skipped.push({ id, reason: "missing topic" });
      return;
    }
    const category = SECTION_TO_CATEGORY[String(d.section ?? "").toLowerCase()];
    if (!category) {
      skipped.push({ id, reason: `unrecognized section "${d.section}"` });
      return;
    }
    const subcategory = TOPIC_TO_SUBCATEGORY[String(d.topic).toLowerCase()];
    if (!subcategory) {
      unmappedTopics.add(d.topic);
      skipped.push({ id, reason: `unmapped topic "${d.topic}"` });
      return;
    }
    if (d.type !== "multiple_choice" && d.type !== "student_produced_response") {
      skipped.push({ id, reason: `unrecognized type "${d.type}"` });
      return;
    }

    if (d.difficulty === undefined || d.difficulty === null || d.difficulty === "") missingDifficultyCount++;
    const difficulty = bucketDifficulty(d.difficulty);
    const questionType = d.type === "student_produced_response" ? "grid_in" : "multiple_choice";
    const { passage, stem } = splitPassageAndStem(d.question_text);

    const underlineSpan = detectUnderlineSpan(passage, stem, d.options);
    if (/underlined|underline/i.test(d.question_text)) {
      underlineMentioned++;
      if (underlineSpan) underlineDetected++;
    }

    const record = {
      external_id: id,
      subcategory,
      difficulty,
      question_type: questionType,
      skill_tag: slugify(String(d.topic)),
      passage,
      stem,
      explanation: d.explanation ?? null,
      avg_seconds: d.time_expected_sec ? Math.max(10, Number(d.time_expected_sec)) : 75,
      calculator_allowed: typeof d.calculator_allowed === "boolean" ? d.calculator_allowed : null,
      passage_underline_start: underlineSpan?.start ?? null,
      passage_underline_end: underlineSpan?.end ?? null,
    };

    if (questionType === "multiple_choice") {
      record.choices = (d.options ?? []).map((text, i) => ({
        key: String.fromCharCode(65 + i),
        text,
      }));
      record.correct_choice = String(d.answer).toUpperCase();
    } else {
      record.correct_value = String(d.answer);
    }

    out.push(record);
  });

  writeFileSync(args.out, JSON.stringify(out, null, 2));

  console.log(`\nWrote ${out.length} questions to ${args.out}`);
  console.log(`Skipped ${skipped.length} documents.`);
  if (missingDifficultyCount) {
    console.log(`${missingDifficultyCount} documents had no difficulty and defaulted to "medium".`);
  }
  if (underlineMentioned) {
    console.log(
      `${underlineDetected}/${underlineMentioned} questions referencing "the underlined ..." got a detected span.`,
    );
  }
  if (unmappedTopics.size) {
    console.log("Unmapped topics (extend TOPIC_TO_SUBCATEGORY in this script and re-run):", [...unmappedTopics]);
  }
  if (skipped.length) {
    const reasonCounts = new Map();
    for (const s of skipped) reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1);
    console.log("Skip reasons:", Object.fromEntries(reasonCounts));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
