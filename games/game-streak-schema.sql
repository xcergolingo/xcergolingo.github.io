-- GoLingo 365-day challenge: authenticated, server-dated GAME LAUNCH streaks.
-- Run in Supabase SQL Editor after cognito-rls-migration.sql.
-- This is a streak record, NOT a proof of actual gameplay or cash entitlement.
begin;
create table if not exists public.golingo_game_daily_launches (
  user_id text not null,
  activity_day date not null,
  game_id text not null check(game_id ~ '^[a-z0-9-]{1,90}$'),
  recorded_at timestamptz not null default now(),
  primary key(user_id,activity_day)
);
create index if not exists golingo_daily_launches_recent
  on public.golingo_game_daily_launches(user_id,activity_day desc);
create table if not exists public.golingo_game_streaks (
  user_id text primary key,
  last_day date not null,
  current_streak integer not null default 1 check(current_streak >= 0),
  longest_streak integer not null default 1 check(longest_streak >= 0),
  total_days integer not null default 1 check(total_days >= 0),
  milestone_365_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.golingo_game_daily_launches enable row level security;
alter table public.golingo_game_streaks enable row level security;
revoke all on public.golingo_game_daily_launches,public.golingo_game_streaks from anon,authenticated;
grant select on public.golingo_game_daily_launches,public.golingo_game_streaks to authenticated;
drop policy if exists "See own daily launch records" on public.golingo_game_daily_launches;
create policy "See own daily launch records" on public.golingo_game_daily_launches
 for select to authenticated
 using(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));
drop policy if exists "See own streak records" on public.golingo_game_streaks;
create policy "See own streak records" on public.golingo_game_streaks
 for select to authenticated
 using(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));

create or replace function public.golingo_mark_daily_game_launch(p_game_id text)
returns table(streak integer,longest integer,total_days integer,done_today boolean,
  goal_reached boolean,server_day date)
language plpgsql security definer set search_path=''
as $$
declare
  uid text;
  today_utc date:=(now() at time zone 'UTC')::date;
  inserted_rows integer:=0;
  prior public.golingo_game_streaks%rowtype;
  next_streak integer;
begin
  if not public.golingo_is_cognito() then raise exception 'GoLingo sign-in required'; end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,90}$' then
    raise exception 'Invalid game id';
  end if;
  uid:=auth.jwt()->>'sub';
  -- Serialize concurrent tabs/devices for this user.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid,365));
  insert into public.golingo_game_daily_launches(user_id,activity_day,game_id)
    values(uid,today_utc,p_game_id)
    on conflict(user_id,activity_day) do nothing;
  get diagnostics inserted_rows=row_count;
  if inserted_rows>0 then
    select * into prior from public.golingo_game_streaks where user_id=uid for update;
    if found then
      next_streak:=case when prior.last_day=today_utc-1 then prior.current_streak+1 else 1 end;
      update public.golingo_game_streaks
        set current_streak=next_streak,
            longest_streak=greatest(prior.longest_streak,next_streak),
            total_days=prior.total_days+1,
            last_day=today_utc,
            milestone_365_at=case when next_streak>=365
              then coalesce(prior.milestone_365_at,now()) else prior.milestone_365_at end,
            updated_at=now()
        where user_id=uid;
    else
      insert into public.golingo_game_streaks(user_id,last_day,current_streak,longest_streak,total_days)
      values(uid,today_utc,1,1,1);
    end if;
  end if;
  return query select
    case when s.last_day>=today_utc-1 then s.current_streak else 0 end,
    s.longest_streak,s.total_days,(s.last_day=today_utc),
    (s.milestone_365_at is not null),today_utc
    from public.golingo_game_streaks s where s.user_id=uid;
end;
$$;
revoke all on function public.golingo_mark_daily_game_launch(text) from public;
grant execute on function public.golingo_mark_daily_game_launch(text) to authenticated;

create or replace function public.golingo_get_daily_game_streak()
returns table(streak integer,longest integer,total_days integer,done_today boolean,
  goal_reached boolean,server_day date)
language plpgsql stable security definer set search_path=''
as $$
declare uid text;
declare today_utc date:=(now() at time zone 'UTC')::date;
begin
  if not public.golingo_is_cognito() then raise exception 'GoLingo sign-in required'; end if;
  uid:=auth.jwt()->>'sub';
  return query
  select case when s.last_day>=today_utc-1 then s.current_streak else 0 end,
         s.longest_streak,s.total_days,(s.last_day=today_utc),
         (s.milestone_365_at is not null),today_utc
  from public.golingo_game_streaks s where s.user_id=uid;
end;
$$;
revoke all on function public.golingo_get_daily_game_streak() from public;
grant execute on function public.golingo_get_daily_game_streak() to authenticated;
commit;
