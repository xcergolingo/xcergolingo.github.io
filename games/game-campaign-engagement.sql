-- GoLingo share-action + published-lesson counters for Cognito users.
-- Run after existing game lessons + Cognito RLS schema.
-- Share actions = successful link copies or completed native Share API.
-- They are NOT verified deliveries, referrals, or prize entries.
begin;
create table if not exists public.golingo_game_share_actions (
  id bigint generated always as identity primary key,
  user_id text not null,
  target text not null,
  action text not null check(action in ('copy','share')),
  recorded_at timestamptz not null default now()
);
create index if not exists golingo_share_actions_owner_recent
  on public.golingo_game_share_actions(user_id,recorded_at desc);
alter table public.golingo_game_share_actions enable row level security;
revoke all on public.golingo_game_share_actions from anon,authenticated;
create or replace function public.golingo_record_game_share_action(p_target text,p_action text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare
  uid text;
  n bigint;
begin
  if not public.golingo_is_cognito() then raise exception 'GoLingo account required'; end if;
  if p_action is null or p_action not in ('copy','share') then raise exception 'Invalid action'; end if;
  if p_target is null or (
     p_target <> 'gallery'
     and p_target !~ '^game:[a-z0-9-]{1,90}$'
     and p_target !~ '^lesson:[0-9a-f-]{36}$'
  ) then raise exception 'Invalid share target'; end if;
  if p_target like 'lesson:%' and not exists (
    select 1 from public.golingo_game_lessons l
     where l.id=(substring(p_target from 8))::uuid and l.is_public=true
  ) then raise exception 'Lesson not published'; end if;
  uid:=auth.jwt()->>'sub';
  -- Basic abuse ceiling: cap counted actions to 60 per hour per account.
  if (select count(*) from public.golingo_game_share_actions a
       where a.user_id=uid and a.recorded_at>=now()-interval '1 hour') < 60 then
    insert into public.golingo_game_share_actions(user_id,target,action)
    values(uid,p_target,p_action);
  end if;
  select count(*) into n from public.golingo_game_share_actions where user_id=uid;
  return n;
end;
$$;
revoke all on function public.golingo_record_game_share_action(text,text) from public;
grant execute on function public.golingo_record_game_share_action(text,text) to authenticated;
create or replace function public.golingo_get_game_engagement_counts()
returns table(share_actions bigint,published_lessons bigint)
language sql stable security definer set search_path=''
as $$
select
 (select count(*) from public.golingo_game_share_actions a where a.user_id=auth.jwt()->>'sub'),
 (select count(*) from public.golingo_game_lessons l
    where l.user_id=auth.jwt()->>'sub' and l.is_public=true)
where public.golingo_is_cognito()
$$;
revoke all on function public.golingo_get_game_engagement_counts() from public;
grant execute on function public.golingo_get_game_engagement_counts() to authenticated;
commit;
