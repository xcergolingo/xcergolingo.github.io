-- GoLingo social campaign activity counters (Cognito accounts only).
-- Run after cognito-rls-migration.sql and the existing game lessons schema.
-- Records confirmed "Copy link" and completed browser "Share" actions, not
-- actual social deliveries, recipients, referrals, or bonus prize entries.
begin;
create table if not exists public.golingo_game_share_actions (
  id bigint generated always as identity primary key,
  user_id text not null,
  lesson_id uuid not null,
  action text not null check (action in ('copy','share')),
  recorded_at timestamptz not null default now()
);
create index if not exists golingo_share_actions_owner_recent
  on public.golingo_game_share_actions(user_id,recorded_at desc);
alter table public.golingo_game_share_actions enable row level security;
revoke all on public.golingo_game_share_actions from anon,authenticated;
-- Do not expose individual actions; only the owner's totals via RPC.
create or replace function public.golingo_record_game_share_action(
  p_lesson_id uuid,p_action text
) returns bigint
language plpgsql security definer set search_path=''
as $$
declare
  uid text;
  count_actions bigint;
begin
  if not public.golingo_is_cognito() then
    raise exception 'GoLingo app account required';
  end if;
  if p_action not in ('copy','share') then
    raise exception 'Invalid share action';
  end if;
  uid:=auth.jwt()->>'sub';
  if not exists(
    select 1 from public.golingo_game_lessons l
    where l.id=p_lesson_id and l.is_public=true
  ) then
    raise exception 'Lesson is not public';
  end if;
  -- Limit fake taps; this measures UI shares, not proof of recipients.
  if (select count(*) from public.golingo_game_share_actions a
      where a.user_id=uid
        and a.recorded_at >= now()-interval '1 hour') < 60
  then
    insert into public.golingo_game_share_actions(user_id,lesson_id,action)
      values(uid,p_lesson_id,p_action);
  end if;
  select count(*) into count_actions
    from public.golingo_game_share_actions where user_id=uid;
  return count_actions;
end;
$$;
revoke all on function public.golingo_record_game_share_action(uuid,text) from public;
grant execute on function public.golingo_record_game_share_action(uuid,text) to authenticated;

create or replace function public.golingo_get_game_engagement_counts()
returns table (share_actions bigint,published_lessons bigint)
language sql stable security definer set search_path=''
as $$
  select
    (select count(*) from public.golingo_game_share_actions a
       where a.user_id=auth.jwt()->>'sub'),
    (select count(*) from public.golingo_game_lessons l
       where l.user_id=auth.jwt()->>'sub' and l.is_public=true)
  where public.golingo_is_cognito()
$$;
revoke all on function public.golingo_get_game_engagement_counts() from public;
grant execute on function public.golingo_get_game_engagement_counts() to authenticated;
commit;
