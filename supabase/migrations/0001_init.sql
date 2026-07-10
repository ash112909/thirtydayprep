-- ThirtyDayPrep: core schema
-- Models the digital SAT's 2 sections x 4 domains each, a 15k-question bank,
-- baseline diagnostics, adaptive study plans, and per-question attempt history.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Taxonomy: sections -> subcategories (domains)
-- ---------------------------------------------------------------------------

create type difficulty_level as enum ('easy', 'medium', 'hard');
create type plan_status as enum ('active', 'completed', 'abandoned');
create type day_status as enum ('locked', 'available', 'completed', 'skipped');

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0
);

create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  slug text unique not null,
  name text not null,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Question bank (target: ~15,000 rows via scripts/import-questions.mjs)
-- ---------------------------------------------------------------------------

create table questions (
  id uuid primary key default gen_random_uuid(),
  external_id text unique, -- id from the source question bank, for idempotent import
  category_id uuid not null references categories(id),
  subcategory_id uuid not null references subcategories(id),
  difficulty difficulty_level not null,
  skill_tag text, -- fine-grained tag within a subcategory, e.g. "linear-equations-one-variable"
  passage text, -- optional stimulus/passage (Reading & Writing)
  stem text not null,
  choices jsonb not null, -- [{ "key": "A", "text": "..." }, ...]
  correct_choice text not null, -- e.g. "A"
  explanation text,
  avg_seconds int not null default 75, -- expected time to answer, used for plan pacing
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index questions_subcategory_difficulty_idx on questions (subcategory_id, difficulty) where active;
create index questions_category_idx on questions (category_id) where active;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sat_date date,
  daily_minutes int, -- minutes/day the student can commit
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Baseline diagnostic ("practice mini test")
-- ---------------------------------------------------------------------------

create table baseline_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_questions int not null
);

create table baseline_test_questions (
  id uuid primary key default gen_random_uuid(),
  baseline_test_id uuid not null references baseline_tests(id) on delete cascade,
  question_id uuid not null references questions(id),
  order_index int not null,
  selected_choice text,
  is_correct boolean,
  time_spent_seconds int,
  answered_at timestamptz,
  unique (baseline_test_id, order_index)
);

-- ---------------------------------------------------------------------------
-- Study plans: generated once from the baseline, materialized day-by-day
-- ---------------------------------------------------------------------------

create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  baseline_test_id uuid references baseline_tests(id),
  start_date date not null,
  end_date date not null, -- the student's SAT date
  total_days int not null,
  daily_minutes int not null,
  status plan_status not null default 'active',
  created_at timestamptz not null default now()
);

-- Per-day target: how many questions of each subcategory/difficulty are due.
-- Generated in full at plan-creation time (so the student can see the whole
-- roadmap), but the *specific* questions are only picked ("materialized")
-- when the student opens that day, so selection can reflect the latest
-- mastery stats and avoid repeats.
create table study_plan_days (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references study_plans(id) on delete cascade,
  day_number int not null, -- 1-indexed from start_date
  date date not null,
  target_minutes int not null,
  targets jsonb not null, -- [{ subcategory_id, difficulty, count }, ...]
  status day_status not null default 'locked',
  materialized boolean not null default false,
  completed_at timestamptz,
  unique (study_plan_id, day_number)
);

create table study_plan_day_questions (
  id uuid primary key default gen_random_uuid(),
  study_plan_day_id uuid not null references study_plan_days(id) on delete cascade,
  question_id uuid not null references questions(id),
  order_index int not null,
  selected_choice text,
  is_correct boolean,
  time_spent_seconds int,
  answered_at timestamptz,
  unique (study_plan_day_id, order_index)
);

-- ---------------------------------------------------------------------------
-- Attempt history (union of baseline + daily attempts, for analytics /
-- "don't repeat a question the student already got right recently")
-- ---------------------------------------------------------------------------

create table question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id),
  source text not null check (source in ('baseline', 'daily')),
  baseline_test_id uuid references baseline_tests(id),
  study_plan_day_id uuid references study_plan_days(id),
  selected_choice text not null,
  is_correct boolean not null,
  time_spent_seconds int not null,
  attempted_at timestamptz not null default now()
);

create index question_attempts_user_question_idx on question_attempts (user_id, question_id);

-- Rolling per-user, per-subcategory mastery, updated after every attempt.
-- mastery_score is 0-100, a recency-weighted accuracy used to drive both
-- baseline scoring display and the adaptive rebalance of future plan days.
create table user_skill_stats (
  user_id uuid not null references profiles(id) on delete cascade,
  subcategory_id uuid not null references subcategories(id),
  questions_attempted int not null default 0,
  questions_correct int not null default 0,
  mastery_score numeric(5,2) not null default 0,
  avg_time_seconds numeric(6,1),
  updated_at timestamptz not null default now(),
  primary key (user_id, subcategory_id)
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table baseline_tests enable row level security;
alter table baseline_test_questions enable row level security;
alter table study_plans enable row level security;
alter table study_plan_days enable row level security;
alter table study_plan_day_questions enable row level security;
alter table question_attempts enable row level security;
alter table user_skill_stats enable row level security;

-- categories/subcategories/questions are public reference data, readable by
-- any authenticated user, writable only via service role (import script).
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table questions enable row level security;

create policy "categories are readable by authenticated users"
  on categories for select to authenticated using (true);
create policy "subcategories are readable by authenticated users"
  on subcategories for select to authenticated using (true);
create policy "questions are readable by authenticated users"
  on questions for select to authenticated using (true);

create policy "users manage their own profile"
  on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "users manage their own baseline tests"
  on baseline_tests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage their own baseline test questions"
  on baseline_test_questions for all to authenticated
  using (
    exists (
      select 1 from baseline_tests bt
      where bt.id = baseline_test_questions.baseline_test_id
      and bt.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from baseline_tests bt
      where bt.id = baseline_test_questions.baseline_test_id
      and bt.user_id = auth.uid()
    )
  );

create policy "users manage their own study plans"
  on study_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage their own study plan days"
  on study_plan_days for all to authenticated
  using (
    exists (
      select 1 from study_plans sp
      where sp.id = study_plan_days.study_plan_id
      and sp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from study_plans sp
      where sp.id = study_plan_days.study_plan_id
      and sp.user_id = auth.uid()
    )
  );

create policy "users manage their own study plan day questions"
  on study_plan_day_questions for all to authenticated
  using (
    exists (
      select 1 from study_plan_days spd
      join study_plans sp on sp.id = spd.study_plan_id
      where spd.id = study_plan_day_questions.study_plan_day_id
      and sp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from study_plan_days spd
      join study_plans sp on sp.id = spd.study_plan_id
      where spd.id = study_plan_day_questions.study_plan_day_id
      and sp.user_id = auth.uid()
    )
  );

create policy "users manage their own attempts"
  on question_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage their own skill stats"
  on user_skill_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
