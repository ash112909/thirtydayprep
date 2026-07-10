-- Auto-create a profiles row whenever a new auth user signs up, so the app
-- never has to race the client-side RLS-scoped upsert against a session
-- that may not exist yet (e.g. email confirmation is pending).

create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
