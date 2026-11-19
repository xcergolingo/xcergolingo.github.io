-- GoLingo Games: run in your Supabase SQL editor.
-- Enable Authentication > Providers > Email (OTP/magic link).
-- Add https://xcergolingo.github.io/games/ to Auth URL allowed redirects.
-- Never put the service_role key in cloud-config.json.
create extension if not exists pgcrypto;
create table if not exists public.golingo_game_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,90}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(title) <= 256),
  lesson_json jsonb not null check (jsonb_typeof(lesson_json) = 'object'
    and pg_column_size(lesson_json) <= 100000),
  is_public boolean not null default false,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,game_id,fingerprint)
);
create index if not exists golingo_lessons_own_recent on public.golingo_game_lessons(user_id,last_played_at desc);
create index if not exists golingo_lessons_public_recent on public.golingo_game_lessons(last_played_at desc) where is_public;
alter table public.golingo_game_lessons enable row level security;
revoke all on public.golingo_game_lessons from anon,authenticated;
grant select on public.golingo_game_lessons to anon,authenticated;
grant insert,update,delete on public.golingo_game_lessons to authenticated;
drop policy if exists "Read own lessons or public lessons" on public.golingo_game_lessons;
create policy "Read own lessons or public lessons"
  on public.golingo_game_lessons for select
  to anon,authenticated using (is_public or auth.uid() = user_id);
drop policy if exists "Insert only own lessons" on public.golingo_game_lessons;
create policy "Insert only own lessons" on public.golingo_game_lessons for insert
  to authenticated with check (auth.uid() = user_id);
drop policy if exists "Edit only own lessons" on public.golingo_game_lessons;
create policy "Edit only own lessons" on public.golingo_game_lessons for update
  to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Delete only own lessons" on public.golingo_game_lessons;
create policy "Delete only own lessons" on public.golingo_game_lessons for delete
  to authenticated using (auth.uid() = user_id);
