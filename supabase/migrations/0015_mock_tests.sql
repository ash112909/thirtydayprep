-- Full-length, fixed-form mock exams: a timed, non-adaptive Reading &
-- Writing section (54 Q) and Math section (44 Q) a student can retake
-- across their plan to watch a real scaled-score trend, instead of only the
-- mastery-inferred estimate in scorePrediction.ts. Mirrors the shape of
-- baseline_tests/baseline_test_questions on purpose.

alter table question_attempts drop constraint question_attempts_source_check;
alter table question_attempts add constraint question_attempts_source_check
  check (source in ('baseline', 'daily', 'review', 'practice', 'mock_test'));

create table mock_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_questions int not null,
  rw_scaled int,
  math_scaled int,
  total_scaled int
);

create table mock_test_questions (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references mock_tests(id) on delete cascade,
  question_id uuid not null references questions(id),
  order_index int not null,
  selected_choice text,
  is_correct boolean,
  time_spent_seconds int,
  answered_at timestamptz,
  unique (mock_test_id, order_index)
);

create index mock_tests_user_idx on mock_tests (user_id, started_at desc);

alter table mock_tests enable row level security;
alter table mock_test_questions enable row level security;

create policy "users manage their own mock tests"
  on mock_tests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage their own mock test questions"
  on mock_test_questions for all to authenticated
  using (
    exists (
      select 1 from mock_tests mt
      where mt.id = mock_test_questions.mock_test_id
      and mt.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mock_tests mt
      where mt.id = mock_test_questions.mock_test_id
      and mt.user_id = auth.uid()
    )
  );
