-- GoLingo daily streak: retain the dates of missed days on resets.
-- RUN AFTER games/game-streak-schema.sql in Supabase SQL Editor.
-- All dates are UTC. No RLS bypass for browsers or other accounts.
begin;
create table if not exists public.golingo_game_streak_breaks (
  user_id text not null,
  last_active_day date not null,
  restart_day date not null,
  missed_count integer not null check(missed_count>0),
  previous_streak integer not null check(previous_streak>=1),
  recorded_at timestamptz not null default now(),
  primary key(user_id,restart_day)
);
create index if not exists golingo_streak_breaks_recent
  on public.golingo_game_streak_breaks(user_id,restart_day desc);
alter table public.golingo_game_streak_breaks enable row level security;
revoke all on public.golingo_game_streak_breaks from anon,authenticated;
grant select on public.golingo_game_streak_breaks to authenticated;
drop policy if exists "Read own streak breaks" on public.golingo_game_streak_breaks;
create policy "Read own streak breaks" on public.golingo_game_streak_breaks
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
      if prior.last_day < today_utc-1 then
        insert into public.golingo_game_streak_breaks
          (user_id,last_active_day,restart_day,missed_count,previous_streak)
        values (uid,prior.last_day,today_utc,today_utc-prior.last_day-1,prior.current_streak)
        on conflict (user_id,restart_day) do nothing;
      end if;
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

-- A read-only status function exposes the currently missed period, or
-- (after a new game launch) the most recent recorded streak break.
-- Return the latest 31 missed UTC dates, plus the full count.
create or replace function public.golingo_get_game_missed_days()
returns table (
  missed_dates date[],
  missed_count integer,
  last_played_day date,
  streak_reset boolean,
  previous_streak integer,
  period_end date
)
language plpgsql stable security definer set search_path=''
as $$
declare
  uid text;
  today_utc date:=(now() at time zone 'UTC')::date;
  last_day date;
  current_length integer;
  previous_end date;
  gap_count integer;
  recent public.golingo_game_streak_breaks%rowtype;
begin
  if not public.golingo_is_cognito() then
    raise exception 'GoLingo sign-in required';
  end if;
  uid:=auth.jwt()->>'sub';
  select s.last_day,s.current_streak
    into last_day,current_length
    from public.golingo_game_streaks s where s.user_id=uid;
  if last_day is null then return; end if;
  previous_end:=today_utc-1;
  -- A gap exists only when yesterday was also missed, or earlier.
  -- On the first missed day, the user can still play today to continue?
  -- No: missing yesterday breaks the consecutive streak as of today.
  if last_day < previous_end then
    gap_count:=previous_end-last_day;
    return query
      select array(
          select d::date from generate_series(
            greatest(last_day+1,previous_end-30),previous_end,'1 day'::interval
          ) d order by d desc
        ),gap_count,last_day,true,current_length,previous_end;
    return;
  end if;
  select * into recent from public.golingo_game_streak_breaks b
   where b.user_id=uid order by b.restart_day desc limit 1;
  if found then
    return query
      select array(
        select d::date from generate_series(
          greatest(recent.last_active_day+1,recent.restart_day-31),
          recent.restart_day-1,'1 day'::interval
        ) d order by d desc
      ),recent.missed_count,recent.last_active_day,false,
        recent.previous_streak,recent.restart_day-1;
  end if;
end;
$$;
revoke all on function public.golingo_get_game_missed_days() from public;
grant execute on function public.golingo_get_game_missed_days() to authenticated;
commit;
