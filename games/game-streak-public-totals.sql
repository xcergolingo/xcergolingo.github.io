-- Public aggregate streak counts, plus private medals from existing streak RPC.
-- Supabase SQL Editor: run after game-streak-schema.sql.
-- No email, user IDs, or per-user rows are exposed to unauthenticated callers.
begin;
create or replace function public.golingo_public_streak_totals()
returns table (
  active_streak_users bigint,
  current_365_users bigint,
  lifetime_365_users bigint,
  silver_medal_users bigint,
  gold_medal_users bigint,
  diamond_medal_users bigint
)
language sql stable security definer set search_path=''
as $$
  with basis as (
    select
      (last_day >= (now() at time zone 'UTC')::date - 1) as active,
      (last_day >= (now() at time zone 'UTC')::date - 1
       and current_streak >= 365) as qualified,
      longest_streak,
      milestone_365_at
    from public.golingo_game_streaks
  )
  select
    count(*) filter (where active),
    count(*) filter (where qualified),
    count(*) filter (where milestone_365_at is not null or longest_streak >=365),
    count(*) filter (where longest_streak >=365 and longest_streak <730),
    count(*) filter (where longest_streak >=730 and longest_streak <1095),
    count(*) filter (where longest_streak >=1095)
  from basis
$$;
revoke all on function public.golingo_public_streak_totals() from public;
grant execute on function public.golingo_public_streak_totals() to anon,authenticated;
commit;

-- Streak badges are earned for recorded launch-day milestones at 365, 730 and
-- 1095 consecutive days (not formal anniversary dates).
-- This aggregation measures authenticated gallery launches, NOT verified
-- gameplay, qualified prize entrants, or paid-out winners.
