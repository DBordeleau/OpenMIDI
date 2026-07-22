-- AVATAR-03 contracts the retired uploaded-avatar subsystem after the
-- generated-avatar application cutover. The guard must remain first.

do $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id in ('profile-images', 'public-avatars')
  ) then
    raise exception using
      errcode = 'PT409',
      message = 'avatar_storage_objects_remain';
  end if;

  if exists (
    select 1 from private.content_holds
    where target_asset_id is not null
      and released_at is null
      and (expires_at is null or expires_at > statement_timestamp())
  ) then
    raise exception using
      errcode = 'PT409',
      message = 'active_avatar_asset_hold_remains';
  end if;

  if exists (
    select 1 from private.profile_image_processing_jobs
    where status = 'leased' and lease_expires_at > statement_timestamp()
  ) or exists (
    select 1 from private.profile_avatar_cleanup_jobs
    where status = 'leased' and lease_expires_at > statement_timestamp()
  ) or exists (
    select 1 from private.retention_cleanup_jobs
    where subject_kind = 'avatar' and status = 'leased'
      and lease_expires_at > statement_timestamp()
  ) then
    raise exception using
      errcode = 'PT409',
      message = 'live_avatar_worker_lease_remains';
  end if;
end;
$$;

-- Close admission before removing any legacy state.
drop policy if exists reserved_profile_image_insert on storage.objects;

