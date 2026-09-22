# Question bank semantic vetting

Structural corruption (bad answer-key format, mojibake, exact duplicates)
was already fixed mechanically — see `scripts/fix-questions-structural.mjs`
and its commit. What's left needs actual judgment: is the *stated answer
really correct* for this question?

## Pipeline

1. `chunk-questions.mjs` splits `supabase/seed/firestore_questions.json`
   into fixed-size batches under a scratch directory.
2. Each batch is reviewed by a subagent using the rubric below, which reads
   the batch file and writes a findings JSON (only flagged questions, never
   a full restate of every question) to a paired output path.
3. Findings across all batches get aggregated into one report.
4. Confirmed issues get fixed by hand or deactivated (`active = false`)
   rather than guessed at automatically — an LLM flag is a lead, not an
   automatic edit.

## Review rubric (given to each batch agent)

For every question in the batch, actually work the problem / read the
passage — don't pattern-match on plausibility. Flag a question only when
you're actually confident something's wrong, using these categories:

- `wrong_answer_key` — the stated correct_choice/correct_value is not
  actually correct; you can show what the right answer should be.
- `ambiguous_question` — more than one choice is reasonably defensible, or
  the question/passage doesn't give enough information to pick one answer.
- `bad_distractor` — a wrong choice is actually also correct, or is
  nonsensical/non-parallel in a way that breaks the question (e.g. gives
  the answer away, or couldn't plausibly be tempting).
- `explanation_mismatch` — the explanation text contradicts or doesn't
  support the stated correct answer.
- `low_quality_content` — garbled, incoherent, or otherwise broken content
  the structural pass didn't catch.

Output only the questions with a real issue, as JSON:
`{ "external_id": "...", "category": "...", "confidence": "high"|"medium", "reasoning": "one or two sentences" }`

Skip anything already fine — most questions will be. Don't flag on style
preference or "could be worded better"; only flag actual correctness
problems a student would get wrong information from.
