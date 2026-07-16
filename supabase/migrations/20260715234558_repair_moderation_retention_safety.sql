-- Forward repair for the already-applied PR 18 migration.
-- A retention claim is also the irreversible-delete authorization boundary:
-- eligibility is rechecked under row locks and all supported blocker writers
-- reject new references/holds until the Storage result is finalized.

alter table private.retention_cleanup_jobs
  add column delete_authorized_at timestamptz;

alter table private.retention_cleanup_jobs
  drop constraint retention_cleanup_jobs_rule_code_check,
  add constraint retention_cleanup_jobs_rule_code_check check (
    rule_code in (
      'failed_upload_24h',
      'snapshot_30d',
      'peak_expired_24h',
      'avatar_superseded',
      'deletion_expired_30d',
      'account_source_30d',
      'moderation_metadata_180d'
    )
  );

create or replace function private.asset_has_authorized_retention_job(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from private.retention_cleanup_jobs j
    where j.subject_kind='asset'
      and j.subject_id=p_asset_id
      and j.delete_authorized_at is not null
      and j.status in ('leased','retry','dead')
  )
$$;
revoke all on function private.asset_has_authorized_retention_job(uuid) from public,anon,authenticated;

create function private.prevent_authorized_retention_reference()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_asset_id uuid;
begin
  v_asset_id:=nullif(to_jsonb(new)->>tg_argv[0],'')::uuid;
  if v_asset_id is not null and private.asset_has_authorized_retention_job(v_asset_id) then
    raise sqlstate 'PT409' using message='asset_retention_delete_authorized';
  end if;
  return new;
end $$;
revoke all on function private.prevent_authorized_retention_reference() from public,anon,authenticated;

create trigger project_asset_references_retention_barrier
before insert or update on public.project_asset_references
for each row execute function private.prevent_authorized_retention_reference('asset_id');

create trigger revision_tracks_retention_barrier
before insert or update on public.revision_tracks
for each row execute function private.prevent_authorized_retention_reference('asset_id');

create trigger workspace_tracks_retention_barrier
before insert or update on public.workspace_tracks
for each row execute function private.prevent_authorized_retention_reference('asset_id');

create trigger workspaces_snapshot_retention_barrier
before insert or update of snapshot_asset_id on public.workspaces
for each row execute function private.prevent_authorized_retention_reference('snapshot_asset_id');

create trigger contribution_version_tracks_retention_barrier
before insert or update on public.contribution_version_tracks
for each row execute function private.prevent_authorized_retention_reference('asset_id');

create trigger contribution_versions_snapshot_retention_barrier
before insert or update of snapshot_asset_id on public.contribution_versions
for each row execute function private.prevent_authorized_retention_reference('snapshot_asset_id');

create function private.prevent_authorized_asset_reactivation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from new.status
    and new.status not in ('failed','deleted')
    and private.asset_has_authorized_retention_job(new.id)
  then
    raise sqlstate 'PT409' using message='asset_retention_delete_authorized';
  end if;
  return new;
end $$;
revoke all on function private.prevent_authorized_asset_reactivation() from public,anon,authenticated;
create trigger assets_retention_reactivation_barrier
before update of status on public.assets
for each row execute function private.prevent_authorized_asset_reactivation();

create function private.prevent_authorized_avatar_restore()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.avatar_version_id is not null
    and new.avatar_version_id is distinct from old.avatar_version_id
    and exists (
      select 1 from private.retention_cleanup_jobs j
      where j.subject_kind='avatar' and j.subject_id=new.avatar_version_id
        and j.delete_authorized_at is not null and j.status in ('leased','retry','dead')
    )
  then
    raise sqlstate 'PT409' using message='avatar_retention_delete_authorized';
  end if;
  return new;
end $$;
revoke all on function private.prevent_authorized_avatar_restore() from public,anon,authenticated;
create trigger profiles_avatar_retention_barrier
before update of avatar_version_id on public.profiles
for each row execute function private.prevent_authorized_avatar_restore();