revoke all on function public.reserve_profile_image_upload(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_profile_image_upload(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.remove_own_avatar(uuid)
  from public, anon, authenticated, service_role;

update public.profiles
set avatar_path = null,
    avatar_version_id = null
where avatar_path is not null or avatar_version_id is not null;

create or replace function public.request_account_deletion(
  p_request_id uuid,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_parent private.deletion_requests%rowtype;
  v_project public.projects%rowtype;
  v_child private.deletion_requests%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'account_delete_unauthenticated';
  end if;
  select * into v_profile from public.profiles
  where id = v_actor and status = 'active' and profile_completed_at is not null
  for update;
  if not found or v_profile.username <> p_username then
    raise sqlstate 'PT403' using message = 'account_delete_confirmation_invalid';
  end if;
  insert into private.deletion_requests(
    requester_id, request_id, target_kind, target_profile_id, prior_status,
    prior_visibility, requested_at, restore_until
  ) values (
    v_actor, p_request_id, 'profile', v_actor, v_profile.status::text,
    v_profile.moderation_state, statement_timestamp(),
    statement_timestamp() + interval '30 days'
  ) returning * into v_parent;
  for v_project in
    select * from public.projects
    where owner_id = v_actor and status <> 'deleted' and moderation_state = 'visible'
    for update
  loop
    insert into private.deletion_requests(
      requester_id, request_id, target_kind, target_project_id,
      parent_request_id, expected_lock_version, prior_status, prior_visibility,
      prior_open_to_contributions, provenance, requested_at, restore_until
    ) values (
      v_actor, gen_random_uuid(), 'project', v_project.id, v_parent.id,
      v_project.lock_version, v_project.status::text, v_project.visibility::text,
      v_project.open_to_contributions, 'account_cascade', v_parent.requested_at,
      v_parent.restore_until
    ) returning * into v_child;
    insert into private.deletion_request_workspaces(
      deletion_request_id, workspace_id, prior_status
    )
    select v_child.id, w.id, w.status from public.workspaces w
    where w.project_id = v_project.id and w.status = 'active';
    update public.workspaces set status = 'archived', updated_at = statement_timestamp()
    where project_id = v_project.id and status = 'active';
    update public.projects
    set visibility = 'private', status = 'deleted', open_to_contributions = false,
        deleted_at = statement_timestamp(), lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = v_project.id;
    perform private.refresh_moderated_project(v_project.id);
  end loop;
  update public.workspaces set status = 'archived', updated_at = statement_timestamp()
  where owner_id = v_actor and status = 'active';
  update public.profiles
  set status = 'deleted',
      deletion_requested_at = v_parent.requested_at,
      deletion_restore_until = v_parent.restore_until,
      avatar_config = null,
      avatar_config_revision = avatar_config_revision
        + case when avatar_config is null then 0 else 1 end,
      avatar_updated_at = case when avatar_config is null then avatar_updated_at
        else statement_timestamp() end
  where id = v_actor;
  delete from public.public_project_catalog where owner_id = v_actor;
  return jsonb_build_object('requestId', v_parent.id, 'restoreUntil', v_parent.restore_until);
end;
$$;

revoke all on function public.request_account_deletion(uuid, text) from public;
grant execute on function public.request_account_deletion(uuid, text) to authenticated;

-- Reconcile obsolete operational rows only after the guard succeeds.
create temporary table avatar_03_retention_run_ids (
  run_id uuid primary key
) on commit drop;

insert into pg_temp.avatar_03_retention_run_ids(run_id)
select distinct run_id
from private.retention_cleanup_jobs
where subject_kind = 'avatar';

delete from private.retention_cleanup_objects o
using private.retention_cleanup_jobs j
where o.job_id = j.id and j.subject_kind = 'avatar';
delete from private.retention_cleanup_jobs where subject_kind = 'avatar';
delete from private.retention_runs r
using pg_temp.avatar_03_retention_run_ids removed
where r.id = removed.run_id
  and not exists (select 1 from private.retention_cleanup_jobs j where j.run_id = r.id);
delete from private.content_holds where target_asset_id is not null;
delete from private.moderation_actions
where target_kind = 'asset' or action = 'reject_upload';
delete from private.profile_image_processing_jobs;
delete from private.profile_image_uploads;
delete from private.profile_avatar_cleanup_jobs;
delete from public.profile_avatar_versions;
delete from public.assets;

-- Keep generic legal holds and retention, removing only asset/avatar branches.
create or replace function private.hold_conflicts_authorized_retention(
  p_target_kind text,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_target_kind
    when 'profile' then exists(
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null
        and j.status in ('leased', 'retry', 'dead')
        and (
          (j.subject_kind = 'deletion' and exists(
            select 1 from private.deletion_requests d
            where d.id = j.subject_id and d.target_profile_id = p_target_id
          ))
          or (j.subject_kind = 'metadata' and exists(
            select 1 from private.moderation_reports r
            where r.id = j.subject_id and r.target_profile_id = p_target_id
          ))
        )
    )
    when 'project' then exists(
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null
        and j.status in ('leased', 'retry', 'dead')
        and (
          (j.subject_kind = 'deletion' and exists(
            select 1 from private.deletion_requests d
            where d.id = j.subject_id and d.target_project_id = p_target_id
          ))
          or (j.subject_kind = 'metadata' and exists(
            select 1 from private.moderation_reports r
            where r.id = j.subject_id and r.target_project_id = p_target_id
          ))
        )
    )
    when 'contribution' then exists(
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null
        and j.status in ('leased', 'retry', 'dead')
        and (
          (j.subject_kind = 'deletion' and exists(
            select 1 from private.deletion_requests d
            where d.id = j.subject_id and d.target_contribution_id = p_target_id
          ))
          or (j.subject_kind = 'metadata' and exists(
            select 1 from private.moderation_reports r
            where r.id = j.subject_id and r.target_contribution_id = p_target_id
          ))
        )
    )
    else false
  end
$$;

create or replace function private.prevent_authorized_account_restore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'deleted' and new.status = 'active'
    and exists (
      select 1 from private.retention_cleanup_jobs j
      join private.deletion_requests d
        on j.subject_kind = 'deletion' and d.id = j.subject_id
      where d.target_profile_id = new.id
        and j.delete_authorized_at is not null
        and j.status in ('leased', 'retry', 'dead')
    )
  then
    raise sqlstate 'PT409' using message = 'account_retention_delete_authorized';
  end if;
  return new;
end;
$$;

create or replace function public.operator_retention_preview(p_limit integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 500 then
    raise sqlstate '22023' using message = 'retention_limit_invalid';
  end if;
  return jsonb_build_object(
    'policyVersion', 'retention-v3',
    'limit', p_limit,
    'groups', jsonb_build_array(
      jsonb_build_object(
        'rule', 'deletion_expired_30d',
        'count', (select count(*) from private.deletion_requests
          where status = 'recoverable' and restore_until <= statement_timestamp()),
        'bytes', 0
      ),
      jsonb_build_object(
        'rule', 'moderation_metadata_180d',
        'count', (select count(*) from private.moderation_reports
          where status in ('resolved', 'dismissed')
            and resolved_at <= statement_timestamp() - interval '180 days'
            and detail is not null),
        'bytes', 0
      )
    )
  );
end;
$$;

comment on function public.operator_retention_preview(integer) is
  'Read-only bounded metadata retention preview; never returns object paths.';

create or replace function public.operator_start_retention_run(p_limit integer default 100)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid := gen_random_uuid();
begin
  if p_limit not between 1 and 100 then
    raise sqlstate '22023' using message = 'retention_limit_invalid';
  end if;
  insert into private.retention_runs(id, mode, policy_version)
  values (v_run, 'execute', 'retention-v3');
  insert into private.retention_cleanup_jobs(
    run_id, policy_version, rule_code, subject_kind, subject_id, eligible_at
  )
  select v_run, 'retention-v3', 'deletion_expired_30d', 'deletion', d.id,
    d.restore_until
  from private.deletion_requests d
  where d.status = 'recoverable' and d.restore_until <= statement_timestamp()
  order by d.restore_until, d.id limit p_limit on conflict do nothing;
  insert into private.retention_cleanup_jobs(
    run_id, policy_version, rule_code, subject_kind, subject_id, eligible_at
  )
  select v_run, 'retention-v3', 'moderation_metadata_180d', 'metadata', r.id,
    r.resolved_at + interval '180 days'
  from private.moderation_reports r
  where r.status in ('resolved', 'dismissed')
    and r.resolved_at <= statement_timestamp() - interval '180 days'
    and r.detail is not null
  order by r.resolved_at, r.id limit p_limit on conflict do nothing;
  update private.retention_runs
  set candidate_count = (select count(*) from private.retention_cleanup_jobs where run_id = v_run)
  where id = v_run;
  return v_run;
end;
$$;

create or replace function public.operator_claim_retention_job(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.retention_cleanup_jobs%rowtype;
  v_token uuid;
begin
  loop
    v_job := null;
    v_token := gen_random_uuid();
    select * into v_job from private.retention_cleanup_jobs j
    where j.run_id = p_run_id
      and ((j.status in ('pending', 'retry') and j.next_attempt_at <= statement_timestamp())
        or (j.status = 'leased' and j.lease_expires_at <= statement_timestamp()))
    order by j.next_attempt_at, j.id for update skip locked limit 1;
    if not found then return null; end if;
    if v_job.delete_authorized_at is null then
      if v_job.subject_kind = 'deletion' and exists(
        select 1 from private.deletion_requests d join private.content_holds h
          on h.released_at is null
          and (h.expires_at is null or h.expires_at > statement_timestamp())
          and ((d.target_profile_id is not null and h.target_profile_id = d.target_profile_id)
            or (d.target_project_id is not null and h.target_project_id = d.target_project_id)
            or (d.target_contribution_id is not null and h.target_contribution_id = d.target_contribution_id))
        where d.id = v_job.subject_id
      ) or v_job.subject_kind = 'metadata' and exists(
        select 1 from private.moderation_reports r join private.content_holds h
          on h.released_at is null
          and (h.expires_at is null or h.expires_at > statement_timestamp())
          and ((r.target_profile_id is not null and h.target_profile_id = r.target_profile_id)
            or (r.target_project_id is not null and h.target_project_id = r.target_project_id)
            or (r.target_contribution_id is not null and h.target_contribution_id = r.target_contribution_id))
        where r.id = v_job.subject_id
      ) then
        update private.retention_cleanup_jobs
        set status = 'blocked', last_error_code = 'blocked_before_delete',
            lease_token = null, lease_expires_at = null
        where id = v_job.id;
        update private.retention_runs set blocked_count = blocked_count + 1
        where id = v_job.run_id;
        continue;
      end if;
    end if;
    update private.retention_cleanup_jobs
    set status = 'leased', attempt_count = attempt_count + 1,
        lease_token = v_token,
        lease_expires_at = statement_timestamp() + interval '2 minutes',
        delete_authorized_at = coalesce(delete_authorized_at, statement_timestamp())
    where id = v_job.id;
    return jsonb_build_object(
      'jobId', v_job.id, 'rule', v_job.rule_code,
      'subjectKind', v_job.subject_kind, 'subjectId', v_job.subject_id,
      'leaseToken', v_token, 'attempt', v_job.attempt_count + 1
    );
  end loop;
end;
$$;

create or replace function public.operator_finalize_retention_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_deleted_object_ids uuid[],
  p_missing_object_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.retention_cleanup_jobs%rowtype;
begin
  if coalesce(cardinality(p_deleted_object_ids), 0) <> 0
    or coalesce(cardinality(p_missing_object_ids), 0) <> 0
  then
    raise sqlstate '22023' using message = 'retention_objects_unsupported';
  end if;
  select * into v_job from private.retention_cleanup_jobs where id = p_job_id for update;
  if not found then raise sqlstate 'PT404' using message = 'retention_job_not_found'; end if;
  if v_job.status = 'complete' then return 'complete'; end if;
  if v_job.status <> 'leased' or v_job.lease_token <> p_lease_token
    or v_job.lease_expires_at <= statement_timestamp()
    or v_job.delete_authorized_at is null
  then
    raise sqlstate 'PT409' using message = 'retention_lease_invalid';
  end if;
  if v_job.subject_kind = 'deletion' then
    if exists(
      select 1 from private.deletion_requests d join private.content_holds h
        on h.released_at is null
        and (h.expires_at is null or h.expires_at > statement_timestamp())
        and ((d.target_profile_id is not null and h.target_profile_id = d.target_profile_id)
          or (d.target_project_id is not null and h.target_project_id = d.target_project_id)
          or (d.target_contribution_id is not null and h.target_contribution_id = d.target_contribution_id))
      where d.id = v_job.subject_id
    ) then
      raise sqlstate 'PT500' using message = 'retention_authorization_invariant';
    end if;
    update private.deletion_requests set status = 'purged', purged_at = statement_timestamp()
    where id = v_job.subject_id and status = 'recoverable'
      and restore_until <= statement_timestamp();
    update public.profiles set purged_at = statement_timestamp(), bio = null,
      display_name = 'Deleted musician'
    where id = (select target_profile_id from private.deletion_requests where id = v_job.subject_id)
      and status = 'deleted';
    update public.projects set purged_at = statement_timestamp(), description = null
    where id = (select target_project_id from private.deletion_requests where id = v_job.subject_id)
      and status = 'deleted';
    update public.contributions set purged_at = statement_timestamp(), description = null
    where id = (select target_contribution_id from private.deletion_requests where id = v_job.subject_id)
      and deleted_at is not null;
  elsif v_job.subject_kind = 'metadata' then
    update private.moderation_reports
    set detail = null, target_label_snapshot = 'Unavailable target',
        updated_at = statement_timestamp()
    where id = v_job.subject_id
      and resolved_at <= statement_timestamp() - interval '180 days';
  else
    raise sqlstate 'PT500' using message = 'retention_subject_invalid';
  end if;
  update private.retention_cleanup_jobs
  set status = 'complete', completed_at = statement_timestamp(),
      lease_token = null, lease_expires_at = null
  where id = v_job.id;
  update private.retention_runs set completed_count = completed_count + 1
  where id = v_job.run_id;
  return 'complete';
end;
$$;

create or replace function public.place_content_hold(
  p_request_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_hold_type text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.assert_admin_actor();
  v_existing private.content_holds%rowtype;
  v_id uuid;
begin
  if p_request_id is null or p_target_id is null
    or p_target_kind not in ('profile', 'project', 'contribution')
    or p_hold_type not in ('legal', 'abuse')
    or p_reason is null or btrim(p_reason) = '' or char_length(btrim(p_reason)) > 500
    or (p_expires_at is not null and p_expires_at <= statement_timestamp())
  then raise sqlstate '22023' using message = 'hold_invalid'; end if;
  select * into v_existing from private.content_holds
  where placed_by = v_admin and request_id = p_request_id;
  if found then
    if v_existing.target_kind <> p_target_kind
      or coalesce(v_existing.target_profile_id, v_existing.target_project_id,
        v_existing.target_contribution_id) <> p_target_id
      or v_existing.hold_type <> p_hold_type
      or v_existing.reason <> btrim(p_reason)
      or v_existing.expires_at is distinct from p_expires_at
    then raise sqlstate 'PT409' using message = 'hold_request_conflict'; end if;
    return v_existing.id;
  end if;
  if private.hold_conflicts_authorized_retention(p_target_kind, p_target_id) then
    raise sqlstate 'PT409' using message = 'hold_retention_delete_authorized';
  end if;
  insert into private.content_holds(
    request_id, target_kind, target_profile_id, target_project_id,
    target_contribution_id, hold_type, reason, placed_by, expires_at
  ) values (
    p_request_id, p_target_kind,
    case when p_target_kind = 'profile' then p_target_id end,
    case when p_target_kind = 'project' then p_target_id end,
    case when p_target_kind = 'contribution' then p_target_id end,
    p_hold_type, btrim(p_reason), v_admin, p_expires_at
  ) returning id into v_id;
  insert into private.moderation_actions(
    admin_id, request_id, action, target_kind, target_id, reason, resulting_state
  ) values (v_admin, p_request_id, 'place_hold', p_target_kind, p_target_id,
    btrim(p_reason), p_hold_type);
  return v_id;
end;
$$;

create or replace function public.release_content_hold(
  p_hold_id uuid,
  p_request_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.assert_admin_actor();
  v_hold private.content_holds%rowtype;
  v_existing private.moderation_actions%rowtype;
  v_target_id uuid;
begin
  if p_hold_id is null or p_request_id is null or p_reason is null
    or btrim(p_reason) = '' or char_length(btrim(p_reason)) > 500
  then raise sqlstate '22023' using message = 'hold_release_invalid'; end if;
  select * into v_hold from private.content_holds where id = p_hold_id for update;
  if not found then raise sqlstate 'PT404' using message = 'hold_not_found'; end if;
  v_target_id := coalesce(v_hold.target_profile_id, v_hold.target_project_id,
    v_hold.target_contribution_id);
  select * into v_existing from private.moderation_actions
  where admin_id = v_admin and request_id = p_request_id;
  if found then
    if v_existing.action <> 'release_hold'
      or v_existing.target_kind <> v_hold.target_kind
      or v_existing.target_id <> v_target_id
      or v_existing.reason <> btrim(p_reason)
    then raise sqlstate 'PT409' using message = 'hold_release_request_conflict'; end if;
    return p_hold_id;
  end if;
  if v_hold.released_at is not null then
    raise sqlstate 'PT409' using message = 'hold_already_released';
  end if;
  update private.content_holds
  set released_by = v_admin, released_at = statement_timestamp()
  where id = p_hold_id;
  insert into private.moderation_actions(
    admin_id, request_id, action, target_kind, target_id, reason,
    prior_state, resulting_state
  ) values (v_admin, p_request_id, 'release_hold', v_hold.target_kind,
    v_target_id, btrim(p_reason), v_hold.hold_type, 'released');
  return p_hold_id;
end;
$$;

-- Remove result shapes that still expose the legacy profile pointers.
drop view public.public_profiles;
drop function public.get_viewer_profile();

drop trigger profiles_avatar_retention_barrier on public.profiles;
drop trigger assets_immutable on public.assets;
drop function private.prevent_authorized_avatar_restore();
drop function private.avatar_retention_blocked(uuid);
drop function private.can_upload_reserved_profile_image(text, text);
drop function private.protect_asset_immutability();
drop function public.complete_profile_image_upload(uuid);
drop function public.get_admin_storage_summary();
drop function public.operator_claim_profile_avatar_cleanup();
drop function public.operator_claim_profile_image(uuid, uuid);
drop function public.operator_complete_profile_avatar_cleanup(uuid, uuid);
drop function public.operator_complete_profile_image(
  uuid, uuid, text, bigint, text, integer, integer, smallint, integer, text
);
drop function public.operator_count_due_profile_avatar_cleanup();
drop function public.operator_retry_profile_avatar_cleanup(uuid, uuid, text);
drop function public.operator_retry_profile_image(uuid, uuid, text);
drop function public.remove_own_avatar(uuid);
drop function public.reserve_profile_image_upload(uuid, integer, text, text);

drop table private.retention_cleanup_objects;
drop table private.profile_image_uploads;
drop table private.profile_image_processing_jobs;
drop table private.profile_avatar_cleanup_jobs;

alter table private.content_holds
  drop constraint content_holds_target_asset_id_fkey,
  drop constraint content_holds_one_target,
  drop constraint content_holds_target_kind_check,
  drop column target_asset_id,
  add constraint content_holds_one_target check (
    num_nonnulls(target_profile_id, target_project_id, target_contribution_id) = 1
    and ((target_kind = 'profile') = (target_profile_id is not null))
    and ((target_kind = 'project') = (target_project_id is not null))
    and ((target_kind = 'contribution') = (target_contribution_id is not null))
  ),
  add constraint content_holds_target_kind_check check (
    target_kind in ('profile', 'project', 'contribution')
  );
alter table private.moderation_actions
  drop constraint moderation_actions_action_check,
  drop constraint moderation_actions_target_kind_check,
  add constraint moderation_actions_action_check check (
    action in ('assign_self', 'dismiss', 'resolve', 'hide', 'restore',
      'suspend_account', 'restore_account', 'place_hold', 'release_hold')
  ),
  add constraint moderation_actions_target_kind_check check (
    target_kind in ('report', 'profile', 'project', 'contribution')
  );

alter table private.retention_cleanup_jobs
  drop constraint retention_cleanup_jobs_rule_code_check,
  drop constraint retention_cleanup_jobs_subject_kind_check,
  add constraint retention_cleanup_jobs_rule_code_check check (
    rule_code in ('deletion_expired_30d', 'moderation_metadata_180d')
  ),
  add constraint retention_cleanup_jobs_subject_kind_check check (
    subject_kind in ('deletion', 'metadata')
  );

alter table public.profiles
  drop constraint profiles_avatar_version_fk,
  drop column avatar_version_id,
  drop column avatar_path;

drop table public.profile_avatar_versions;
drop table public.assets;
drop type public.profile_avatar_status;
drop type public.asset_status;

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
    p.last_active_at, p.avatar_config, p.avatar_config_revision,
    p.avatar_updated_at
  from public.profiles p where p.id = v_user_id;
  if not found then raise sqlstate 'PT500' using message = 'profile_missing'; end if;
end;
$$;

comment on function public.get_viewer_profile() is
  'Returns lifecycle and generated-avatar preference data for the authenticated caller only.';
revoke all on function public.get_viewer_profile() from public;
grant execute on function public.get_viewer_profile() to authenticated;

create view public.public_profiles with (security_invoker = true) as
select id, username, username_normalized, display_name, credit_name, bio,
  created_at, updated_at, avatar_config
from public.profiles;

comment on view public.public_profiles is
  'Safe profile projection; underlying profile RLS limits rows and avatar revision remains private.';
grant select on public.public_profiles to anon, authenticated;

comment on function public.get_admin_retention_summary() is
  'Administrator-only metadata retention summary; generated avatars create no stored files.';
