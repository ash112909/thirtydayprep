-- A student's customizable study companion (cat or dog). Its mood/energy
-- and growth stage are derived client-side from existing plan/attempt data
-- (see src/lib/petState.ts) rather than stored — only the cosmetic choices
-- that need to persist live here. Which accessories are *unlocked* is also
-- derived (from the existing achievements computation); only which of the
-- unlocked ones are currently *equipped* needs a column.

create table study_pets (
  user_id uuid primary key references profiles(id) on delete cascade,
  species text not null check (species in ('cat', 'dog')),
  color text not null,
  equipped_accessories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table study_pets enable row level security;

create policy "users manage their own study pet"
  on study_pets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger study_pets_set_updated_at before update on study_pets
  for each row execute function set_updated_at();
