-- GoLingo Games Cognito identity migration (RUN IN SUPABASE SQL EDITOR).
-- BACK UP public.golingo_game_lessons BEFORE RUNNING IF IT HAS REAL DATA.
-- This replaces original Supabase-auth UUID ownership with AWS Cognito sub.
-- Cognito pool: us-east-1_m1wn7aFbx; use a JWT with role='authenticated'.
begin;
alter table public.golingo_game_lessons enable row level security;
drop policy if exists "Read own lessons or public lessons" on public.golingo_game_lessons;
drop policy if exists "Insert only own lessons" on public.golingo_game_lessons;
drop policy if exists "Edit only own lessons" on public.golingo_game_lessons;
drop policy if exists "Delete only own lessons" on public.golingo_game_lessons;
drop policy if exists "Cognito read own or public lessons" on public.golingo_game_lessons;
drop policy if exists "Cognito insert own lessons" on public.golingo_game_lessons;
drop policy if exists "Cognito update own lessons" on public.golingo_game_lessons;
drop policy if exists "Cognito delete own lessons" on public.golingo_game_lessons;
alter table public.golingo_game_lessons drop constraint if exists golingo_game_lessons_user_id_fkey;
alter table public.golingo_game_lessons alter column user_id type text using user_id::text;
-- Supabase validates the JWT signature against the configured Cognito provider.
-- These checks additionally restrict RLS to GoLingo's user pool and ID-token type.
create or replace function public.golingo_is_cognito()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select (auth.jwt() ->> 'iss') = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m1wn7aFbx'
    and (auth.jwt() ->> 'token_use') = 'id'
    and (auth.jwt() ->> 'role') = 'authenticated'
    and nullif(auth.jwt() ->> 'sub','') is not null;
$$;
revoke all on function public.golingo_is_cognito() from public;
grant execute on function public.golingo_is_cognito() to anon,authenticated;
create policy "Cognito read own or public lessons"
  on public.golingo_game_lessons for select to anon,authenticated
  using (is_public or (public.golingo_is_cognito() and user_id = (auth.jwt() ->> 'sub')));
create policy "Cognito insert own lessons"
  on public.golingo_game_lessons for insert to authenticated
  with check (public.golingo_is_cognito() and user_id = (auth.jwt() ->> 'sub'));
create policy "Cognito update own lessons"
  on public.golingo_game_lessons for update to authenticated
  using (public.golingo_is_cognito() and user_id = (auth.jwt() ->> 'sub'))
  with check (public.golingo_is_cognito() and user_id = (auth.jwt() ->> 'sub'));
create policy "Cognito delete own lessons"
  on public.golingo_game_lessons for delete to authenticated
  using (public.golingo_is_cognito() and user_id = (auth.jwt() ->> 'sub'));
revoke all on public.golingo_game_lessons from anon,authenticated;
grant select on public.golingo_game_lessons to anon,authenticated;
grant insert,update,delete on public.golingo_game_lessons to authenticated;
commit;
