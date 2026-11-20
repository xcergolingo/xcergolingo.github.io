-- GoLingo opt-in public profiles, leaderboard and referral link visits.
-- Requires existing Cognito RLS, game-streak-schema.sql and cloud-schema.
-- This migration does NOT expose Cognito sub IDs or email addresses.
begin;
create table if not exists public.golingo_game_profiles (
  user_id text primary key,
  public_id uuid not null default gen_random_uuid() unique,
  display_name text not null,
  leaderboard_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint golingo_display_name_valid check(display_name ~ '^[A-Za-z][A-Za-z0-9_]{2,23}$')
);
create unique index if not exists golingo_game_profile_name_unique
 on public.golingo_game_profiles(lower(display_name));
create table if not exists public.golingo_game_referral_visits (
  id bigint generated always as identity primary key,
  referrer_public_id uuid not null references public.golingo_game_profiles(public_id) on delete cascade,
  visited_at timestamptz not null default now()
);
create index if not exists golingo_referral_visits_count
 on public.golingo_game_referral_visits(referrer_public_id,visited_at desc);
alter table public.golingo_game_profiles enable row level security;
alter table public.golingo_game_referral_visits enable row level security;
revoke all on public.golingo_game_profiles,public.golingo_game_referral_visits from anon,authenticated;

create or replace function public.golingo_save_game_profile(p_name text,p_visible boolean)
returns table(public_id uuid,display_name text,leaderboard_visible boolean,link_visits bigint)
language plpgsql security definer set search_path='' as $$
declare uid text;
begin
 if not public.golingo_is_cognito() then raise exception 'GoLingo sign-in required'; end if;
 if p_name is null or p_name !~ '^[A-Za-z][A-Za-z0-9_]{2,23}$'
   then raise exception 'Name must be 3–24 letters, numbers or underscores and start with a letter'; end if;
 uid:=auth.jwt()->>'sub';
 insert into public.golingo_game_profiles(user_id,display_name,leaderboard_visible)
 values(uid,p_name,coalesce(p_visible,false))
 on conflict(user_id) do update set
  display_name=excluded.display_name,
  leaderboard_visible=excluded.leaderboard_visible,
  updated_at=now();
 return query
  select p.public_id,p.display_name,p.leaderboard_visible,
   (select count(*) from public.golingo_game_referral_visits v where v.referrer_public_id=p.public_id)
  from public.golingo_game_profiles p where p.user_id=uid;
end;
$$;
revoke all on function public.golingo_save_game_profile(text,boolean) from public;
grant execute on function public.golingo_save_game_profile(text,boolean) to authenticated;

create or replace function public.golingo_get_my_game_profile()
returns table(public_id uuid,display_name text,leaderboard_visible boolean,link_visits bigint)
language sql stable security definer set search_path='' as $$
 select p.public_id,p.display_name,p.leaderboard_visible,
  (select count(*) from public.golingo_game_referral_visits v where v.referrer_public_id=p.public_id)
 from public.golingo_game_profiles p
 where public.golingo_is_cognito() and p.user_id=auth.jwt()->>'sub'
$$;
revoke all on function public.golingo_get_my_game_profile() from public;
grant execute on function public.golingo_get_my_game_profile() to authenticated;

-- This is a leaderboard of RECORDED GAME LAUNCHES and published lesson sentences,
-- not time actually played, games mastered or sentences learned.
create or replace function public.golingo_game_top_streaks()
returns table(
 display_name text,public_id uuid,current_days integer,longest_days integer,
 games_tried bigint,published_sentences bigint,medal text
)
language sql stable security definer set search_path='' as $$
 select p.display_name,p.public_id,
  case when s.last_day >= (now() at time zone 'UTC')::date-1 then s.current_streak else 0 end,
  s.longest_streak,
  (select count(distinct g.game_id) from public.golingo_game_daily_launches g where g.user_id=p.user_id),
  (select coalesce(sum(case when jsonb_typeof(l.lesson_json->'sentences')='array'
     then jsonb_array_length(l.lesson_json->'sentences') else 0 end),0)::bigint
   from public.golingo_game_lessons l where l.user_id=p.user_id and l.is_public=true),
  case when s.longest_streak>=1095 then 'Diamond'
       when s.longest_streak>=730 then 'Gold'
       when s.longest_streak>=365 then 'Silver' else '' end
 from public.golingo_game_profiles p
 join public.golingo_game_streaks s on s.user_id=p.user_id
 where p.leaderboard_visible=true
 order by 3 desc,s.longest_streak desc,p.display_name asc
 limit 10;
$$;
revoke all on function public.golingo_game_top_streaks() from public;
grant execute on function public.golingo_game_top_streaks() to anon,authenticated;

-- Anonymous visitor can increment a public code's count, limited to one
-- counted visit per public code per minute. Not unique visitors or verified
-- referrals. Raw IPs, identities, and browsing fingerprints are NOT stored.
create or replace function public.golingo_record_game_referral_visit(p_public_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare recent_visit timestamptz;
begin
 if p_public_id is null or not exists(
  select 1 from public.golingo_game_profiles p where p.public_id=p_public_id
 ) then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_public_id::text,51001));
 select max(v.visited_at) into recent_visit from public.golingo_game_referral_visits v
 where v.referrer_public_id=p_public_id;
 if recent_visit is not null and recent_visit>now()-interval '1 minute' then return false; end if;
 insert into public.golingo_game_referral_visits(referrer_public_id) values(p_public_id);
 return true;
end;
$$;
revoke all on function public.golingo_record_game_referral_visit(uuid) from public;
grant execute on function public.golingo_record_game_referral_visit(uuid) to anon,authenticated;
commit;
