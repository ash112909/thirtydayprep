#!/usr/bin/env node
// Imports the real question bank (CSV or JSON) into Supabase.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/import-questions.mjs --file=./questions.csv
//
// Expected columns/fields per question (see README for the full contract):
//   external_id, category, subcategory, difficulty, skill_tag,
//   passage, stem, question_type, choice_a, choice_b, choice_c, choice_d,
//   correct_choice, correct_value, calculator_allowed, explanation, avg_seconds,
//   passage_underline_start, passage_underline_end
//
// JSON input may instead provide `choices` directly as
// [{ "key": "A", "text": "..." }, ...] instead of choice_a..choice_d.
//
// question_type is "multiple_choice" (default) or "grid_in" (free-response,
// e.g. SAT-style grid-in math questions). multiple_choice rows need
// choices + correct_choice; grid_in rows need correct_value instead and no
// choices at all.
//
// Rows are upserted keyed on external_id, so re-running the import with an
// updated file is safe and idempotent.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 500;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || true];
    }),
  );
  if (!args.file) {
    console.error("Usage: node scripts/import-questions.mjs --file=./questions.csv");
    process.exit(1);
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.length > 1 || r[0] !== "")
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

function toChoices(raw) {
  if (raw.choices) {
    return typeof raw.choices === "string" ? JSON.parse(raw.choices) : raw.choices;
  }
  const keys = ["a", "b", "c", "d", "e"];
  return keys
    .filter((k) => raw[`choice_${k}`] !== undefined && raw[`choice_${k}`] !== "")
    .map((k) => ({ key: k.toUpperCase(), text: raw[`choice_${k}`] }));
}

async function main() {
  const args = parseArgs();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.");
    process.exit(1);
  }

  const raw = readFileSync(args.file, "utf-8");
  const records = args.file.endsWith(".json") ? JSON.parse(raw) : parseCsv(raw);
  console.log(`Loaded ${records.length} records from ${args.file}`);

  const supabase = createClient(url, serviceKey);

  const { data: categories, error: catErr } = await supabase.from("categories").select("id, slug, name");
  if (catErr) throw catErr;
  const { data: subcategories, error: subErr } = await supabase
    .from("subcategories")
    .select("id, slug, name, category_id");
  if (subErr) throw subErr;

  const catBySlugOrName = new Map();
  for (const c of categories) {
    catBySlugOrName.set(c.slug.toLowerCase(), c.id);
    catBySlugOrName.set(c.name.toLowerCase(), c.id);
  }
  const subBySlugOrName = new Map();
  for (const s of subcategories) {
    subBySlugOrName.set(s.slug.toLowerCase(), s);
    subBySlugOrName.set(s.name.toLowerCase(), s);
  }

  const rowsToUpsert = [];
  const skipped = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const subcategory = subBySlugOrName.get(String(r.subcategory ?? "").toLowerCase());
    if (!subcategory) {
      skipped.push({ row: i, reason: `Unknown subcategory "${r.subcategory}"` });
      continue;
    }
    const difficulty = String(r.difficulty ?? "").toLowerCase();
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      skipped.push({ row: i, reason: `Invalid difficulty "${r.difficulty}"` });
      continue;
    }
    const questionType = r.question_type === "grid_in" ? "grid_in" : "multiple_choice";

    let choices = null;
    let correctChoice = null;
    let correctValue = null;

    if (questionType === "grid_in") {
      if (r.correct_value === undefined || r.correct_value === null || r.correct_value === "") {
        skipped.push({ row: i, reason: "grid_in row missing correct_value" });
        continue;
      }
      correctValue = String(r.correct_value);
    } else {
      choices = toChoices(r);
      if (!choices.length) {
        skipped.push({ row: i, reason: "No answer choices found" });
        continue;
      }
      if (!r.correct_choice) {
        skipped.push({ row: i, reason: "Missing correct_choice" });
        continue;
      }
      correctChoice = String(r.correct_choice).toUpperCase();
    }

    rowsToUpsert.push({
      external_id: r.external_id || null,
      category_id: subcategory.category_id,
      subcategory_id: subcategory.id,
      difficulty,
      question_type: questionType,
      skill_tag: r.skill_tag || null,
      passage: r.passage || null,
      stem: r.stem,
      choices,
      correct_choice: correctChoice,
      correct_value: correctValue,
      calculator_allowed:
        r.calculator_allowed === undefined || r.calculator_allowed === ""
          ? null
          : r.calculator_allowed === true || r.calculator_allowed === "true",
      explanation: r.explanation || null,
      avg_seconds: r.avg_seconds ? Number(r.avg_seconds) : 75,
      passage_underline_start:
        r.passage_underline_start === undefined || r.passage_underline_start === null || r.passage_underline_start === ""
          ? null
          : Number(r.passage_underline_start),
      passage_underline_end:
        r.passage_underline_end === undefined || r.passage_underline_end === null || r.passage_underline_end === ""
          ? null
          : Number(r.passage_underline_end),
    });
  }

  console.log(`${rowsToUpsert.length} rows ready to import, ${skipped.length} skipped.`);
  if (skipped.length) {
    console.log("First skipped rows:", skipped.slice(0, 10));
  }

  for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
    const hasExternalIds = chunk.every((r) => r.external_id);
    const { error } = await supabase
      .from("questions")
      .upsert(chunk, hasExternalIds ? { onConflict: "external_id" } : undefined);
    if (error) throw error;
    console.log(`Imported ${Math.min(i + CHUNK_SIZE, rowsToUpsert.length)}/${rowsToUpsert.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