create function private.prevent_authorized_account_restore()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status='deleted' and new.status='active'
    and exists (
      select 1 from private.retention_cleanup_jobs j
      join public.assets a on j.subject_kind='asset' and a.id=j.subject_id
      where a.owner_id=new.id and j.rule_code='account_source_30d'
        and j.delete_authorized_at is not null and j.status in ('leased','retry','dead')
    )
  then
    raise sqlstate 'PT409' using message='account_retention_delete_authorized';
  end if;
  return new;
end $$;
revoke all on function private.prevent_authorized_account_restore() from public,anon,authenticated;
create trigger profiles_account_retention_barrier
before update of status on public.profiles
for each row execute function private.prevent_authorized_account_restore();

-- Account deletion and its recovery window are user-controlled. Moderation may
-- suspend or restore moderation-suspended accounts, but it must not bypass the
-- deletion recovery workflow by changing a deleted profile's status.
create function private.prevent_admin_deleted_account_restore()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status='deleted'
    and new.status is distinct from old.status
    and auth.uid() is distinct from old.id
  then
    raise sqlstate 'PT409' using message='account_deletion_user_controlled';
  end if;
  return new;
end $$;
revoke all on function private.prevent_admin_deleted_account_restore() from public,anon,authenticated;
create trigger profiles_deleted_account_authority
before update of status on public.profiles
for each row execute function private.prevent_admin_deleted_account_restore();

create function private.hold_conflicts_authorized_retention(p_target_kind text,p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case p_target_kind
    when 'asset' then exists (
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null and j.status in ('leased','retry','dead')
        and ((j.subject_kind='asset' and j.subject_id=p_target_id)
          or (j.subject_kind='avatar' and exists (
            select 1 from public.profile_avatar_versions v
            where v.id=j.subject_id and v.source_asset_id=p_target_id)))
    )
    when 'profile' then exists (
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='asset' and exists (
          select 1 from public.assets a where a.id=j.subject_id and a.owner_id=p_target_id))
        or (j.subject_kind='avatar' and exists (
          select 1 from public.profile_avatar_versions v where v.id=j.subject_id and v.profile_id=p_target_id))
        or (j.subject_kind='deletion' and exists (
          select 1 from private.deletion_requests d where d.id=j.subject_id and d.target_profile_id=p_target_id))
        or (j.subject_kind='metadata' and exists (
          select 1 from private.moderation_reports r where r.id=j.subject_id and r.target_profile_id=p_target_id))
      )
    )
    when 'project' then exists (
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='asset' and exists (
          select 1 from public.project_asset_references r where r.asset_id=j.subject_id and r.project_id=p_target_id))
        or (j.subject_kind='deletion' and exists (
          select 1 from private.deletion_requests d where d.id=j.subject_id and d.target_project_id=p_target_id))
        or (j.subject_kind='metadata' and exists (
          select 1 from private.moderation_reports r where r.id=j.subject_id and r.target_project_id=p_target_id))
      )
    )
    when 'contribution' then exists (
      select 1 from private.retention_cleanup_jobs j
      where j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='deletion' and exists (
          select 1 from private.deletion_requests d where d.id=j.subject_id and d.target_contribution_id=p_target_id))
        or (j.subject_kind='metadata' and exists (
          select 1 from private.moderation_reports r where r.id=j.subject_id and r.target_contribution_id=p_target_id))
      )
    )
    else false
  end
$$;
revoke all on function private.hold_conflicts_authorized_retention(text,uuid) from public,anon,authenticated;

