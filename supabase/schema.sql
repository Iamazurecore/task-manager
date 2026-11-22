-- =============================================================
-- Taskline v2: Supabase database schema (issue #11)
--
-- Run once in the Supabase dashboard: SQL Editor -> New query ->
-- paste this whole file -> Run. It is safe to run again.
--
-- Security model: the app uses the public (publishable/anon) key,
-- which anyone can read from the page. That is safe ONLY because
-- every table below has row-level security (RLS): each signed-in
-- user can read and change their own rows and nothing else.
-- =============================================================

-- ---------- Profiles: one row per user ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  time_zone    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Tasks: one row per task per user (used by the sync, issue 2 of 3) ----------
-- The task itself is stored as JSON in `data`, so new task fields
-- (recurrence from B1, future due times) need no database change.
create table if not exists public.tasks (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) <= 64),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,               -- set when deleted (soft delete, as in C5)
  primary key (user_id, id)
);

create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at);

alter table public.tasks enable row level security;

drop policy if exists "tasks: read own" on public.tasks;
create policy "tasks: read own" on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "tasks: insert own" on public.tasks;
create policy "tasks: insert own" on public.tasks
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "tasks: update own" on public.tasks;
create policy "tasks: update own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "tasks: delete own" on public.tasks;
create policy "tasks: delete own" on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- "Delete my account and data" (UK GDPR right to erasure) ----------
-- Deleting the auth user removes their profile and tasks through
-- "on delete cascade". It can only ever delete the caller's own account.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
