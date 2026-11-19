-- GoLingo Games shared activity & account favorites
-- RUN ONCE in Supabase SQL Editor after cognito-rls-migration.sql.
-- This does not migrate/inflate old device-only counts or likes.
-- Cognito JWT must have issuer us-east-1_m1wn7aFbx and role='authenticated'.
begin;
create table if not exists public.golingo_game_metrics (
 game_id text primary key check(game_id ~ '^[a-z0-9-]{1,90}$'),
 play_count bigint not null default 0 check (play_count >= 0),
 like_count bigint not null default 0 check (like_count >= 0)
);
create table if not exists public.golingo_game_likes (
 user_id text not null,
 game_id text not null check(game_id ~ '^[a-z0-9-]{1,90}$'),
 created_at timestamptz not null default now(),
 primary key(user_id,game_id)
);
create table if not exists public.golingo_game_favorites (
 user_id text not null,
 game_id text not null check(game_id ~ '^[a-z0-9-]{1,90}$'),
 created_at timestamptz not null default now(),
 primary key(user_id,game_id)
);
-- A random per-device UUID prevents accidental duplicate launch increments.
-- This is a simple rate limit, not bot-proof analytics. Use Edge Functions
-- and server-side abuse protection if you need audited global metrics.
create table if not exists public.golingo_game_play_guard (
 device_id uuid not null,
 game_id text not null check(game_id ~ '^[a-z0-9-]{1,90}$'),
 last_played_at timestamptz not null default now(),
 primary key(device_id,game_id)
);
alter table public.golingo_game_metrics enable row level security;
alter table public.golingo_game_likes enable row level security;
alter table public.golingo_game_favorites enable row level security;
alter table public.golingo_game_play_guard enable row level security;
revoke all on public.golingo_game_metrics, public.golingo_game_likes,
 public.golingo_game_favorites, public.golingo_game_play_guard from anon,authenticated;
grant select on public.golingo_game_metrics to anon,authenticated;
grant select on public.golingo_game_likes,public.golingo_game_favorites to authenticated;
grant insert,delete on public.golingo_game_favorites to authenticated;
drop policy if exists "Game metrics visible to everyone" on public.golingo_game_metrics;
create policy "Game metrics visible to everyone"
 on public.golingo_game_metrics for select to anon,authenticated using(true);
drop policy if exists "Read own likes" on public.golingo_game_likes;
create policy "Read own likes" on public.golingo_game_likes for select to authenticated
 using(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));
drop policy if exists "Read own favorites" on public.golingo_game_favorites;
create policy "Read own favorites" on public.golingo_game_favorites for select to authenticated
 using(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));
drop policy if exists "Add own favorites" on public.golingo_game_favorites;
create policy "Add own favorites" on public.golingo_game_favorites for insert to authenticated
 with check(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));
drop policy if exists "Remove own favorites" on public.golingo_game_favorites;
create policy "Remove own favorites" on public.golingo_game_favorites for delete to authenticated
 using(public.golingo_is_cognito() and user_id=(auth.jwt()->>'sub'));

create or replace function public.golingo_record_game_play(p_game_id text,p_device_id uuid)
returns table(play_count bigint,like_count bigint)
language plpgsql security definer set search_path=''
as $$
declare accepted boolean;
begin
 if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,90}$' or p_device_id is null then
  raise exception 'Invalid game or device';
 end if;
 accepted:=false;
 insert into public.golingo_game_play_guard(device_id,game_id,last_played_at)
 values(p_device_id,p_game_id,now())
 on conflict(device_id,game_id)
 do update set last_played_at=excluded.last_played_at
 where public.golingo_game_play_guard.last_played_at < now()-interval '10 seconds'
 returning true into accepted;
 if coalesce(accepted,false) then
  insert into public.golingo_game_metrics(game_id,play_count)
  values(p_game_id,1)
  on conflict(game_id) do update
   set play_count=public.golingo_game_metrics.play_count+1;
 end if;
 return query select m.play_count,m.like_count from public.golingo_game_metrics m
  where m.game_id=p_game_id;
end;
$$;
revoke all on function public.golingo_record_game_play(text,uuid) from public;
grant execute on function public.golingo_record_game_play(text,uuid) to anon,authenticated;

create or replace function public.golingo_set_game_like(p_game_id text,p_liked boolean)
returns table(play_count bigint,like_count bigint)
language plpgsql security definer set search_path=''
as $$
declare uid text;
declare changed integer:=0;
begin
 if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,90}$' or p_liked is null then
  raise exception 'Invalid game or like status';
 end if;
 if not public.golingo_is_cognito() then raise exception 'Sign in with GoLingo required'; end if;
 uid:=auth.jwt()->>'sub';
 if p_liked then
  insert into public.golingo_game_likes(user_id,game_id) values(uid,p_game_id)
   on conflict do nothing;
  get diagnostics changed=row_count;
 else
  delete from public.golingo_game_likes where user_id=uid and game_id=p_game_id;
  get diagnostics changed=row_count;
 end if;
 if changed>0 then
  insert into public.golingo_game_metrics(game_id,like_count)
    values(p_game_id,case when p_liked then 1 else 0 end)
  on conflict(game_id) do update set
    like_count=greatest(0,public.golingo_game_metrics.like_count
      +case when p_liked then 1 else -1 end);
 end if;
 return query select m.play_count,m.like_count from public.golingo_game_metrics m
   where m.game_id=p_game_id;
end;
$$;
revoke all on function public.golingo_set_game_like(text,boolean) from public;
grant execute on function public.golingo_set_game_like(text,boolean) to authenticated;
commit;
