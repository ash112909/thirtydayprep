-- Tracks which achievements a student has already claimed, so the reward
-- (study-buddy points) is paid out exactly once per achievement rather than
-- every time the Profile screen recomputes which badges are unlocked.
-- Claiming happens through the claim-achievement edge function, which
-- independently re-verifies the achievement is actually earned before
-- inserting a row here and awarding points — the same reason points
-- themselves are server-authoritative (see _shared/petPoints.ts) applies
-- here: a student shouldn't be able to grant themselves currency by just
-- calling an endpoint with a fabricated achievement id.

create table user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "users read their own claimed achievements"
  on user_achievements for select to authenticated
  using (user_id = auth.uid());

-- The edge function does the actual earned/not-earned verification before
-- writing this row; RLS here just scopes the write to the caller's own
-- user_id, matching the same client-writable trust model already used for
-- study_pets.points (see 0009_pet_shop.sql) — a determined user could
-- already tamper with their own points directly, so this doesn't introduce
-- a new gap, and a fabricated insert here only marks an achievement
-- "claimed" without paying out anything (points come from a separate call).
create policy "users insert their own claimed achievements"
  on user_achievements for insert to authenticated
  with check (user_id = auth.uid());
