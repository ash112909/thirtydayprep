#!/usr/bin/env node
// Applies the high-confidence, mechanical fixes identified by
// vet-questions-structural.mjs — the ones safe to make without human
// judgment. Anything that needs real content decisions (regenerating a
// broken distractor, resolving an ambiguous answer key) is left alone and
// reported so it can go through manual/LLM review instead.
//
// Usage:
//   node scripts/fix-questions-structural.mjs --file=./supabase/seed/firestore_questions.json [--write]
//
// Without --write, runs as a dry run and just prints what it would do.

import { readFileSync, writeFileSync } from "node:fs";

// Literal substring replacements for UTF-8 text that was previously
// mis-decoded as CP1252/Latin-1 (the classic "â€”" for an em dash bug). Kept
// as an explicit map rather than a blind whole-string re-encode, because a
// few rows mix already-correct Unicode (e.g. a real ° character) with
// mojibake in the same string, and a blind re-encode of the whole string
// would corrupt the already-correct part.
const MOJIBAKE_MAP = {
  "â€”": "—",
  "â€²": "′",
  "Ã©": "é",
  "Ã±": "ñ",
  "Ã\xad": "í",
  "Ã§": "ç",
  "Ã¶": "ö",
  "Ã³": "ó",
  "Ã«": "ë",
  "Ã¡": "á",
};

// Same domain weighting the study-plan engine uses for pacing, reused here
// as a sane replacement for the handful of rows whose avg_seconds was
// clearly a placeholder (10-12s — nobody answers a real SAT question that
// fast) rather than a real timing estimate.
const AVG_SECONDS_BY_SUBCATEGORY = {
  "information-and-ideas": 70,
  "craft-and-structure": 65,
  "expression-of-ideas": 60,
  "standard-english-conventions": 55,
  algebra: 90,
  "advanced-math": 100,
  "problem-solving-data-analysis": 95,
  "geometry-trigonometry": 95,
};

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/fix-questions-structural.mjs --file=./supabase/seed/firestore_questions.json [--write]");
    process.exit(1);
  }
  return args;
}

function fixMojibake(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
    out = out.split(bad).join(good);
  }
  return out;
}

function fixMojibakeInQuestion(q, stats) {
  let changed = false;
  for (const field of ["stem", "passage", "explanation"]) {
    if (typeof q[field] === "string") {
      const fixed = fixMojibake(q[field]);
      if (fixed !== q[field]) {
        q[field] = fixed;
        changed = true;
      }
    }
  }
  if (Array.isArray(q.choices)) {
    for (const c of q.choices) {
      if (typeof c.text === "string") {
        const fixed = fixMojibake(c.text);
        if (fixed !== c.text) {
          c.text = fixed;
          changed = true;
        }
      }
    }
  }
  if (changed) stats.mojibakeFixed++;
}

function fixCorrectChoiceKey(q, stats, unresolved) {
  if (q.question_type !== "multiple_choice" || !Array.isArray(q.choices)) return;
  const keys = q.choices.map((c) => c.key);
  if (q.correct_choice && keys.includes(q.correct_choice)) return; // already fine

  const target = (q.correct_choice ?? "").trim().toLowerCase();
  const matches = q.choices.filter((c) => (c.text ?? "").trim().toLowerCase() === target);
  if (matches.length === 1) {
    q.correct_choice = matches[0].key;
    stats.correctChoiceFixed++;
  } else {
    unresolved.push({ external_id: q.external_id, reason: "correct_choice_unresolvable", detail: q.correct_choice });
  }
}

function fixExtraChoices(q, stats, unresolved) {
  if (q.question_type !== "multiple_choice" || !Array.isArray(q.choices) || q.choices.length <= 4) return;
  const first4Keys = q.choices.slice(0, 4).map((c) => c.key);
  if (first4Keys.includes(q.correct_choice)) {
    q.choices = q.choices.slice(0, 4);
    stats.extraChoicesTrimmed++;
  } else {
    unresolved.push({ external_id: q.external_id, reason: "extra_choices_unresolvable", detail: `${q.choices.length} choices` });
  }
}

function fixAvgSeconds(q, stats) {
  if (typeof q.avg_seconds === "number" && q.avg_seconds < 20) {
    q.avg_seconds = AVG_SECONDS_BY_SUBCATEGORY[q.subcategory] ?? 75;
    stats.avgSecondsFixed++;
  }
}

function dedupe(questions, stats) {
  const seen = new Set();
  const kept = [];
  for (const q of questions) {
    const contentKey = JSON.stringify([
      (q.stem ?? "").trim().toLowerCase(),
      q.passage ?? null,
      q.choices ?? null,
      q.correct_choice ?? null,
      q.correct_value ?? null,
    ]);
    if (seen.has(contentKey)) {
      stats.duplicatesRemoved++;
      continue;
    }
    seen.add(contentKey);
    kept.push(q);
  }
  return kept;
}

function main() {
  const args = parseArgs();
  const raw = readFileSync(args.file, "utf-8");
  let questions = JSON.parse(raw);

  const stats = {
    mojibakeFixed: 0,
    correctChoiceFixed: 0,
    extraChoicesTrimmed: 0,
    avgSecondsFixed: 0,
    duplicatesRemoved: 0,
  };
  const unresolved = [];

  for (const q of questions) {
    fixMojibakeInQuestion(q, stats);
    fixCorrectChoiceKey(q, stats, unresolved);
    fixExtraChoices(q, stats, unresolved);
    fixAvgSeconds(q, stats);
  }

  const before = questions.length;
  questions = dedupe(questions, stats);

  console.log(`Questions before: ${before}, after dedupe: ${questions.length}`);
  console.log("Fixes applied:");
  console.log(`  mojibake text fixed: ${stats.mojibakeFixed} questions`);
  console.log(`  correct_choice resolved to a key: ${stats.correctChoiceFixed}`);
  console.log(`  extra (>4) choices trimmed: ${stats.extraChoicesTrimmed}`);
  console.log(`  avg_seconds placeholder replaced: ${stats.avgSecondsFixed}`);
  console.log(`  exact-duplicate questions removed: ${stats.duplicatesRemoved}`);
  console.log(`\n${unresolved.length} rows NOT auto-fixed (need manual/LLM review):`);
  for (const u of unresolved) console.log(`  ${u.external_id}: ${u.reason} (${u.detail})`);

  if (args.write) {
    writeFileSync(args.file, JSON.stringify(questions, null, 2));
    console.log(`\nWrote fixed data back to ${args.file}`);
  } else {
    console.log("\nDry run — pass --write to save changes.");
  }
}

main();