create or replace function public.reject_admin_upload(
  p_asset_id uuid,p_request_id uuid,p_expected_status text,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid:=private.assert_admin_actor();
  v_asset public.assets%rowtype;
  v_existing private.moderation_actions%rowtype;
  v_action uuid;
begin
  if p_request_id is null or p_asset_id is null
    or p_expected_status not in ('reserved','uploading','processing','failed')
    or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500
  then raise sqlstate '22023' using message='upload_rejection_invalid'; end if;

  select * into v_existing from private.moderation_actions
  where admin_id=v_admin and request_id=p_request_id;
  if found then
    if v_existing.action<>'reject_upload' or v_existing.target_kind<>'asset'
      or v_existing.target_id<>p_asset_id or v_existing.reason<>btrim(p_reason)
      or v_existing.prior_state is distinct from p_expected_status
    then raise sqlstate 'PT409' using message='upload_rejection_request_conflict'; end if;
    return jsonb_build_object('actionId',v_existing.id,'result',v_existing.resulting_state);
  end if;

  select * into v_asset from public.assets where id=p_asset_id for update;
  if not found then raise sqlstate 'PT404' using message='asset_not_found'; end if;
  if v_asset.status::text<>p_expected_status or v_asset.status='ready'
    or exists(select 1 from private.retention_blockers(v_asset.id) where blocker_code<>'source_verification')
  then raise sqlstate 'PT409' using message='upload_rejection_blocked'; end if;
  if v_asset.status<>'failed' then perform private.fail_source_asset(v_asset.id,'moderation_rejected'); end if;
  update private.asset_verification_jobs
  set state='permanent_failed',lease_token=null,lease_expires_at=null,
    completed_at=statement_timestamp(),last_error_code='moderation_rejected'
  where asset_id=v_asset.id and state not in ('succeeded','permanent_failed');
  insert into private.moderation_actions(
    admin_id,request_id,action,target_kind,target_id,reason,prior_state,resulting_state
  ) values(
    v_admin,p_request_id,'reject_upload','asset',p_asset_id,btrim(p_reason),p_expected_status,'failed'
  ) returning id into v_action;
  return jsonb_build_object('actionId',v_action,'result','failed');
end $$;

create or replace function public.place_content_hold(
  p_request_id uuid,p_target_kind text,p_target_id uuid,p_hold_type text,
  p_reason text,p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid:=private.assert_admin_actor();
  v_existing private.content_holds%rowtype;
  v_id uuid;
begin
  if p_request_id is null or p_target_id is null
    or p_target_kind not in ('profile','project','contribution','asset')
    or p_hold_type not in ('legal','abuse')
    or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500
    or (p_expires_at is not null and p_expires_at<=statement_timestamp())
  then raise sqlstate '22023' using message='hold_invalid'; end if;

  select * into v_existing from private.content_holds
  where placed_by=v_admin and request_id=p_request_id;
  if found then
    if v_existing.target_kind<>p_target_kind
      or coalesce(v_existing.target_profile_id,v_existing.target_project_id,
        v_existing.target_contribution_id,v_existing.target_asset_id)<>p_target_id
      or v_existing.hold_type<>p_hold_type or v_existing.reason<>btrim(p_reason)
      or v_existing.expires_at is distinct from p_expires_at
    then raise sqlstate 'PT409' using message='hold_request_conflict'; end if;
    return v_existing.id;
  end if;

  if private.hold_conflicts_authorized_retention(p_target_kind,p_target_id) then
    raise sqlstate 'PT409' using message='hold_retention_delete_authorized';
  end if;
  insert into private.content_holds(
    request_id,target_kind,target_profile_id,target_project_id,
    target_contribution_id,target_asset_id,hold_type,reason,placed_by,expires_at
  ) values(
    p_request_id,p_target_kind,
    case when p_target_kind='profile' then p_target_id end,
    case when p_target_kind='project' then p_target_id end,
    case when p_target_kind='contribution' then p_target_id end,
    case when p_target_kind='asset' then p_target_id end,
    p_hold_type,btrim(p_reason),v_admin,p_expires_at
  ) returning id into v_id;
  insert into private.moderation_actions(
    admin_id,request_id,action,target_kind,target_id,reason,resulting_state
  ) values(v_admin,p_request_id,'place_hold',p_target_kind,p_target_id,btrim(p_reason),p_hold_type);
  return v_id;
end $$;

create or replace function public.release_content_hold(
  p_hold_id uuid,p_request_id uuid,p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid:=private.assert_admin_actor();
  v_hold private.content_holds%rowtype;
  v_existing private.moderation_actions%rowtype;
  v_target_id uuid;
begin
  if p_hold_id is null or p_request_id is null or p_reason is null
    or btrim(p_reason)='' or char_length(btrim(p_reason))>500
  then raise sqlstate '22023' using message='hold_release_invalid'; end if;
  select * into v_hold from private.content_holds where id=p_hold_id for update;
  if not found then raise sqlstate 'PT404' using message='hold_not_found'; end if;
  v_target_id:=coalesce(v_hold.target_profile_id,v_hold.target_project_id,
    v_hold.target_contribution_id,v_hold.target_asset_id);
  select * into v_existing from private.moderation_actions
  where admin_id=v_admin and request_id=p_request_id;
  if found then
    if v_existing.action<>'release_hold' or v_existing.target_kind<>v_hold.target_kind
      or v_existing.target_id<>v_target_id or v_existing.reason<>btrim(p_reason)
    then raise sqlstate 'PT409' using message='hold_release_request_conflict'; end if;
    return p_hold_id;
  end if;
  if v_hold.released_at is not null then
    raise sqlstate 'PT409' using message='hold_already_released';
  end if;
  update private.content_holds set released_by=v_admin,released_at=statement_timestamp()
  where id=p_hold_id;
  insert into private.moderation_actions(
    admin_id,request_id,action,target_kind,target_id,reason,prior_state,resulting_state
  ) values(
    v_admin,p_request_id,'release_hold',v_hold.target_kind,v_target_id,
    btrim(p_reason),v_hold.hold_type,'released'
  );
  return p_hold_id;
end $$;

create or replace function public.get_admin_moderation_target(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_report private.moderation_reports%rowtype;
begin
  perform private.assert_admin_actor();
  select * into v_report from private.moderation_reports where id=p_report_id;
  if not found then raise sqlstate 'PT404' using message='report_not_found'; end if;
  return jsonb_build_object(
    'id',v_report.id,'targetKind',v_report.target_kind,
    'targetId',coalesce(v_report.target_profile_id,v_report.target_project_id,v_report.target_contribution_id),
    'targetLabel',v_report.target_label_snapshot,'reason',v_report.reason,'detail',v_report.detail,
    'status',v_report.status,'createdAt',v_report.created_at,'updatedAt',v_report.updated_at,
    'targetVersion',case v_report.target_kind
      when 'profile' then (select moderation_version from public.profiles where id=v_report.target_profile_id)
      when 'project' then (select moderation_version from public.projects where id=v_report.target_project_id)
      else (select moderation_version from public.contributions where id=v_report.target_contribution_id) end,
    'targetState',case v_report.target_kind
      when 'profile' then (select moderation_state from public.profiles where id=v_report.target_profile_id)
      when 'project' then (select moderation_state from public.projects where id=v_report.target_project_id)
      else (select moderation_state from public.contributions where id=v_report.target_contribution_id) end,
    'targetAccountStatus',case when v_report.target_kind='profile'
      then (select status::text from public.profiles where id=v_report.target_profile_id) end,
    'holds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',h.id,'type',h.hold_type,'placedAt',h.placed_at,'expiresAt',h.expires_at
      ) order by h.placed_at desc)
      from private.content_holds h
      where h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
        and ((v_report.target_kind='profile' and h.target_profile_id=v_report.target_profile_id)
          or (v_report.target_kind='project' and h.target_project_id=v_report.target_project_id)
          or (v_report.target_kind='contribution' and h.target_contribution_id=v_report.target_contribution_id))
    ),'[]'::jsonb)
  );
