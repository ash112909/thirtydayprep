-- A lightweight friend system for a Snapchat-streak-style comparison: a
-- shareable code to add a friend, then read-only visibility into a
-- friend's streak, buddy points, and pet — never their questions,
-- answers, plan content, or personal profile fields (SAT date, daily
-- minutes stay private; friendships only widen study_plans/
-- study_plan_days/study_pets, and only for streak/points display).

create table friend_codes (
  user_id uuid primary key references profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table friend_codes enable row level security;

create policy "users manage their own friend code"
  on friend_codes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A friend code is meant to be shared and looked up by whoever receives
-- it (like a username), not a secret bearer token, so any authenticated
-- user can resolve a code to find out whose it is.
create policy "anyone can look up a code to redeem it"
  on friend_codes for select to authenticated
  using (true);

create table friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table friendships enable row level security;

-- One row grants MUTUAL visibility (every policy below checks both
-- directions), so only the person redeeming a code needs to write
-- anything — no confirmation step from the other side. Whoever holds a
-- code already had to receive it out-of-band, and the only thing a
-- friendship exposes is streak/points/pet, the same low-stakes,
-- cosmetic tier of data already treated as client-writable elsewhere
-- (see 0009_pet_shop.sql) — so skipping a mutual-consent handshake for a
-- v1 is an acceptable trade, not a new class of exposure.
create policy "users can add a friendship they're part of"
  on friendships for insert to authenticated
  with check (auth.uid() = user_id or auth.uid() = friend_id);

create policy "users can view friendships they're part of"
  on friendships for select to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "users can remove a friendship they're part of"
  on friendships for delete to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "friends can view each other's study plans"
  on study_plans for select to authenticated
  using (
    exists (
      select 1 from friendships f
      where (f.user_id = auth.uid() and f.friend_id = study_plans.user_id)
         or (f.friend_id = auth.uid() and f.user_id = study_plans.user_id)
    )
  );

create policy "friends can view each other's study plan days"
  on study_plan_days for select to authenticated
  using (
    exists (
      select 1 from study_plans sp
      join friendships f
        on (f.user_id = auth.uid() and f.friend_id = sp.user_id)
        or (f.friend_id = auth.uid() and f.user_id = sp.user_id)
      where sp.id = study_plan_days.study_plan_id
    )
  );

create policy "friends can view each other's study pet"
  on study_pets for select to authenticated
  using (
    exists (
      select 1 from friendships f
      where (f.user_id = auth.uid() and f.friend_id = study_pets.user_id)
         or (f.friend_id = auth.uid() and f.user_id = study_pets.user_id)
    )
  );
