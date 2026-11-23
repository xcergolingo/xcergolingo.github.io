-- GoLingo account quick access: most recently launched game and one pinned favorite.
-- Apply in Supabase SQL Editor after cognito-rls-migration.sql and game-social-schema.sql.
-- A recent launch is not verified completed gameplay.
begin;
create table if not exists public.golingo_game_quick_access (
  user_id text primary key,
  last_played_game_id text check(last_played_game_id ~ '^[a-z0-9-]{1,90}$'),
  last_played_at timestamptz,
  pinned_game_id text check(pinned_game_id ~ '^[a-z0-9-]{1,90}$'),
  updated_at timestamptz not null default now()
);
alter table public.golingo_game_quick_access enable row level security;
revoke all on public.golingo_game_quick_access from anon,authenticated;
create or replace function public.golingo_get_game_quick_access()
returns table(last_played_game_id text,pinned_game_id text,last_played_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.last_played_game_id,
    case when exists (
      select 1 from public.golingo_game_favorites f where
      f.user_id=a.user_id and f.game_id=a.pinned_game_id
    ) then a.pinned_game_id else null end,
    a.last_played_at
  from public.golingo_game_quick_access a
  where public.golingo_is_cognito() and a.user_id=auth.jwt()->>'sub'
$$;
revoke all on function public.golingo_get_game_quick_access() from public;
grant execute on function public.golingo_get_game_quick_access() to authenticated;

create or replace function public.golingo_mark_recent_game(p_game_id text)
returns void language plpgsql security definer set search_path='' as $$
declare uid text;
begin
  if not public.golingo_is_cognito() then raise exception 'GoLingo account required'; end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,90}$' then raise exception 'Invalid game';end if;
  uid:=auth.jwt()->>'sub';
  insert into public.golingo_game_quick_access(user_id,last_played_game_id,last_played_at,updated_at)
  values(uid,p_game_id,now(),now())
  on conflict(user_id) do update set
    last_played_game_id=excluded.last_played_game_id,
    last_played_at=excluded.last_played_at,
    updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.golingo_mark_recent_game(text) from public;
grant execute on function public.golingo_mark_recent_game(text) to authenticated;

create or replace function public.golingo_pin_favorite_game(p_game_id text)
returns text language plpgsql security definer set search_path='' as $$
declare uid text;
begin
  if not public.golingo_is_cognito() then raise exception 'GoLingo account required';end if;
  uid:=auth.jwt()->>'sub';
  if p_game_id is not null and (p_game_id !~ '^[a-z0-9-]{1,90}$'
      or not exists (select 1 from public.golingo_game_favorites f
          where f.user_id=uid and f.game_id=p_game_id)) then
    raise exception 'Only one of your own favorite games can be pinned';
  end if;
  insert into public.golingo_game_quick_access(user_id,pinned_game_id,updated_at)
  values(uid,p_game_id,now())
  on conflict(user_id) do update
  set pinned_game_id=excluded.pinned_game_id,updated_at=excluded.updated_at;
  return p_game_id;
end;
$$;
revoke all on function public.golingo_pin_favorite_game(text) from public;
grant execute on function public.golingo_pin_favorite_game(text) to authenticated;
commit;