end $$;

create function public.list_admin_rejectable_uploads()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform private.assert_admin_actor();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at,x.id)
    from (
      select a.id,a.original_filename,a.status::text status,
        a.reserved_byte_size,a.created_at
      from public.assets a
      where a.kind='source_audio'
        and a.status in ('reserved','uploading','processing','failed')
        and not exists (
          select 1 from private.retention_blockers(a.id)
          where blocker_code<>'source_verification'
        )
      order by a.created_at,a.id
      limit 25
    ) x
  ),'[]'::jsonb);
end $$;
revoke all on function public.list_admin_rejectable_uploads() from public,anon;
grant execute on function public.list_admin_rejectable_uploads() to authenticated;

create or replace function public.operator_retention_preview(p_limit integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if p_limit not between 1 and 500 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  return jsonb_build_object('policyVersion','retention-v1','limit',p_limit,'groups',jsonb_build_array(
    jsonb_build_object('rule','failed_upload_24h','count',(select count(*) from (select a.id from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)) limit p_limit) q),'bytes',(select coalesce(sum(a.reserved_byte_size),0) from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)))),
    jsonb_build_object('rule','snapshot_30d','count',(select count(*) from (select a.id from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)) limit p_limit) q),'bytes',(select coalesce(sum(coalesce(a.byte_size,a.reserved_byte_size)),0) from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)))),
    jsonb_build_object('rule','peak_expired_24h','count',(select count(*) from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours')),'bytes',(select coalesce(sum(coalesce(d.byte_size,d.expected_byte_size)),0) from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours'))),
    jsonb_build_object('rule','avatar_superseded','count',(select count(*) from private.profile_avatar_cleanup_jobs where status in ('pending','retry') and next_attempt_at<=statement_timestamp()),'bytes',(select coalesce(sum(coalesce(v.byte_size,0)+a.reserved_byte_size),0) from private.profile_avatar_cleanup_jobs j join public.profile_avatar_versions v on v.id=j.avatar_version_id join public.assets a on a.id=j.source_asset_id where j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp())),
    jsonb_build_object('rule','deletion_expired_30d','count',(select count(*) from private.deletion_requests where status='recoverable' and restore_until<=statement_timestamp()),'bytes',0),
    jsonb_build_object('rule','account_source_30d','count',(select count(*) from (select a.id from public.assets a join public.profiles p on p.id=a.owner_id where a.kind='source_audio' and a.status='ready' and p.status='deleted' and p.purged_at is not null and not exists(select 1 from private.retention_blockers(a.id)) limit p_limit) q),'bytes',(select coalesce(sum(a.byte_size),0) from public.assets a join public.profiles p on p.id=a.owner_id where a.kind='source_audio' and a.status='ready' and p.status='deleted' and p.purged_at is not null and not exists(select 1 from private.retention_blockers(a.id)))),
    jsonb_build_object('rule','moderation_metadata_180d','count',(select count(*) from private.moderation_reports where status in ('resolved','dismissed') and resolved_at<=statement_timestamp()-interval '180 days'),'bytes',0)
  ));
