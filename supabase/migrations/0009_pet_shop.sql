-- Points and inventory for the study buddy's food/toy shop. Points are
-- only ever *earned* server-side (submit-attempt, on day completion) so a
-- student can't just grant themselves currency by editing client state —
-- see supabase/functions/_shared/petPoints.ts. Spending them (purchases,
-- feeding) is low-stakes (cosmetic, single-player, no leaderboard) and
-- goes through ordinary client RLS like the rest of study_pets.

alter table study_pets add column points integer not null default 0;

create table pet_inventory (
  user_id uuid not null references profiles(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table pet_inventory enable row level security;

create policy "users manage their own pet inventory"
  on pet_inventory for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
