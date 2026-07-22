-- AVATAR-01 is expand-only: uploaded-avatar columns and commands remain intact.

create or replace function private.is_valid_avatar_config(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_options jsonb;
  v_scale numeric;
  v_rotate numeric;
begin
  if p_config is null then return true; end if;
  if jsonb_typeof(p_config) <> 'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_config) key)
      is distinct from array['options', 'seed', 'version']::text[]
    or p_config->'version' <> '1'::jsonb
    or jsonb_typeof(p_config->'seed') <> 'string'
    or (p_config->>'seed') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_config->'options') <> 'object'
  then return false; end if;

  v_options := p_config->'options';
  if (select array_agg(key order by key) from jsonb_object_keys(v_options) key)
      is distinct from array['backgroundColor', 'eyebrowsVariant', 'eyesVariant', 'glassesProbability',
        'glassesVariant', 'mouthVariant', 'rotate', 'scale']::text[]
    or jsonb_typeof(v_options->'eyebrowsVariant') <> 'string'
    or (v_options->>'eyebrowsVariant') !~ '^variant(0[1-9]|1[0-5])$'
    or jsonb_typeof(v_options->'eyesVariant') <> 'string'
    or (v_options->>'eyesVariant') !~ '^variant(0[1-9]|1[0-9]|2[0-6])$'
    or jsonb_typeof(v_options->'glassesVariant') <> 'string'
    or (v_options->>'glassesVariant') !~ '^variant0[1-5]$'
    or jsonb_typeof(v_options->'glassesProbability') <> 'number'
    or v_options->'glassesProbability' not in ('0'::jsonb, '100'::jsonb)
    or jsonb_typeof(v_options->'mouthVariant') <> 'string'
    or (v_options->>'mouthVariant') !~ '^variant(0[1-9]|[12][0-9]|30)$'
    or jsonb_typeof(v_options->'backgroundColor') <> 'string'
    or (v_options->>'backgroundColor') !~ '^[0-9a-f]{6}$'
    or jsonb_typeof(v_options->'scale') <> 'number'
    or jsonb_typeof(v_options->'rotate') <> 'number'
  then return false; end if;

  v_scale := (v_options->>'scale')::numeric;
  v_rotate := (v_options->>'rotate')::numeric;
  return coalesce(v_scale between 0.8 and 1.6
    and mod(v_scale * 20, 1) = 0
    and v_rotate between -20 and 20
    and v_rotate = trunc(v_rotate), false);
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_avatar_config(jsonb) from public;

alter table public.profiles
  add column avatar_config jsonb,
  add column avatar_config_revision integer not null default 0,
  add constraint profiles_avatar_config_valid_check
    check (private.is_valid_avatar_config(avatar_config)),
  add constraint profiles_avatar_config_seed_check
    check (avatar_config is null or avatar_config->>'seed' = id::text),
  add constraint profiles_avatar_config_revision_check
    check (avatar_config_revision >= 0);

comment on column public.profiles.avatar_config is
  'Validated DiceBear Adventurer Neutral configuration; NULL selects the initials fallback.';
comment on column public.profiles.avatar_config_revision is
  'Owner-private optimistic-concurrency revision for generated avatar preference changes.';