end $$;

create or replace function public.operator_start_retention_run(p_limit integer default 100)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_run uuid:=gen_random_uuid();
begin
  if p_limit not between 1 and 100 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  insert into private.retention_runs(id,mode) values(v_run,'execute');
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','failed_upload_24h','asset',a.id,a.failed_at+interval '24 hours',coalesce(a.byte_size,a.reserved_byte_size)
    from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)) order by a.failed_at,a.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','snapshot_30d','asset',a.id,a.created_at+interval '30 days',coalesce(a.byte_size,a.reserved_byte_size)
    from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)) order by a.created_at,a.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','peak_expired_24h','peak',d.id,coalesce(d.failed_at,d.expires_at)+interval '24 hours',coalesce(d.byte_size,d.expected_byte_size)
    from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours')
    order by coalesce(d.failed_at,d.expires_at),d.id limit p_limit on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','avatar_superseded','avatar',j.avatar_version_id,j.next_attempt_at,coalesce(v.byte_size,0)+a.reserved_byte_size
    from private.profile_avatar_cleanup_jobs j join public.profile_avatar_versions v on v.id=j.avatar_version_id join public.assets a on a.id=j.source_asset_id
    where j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp() order by j.next_attempt_at,j.avatar_version_id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
    select v_run,'retention-v1','deletion_expired_30d','deletion',d.id,d.restore_until from private.deletion_requests d where d.status='recoverable' and d.restore_until<=statement_timestamp() order by d.restore_until,d.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','account_source_30d','asset',a.id,p.purged_at,coalesce(a.byte_size,a.reserved_byte_size)
    from public.assets a join public.profiles p on p.id=a.owner_id
    where a.kind='source_audio' and a.status='ready' and p.status='deleted' and p.purged_at is not null
      and not exists(select 1 from private.retention_blockers(a.id))
    order by p.purged_at,a.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
    select v_run,'retention-v1','moderation_metadata_180d','metadata',r.id,r.resolved_at+interval '180 days' from private.moderation_reports r
    where r.status in ('resolved','dismissed') and r.resolved_at<=statement_timestamp()-interval '180 days' and r.detail is not null
    order by r.resolved_at,r.id limit p_limit on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,a.bucket,a.object_path from private.retention_cleanup_jobs j join public.assets a on j.subject_kind='asset' and a.id=j.subject_id where j.run_id=v_run on conflict do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,d.bucket,d.object_path from private.retention_cleanup_jobs j join public.waveform_peak_derivatives d on j.subject_kind='peak' and d.id=j.subject_id where j.run_id=v_run on conflict do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,'public-avatars',v.public_object_path from private.retention_cleanup_jobs j join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id where j.run_id=v_run
    union all select j.id,a.bucket,a.object_path from private.retention_cleanup_jobs j join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id join public.assets a on a.id=v.source_asset_id where j.run_id=v_run on conflict do nothing;
  update private.retention_runs set candidate_count=(select count(*) from private.retention_cleanup_jobs where run_id=v_run) where id=v_run;
  return v_run;
