# ThirtyDayPrep

An adaptive SAT prep app. Students sign up, tell us their test date and how
much time they can study per day, take a short baseline diagnostic, and get
a day-by-day study plan built from a ~15,000-question bank — weighted toward
their weak areas and rebalanced as they improve.

## How it works

1. **Sign up + onboarding** — student enters their SAT date and daily study
   minutes.
2. **Baseline test** — a 24-question diagnostic (one easy, one medium, one
   hard question from each of the SAT's 8 domains) measures where they stand
   today.
3. **Plan generation** — from the baseline score and the number of days
   until the test, we generate a full day-by-day plan: how many questions of
   each domain/difficulty are due each day. Weak domains get proportionally
   more questions; the mix shifts toward harder questions as mastery grows.
4. **Daily sessions** — each day, the app picks real, unseen questions
   matching that day's targets ("materializing" the day on first open), the
   student answers them, and their rolling mastery per domain updates after
   every question. Whenever a day is completed, all not-yet-materialized
   future days are rebalanced against the latest mastery data.

## Architecture

- **Mobile app**: React Native + Expo Router + TypeScript (`apps/mobile`)
- **Backend**: Supabase — Postgres (schema + RLS in `supabase/migrations`),
  Auth, and Edge Functions (`supabase/functions`) for the logic that needs
  to run with elevated privileges or combine multiple writes atomically.
- **Adaptive engine**: pure, dependency-free TypeScript in
  `supabase/functions/_shared/planEngine.ts` — baseline scoring, mastery
  updates, and day-target computation are all unit-testable functions with
  no I/O.

```
apps/mobile/              Expo app
  app/                    expo-router screens
    (auth)/               sign-in, sign-up
    (tabs)/               home (today), progress, profile
    baseline/             baseline diagnostic flow
    onboarding.tsx         SAT date + daily minutes
    session.tsx             daily question-taking flow
  src/
    api/                  Supabase table + edge-function wrappers
    components/           QuestionCard, PrimaryButton
    hooks/useAuth.tsx     session + profile context
    types/domain.ts       shared types (mirrors supabase/functions/_shared/types.ts)

supabase/
  migrations/             schema, RLS policies, SAT domain taxonomy seed
  functions/
    _shared/              planEngine.ts, questionSelection.ts, client/cors helpers
    generate-baseline/    builds a fresh 24-question diagnostic
    submit-baseline/      grades it, computes mastery, generates the full study plan
    get-today-session/    returns (and materializes) the next due day
    submit-attempt/       grades one answer, updates mastery, rebalances future days
  seed/sample_questions.json   ~48 hand-written placeholder questions (2 per
                                domain x difficulty) so every flow is testable
                                before the real bank is imported

scripts/import-questions.mjs   CSV/JSON importer for the real ~15k question bank
```

### Data model

`categories` (Reading & Writing, Math) → `subcategories` (the SAT's 8
domains: Information and Ideas, Craft and Structure, Expression of Ideas,
Standard English Conventions, Algebra, Advanced Math, Problem-Solving and
Data Analysis, Geometry and Trigonometry) → `questions`.

A `study_plan` has one `study_plan_day` per calendar day until the SAT date.
Each day stores `targets` (how many questions of each subcategory/difficulty
are due) computed at plan-creation time; the actual `study_plan_day_questions`
are only picked when the student opens that day, so selection reflects the
freshest mastery data and never repeats a question they've already seen (if
avoidable). `question_attempts` is the full history used for that dedup and
for `user_skill_stats`, the rolling per-subcategory mastery score that drives
everything.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations in `supabase/migrations/` in order (via the SQL editor,
   or `supabase db push` if you have the Supabase CLI linked to the project).
3. Deploy the edge functions:
   ```
   supabase functions deploy generate-baseline
   supabase functions deploy submit-baseline
   supabase functions deploy get-today-session
   supabase functions deploy submit-attempt
   ```
4. In Auth settings, enable email/password sign-in (and disable email
   confirmation for faster local testing, if you like).

#### No local terminal? Use the GitHub Action instead

`.github/workflows/backend-sync.yml` runs the question-bank import and/or
edge function deployment on GitHub's own runners — useful if you don't want
to run these commands from a local machine. After running the migrations in
the SQL editor (step 2 above), add these repo secrets under **Settings ->
Secrets and variables -> Actions**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN` — a personal access token from
  [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
  (only needed to deploy edge functions)

Then run the workflow from the **Actions** tab (or ask Claude to trigger it).
It checks that the migrations were applied before importing anything, so a
missing migration fails fast with a clear message instead of partially
importing.

### 2. Question bank

Seed with the sample dataset to get every flow working end-to-end:

```
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/import-questions.mjs --file=supabase/seed/sample_questions.json
```

When your real ~15,000-question bank is ready, export it to CSV or JSON with
these fields and run the same command against it:

| field | required | notes |
|---|---|---|
| `external_id` | recommended | stable ID from your source bank; enables safe re-imports |
| `subcategory` | yes | slug or name, e.g. `algebra` or `Algebra` |
| `difficulty` | yes | `easy`, `medium`, or `hard` |
| `question_type` | no | `multiple_choice` (default) or `grid_in` (free-response, e.g. SAT grid-in math) |
| `skill_tag` | no | fine-grained tag within the subcategory |
| `passage` | no | stimulus text (Reading & Writing) |
| `stem` | yes | the question text |
| `choice_a`..`choice_d` (CSV) or `choices` (JSON array of `{key, text}`) | `multiple_choice` only | answer options |
| `correct_choice` | `multiple_choice` only | e.g. `A` |
| `correct_value` | `grid_in` only | the expected answer, graded as normalized exact-text match (handles symbolic/multi-part answers) |
| `calculator_allowed` | no | boolean, Math questions only |
| `explanation` | no | shown after answering |
| `avg_seconds` | no | expected time to answer; defaults to 75 |

The import is idempotent on `external_id` — re-running with an updated file
updates existing rows instead of duplicating them.

### 3. Mobile app

```
cd apps/mobile
cp .env.example .env   # fill in your Supabase URL + anon key
npm install
npm run start
```

Scan the QR code with Expo Go, or press `i`/`a` for a simulator.

## Notes on the seed data

`supabase/seed/sample_questions.json` is placeholder content for
development — 48 original practice-style questions, not real SAT questions —
so every screen (baseline test, plan generation, daily sessions, mastery
tracking) is fully exercisable before the real question bank is imported.
Swap it out any time by re-running the import script against your real data;
existing user progress is unaffected since questions are referenced by ID.