create or replace function public.save_own_avatar_config(
  p_options jsonb,
  p_expected_revision integer
)
returns table(avatar_config jsonb, avatar_config_revision integer, avatar_updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_revision integer;
  v_config jsonb;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'avatar_config_unauthenticated';
  end if;

  select p.avatar_config_revision into v_revision
  from public.profiles p
  where p.id = v_actor and p.status = 'active' and p.profile_completed_at is not null
  for update;
  if not found then
    raise sqlstate 'PT403' using message = 'avatar_config_forbidden';
  end if;
  if p_expected_revision is distinct from v_revision then
    raise sqlstate 'PT409' using message = 'avatar_config_stale';
  end if;

  v_config := jsonb_build_object('version', 1, 'seed', v_actor::text, 'options', p_options);
  if private.is_valid_avatar_config(v_config) is not true then
    raise sqlstate 'PT400' using message = 'avatar_config_invalid';
  end if;

  return query
  update public.profiles p
  set avatar_config = v_config,
      avatar_config_revision = p.avatar_config_revision + 1,
      avatar_updated_at = statement_timestamp()
  where p.id = v_actor
  returning p.avatar_config, p.avatar_config_revision, p.avatar_updated_at;
end;
$$;

create or replace function public.reset_own_avatar_config(p_expected_revision integer)
returns table(avatar_config jsonb, avatar_config_revision integer, avatar_updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_revision integer;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'avatar_config_unauthenticated';
  end if;

  select p.avatar_config_revision into v_revision
  from public.profiles p
  where p.id = v_actor and p.status = 'active' and p.profile_completed_at is not null
  for update;
  if not found then
    raise sqlstate 'PT403' using message = 'avatar_config_forbidden';
  end if;
  if p_expected_revision is distinct from v_revision then
    raise sqlstate 'PT409' using message = 'avatar_config_stale';
  end if;

  return query
  update public.profiles p
  set avatar_config = null,
      avatar_config_revision = p.avatar_config_revision + 1,
      avatar_updated_at = statement_timestamp()
  where p.id = v_actor
  returning p.avatar_config, p.avatar_config_revision, p.avatar_updated_at;
end;
$$;

revoke all on function public.save_own_avatar_config(jsonb, integer) from public;
grant execute on function public.save_own_avatar_config(jsonb, integer) to authenticated;
revoke all on function public.reset_own_avatar_config(integer) from public;
grant execute on function public.reset_own_avatar_config(integer) to authenticated;

create or replace function private.clear_deleted_profile_avatar_config()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'deleted' and old.status is distinct from new.status
    and new.avatar_config is not null
  then
    new.avatar_config := null;
    new.avatar_config_revision := old.avatar_config_revision + 1;
    new.avatar_updated_at := statement_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function private.clear_deleted_profile_avatar_config() from public;
create trigger profiles_clear_deleted_avatar_config
before update of status on public.profiles
for each row execute function private.clear_deleted_profile_avatar_config();

drop function public.get_viewer_profile();
create function public.get_viewer_profile()
returns table(
  id uuid,
  username text,
  username_normalized text,
  display_name text,
  credit_name text,
  bio text,
  status public.account_status,
  profile_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  last_active_at timestamptz,
  avatar_path text,
  avatar_version_id uuid,
  avatar_config jsonb,
  avatar_config_revision integer,
  avatar_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise sqlstate 'PT401' using message = 'viewer_unauthenticated';
  end if;
  return query
  select p.id, p.username, p.username_normalized, p.display_name, p.credit_name,
    p.bio, p.status, p.profile_completed_at, p.created_at, p.updated_at,
    p.last_active_at, p.avatar_path, p.avatar_version_id, p.avatar_config,
    p.avatar_config_revision, p.avatar_updated_at
  from public.profiles p where p.id = v_user_id;
  if not found then raise sqlstate 'PT500' using message = 'profile_missing'; end if;
end;
$$;

comment on function public.get_viewer_profile() is
  'Returns lifecycle and avatar preference data for the authenticated caller only.';
revoke all on function public.get_viewer_profile() from public;
grant execute on function public.get_viewer_profile() to authenticated;

create or replace view public.public_profiles with (security_invoker = true) as
select id, username, username_normalized, display_name, credit_name, bio,
  created_at, updated_at, avatar_path, avatar_version_id, avatar_config
from public.profiles;

comment on view public.public_profiles is
  'Safe profile projection; underlying profile RLS limits rows and avatar revision remains private.';
grant select(avatar_config) on public.profiles to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

create or replace function public.get_admin_retention_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();
  return jsonb_build_object(
    'dueCleanupCount',
      (select count(*) from private.deletion_requests d
        where d.status = 'recoverable' and d.restore_until <= statement_timestamp())
      +
      (select count(*) from private.moderation_reports r
        where r.status in ('resolved', 'dismissed')
          and r.resolved_at <= statement_timestamp() - interval '180 days'
          and r.detail is not null),
    'lastRun', (
      select jsonb_build_object(
        'id', r.id, 'status', r.status, 'requestedAt', r.requested_at,
        'completedAt', r.completed_at, 'candidateCount', r.candidate_count,
        'completedCount', r.completed_count, 'blockedCount', r.blocked_count,
        'failedCount', r.failed_count
      )
      from private.retention_runs r
      order by r.requested_at desc, r.id desc
      limit 1
    )
  );
end;
$$;

comment on function public.get_admin_retention_summary() is
  'Administrator-only non-Storage retention summary for the generated-avatar transition.';
revoke all on function public.get_admin_retention_summary() from public;
grant execute on function public.get_admin_retention_summary() to authenticated;