end $$;

create or replace function public.operator_claim_retention_job(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_job private.retention_cleanup_jobs%rowtype;
  v_token uuid;
  v_source_asset uuid;
begin
  loop
    v_job:=null;
    v_token:=gen_random_uuid();
    select * into v_job
    from private.retention_cleanup_jobs j
    where j.run_id=p_run_id and (
      (j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp())
      or (j.status='leased' and j.lease_expires_at<=statement_timestamp())
    )
    order by j.next_attempt_at,j.id
    for update skip locked limit 1;
    if not found then return null; end if;

    if v_job.delete_authorized_at is null then
      if v_job.subject_kind='asset' then
        perform 1 from public.assets where id=v_job.subject_id for update;
        if not found or exists(select 1 from private.retention_blockers(v_job.subject_id)) then
          update private.retention_cleanup_jobs
          set status='blocked',last_error_code='blocked_before_delete',lease_token=null,lease_expires_at=null
          where id=v_job.id;
          update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
          continue;
        end if;
      elsif v_job.subject_kind='avatar' then
        select source_asset_id into v_source_asset from public.profile_avatar_versions
        where id=v_job.subject_id for update;
        if not found or exists(select 1 from private.retention_blockers(v_source_asset)) then
          update private.retention_cleanup_jobs
          set status='blocked',last_error_code='blocked_before_delete',lease_token=null,lease_expires_at=null
          where id=v_job.id;
          update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
          continue;
        end if;
      elsif v_job.subject_kind='deletion' and exists(
        select 1 from private.deletion_requests d join private.content_holds h
          on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
          and ((d.target_profile_id is not null and h.target_profile_id=d.target_profile_id)
            or (d.target_project_id is not null and h.target_project_id=d.target_project_id)
            or (d.target_contribution_id is not null and h.target_contribution_id=d.target_contribution_id))
        where d.id=v_job.subject_id
      ) then
        update private.retention_cleanup_jobs
        set status='blocked',last_error_code='blocked_before_delete',lease_token=null,lease_expires_at=null
        where id=v_job.id;
        update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
        continue;
      elsif v_job.subject_kind='metadata' and exists(
        select 1 from private.moderation_reports r join private.content_holds h
          on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
          and ((r.target_profile_id is not null and h.target_profile_id=r.target_profile_id)
            or (r.target_project_id is not null and h.target_project_id=r.target_project_id)
            or (r.target_contribution_id is not null and h.target_contribution_id=r.target_contribution_id))
        where r.id=v_job.subject_id
      ) then
        update private.retention_cleanup_jobs
        set status='blocked',last_error_code='blocked_before_delete',lease_token=null,lease_expires_at=null
        where id=v_job.id;
        update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
        continue;
      end if;
    end if;

    update private.retention_cleanup_jobs
    set status='leased',attempt_count=attempt_count+1,lease_token=v_token,
      lease_expires_at=statement_timestamp()+interval '2 minutes',
      delete_authorized_at=coalesce(delete_authorized_at,statement_timestamp())
    where id=v_job.id;
    return jsonb_build_object(
      'jobId',v_job.id,'rule',v_job.rule_code,'subjectKind',v_job.subject_kind,
      'subjectId',v_job.subject_id,'leaseToken',v_token,'attempt',v_job.attempt_count+1,
      'objects',coalesce((select jsonb_agg(jsonb_build_object(
        'id',o.id,'bucket',o.bucket,'path',o.object_path
      ) order by o.id) from private.retention_cleanup_objects o where o.job_id=v_job.id),'[]'::jsonb)
    );
  end loop;
end $$;

create or replace function public.operator_finalize_retention_job(
  p_job_id uuid,p_lease_token uuid,p_deleted_object_ids uuid[],p_missing_object_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_job private.retention_cleanup_jobs%rowtype;
  v_asset public.assets%rowtype;
  v_version public.profile_avatar_versions%rowtype;
begin
  select * into v_job from private.retention_cleanup_jobs where id=p_job_id for update;
  if not found then raise sqlstate 'PT404' using message='retention_job_not_found'; end if;
  if v_job.status='complete' then return 'complete'; end if;
  if v_job.status<>'leased' or v_job.lease_token<>p_lease_token
    or v_job.lease_expires_at<=statement_timestamp() or v_job.delete_authorized_at is null
  then raise sqlstate 'PT409' using message='retention_lease_invalid'; end if;
  if exists(
    select 1 from private.retention_cleanup_objects
    where job_id=v_job.id and deleted_at is null
      and id<>all(coalesce(p_deleted_object_ids,'{}'))
      and id<>all(coalesce(p_missing_object_ids,'{}'))
  ) then raise sqlstate 'PT409' using message='retention_objects_incomplete'; end if;

  if v_job.subject_kind='asset' then
    select * into v_asset from public.assets where id=v_job.subject_id for update;
    if exists(select 1 from private.retention_blockers(v_asset.id)) then
      raise sqlstate 'PT500' using message='retention_authorization_invariant';
    end if;
    if v_asset.status<>'deleted' then
      if v_asset.kind='source_audio' and v_asset.status='ready' then
        update public.global_storage_usage
        set source_bytes=greatest(0,source_bytes-coalesce(v_asset.byte_size,0)),updated_at=statement_timestamp()
        where singleton;
        update public.user_storage_usage
        set source_bytes=greatest(0,source_bytes-coalesce(v_asset.byte_size,0)),updated_at=statement_timestamp()
        where user_id=v_asset.owner_id;
      end if;
      update public.assets set status='deleted',failure_code=null,failed_at=null,
        deleted_at=statement_timestamp() where id=v_asset.id;
    end if;
  elsif v_job.subject_kind='peak' then
    update public.global_storage_usage g
    set reserved_derived_bytes=greatest(0,g.reserved_derived_bytes-d.expected_byte_size),updated_at=statement_timestamp()
    from public.waveform_peak_derivatives d
    where d.id=v_job.subject_id and d.status='reserved' and g.singleton;
    delete from public.waveform_peak_derivatives where id=v_job.subject_id and status in ('reserved','failed');
  elsif v_job.subject_kind='avatar' then
    select * into v_version from public.profile_avatar_versions where id=v_job.subject_id for update;
    if exists(select 1 from private.retention_blockers(v_version.source_asset_id)) then
      raise sqlstate 'PT500' using message='retention_authorization_invariant';
    end if;
    update public.profile_avatar_versions set status='cleaned',cleaned_at=coalesce(cleaned_at,statement_timestamp()) where id=v_version.id;
    update public.assets set status='deleted',failure_code=null,failed_at=null,
      deleted_at=coalesce(deleted_at,statement_timestamp()) where id=v_version.source_asset_id and status<>'deleted';
    update private.profile_avatar_cleanup_jobs
    set status='complete',lease_token=null,lease_expires_at=null,updated_at=statement_timestamp()
    where avatar_version_id=v_version.id;
  elsif v_job.subject_kind='deletion' then
    if exists(
      select 1 from private.deletion_requests d join private.content_holds h
        on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
        and ((d.target_profile_id is not null and h.target_profile_id=d.target_profile_id)
          or (d.target_project_id is not null and h.target_project_id=d.target_project_id)
          or (d.target_contribution_id is not null and h.target_contribution_id=d.target_contribution_id))
      where d.id=v_job.subject_id
    ) then
      raise sqlstate 'PT500' using message='retention_authorization_invariant';
    end if;
    update private.deletion_requests set status='purged',purged_at=statement_timestamp()
    where id=v_job.subject_id and status='recoverable' and restore_until<=statement_timestamp();
    update public.profiles set purged_at=statement_timestamp(),bio=null,display_name='Deleted musician'
    where id=(select target_profile_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.projects set purged_at=statement_timestamp(),description=null
    where id=(select target_project_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.contributions set purged_at=statement_timestamp(),description=null
    where id=(select target_contribution_id from private.deletion_requests where id=v_job.subject_id) and deleted_at is not null;
  elsif v_job.subject_kind='metadata' then
    update private.moderation_reports set detail=null,target_label_snapshot='Unavailable target',updated_at=statement_timestamp()
    where id=v_job.subject_id and resolved_at<=statement_timestamp()-interval '180 days';
  end if;

  update private.retention_cleanup_objects
  set deleted_at=statement_timestamp(),already_missing=(id=any(coalesce(p_missing_object_ids,'{}')))
  where job_id=v_job.id and id=any(coalesce(p_deleted_object_ids,'{}')||coalesce(p_missing_object_ids,'{}'));
  update private.retention_cleanup_jobs
  set status='complete',completed_at=statement_timestamp(),lease_token=null,lease_expires_at=null
  where id=v_job.id;
  update private.retention_runs set completed_count=completed_count+1 where id=v_job.run_id;
  return 'complete';
end $$;

-- Authorized jobs keep their barrier across retries, including partial
-- multi-object avatar deletion. A later claim reuses the authorization and
-- missing-object confirmation safely reconciles the partial attempt.
create or replace function public.operator_retry_retention_job(
  p_job_id uuid,p_lease_token uuid,p_error_code text
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_attempt integer; v_run uuid;
begin
  select attempt_count,run_id into v_attempt,v_run
  from private.retention_cleanup_jobs
  where id=p_job_id and status='leased' and lease_token=p_lease_token
  for update;
  if not found then raise sqlstate 'PT409' using message='retention_lease_invalid'; end if;
  update private.retention_cleanup_jobs
  set status=case when v_attempt>=8 then 'dead' else 'retry' end,
    next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,power(2,v_attempt)::integer*10)),
    lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80)
  where id=p_job_id;
  if v_attempt>=8 then
    update private.retention_runs set failed_count=failed_count+1 where id=v_run;
    return 'dead';
  end if;
  return 'retry';
end $$;

revoke all on function public.list_admin_rejectable_uploads() from public,anon;
grant execute on function public.list_admin_rejectable_uploads() to authenticated;

comment on column private.retention_cleanup_jobs.delete_authorized_at is
  'Set only after a locked blocker recheck; supported blocker writers reject new references until job reconciliation.';
