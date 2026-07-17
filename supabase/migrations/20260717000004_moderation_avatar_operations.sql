-- PIVOT-09 reviewed baseline: moderation, deletion/retention, admin operations, and avatar-only Storage.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."avatar_retention_blocked"("p_avatar_version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists(select 1 from public.profiles p where p.avatar_version_id=p_avatar_version_id)
    or exists(
      select 1 from public.profile_avatar_versions v join private.content_holds h
        on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
        and (h.target_asset_id=v.source_asset_id or h.target_profile_id=v.profile_id)
      where v.id=p_avatar_version_id)
$$;

ALTER FUNCTION "private"."avatar_retention_blocked"("p_avatar_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."can_upload_reserved_profile_image"("p_bucket" "text", "p_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists(select 1 from public.assets a join private.profile_image_uploads u on u.asset_id=a.id
    where a.owner_id=(select auth.uid()) and a.bucket=p_bucket and a.object_path=p_name
      and a.status in ('reserved','uploading') and u.expires_at>statement_timestamp())
$$;

ALTER FUNCTION "private"."can_upload_reserved_profile_image"("p_bucket" "text", "p_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."hold_conflicts_authorized_retention"("p_target_kind" "text", "p_target_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case p_target_kind
    when 'asset' then exists(select 1 from private.retention_cleanup_jobs j
      join public.profile_avatar_versions v on v.id=j.subject_id
      where j.subject_kind='avatar' and v.source_asset_id=p_target_id
        and j.delete_authorized_at is not null and j.status in ('leased','retry','dead'))
    when 'profile' then exists(select 1 from private.retention_cleanup_jobs j where
      j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='avatar' and exists(select 1 from public.profile_avatar_versions v
          where v.id=j.subject_id and v.profile_id=p_target_id))
        or (j.subject_kind='deletion' and exists(select 1 from private.deletion_requests d
          where d.id=j.subject_id and d.target_profile_id=p_target_id))
        or (j.subject_kind='metadata' and exists(select 1 from private.moderation_reports r
          where r.id=j.subject_id and r.target_profile_id=p_target_id))))
    when 'project' then exists(select 1 from private.retention_cleanup_jobs j where
      j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='deletion' and exists(select 1 from private.deletion_requests d
          where d.id=j.subject_id and d.target_project_id=p_target_id))
        or (j.subject_kind='metadata' and exists(select 1 from private.moderation_reports r
          where r.id=j.subject_id and r.target_project_id=p_target_id))))
    when 'contribution' then exists(select 1 from private.retention_cleanup_jobs j where
      j.delete_authorized_at is not null and j.status in ('leased','retry','dead') and (
        (j.subject_kind='deletion' and exists(select 1 from private.deletion_requests d
          where d.id=j.subject_id and d.target_contribution_id=p_target_id))
        or (j.subject_kind='metadata' and exists(select 1 from private.moderation_reports r
          where r.id=j.subject_id and r.target_contribution_id=p_target_id))))
    else false end
$$;

ALTER FUNCTION "private"."hold_conflicts_authorized_retention"("p_target_kind" "text", "p_target_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."prevent_authorized_account_restore"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."prevent_authorized_account_restore"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."prevent_authorized_avatar_restore"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."prevent_authorized_avatar_restore"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."apply_moderation_action"("p_report_id" "uuid", "p_request_id" "uuid", "p_action" "text", "p_reason" "text", "p_expected_report_status" "text", "p_expected_target_version" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_admin uuid:=private.assert_admin_actor(); v_report private.moderation_reports%rowtype;
  v_existing private.moderation_actions%rowtype; v_target uuid; v_prior text; v_result text;
begin
  if p_request_id is null or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500
    or p_action not in ('assign_self','dismiss','resolve','hide','restore','suspend_account','restore_account')
    then raise sqlstate '22023' using message='moderation_action_invalid'; end if;
  select * into v_existing from private.moderation_actions where admin_id=v_admin and request_id=p_request_id;
  if found then
    if v_existing.report_id is distinct from p_report_id or v_existing.action<>p_action or v_existing.reason<>btrim(p_reason)
      then raise sqlstate 'PT409' using message='moderation_action_request_conflict'; end if;
    return jsonb_build_object('actionId',v_existing.id,'result',v_existing.resulting_state);
  end if;
  select * into v_report from private.moderation_reports where id=p_report_id for update;
  if not found then raise sqlstate 'PT404' using message='report_not_found'; end if;
  if v_report.status<>p_expected_report_status then raise sqlstate 'PT409' using message='report_state_conflict'; end if;
  v_target:=coalesce(v_report.target_profile_id,v_report.target_project_id,v_report.target_contribution_id);
  if p_action='assign_self' then
    update private.moderation_reports set status='reviewing',assigned_admin_id=v_admin,updated_at=statement_timestamp() where id=p_report_id;
    v_prior:=v_report.status; v_result:='reviewing';
  elsif p_action in ('dismiss','resolve') then
    update private.moderation_reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,
      resolved_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_report_id;
    v_prior:=v_report.status; v_result:=case when p_action='dismiss' then 'dismissed' else 'resolved' end;
  elsif v_report.target_kind='profile' then
    if p_action in ('hide','restore') then
      select moderation_state into v_prior from public.profiles where id=v_target and moderation_version=p_expected_target_version for update;
      if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
      v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
      update public.profiles set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
      if p_action='hide' then delete from public.public_project_catalog where owner_id=v_target; end if;
      if p_action='restore' then
        perform private.refresh_moderated_project(p.id) from public.projects p where p.owner_id=v_target;
      end if;
    elsif p_action in ('suspend_account','restore_account') then
      select status::text into v_prior from public.profiles where id=v_target and moderation_version=p_expected_target_version for update;
      if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
      v_result:=case when p_action='suspend_account' then 'suspended' else 'active' end;
      update public.profiles set status=v_result::public.account_status,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
      if p_action='suspend_account' then delete from public.public_project_catalog where owner_id=v_target; end if;
      if p_action='restore_account' then
        perform private.refresh_moderated_project(p.id) from public.projects p where p.owner_id=v_target;
      end if;
    else raise sqlstate 'PT409' using message='moderation_action_incompatible'; end if;
  elsif v_report.target_kind='project' and p_action in ('hide','restore') then
    select moderation_state into v_prior from public.projects where id=v_target and moderation_version=p_expected_target_version for update;
    if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
    v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
    update public.projects set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp(),
      open_to_contributions=case when p_action='hide' then false else open_to_contributions end where id=v_target;
    perform private.refresh_moderated_project(v_target);
  elsif v_report.target_kind='contribution' and p_action in ('hide','restore') then
    select moderation_state into v_prior from public.contributions where id=v_target and moderation_version=p_expected_target_version for update;
    if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
    v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
    update public.contributions set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
  else raise sqlstate 'PT409' using message='moderation_action_incompatible'; end if;
  if p_action not in ('assign_self','dismiss','resolve') then
    update private.moderation_reports set status='resolved',resolved_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_report_id;
  end if;
  insert into private.moderation_actions(admin_id,request_id,report_id,action,target_kind,target_id,reason,prior_state,resulting_state)
  values(v_admin,p_request_id,p_report_id,p_action,case when p_action in ('assign_self','dismiss','resolve') then 'report' else v_report.target_kind end,
    case when p_action in ('assign_self','dismiss','resolve') then p_report_id else v_target end,btrim(p_reason),v_prior,v_result)
  returning id into v_target;
  return jsonb_build_object('actionId',v_target,'result',v_result);
end $$;

ALTER FUNCTION "public"."apply_moderation_action"("p_report_id" "uuid", "p_request_id" "uuid", "p_action" "text", "p_reason" "text", "p_expected_report_status" "text", "p_expected_target_version" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_profile_image_upload"("p_asset_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_version uuid;
begin
  select u.avatar_version_id into v_version from private.profile_image_uploads u join public.assets a on a.id=u.asset_id
    where u.asset_id=p_asset_id and u.owner_id=v_actor and a.status in ('reserved','uploading','processing') and u.expires_at>statement_timestamp() for update of u,a;
  if not found then raise sqlstate 'PT404' using message='avatar_upload_missing'; end if;
  update public.assets set status='processing',upload_completed_at=coalesce(upload_completed_at,statement_timestamp()) where id=p_asset_id and status in ('reserved','uploading');
  update private.profile_image_uploads set upload_completed_at=coalesce(upload_completed_at,statement_timestamp()) where asset_id=p_asset_id;
  insert into private.profile_image_processing_jobs(asset_id,owner_id,avatar_version_id) values(p_asset_id,v_actor,v_version) on conflict(asset_id) do nothing;
  return v_version;
end $$;

ALTER FUNCTION "public"."complete_profile_image_upload"("p_asset_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_own_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_c public.contributions%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_delete_unauthenticated'; end if;
  select * into v_c from public.contributions where id=p_contribution_id and author_id=v_actor for update;
  if not found then raise sqlstate 'PT404' using message='contribution_delete_not_found'; end if;
  if v_c.status not in ('rejected','withdrawn') or v_c.deleted_at is not null or v_c.moderation_state<>'visible'
    or exists(select 1 from public.project_revisions where accepted_contribution_id=v_c.id)
    or exists(select 1 from private.content_holds where target_contribution_id=v_c.id and released_at is null and (expires_at is null or expires_at>statement_timestamp()))
    then raise sqlstate 'PT409' using message='contribution_delete_unavailable'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_contribution_id,prior_status,prior_visibility,requested_at,restore_until)
  values(v_actor,p_request_id,'contribution',v_c.id,v_c.status::text,v_c.moderation_state,statement_timestamp(),statement_timestamp()+interval '30 days');
  update public.contributions set deleted_at=statement_timestamp(),moderation_state='hidden',moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_c.id;
  return jsonb_build_object('contributionId',v_c.id,'restoreUntil',statement_timestamp()+interval '30 days');
end $$;

ALTER FUNCTION "public"."delete_own_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_project"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer) RETURNS TABLE("project_id" "uuid", "deleted_at" timestamp with time zone, "lock_version" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_request private.deletion_requests%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_delete_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_delete_actor_ineligible'; end if;
  select * into v_request from private.deletion_requests where requester_id=v_actor and request_id=p_request_id;
  if found then
    if v_request.target_project_id is distinct from p_project_id or v_request.expected_lock_version is distinct from p_expected_lock_version then raise sqlstate 'PT409' using message='project_delete_request_conflict'; end if;
    return query select p.id,p.deleted_at,p.lock_version from public.projects p where p.id=p_project_id; return;
  end if;
  select * into v_project from public.projects where id=p_project_id and owner_id=v_actor for update;
  if not found then raise sqlstate 'PT404' using message='project_delete_not_found'; end if;
  if v_project.status='deleted' or v_project.moderation_state<>'visible' or v_project.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='project_delete_conflict'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_project_id,expected_lock_version,prior_status,prior_visibility,prior_open_to_contributions,requested_at,restore_until)
  values(v_actor,p_request_id,'project',p_project_id,p_expected_lock_version,v_project.status::text,v_project.visibility::text,v_project.open_to_contributions,statement_timestamp(),statement_timestamp()+interval '30 days') returning * into v_request;
  insert into private.deletion_request_workspaces(deletion_request_id,workspace_id,prior_status)
    select v_request.id,w.id,w.status from public.workspaces w where w.project_id=p_project_id and w.status='active';
  update public.workspaces w set status='archived',updated_at=statement_timestamp() where w.project_id=p_project_id and w.status='active';
  update public.projects p set visibility='private',status='deleted',open_to_contributions=false,deleted_at=statement_timestamp(),lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id returning p.* into v_project;
  perform private.refresh_moderated_project(p_project_id);
  return query select v_project.id,v_project.deleted_at,v_project.lock_version;
end $$;

ALTER FUNCTION "public"."delete_project"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_admin_moderation_target"("p_report_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_admin_moderation_target"("p_report_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_admin_storage_summary"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  perform private.assert_admin_actor();

  return jsonb_build_object(
    'thresholds', jsonb_build_object(
      'warningBytes', 104857600,
      'stopBytes', 209715200
    ),
    'total', jsonb_build_object(
      'objectCount', (
        select count(*)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
      ),
      'bytes', (
        select coalesce(sum(
          case
            when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
            else 0
          end
        ), 0)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
      ),
      'unknownSizeCount', (
        select count(*)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
          and not coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
      )
    ),
    'buckets', coalesce((
      select jsonb_agg(to_jsonb(bucket_summary) order by bucket_summary.bucket)
      from (
        select
          o.bucket_id as bucket,
          count(*) as object_count,
          coalesce(sum(
            case
              when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
              else 0
            end
          ), 0) as bytes,
          count(*) filter (
            where not coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
          ) as unknown_size_count
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
        group by o.bucket_id
      ) bucket_summary
    ), '[]'::jsonb),
    'untrackedObjectCount', (
      select count(*)
      from storage.objects o
      where o.bucket_id in ('profile-images', 'public-avatars')
        and (
          (o.bucket_id = 'profile-images' and not exists (
            select 1
            from public.assets a
            where a.bucket = o.bucket_id and a.object_path = o.name
          ))
          or
          (o.bucket_id = 'public-avatars' and not exists (
            select 1
            from public.profile_avatar_versions v
            where v.public_object_path = o.name
          ))
        )
    ),
    'dueCleanupCount', (
      (select count(*) from private.profile_avatar_cleanup_jobs j
        where j.status in ('pending', 'retry')
          and j.next_attempt_at <= statement_timestamp())
      +
      (select count(*) from private.deletion_requests d
        where d.status = 'recoverable'
          and d.restore_until <= statement_timestamp())
      +
      (select count(*) from private.moderation_reports r
        where r.status in ('resolved', 'dismissed')
          and r.resolved_at <= statement_timestamp() - interval '180 days'
          and r.detail is not null)
    ),
    'lastRun', (
      select jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'requestedAt', r.requested_at,
        'completedAt', r.completed_at,
        'candidateCount', r.candidate_count,
        'completedCount', r.completed_count,
        'blockedCount', r.blocked_count,
        'failedCount', r.failed_count
      )
      from private.retention_runs r
      order by r.requested_at desc, r.id desc
      limit 1
    )
  );
end;
$_$;

ALTER FUNCTION "public"."get_admin_storage_summary"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_own_account_recovery"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='recovery_unauthenticated'; end if;
  return (select jsonb_build_object('requestId',d.id,'requestedAt',d.requested_at,'restoreUntil',d.restore_until,'canRestore',d.restore_until>statement_timestamp() and d.status='recoverable','username',p.username)
    from private.deletion_requests d join public.profiles p on p.id=d.target_profile_id where d.target_profile_id=v_actor and d.status='recoverable' order by d.requested_at desc limit 1);
end $$;

ALTER FUNCTION "public"."get_own_account_recovery"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_project_revision_history_v3"("p_project_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'revision_history_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'revision_history_actor_ineligible';
  end if;
  if not exists (
    select 1
    from public.projects p
    join public.project_members m on m.project_id = p.id
    where p.id = p_project_id and m.user_id = v_actor
  ) then
    raise sqlstate 'PT404' using message = 'revision_history_not_found';
  end if;

  return coalesce((
    select jsonb_agg(revision_document order by revision_number desc)
    from (
      select
        r.revision_number,
        jsonb_build_object(
          'id', r.id,
          'revisionNumber', r.revision_number,
          'message', r.message,
          'durationMs', r.duration_ms,
          'createdAt', r.created_at,
          'authorName', publisher.credit_name,
          'publisher', jsonb_build_object(
            'creditName', publisher.credit_name,
            'profileUsername', publisher_profile.username
          ),
          'acceptedContributor', case
            when contributor.credit_name is null then null
            else jsonb_build_object(
              'creditName', contributor.credit_name,
              'profileUsername', contributor_profile.username
            )
          end,
          'tracks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', track.track_id,
                'kind', 'midi',
                'instrumentName', track.preset_id,
                'name', track.name,
                'durationMs', r.duration_ms,
                'sortOrder', track.sort_order,
                'creditName', coalesce(
                  track_credits.credits->0->>'creditName',
                  publisher.credit_name
                ),
                'credits', case
                  when jsonb_array_length(track_credits.credits) > 0 then track_credits.credits
                  else jsonb_build_array(jsonb_build_object(
                    'creditName', publisher.credit_name,
                    'role', 'creator',
                    'position', 0,
                    'profileUsername', publisher_profile.username
                  ))
                end
              ) order by track.sort_order, track.track_id
            )
            from public.arrangement_tracks track
            cross join lateral (
              with recursive lineage as (
                select
                  version.id,
                  version.creator_id,
                  version.creator_credit_name,
                  version.parent_pattern_version_id,
                  version.source_pattern_version_id,
                  version.created_at,
                  0 as depth,
                  array[version.id] as path
                from public.arrangement_clips clip
                join public.midi_pattern_versions version
                  on version.id = clip.midi_pattern_version_id
                where clip.arrangement_version_id = track.arrangement_version_id
                  and clip.track_id = track.track_id

                union all

                select
                  ancestor.id,
                  ancestor.creator_id,
                  ancestor.creator_credit_name,
                  ancestor.parent_pattern_version_id,
                  ancestor.source_pattern_version_id,
                  ancestor.created_at,
                  lineage.depth + 1,
                  lineage.path || ancestor.id
                from lineage
                cross join lateral unnest(array[
                  lineage.parent_pattern_version_id,
                  lineage.source_pattern_version_id
                ]) ancestor_id
                join public.midi_pattern_versions ancestor on ancestor.id = ancestor_id
                where ancestor_id is not null
                  and not ancestor.id = any(lineage.path)
              ), distinct_credits as (
                select
                  creator_id,
                  creator_credit_name,
                  min(depth) as depth,
                  min(created_at) as created_at
                from lineage
                group by creator_id, creator_credit_name
              ), ordered_credits as (
                select
                  credit.creator_id,
                  credit.creator_credit_name,
                  credit.depth,
                  row_number() over (
                    order by credit.depth, credit.created_at, credit.creator_id
                  ) - 1 as position
                from distinct_credits credit
              )
              select coalesce(jsonb_agg(jsonb_build_object(
                'creditName', credit.creator_credit_name,
                'role', case when credit.depth = 0 then 'creator' else 'derivation' end,
                'position', credit.position,
                'profileUsername', profile.username
              ) order by credit.position), '[]'::jsonb) as credits
              from ordered_credits credit
              left join public.public_profiles profile on profile.id = credit.creator_id
            ) track_credits
            where track.arrangement_version_id = r.arrangement_version_id
          ), '[]'::jsonb)
        ) as revision_document
      from (
        select revision.*
        from public.project_revisions revision
        where revision.project_id = p_project_id
          and revision.manifest_version = 3
          and revision.arrangement_version_id is not null
        order by revision.revision_number desc
        limit 20
      ) r
      join public.revision_attributions publisher
        on publisher.revision_id = r.id and publisher.kind = 'publisher'
      left join public.public_profiles publisher_profile
        on publisher_profile.id = publisher.user_id
      left join public.revision_attributions contributor
        on contributor.revision_id = r.id and contributor.kind = 'accepted_contributor'
      left join public.public_profiles contributor_profile
        on contributor_profile.id = contributor.user_id
    ) revision_rows
  ), '[]'::jsonb);
end;
$$;

ALTER FUNCTION "public"."get_project_revision_history_v3"("p_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_admin_moderation_queue"("p_after_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform private.assert_admin_actor();
  if (p_after_created_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='admin_cursor_invalid'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (
    select r.id,r.target_kind,r.target_label_snapshot,r.reason,r.status,r.created_at,r.updated_at,
      r.assigned_admin_id is not null assigned
    from private.moderation_reports r where r.status in ('submitted','reviewing')
      and (p_after_created_at is null or (r.created_at,r.id)>(p_after_created_at,p_after_id))
    order by r.created_at,r.id limit 25) x),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_admin_moderation_queue"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_public_profile_contributions"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_accepted_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_revision_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if ((p_after_accepted_at is null) <> (p_after_revision_id is null)) then raise sqlstate 'PT400' using message='profile_cursor_invalid'; end if;
  if not exists(select 1 from public.discovery_state where singleton and version=p_discovery_version) then raise sqlstate 'PT409' using message='profile_cursor_stale'; end if;
  if not exists(select 1 from public.public_profiles where id=p_profile_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('projectId',x.project_id,'projectTitle',x.title,'revisionId',x.revision_id,'revisionNumber',x.revision_number,'creditName',x.credit_name,'acceptedAt',x.created_at)
    order by x.created_at desc,x.revision_id desc) from (
    select c.project_id,c.title,r.id revision_id,r.revision_number,ra.credit_name,ra.created_at
    from public.revision_attributions ra join public.project_revisions r on r.id=ra.revision_id
    join public.public_project_catalog c on c.project_id=r.project_id
    where ra.kind='accepted_contributor' and ra.user_id=p_profile_id
      and (p_after_accepted_at is null or (ra.created_at,r.id)<(p_after_accepted_at,p_after_revision_id))
    order by ra.created_at desc,r.id desc limit 13) x),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_public_profile_contributions"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_accepted_at" timestamp with time zone, "p_after_revision_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_public_profile_projects"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_published_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_project_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if ((p_after_published_at is null) <> (p_after_project_id is null)) then raise sqlstate 'PT400' using message='profile_cursor_invalid'; end if;
  if not exists(select 1 from public.discovery_state where singleton and version=p_discovery_version) then raise sqlstate 'PT409' using message='profile_cursor_stale'; end if;
  if not exists(select 1 from public.public_profiles where id=p_profile_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('projectId',c.project_id,'title',c.title,'publishedAt',c.published_at)
    order by c.published_at desc,c.project_id desc)
    from (select * from public.public_project_catalog where owner_id=p_profile_id
      and (p_after_published_at is null or (published_at,project_id)<(p_after_published_at,p_after_project_id))
      order by published_at desc,project_id desc limit 13) c),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_public_profile_projects"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_viewer_reports"("p_after_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='reports_unauthenticated'; end if;
  if (p_after_created_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='reports_cursor_invalid'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null)
    then raise sqlstate 'PT403' using message='reports_forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
    select r.id,r.target_kind,
      case r.target_kind
        when 'profile' then coalesce((select '@'||p.username from public.profiles p where p.id=r.target_profile_id and p.status='active' and p.moderation_state='visible'),'Unavailable profile')
        when 'project' then coalesce((select p.title from public.projects p where p.id=r.target_project_id and p.deleted_at is null and p.moderation_state='visible'),'Unavailable project')
        else coalesce((select c.title from public.contributions c where c.id=r.target_contribution_id and c.deleted_at is null and c.moderation_state='visible'),'Unavailable contribution') end target_label,
      case when r.status='submitted' then 'submitted' when r.status='reviewing' then 'reviewing' else 'closed' end status,
      r.created_at,r.resolved_at
    from private.moderation_reports r where r.reporter_id=v_actor
      and (p_after_created_at is null or (r.created_at,r.id)<(p_after_created_at,p_after_id))
    order by r.created_at desc,r.id desc limit 25) x),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_viewer_reports"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_claim_profile_avatar_cleanup"() RETURNS TABLE("avatar_version_id" "uuid", "source_asset_id" "uuid", "profile_id" "uuid", "public_object_path" "text", "private_object_path" "text", "lease_token" "uuid", "attempt_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_job private.profile_avatar_cleanup_jobs%rowtype; v_token uuid:=gen_random_uuid();
begin
  select * into v_job from private.profile_avatar_cleanup_jobs j
  where (j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp()) or (j.status='leased' and j.lease_expires_at<=statement_timestamp())
  order by j.next_attempt_at,j.avatar_version_id for update skip locked limit 1;
  if not found then return; end if;
  update private.profile_avatar_cleanup_jobs set status='leased',attempt_count=profile_avatar_cleanup_jobs.attempt_count+1,lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes',updated_at=statement_timestamp() where profile_avatar_cleanup_jobs.avatar_version_id=v_job.avatar_version_id;
  return query select v_job.avatar_version_id,v_job.source_asset_id,v_job.profile_id,v_job.public_object_path,v_job.private_object_path,v_token,v_job.attempt_count+1;
end $$;

ALTER FUNCTION "public"."operator_claim_profile_avatar_cleanup"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_claim_profile_image"("p_asset_id" "uuid" DEFAULT NULL::"uuid", "p_owner_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("asset_id" "uuid", "owner_id" "uuid", "avatar_version_id" "uuid", "bucket" "text", "object_path" "text", "reserved_byte_size" bigint, "declared_media_type" "text", "public_object_path" "text", "lease_token" "uuid", "attempt_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_job private.profile_image_processing_jobs%rowtype; v_token uuid:=gen_random_uuid();
begin
  select * into v_job from private.profile_image_processing_jobs j where (p_asset_id is null or j.asset_id=p_asset_id) and (p_owner_id is null or j.owner_id=p_owner_id)
    and (j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp() or (j.status='leased' and j.lease_expires_at<=statement_timestamp()))
    order by j.next_attempt_at,j.asset_id for update skip locked limit 1;
  if not found then return; end if;
  update private.profile_image_processing_jobs set status='leased',attempt_count=profile_image_processing_jobs.attempt_count+1,lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes',updated_at=statement_timestamp() where profile_image_processing_jobs.asset_id=v_job.asset_id;
  return query select a.id,a.owner_id,v_job.avatar_version_id,a.bucket,a.object_path,a.reserved_byte_size,a.declared_media_type,v.public_object_path,v_token,v_job.attempt_count+1
    from public.assets a join public.profile_avatar_versions v on v.id=v_job.avatar_version_id where a.id=v_job.asset_id;
end $$;

ALTER FUNCTION "public"."operator_claim_profile_image"("p_asset_id" "uuid", "p_owner_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_claim_retention_job"("p_run_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_job private.retention_cleanup_jobs%rowtype; v_token uuid;
begin
  loop
    v_job:=null; v_token:=gen_random_uuid();
    select * into v_job from private.retention_cleanup_jobs j
    where j.run_id=p_run_id and ((j.status in ('pending','retry')
      and j.next_attempt_at<=statement_timestamp())
      or (j.status='leased' and j.lease_expires_at<=statement_timestamp()))
    order by j.next_attempt_at,j.id for update skip locked limit 1;
    if not found then return null; end if;
    if v_job.delete_authorized_at is null then
      if v_job.subject_kind='avatar' and private.avatar_retention_blocked(v_job.subject_id) then
        update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_before_delete',
          lease_token=null,lease_expires_at=null where id=v_job.id;
        update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
        continue;
      elsif v_job.subject_kind='deletion' and exists(
        select 1 from private.deletion_requests d join private.content_holds h
          on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
          and ((d.target_profile_id is not null and h.target_profile_id=d.target_profile_id)
            or (d.target_project_id is not null and h.target_project_id=d.target_project_id)
            or (d.target_contribution_id is not null and h.target_contribution_id=d.target_contribution_id))
        where d.id=v_job.subject_id) then
        update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_before_delete',
          lease_token=null,lease_expires_at=null where id=v_job.id;
        update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
        continue;
      elsif v_job.subject_kind='metadata' and exists(
        select 1 from private.moderation_reports r join private.content_holds h
          on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
          and ((r.target_profile_id is not null and h.target_profile_id=r.target_profile_id)
            or (r.target_project_id is not null and h.target_project_id=r.target_project_id)
            or (r.target_contribution_id is not null and h.target_contribution_id=r.target_contribution_id))
        where r.id=v_job.subject_id) then
        update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_before_delete',
          lease_token=null,lease_expires_at=null where id=v_job.id;
        update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
        continue;
      end if;
    end if;
    update private.retention_cleanup_jobs set status='leased',attempt_count=attempt_count+1,
      lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes',
      delete_authorized_at=coalesce(delete_authorized_at,statement_timestamp()) where id=v_job.id;
    return jsonb_build_object('jobId',v_job.id,'rule',v_job.rule_code,
      'subjectKind',v_job.subject_kind,'subjectId',v_job.subject_id,'leaseToken',v_token,
      'attempt',v_job.attempt_count+1,'objects',coalesce((select jsonb_agg(jsonb_build_object(
        'id',o.id,'bucket',o.bucket,'path',o.object_path) order by o.id)
        from private.retention_cleanup_objects o where o.job_id=v_job.id),'[]'::jsonb));
  end loop;
end $$;

ALTER FUNCTION "public"."operator_claim_retention_job"("p_run_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_complete_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_asset uuid;
begin
  select source_asset_id into v_asset from private.profile_avatar_cleanup_jobs
    where avatar_version_id=p_avatar_version_id and status='leased' and lease_token=p_lease_token
      and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_cleanup_lease_invalid'; end if;
  if exists(select 1 from public.profiles where avatar_version_id=p_avatar_version_id) then
    raise sqlstate 'PT409' using message='avatar_cleanup_current'; end if;
  update public.profile_avatar_versions set status='cleaned',cleaned_at=statement_timestamp()
    where id=p_avatar_version_id;
  update public.assets set status='deleted',deleted_at=statement_timestamp() where id=v_asset;
  update private.profile_avatar_cleanup_jobs set status='complete',lease_token=null,
    lease_expires_at=null,updated_at=statement_timestamp() where avatar_version_id=p_avatar_version_id;
end $$;

ALTER FUNCTION "public"."operator_complete_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_complete_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_media_type" "text", "p_byte_size" bigint, "p_sha256" "text", "p_width" integer, "p_height" integer, "p_frame_count" smallint, "p_output_byte_size" integer, "p_output_sha256" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_job private.profile_image_processing_jobs%rowtype; v_old public.profile_avatar_versions%rowtype; v_path text;
begin
  select * into v_job from private.profile_image_processing_jobs where asset_id=p_asset_id for update;
  if not found or v_job.status<>'leased' or v_job.lease_token<>p_lease_token or v_job.lease_expires_at<=statement_timestamp() then raise sqlstate 'PT409' using message='avatar_lease_invalid'; end if;
  if p_media_type not in ('image/jpeg','image/png','image/webp') or p_byte_size not between 1 and 5242880 or p_sha256 !~ '^[0-9a-f]{64}$' or p_width not between 128 and 4096 or p_height not between 128 and 4096 or p_width::bigint*p_height::bigint>16777216 or p_frame_count<>1 or p_output_byte_size not between 1 and 524288 or p_output_sha256 !~ '^[0-9a-f]{64}$' then raise sqlstate 'PT400' using message='avatar_output_invalid'; end if;
  select * into v_old from public.profile_avatar_versions where profile_id=v_job.owner_id and status='current' for update;
  update public.assets set status='ready',media_type=p_media_type,byte_size=p_byte_size,sha256=p_sha256,image_width=p_width,image_height=p_height,frame_count=p_frame_count,verification_version='profile-image-v1',ready_at=statement_timestamp() where id=p_asset_id;
  if v_old.id is not null then
    update public.profile_avatar_versions set status='superseded',superseded_at=statement_timestamp() where id=v_old.id;
  end if;
  update public.profile_avatar_versions set status='current',media_type='image/webp',byte_size=p_output_byte_size,sha256=p_output_sha256,width=512,height=512,installed_at=statement_timestamp() where id=v_job.avatar_version_id returning public_object_path into v_path;
  update public.profiles set avatar_version_id=v_job.avatar_version_id,avatar_path=v_path,avatar_updated_at=statement_timestamp() where id=v_job.owner_id;
  if v_old.id is not null then
    insert into private.profile_avatar_cleanup_jobs(avatar_version_id,source_asset_id,profile_id,public_object_path,private_object_path)
      values(v_old.id,v_old.source_asset_id,v_old.profile_id,v_old.public_object_path,(select object_path from public.assets where id=v_old.source_asset_id)) on conflict do nothing;
  end if;
  update private.profile_image_processing_jobs set status='complete',lease_token=null,lease_expires_at=null,updated_at=statement_timestamp() where asset_id=p_asset_id;
  perform private.bump_discovery_version();
  return v_path;
end $_$;

ALTER FUNCTION "public"."operator_complete_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_media_type" "text", "p_byte_size" bigint, "p_sha256" "text", "p_width" integer, "p_height" integer, "p_frame_count" smallint, "p_output_byte_size" integer, "p_output_sha256" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_complete_retention_run"("p_run_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin
  update private.retention_runs set status=case when exists(select 1 from private.retention_cleanup_jobs where run_id=p_run_id and status='dead') then 'failed' else 'complete' end,completed_at=statement_timestamp() where id=p_run_id and not exists(select 1 from private.retention_cleanup_jobs where run_id=p_run_id and status in ('pending','retry','leased'));
  return (select jsonb_build_object('runId',id,'status',status,'candidateCount',candidate_count,'completedCount',completed_count,'blockedCount',blocked_count,'failedCount',failed_count) from private.retention_runs where id=p_run_id);
end $$;

ALTER FUNCTION "public"."operator_complete_retention_run"("p_run_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_count_due_profile_avatar_cleanup"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select count(*) from private.profile_avatar_cleanup_jobs
  where (status in ('pending','retry') and next_attempt_at<=statement_timestamp()) or (status='leased' and lease_expires_at<=statement_timestamp())
$$;

ALTER FUNCTION "public"."operator_count_due_profile_avatar_cleanup"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_finalize_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_deleted_object_ids" "uuid"[], "p_missing_object_ids" "uuid"[]) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_job private.retention_cleanup_jobs%rowtype; v_version public.profile_avatar_versions%rowtype;
begin
  select * into v_job from private.retention_cleanup_jobs where id=p_job_id for update;
  if not found then raise sqlstate 'PT404' using message='retention_job_not_found'; end if;
  if v_job.status='complete' then return 'complete'; end if;
  if v_job.status<>'leased' or v_job.lease_token<>p_lease_token
    or v_job.lease_expires_at<=statement_timestamp() or v_job.delete_authorized_at is null then
    raise sqlstate 'PT409' using message='retention_lease_invalid'; end if;
  if exists(select 1 from private.retention_cleanup_objects where job_id=v_job.id and deleted_at is null
    and id<>all(coalesce(p_deleted_object_ids,'{}')) and id<>all(coalesce(p_missing_object_ids,'{}'))) then
    raise sqlstate 'PT409' using message='retention_objects_incomplete'; end if;
  if v_job.subject_kind='avatar' then
    select * into v_version from public.profile_avatar_versions where id=v_job.subject_id for update;
    if not found or private.avatar_retention_blocked(v_job.subject_id) then
      raise sqlstate 'PT500' using message='retention_authorization_invariant'; end if;
    update public.profile_avatar_versions set status='cleaned',
      cleaned_at=coalesce(cleaned_at,statement_timestamp()) where id=v_version.id;
    update public.assets set status='deleted',failure_code=null,failed_at=null,
      deleted_at=coalesce(deleted_at,statement_timestamp())
      where id=v_version.source_asset_id and status<>'deleted';
    update private.profile_avatar_cleanup_jobs set status='complete',lease_token=null,
      lease_expires_at=null,updated_at=statement_timestamp() where avatar_version_id=v_version.id;
  elsif v_job.subject_kind='deletion' then
    if exists(select 1 from private.deletion_requests d join private.content_holds h
      on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
      and ((d.target_profile_id is not null and h.target_profile_id=d.target_profile_id)
        or (d.target_project_id is not null and h.target_project_id=d.target_project_id)
        or (d.target_contribution_id is not null and h.target_contribution_id=d.target_contribution_id))
      where d.id=v_job.subject_id) then
      raise sqlstate 'PT500' using message='retention_authorization_invariant'; end if;
    update private.deletion_requests set status='purged',purged_at=statement_timestamp()
      where id=v_job.subject_id and status='recoverable' and restore_until<=statement_timestamp();
    update public.profiles set purged_at=statement_timestamp(),bio=null,display_name='Deleted musician'
      where id=(select target_profile_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.projects set purged_at=statement_timestamp(),description=null
      where id=(select target_project_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.contributions set purged_at=statement_timestamp(),description=null
      where id=(select target_contribution_id from private.deletion_requests where id=v_job.subject_id)
        and deleted_at is not null;
  elsif v_job.subject_kind='metadata' then
    update private.moderation_reports set detail=null,target_label_snapshot='Unavailable target',
      updated_at=statement_timestamp() where id=v_job.subject_id
      and resolved_at<=statement_timestamp()-interval '180 days';
  else raise sqlstate 'PT500' using message='retention_subject_invalid';
  end if;
  update private.retention_cleanup_objects set deleted_at=statement_timestamp(),
    already_missing=(id=any(coalesce(p_missing_object_ids,'{}')))
    where job_id=v_job.id and id=any(coalesce(p_deleted_object_ids,'{}')||coalesce(p_missing_object_ids,'{}'));
  update private.retention_cleanup_jobs set status='complete',completed_at=statement_timestamp(),
    lease_token=null,lease_expires_at=null where id=v_job.id;
  update private.retention_runs set completed_count=completed_count+1 where id=v_job.run_id;
  return 'complete';
end $$;

ALTER FUNCTION "public"."operator_finalize_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_deleted_object_ids" "uuid"[], "p_missing_object_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_retention_preview"("p_limit" integer DEFAULT 500) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_limit not between 1 and 500 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  return jsonb_build_object('policyVersion','retention-v2','limit',p_limit,'groups',jsonb_build_array(
    jsonb_build_object('rule','avatar_superseded','count',(select count(*) from private.profile_avatar_cleanup_jobs
      where status in ('pending','retry') and next_attempt_at<=statement_timestamp()),'bytes',
      (select coalesce(sum(coalesce(v.byte_size,0)+a.reserved_byte_size),0)
        from private.profile_avatar_cleanup_jobs j join public.profile_avatar_versions v on v.id=j.avatar_version_id
        join public.assets a on a.id=j.source_asset_id where j.status in ('pending','retry')
          and j.next_attempt_at<=statement_timestamp())),
    jsonb_build_object('rule','deletion_expired_30d','count',(select count(*) from private.deletion_requests
      where status='recoverable' and restore_until<=statement_timestamp()),'bytes',0),
    jsonb_build_object('rule','moderation_metadata_180d','count',(select count(*) from private.moderation_reports
      where status in ('resolved','dismissed') and resolved_at<=statement_timestamp()-interval '180 days'
        and detail is not null),'bytes',0)));
end $$;

ALTER FUNCTION "public"."operator_retention_preview"("p_limit" integer) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."operator_retention_preview"("p_limit" integer) IS 'Read-only bounded retention preview; returns grouped counts and byte estimates without object paths.';

CREATE OR REPLACE FUNCTION "public"."operator_retry_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_attempt integer;
begin
  select attempt_count into v_attempt from private.profile_avatar_cleanup_jobs where avatar_version_id=p_avatar_version_id and status='leased' and lease_token=p_lease_token and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_cleanup_lease_invalid'; end if;
  update private.profile_avatar_cleanup_jobs set status=case when v_attempt>=8 then 'dead' else 'retry' end,next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,power(2,v_attempt)::integer*10)),lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80),updated_at=statement_timestamp() where avatar_version_id=p_avatar_version_id;
  return case when v_attempt>=8 then 'dead' else 'retry' end;
end $$;

ALTER FUNCTION "public"."operator_retry_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_retry_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_attempt integer;
begin
  select attempt_count into v_attempt from private.profile_image_processing_jobs where asset_id=p_asset_id and status='leased' and lease_token=p_lease_token and lease_expires_at>statement_timestamp() for update;
  if not found then raise sqlstate 'PT409' using message='avatar_lease_invalid'; end if;
  update private.profile_image_processing_jobs set status=case when v_attempt>=5 then 'dead' else 'retry' end,next_attempt_at=statement_timestamp()+make_interval(secs=>least(300,power(2,v_attempt)::integer*5)),lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80),updated_at=statement_timestamp() where asset_id=p_asset_id;
  if v_attempt>=5 then update public.profile_avatar_versions set status='failed' where source_asset_id=p_asset_id and status='processing'; update public.assets set status='failed',failure_code=left(p_error_code,80),failed_at=statement_timestamp() where id=p_asset_id; end if;
  return case when v_attempt>=5 then 'dead' else 'retry' end;
end $$;

ALTER FUNCTION "public"."operator_retry_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_retry_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."operator_retry_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."operator_start_retention_run"("p_limit" integer DEFAULT 100) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_run uuid:=gen_random_uuid();
begin
  if p_limit not between 1 and 100 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  insert into private.retention_runs(id,mode) values(v_run,'execute');
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,
    eligible_at,byte_estimate)
  select v_run,'retention-v2','avatar_superseded','avatar',j.avatar_version_id,j.next_attempt_at,
    coalesce(v.byte_size,0)+a.reserved_byte_size from private.profile_avatar_cleanup_jobs j
    join public.profile_avatar_versions v on v.id=j.avatar_version_id join public.assets a on a.id=j.source_asset_id
    where j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp()
    order by j.next_attempt_at,j.avatar_version_id limit p_limit on conflict do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
  select v_run,'retention-v2','deletion_expired_30d','deletion',d.id,d.restore_until
    from private.deletion_requests d where d.status='recoverable' and d.restore_until<=statement_timestamp()
    order by d.restore_until,d.id limit p_limit on conflict do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
  select v_run,'retention-v2','moderation_metadata_180d','metadata',r.id,r.resolved_at+interval '180 days'
    from private.moderation_reports r where r.status in ('resolved','dismissed')
      and r.resolved_at<=statement_timestamp()-interval '180 days' and r.detail is not null
    order by r.resolved_at,r.id limit p_limit on conflict do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,'public-avatars',v.public_object_path from private.retention_cleanup_jobs j
      join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id
      where j.run_id=v_run
    union all
    select j.id,a.bucket,a.object_path from private.retention_cleanup_jobs j
      join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id
      join public.assets a on a.id=v.source_asset_id where j.run_id=v_run on conflict do nothing;
  update private.retention_runs set candidate_count=(select count(*) from private.retention_cleanup_jobs
    where run_id=v_run) where id=v_run;
  return v_run;
end $$;

ALTER FUNCTION "public"."operator_start_retention_run"("p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."place_content_hold"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_hold_type" "text", "p_reason" "text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."place_content_hold"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_hold_type" "text", "p_reason" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."release_content_hold"("p_hold_id" "uuid", "p_request_id" "uuid", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."release_content_hold"("p_hold_id" "uuid", "p_request_id" "uuid", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_own_avatar"("p_expected_avatar_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_old public.profile_avatar_versions%rowtype;
begin
  select v.* into v_old from public.profiles p join public.profile_avatar_versions v on v.id=p.avatar_version_id where p.id=v_actor and p.avatar_version_id=p_expected_avatar_version_id for update of p,v;
  if not found then raise sqlstate 'PT409' using message='avatar_stale'; end if;
  update public.profiles set avatar_version_id=null,avatar_path=null,avatar_updated_at=statement_timestamp() where id=v_actor;
  update public.profile_avatar_versions set status='removed',superseded_at=statement_timestamp() where id=v_old.id;
  insert into private.profile_avatar_cleanup_jobs(avatar_version_id,source_asset_id,profile_id,public_object_path,private_object_path)
    values(v_old.id,v_old.source_asset_id,v_old.profile_id,v_old.public_object_path,(select object_path from public.assets where id=v_old.source_asset_id)) on conflict do nothing;
  perform private.bump_discovery_version();
end $$;

ALTER FUNCTION "public"."remove_own_avatar"("p_expected_avatar_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."request_account_deletion"("p_request_id" "uuid", "p_username" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_profile public.profiles%rowtype; v_parent private.deletion_requests%rowtype; v_project public.projects%rowtype; v_child private.deletion_requests%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='account_delete_unauthenticated'; end if;
  select * into v_profile from public.profiles where id=v_actor and status='active' and profile_completed_at is not null for update;
  if not found or v_profile.username<>p_username then raise sqlstate 'PT403' using message='account_delete_confirmation_invalid'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_profile_id,prior_status,prior_visibility,requested_at,restore_until)
  values(v_actor,p_request_id,'profile',v_actor,v_profile.status::text,v_profile.moderation_state,statement_timestamp(),statement_timestamp()+interval '30 days') returning * into v_parent;
  for v_project in select * from public.projects where owner_id=v_actor and status<>'deleted' and moderation_state='visible' for update loop
    insert into private.deletion_requests(requester_id,request_id,target_kind,target_project_id,parent_request_id,expected_lock_version,prior_status,prior_visibility,prior_open_to_contributions,provenance,requested_at,restore_until)
    values(v_actor,gen_random_uuid(),'project',v_project.id,v_parent.id,v_project.lock_version,v_project.status::text,v_project.visibility::text,v_project.open_to_contributions,'account_cascade',v_parent.requested_at,v_parent.restore_until) returning * into v_child;
    insert into private.deletion_request_workspaces(deletion_request_id,workspace_id,prior_status) select v_child.id,w.id,w.status from public.workspaces w where w.project_id=v_project.id and w.status='active';
    update public.workspaces set status='archived',updated_at=statement_timestamp() where project_id=v_project.id and status='active';
    update public.projects set visibility='private',status='deleted',open_to_contributions=false,deleted_at=statement_timestamp(),lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_project.id;
    perform private.refresh_moderated_project(v_project.id);
  end loop;
  update public.workspaces set status='archived',updated_at=statement_timestamp() where owner_id=v_actor and status='active';
  if v_profile.avatar_version_id is not null then perform public.remove_own_avatar(v_profile.avatar_version_id); end if;
  update public.profiles set status='deleted',deletion_requested_at=v_parent.requested_at,deletion_restore_until=v_parent.restore_until where id=v_actor;
  delete from public.public_project_catalog where owner_id=v_actor;
  return jsonb_build_object('requestId',v_parent.id,'restoreUntil',v_parent.restore_until);
end $$;

ALTER FUNCTION "public"."request_account_deletion"("p_request_id" "uuid", "p_username" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reserve_profile_image_upload"("p_request_id" "uuid", "p_expected_byte_size" integer, "p_filename" "text", "p_declared_media_type" "text") RETURNS TABLE("asset_id" "uuid", "avatar_version_id" "uuid", "bucket" "text", "object_path" "text", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_asset uuid:=gen_random_uuid();
  v_version uuid:=gen_random_uuid(); v_expiry timestamptz:=statement_timestamp()+interval '30 minutes';
  v_existing record;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='avatar_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active'
    and profile_completed_at is not null) then raise sqlstate 'PT403' using message='avatar_forbidden'; end if;
  if p_expected_byte_size not between 1 and 5242880
    or p_declared_media_type not in ('image/jpeg','image/png','image/webp')
    or p_filename is null or p_filename<>btrim(p_filename)
    or char_length(p_filename) not between 1 and 255 then
    raise sqlstate 'PT400' using message='avatar_invalid'; end if;
  select a.id,u.avatar_version_id,a.bucket,a.object_path,u.expires_at into v_existing
    from private.profile_image_uploads u join public.assets a on a.id=u.asset_id
    where u.owner_id=v_actor and u.request_id=p_request_id;
  if found then
    if (select reserved_byte_size from public.assets where id=v_existing.id)<>p_expected_byte_size then
      raise sqlstate 'PT409' using message='avatar_request_conflict'; end if;
    return query select v_existing.id,v_existing.avatar_version_id,v_existing.bucket,
      v_existing.object_path,v_existing.expires_at; return;
  end if;
  if exists(select 1 from private.profile_image_uploads u where u.owner_id=v_actor
    and u.expires_at>statement_timestamp() and u.upload_completed_at is null) then
    raise sqlstate 'PT429' using message='avatar_upload_in_progress'; end if;
  insert into public.assets(id,owner_id,status,bucket,object_path,original_filename,
    declared_media_type,reserved_byte_size)
  values(v_asset,v_actor,'reserved','profile-images',v_actor::text||'/'||v_asset::text||'/original',
    p_filename,p_declared_media_type,p_expected_byte_size);
  insert into public.profile_avatar_versions(id,profile_id,source_asset_id,public_object_path)
    values(v_version,v_actor,v_asset,v_actor::text||'/'||v_version::text||'/avatar.webp');
  insert into private.profile_image_uploads(asset_id,avatar_version_id,owner_id,request_id,
    expected_byte_size,declared_media_type,expires_at)
  values(v_asset,v_version,v_actor,p_request_id,p_expected_byte_size,p_declared_media_type,v_expiry);
  return query select v_asset,v_version,'profile-images'::text,
    v_actor::text||'/'||v_asset::text||'/original',v_expiry;
end $$;

ALTER FUNCTION "public"."reserve_profile_image_upload"("p_request_id" "uuid", "p_expected_byte_size" integer, "p_filename" "text", "p_declared_media_type" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_own_account"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_parent private.deletion_requests%rowtype; v_child private.deletion_requests%rowtype; begin
  select * into v_parent from private.deletion_requests where target_profile_id=v_actor and status='recoverable' for update;
  if not found or v_parent.restore_until<=statement_timestamp() then raise sqlstate 'PT404' using message='recovery_unavailable'; end if;
  if exists(select 1 from private.content_holds where target_profile_id=v_actor and released_at is null and (expires_at is null or expires_at>statement_timestamp())) then raise sqlstate 'PT409' using message='recovery_held'; end if;
  update public.profiles set status='active',deletion_requested_at=null,deletion_restore_until=null where id=v_actor and moderation_state='visible';
  if not found then raise sqlstate 'PT409' using message='recovery_moderated'; end if;
  for v_child in select * from private.deletion_requests where parent_request_id=v_parent.id and status='recoverable' for update loop
    if v_child.target_project_id is not null and exists(select 1 from public.projects where id=v_child.target_project_id and status='deleted' and moderation_state='visible') then
      update public.projects set status=v_child.prior_status::public.project_status,visibility=coalesce(v_child.prior_visibility,'private')::public.project_visibility,
        open_to_contributions=coalesce(v_child.prior_open_to_contributions,false),deleted_at=null,lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_child.target_project_id;
      update public.workspaces w set status='active',updated_at=statement_timestamp() from private.deletion_request_workspaces dw where dw.deletion_request_id=v_child.id and dw.workspace_id=w.id and w.status='archived';
      update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_child.id;
      perform private.refresh_moderated_project(v_child.target_project_id);
    end if;
  end loop;
  update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_parent.id;
  return jsonb_build_object('status','restored');
end $$;

ALTER FUNCTION "public"."restore_own_account"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_own_contribution"("p_contribution_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_request private.deletion_requests%rowtype; begin
  select * into v_request from private.deletion_requests where requester_id=v_actor and target_contribution_id=p_contribution_id and status='recoverable' for update;
  if not found or v_request.restore_until<=statement_timestamp() then raise sqlstate 'PT404' using message='contribution_restore_not_found'; end if;
  if not exists(select 1 from public.contributions c join public.projects p on p.id=c.project_id where c.id=p_contribution_id and p.deleted_at is null and p.moderation_state='visible') then raise sqlstate 'PT409' using message='contribution_restore_unavailable'; end if;
  update public.contributions set deleted_at=null,moderation_state='visible',moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=p_contribution_id;
  update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_request.id;
  return jsonb_build_object('contributionId',p_contribution_id,'status','restored');
end $$;

ALTER FUNCTION "public"."restore_own_contribution"("p_contribution_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_project"("p_project_id" "uuid", "p_request_id" "uuid") RETURNS TABLE("project_id" "uuid", "status" "text", "lock_version" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_request private.deletion_requests%rowtype; v_project public.projects%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_restore_unauthenticated'; end if;
  if p_request_id is null then raise sqlstate '22023' using message='project_restore_invalid'; end if;
  select * into v_request from private.deletion_requests d where d.target_project_id=p_project_id and d.requester_id=v_actor and d.status='recoverable' for update;
  if not found then raise sqlstate 'PT404' using message='project_restore_not_found'; end if;
  if v_request.restore_until<=statement_timestamp() or exists(select 1 from private.content_holds where target_project_id=p_project_id and released_at is null and (expires_at is null or expires_at>statement_timestamp())) then raise sqlstate 'PT409' using message='project_restore_unavailable'; end if;
  select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.status='deleted' and p.moderation_state='visible' for update;
  if not found then raise sqlstate 'PT409' using message='project_restore_unavailable'; end if;
  update public.projects p set status=v_request.prior_status::public.project_status,visibility=coalesce(v_request.prior_visibility,'private')::public.project_visibility,
    open_to_contributions=coalesce(v_request.prior_open_to_contributions,false),deleted_at=null,lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id returning p.* into v_project;
  update public.workspaces w set status='active',updated_at=statement_timestamp() from private.deletion_request_workspaces dw
    where dw.deletion_request_id=v_request.id and dw.workspace_id=w.id and dw.prior_status='active' and w.status='archived';
  update private.deletion_requests d set status='restored',restored_at=statement_timestamp() where d.id=v_request.id;
  perform private.refresh_moderated_project(p_project_id);
  return query select v_project.id,v_project.status::text,v_project.lock_version;
end $$;

ALTER FUNCTION "public"."restore_project"("p_project_id" "uuid", "p_request_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_moderation_report"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_reason" "text", "p_detail" "text" DEFAULT NULL::"text") RETURNS TABLE("report_id" "uuid", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_existing private.moderation_reports%rowtype;
  v_label text; v_profile uuid; v_project uuid; v_contribution uuid;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='report_unauthenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null)
    then raise sqlstate 'PT403' using message='report_actor_ineligible'; end if;
  if p_request_id is null or p_target_id is null or p_target_kind not in ('profile','project','contribution')
    or p_reason not in ('copyright','harassment','sexual_content','hate_or_violence','spam','other')
    or (p_detail is not null and (btrim(p_detail)='' or char_length(btrim(p_detail))>2000))
    then raise sqlstate '22023' using message='report_invalid'; end if;
  select * into v_existing from private.moderation_reports where reporter_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.target_kind<>p_target_kind
      or coalesce(v_existing.target_profile_id,v_existing.target_project_id,v_existing.target_contribution_id)<>p_target_id
      or v_existing.reason<>p_reason or v_existing.detail is distinct from nullif(btrim(p_detail),'')
      then raise sqlstate 'PT409' using message='report_request_conflict'; end if;
    return query select v_existing.id,v_existing.status,v_existing.created_at; return;
  end if;
  if (select count(*) from private.moderation_reports mr where mr.reporter_id=v_actor and mr.created_at>statement_timestamp()-interval '24 hours')>=10
    then raise sqlstate 'PT429' using message='report_rate_limited'; end if;
  if p_target_kind='profile' then
    select p.id,coalesce('@'||p.username,'Profile') into v_profile,v_label from public.profiles p
      where p.id=p_target_id and p.id<>v_actor and p.status='active' and p.profile_completed_at is not null and p.moderation_state='visible';
  elsif p_target_kind='project' then
    select p.id,left(p.title,160) into v_project,v_label from public.projects p
      where p.id=p_target_id and p.owner_id<>v_actor and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
        and (exists(select 1 from public.public_project_catalog c where c.project_id=p.id)
          or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=v_actor));
  else
    select c.id,left(c.title,160) into v_contribution,v_label from public.contributions c
      join public.projects p on p.id=c.project_id
      where c.id=p_target_id and c.author_id<>v_actor and c.deleted_at is null and c.moderation_state='visible'
        and p.deleted_at is null and p.moderation_state='visible'
        and (c.author_id=v_actor or p.owner_id=v_actor);
  end if;
  if v_label is null then raise sqlstate 'PT404' using message='report_target_not_found'; end if;
  begin
    insert into private.moderation_reports(reporter_id,request_id,target_kind,target_profile_id,target_project_id,target_contribution_id,target_label_snapshot,reason,detail)
    values(v_actor,p_request_id,p_target_kind,v_profile,v_project,v_contribution,v_label,p_reason,nullif(btrim(p_detail),''))
    returning id,moderation_reports.status,moderation_reports.created_at into report_id,status,created_at;
  exception when unique_violation then
    raise sqlstate 'PT409' using message='report_already_open';
  end;
  return next;
end $$;

ALTER FUNCTION "public"."submit_moderation_report"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_reason" "text", "p_detail" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."content_holds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_profile_id" "uuid",
    "target_project_id" "uuid",
    "target_contribution_id" "uuid",
    "target_asset_id" "uuid",
    "hold_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "placed_by" "uuid" NOT NULL,
    "placed_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "expires_at" timestamp with time zone,
    "released_by" "uuid",
    "released_at" timestamp with time zone,
    CONSTRAINT "content_holds_hold_type_check" CHECK (("hold_type" = ANY (ARRAY['legal'::"text", 'abuse'::"text"]))),
    CONSTRAINT "content_holds_one_target" CHECK ((("num_nonnulls"("target_profile_id", "target_project_id", "target_contribution_id", "target_asset_id") = 1) AND (("target_kind" = 'profile'::"text") = ("target_profile_id" IS NOT NULL)) AND (("target_kind" = 'project'::"text") = ("target_project_id" IS NOT NULL)) AND (("target_kind" = 'contribution'::"text") = ("target_contribution_id" IS NOT NULL)) AND (("target_kind" = 'asset'::"text") = ("target_asset_id" IS NOT NULL)))),
    CONSTRAINT "content_holds_reason_check" CHECK ((("reason" = "btrim"("reason")) AND (("char_length"("reason") >= 1) AND ("char_length"("reason") <= 500)))),
    CONSTRAINT "content_holds_release_shape" CHECK ((("released_at" IS NULL) = ("released_by" IS NULL))),
    CONSTRAINT "content_holds_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['profile'::"text", 'project'::"text", 'contribution'::"text", 'asset'::"text"])))
);

ALTER TABLE "private"."content_holds" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."deletion_request_workspaces" (
    "deletion_request_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "prior_status" "text" NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "deletion_request_workspaces_prior_status_check" CHECK (("prior_status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);

ALTER TABLE "private"."deletion_request_workspaces" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_profile_id" "uuid",
    "target_project_id" "uuid",
    "target_contribution_id" "uuid",
    "parent_request_id" "uuid",
    "expected_lock_version" integer,
    "prior_status" "text" NOT NULL,
    "prior_visibility" "text",
    "prior_open_to_contributions" boolean,
    "provenance" "text" DEFAULT 'user'::"text" NOT NULL,
    "status" "text" DEFAULT 'recoverable'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "restore_until" timestamp with time zone NOT NULL,
    "restored_at" timestamp with time zone,
    "purged_at" timestamp with time zone,
    CONSTRAINT "deletion_requests_one_target" CHECK ((("num_nonnulls"("target_profile_id", "target_project_id", "target_contribution_id") = 1) AND (("target_kind" = 'profile'::"text") = ("target_profile_id" IS NOT NULL)) AND (("target_kind" = 'project'::"text") = ("target_project_id" IS NOT NULL)) AND (("target_kind" = 'contribution'::"text") = ("target_contribution_id" IS NOT NULL)))),
    CONSTRAINT "deletion_requests_provenance_check" CHECK (("provenance" = ANY (ARRAY['user'::"text", 'account_cascade'::"text", 'legacy'::"text"]))),
    CONSTRAINT "deletion_requests_result" CHECK (((("status" = 'recoverable'::"text") AND ("restored_at" IS NULL) AND ("purged_at" IS NULL)) OR (("status" = 'restored'::"text") AND ("restored_at" IS NOT NULL) AND ("purged_at" IS NULL)) OR (("status" = 'purged'::"text") AND ("restored_at" IS NULL) AND ("purged_at" IS NOT NULL)))),
    CONSTRAINT "deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['recoverable'::"text", 'restored'::"text", 'purged'::"text"]))),
    CONSTRAINT "deletion_requests_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['profile'::"text", 'project'::"text", 'contribution'::"text"]))),
    CONSTRAINT "deletion_requests_times" CHECK (("restore_until" = ("requested_at" + '30 days'::interval)))
);

ALTER TABLE "private"."deletion_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "action" "text" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "prior_state" "text",
    "resulting_state" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['assign_self'::"text", 'dismiss'::"text", 'resolve'::"text", 'hide'::"text", 'restore'::"text", 'suspend_account'::"text", 'restore_account'::"text", 'reject_upload'::"text", 'place_hold'::"text", 'release_hold'::"text"]))),
    CONSTRAINT "moderation_actions_reason_check" CHECK ((("reason" = "btrim"("reason")) AND (("char_length"("reason") >= 1) AND ("char_length"("reason") <= 500)))),
    CONSTRAINT "moderation_actions_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['report'::"text", 'profile'::"text", 'project'::"text", 'contribution'::"text", 'asset'::"text"])))
);

ALTER TABLE "private"."moderation_actions" OWNER TO "postgres";

COMMENT ON TABLE "private"."moderation_actions" IS 'Append-only administrator action audit without public report or actor exposure.';

CREATE TABLE IF NOT EXISTS "private"."moderation_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "target_kind" "text" NOT NULL,
    "target_profile_id" "uuid",
    "target_project_id" "uuid",
    "target_contribution_id" "uuid",
    "target_label_snapshot" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "detail" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "assigned_admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "moderation_reports_detail_check" CHECK ((("detail" IS NULL) OR (("detail" = "btrim"("detail")) AND (("char_length"("detail") >= 1) AND ("char_length"("detail") <= 2000))))),
    CONSTRAINT "moderation_reports_one_target" CHECK ((("num_nonnulls"("target_profile_id", "target_project_id", "target_contribution_id") = 1) AND (("target_kind" = 'profile'::"text") = ("target_profile_id" IS NOT NULL)) AND (("target_kind" = 'project'::"text") = ("target_project_id" IS NOT NULL)) AND (("target_kind" = 'contribution'::"text") = ("target_contribution_id" IS NOT NULL)))),
    CONSTRAINT "moderation_reports_reason_check" CHECK (("reason" = ANY (ARRAY['copyright'::"text", 'harassment'::"text", 'sexual_content'::"text", 'hate_or_violence'::"text", 'spam'::"text", 'other'::"text"]))),
    CONSTRAINT "moderation_reports_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "moderation_reports_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['profile'::"text", 'project'::"text", 'contribution'::"text"]))),
    CONSTRAINT "moderation_reports_target_label_snapshot_check" CHECK ((("char_length"("target_label_snapshot") >= 1) AND ("char_length"("target_label_snapshot") <= 160)))
);

ALTER TABLE "private"."moderation_reports" OWNER TO "postgres";

COMMENT ON TABLE "private"."moderation_reports" IS 'Private reports. Submission has no visibility side effect; reporter status is exposed only through a coarse RPC.';

CREATE TABLE IF NOT EXISTS "private"."profile_avatar_cleanup_jobs" (
    "avatar_version_id" "uuid" NOT NULL,
    "source_asset_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "public_object_path" "text" NOT NULL,
    "private_object_path" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "lease_token" "uuid",
    "lease_expires_at" timestamp with time zone,
    "last_error_code" "text",
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "profile_avatar_cleanup_jobs_attempt_count_check" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 8))),
    CONSTRAINT "profile_avatar_cleanup_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'leased'::"text", 'retry'::"text", 'complete'::"text", 'dead'::"text"])))
);

ALTER TABLE "private"."profile_avatar_cleanup_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."profile_image_processing_jobs" (
    "asset_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "avatar_version_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "lease_token" "uuid",
    "lease_expires_at" timestamp with time zone,
    "last_error_code" "text",
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "profile_image_processing_jobs_attempt_count_check" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 5))),
    CONSTRAINT "profile_image_processing_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'leased'::"text", 'retry'::"text", 'complete'::"text", 'dead'::"text"])))
);

ALTER TABLE "private"."profile_image_processing_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."profile_image_uploads" (
    "asset_id" "uuid" NOT NULL,
    "avatar_version_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "expected_byte_size" integer NOT NULL,
    "declared_media_type" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "upload_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "profile_image_uploads_declared_media_type_check" CHECK (("declared_media_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "profile_image_uploads_expected_byte_size_check" CHECK ((("expected_byte_size" >= 1) AND ("expected_byte_size" <= 5242880)))
);

ALTER TABLE "private"."profile_image_uploads" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."retention_cleanup_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "policy_version" "text" NOT NULL,
    "rule_code" "text" NOT NULL,
    "subject_kind" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "eligible_at" timestamp with time zone NOT NULL,
    "byte_estimate" bigint DEFAULT 0 NOT NULL,
    "proof_version" "text" DEFAULT 'blockers-v1'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "lease_token" "uuid",
    "lease_expires_at" timestamp with time zone,
    "last_error_code" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "completed_at" timestamp with time zone,
    "delete_authorized_at" timestamp with time zone,
    CONSTRAINT "retention_cleanup_jobs_attempt_count_check" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 8))),
    CONSTRAINT "retention_cleanup_jobs_byte_estimate_check" CHECK (("byte_estimate" >= 0)),
    CONSTRAINT "retention_cleanup_jobs_rule_code_check" CHECK (("rule_code" = ANY (ARRAY['avatar_superseded'::"text", 'deletion_expired_30d'::"text", 'moderation_metadata_180d'::"text"]))),
    CONSTRAINT "retention_cleanup_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'leased'::"text", 'retry'::"text", 'complete'::"text", 'blocked'::"text", 'dead'::"text"]))),
    CONSTRAINT "retention_cleanup_jobs_subject_kind_check" CHECK (("subject_kind" = ANY (ARRAY['avatar'::"text", 'deletion'::"text", 'metadata'::"text"])))
);

ALTER TABLE "private"."retention_cleanup_jobs" OWNER TO "postgres";

COMMENT ON COLUMN "private"."retention_cleanup_jobs"."delete_authorized_at" IS 'Set only after a locked blocker recheck; supported blocker writers reject new references until job reconciliation.';

CREATE TABLE IF NOT EXISTS "private"."retention_cleanup_objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "object_path" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "already_missing" boolean DEFAULT false NOT NULL
);

ALTER TABLE "private"."retention_cleanup_objects" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."retention_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_version" "text" DEFAULT 'retention-v1'::"text" NOT NULL,
    "mode" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "completed_at" timestamp with time zone,
    "candidate_count" integer DEFAULT 0 NOT NULL,
    "completed_count" integer DEFAULT 0 NOT NULL,
    "blocked_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "retention_runs_mode_check" CHECK (("mode" = ANY (ARRAY['preview'::"text", 'execute'::"text"]))),
    CONSTRAINT "retention_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'complete'::"text", 'failed'::"text"])))
);

ALTER TABLE "private"."retention_runs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" "public"."asset_status" DEFAULT 'reserved'::"public"."asset_status" NOT NULL,
    "bucket" "text" DEFAULT 'profile-images'::"text" NOT NULL,
    "object_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "declared_media_type" "text",
    "reserved_byte_size" bigint NOT NULL,
    "media_type" "text",
    "byte_size" bigint,
    "sha256" "text",
    "verification_version" "text",
    "failure_code" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "upload_completed_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "image_width" integer,
    "image_height" integer,
    "frame_count" smallint,
    CONSTRAINT "assets_avatar_bucket_check" CHECK (("bucket" = 'profile-images'::"text")),
    CONSTRAINT "assets_avatar_path_check" CHECK (("object_path" = (((("owner_id")::"text" || '/'::"text") || ("id")::"text") || '/original'::"text"))),
    CONSTRAINT "assets_failed_check" CHECK (((("status" = 'failed'::"public"."asset_status") AND ("failure_code" IS NOT NULL) AND ("failed_at" IS NOT NULL)) OR (("status" <> 'failed'::"public"."asset_status") AND ("failed_at" IS NULL)))),
    CONSTRAINT "assets_filename_check" CHECK ((("original_filename" = "btrim"("original_filename")) AND (("char_length"("original_filename") >= 1) AND ("char_length"("original_filename") <= 255)))),
    CONSTRAINT "assets_ready_check" CHECK (((("status" = 'ready'::"public"."asset_status") AND ("failure_code" IS NULL) AND ("failed_at" IS NULL) AND ("ready_at" IS NOT NULL) AND ("deleted_at" IS NULL) AND ("media_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"])) AND (("byte_size" >= 1) AND ("byte_size" <= 5242880)) AND ("sha256" IS NOT NULL) AND ("verification_version" = 'profile-image-v1'::"text") AND (("image_width" >= 128) AND ("image_width" <= 4096)) AND (("image_height" >= 128) AND ("image_height" <= 4096)) AND ((("image_width")::bigint * ("image_height")::bigint) <= 16777216) AND ("frame_count" = 1)) OR (("status" = 'deleted'::"public"."asset_status") AND ("deleted_at" IS NOT NULL)) OR (("status" <> ALL (ARRAY['ready'::"public"."asset_status", 'deleted'::"public"."asset_status"])) AND ("ready_at" IS NULL) AND ("deleted_at" IS NULL)))),
    CONSTRAINT "assets_reserved_size_check" CHECK ((("reserved_byte_size" >= 1) AND ("reserved_byte_size" <= 5242880))),
    CONSTRAINT "assets_sha_check" CHECK ((("sha256" IS NULL) OR ("sha256" ~ '^[0-9a-f]{64}$'::"text")))
);

ALTER TABLE "public"."assets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profile_avatar_versions" (
    "id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "source_asset_id" "uuid" NOT NULL,
    "public_object_path" "text" NOT NULL,
    "status" "public"."profile_avatar_status" DEFAULT 'processing'::"public"."profile_avatar_status" NOT NULL,
    "media_type" "text",
    "byte_size" integer,
    "sha256" "text",
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "installed_at" timestamp with time zone,
    "superseded_at" timestamp with time zone,
    "cleaned_at" timestamp with time zone,
    CONSTRAINT "profile_avatar_output_check" CHECK (((("status" = ANY (ARRAY['current'::"public"."profile_avatar_status", 'superseded'::"public"."profile_avatar_status", 'removed'::"public"."profile_avatar_status"])) AND ("media_type" = 'image/webp'::"text") AND (("byte_size" >= 1) AND ("byte_size" <= 524288)) AND ("sha256" ~ '^[0-9a-f]{64}$'::"text") AND ("width" = 512) AND ("height" = 512) AND ("installed_at" IS NOT NULL)) OR ("status" = ANY (ARRAY['processing'::"public"."profile_avatar_status", 'failed'::"public"."profile_avatar_status", 'cleaned'::"public"."profile_avatar_status"])))),
    CONSTRAINT "profile_avatar_path_check" CHECK (("public_object_path" = (((("profile_id")::"text" || '/'::"text") || ("id")::"text") || '/avatar.webp'::"text")))
);

ALTER TABLE "public"."profile_avatar_versions" OWNER TO "postgres";

COMMENT ON TABLE "public"."profile_avatar_versions" IS 'Trusted immutable public avatar derivatives; application roles use safe profile projections only.';

COMMENT ON TABLE "public"."projects" IS 'Private project metadata foundation; revisions, assets, publishing, and forks are intentionally deferred.';

CREATE OR REPLACE VIEW "public"."public_profiles" WITH ("security_invoker"='true') AS
 SELECT "id",
    "username",
    "username_normalized",
    "display_name",
    "credit_name",
    "bio",
    "created_at",
    "updated_at",
    "avatar_path",
    "avatar_version_id"
   FROM "public"."profiles";

ALTER VIEW "public"."public_profiles" OWNER TO "postgres";

COMMENT ON VIEW "public"."public_profiles" IS 'Safe profile projection; underlying profile RLS limits rows by lifecycle and viewer identity.';

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_placed_by_request_id_key" UNIQUE ("placed_by", "request_id");

ALTER TABLE ONLY "private"."deletion_request_workspaces"
    ADD CONSTRAINT "deletion_request_workspaces_pkey" PRIMARY KEY ("deletion_request_id", "workspace_id");

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_requester_id_request_id_key" UNIQUE ("requester_id", "request_id");

ALTER TABLE ONLY "private"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_admin_id_request_id_key" UNIQUE ("admin_id", "request_id");

ALTER TABLE ONLY "private"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_reporter_id_request_id_key" UNIQUE ("reporter_id", "request_id");

ALTER TABLE ONLY "private"."profile_avatar_cleanup_jobs"
    ADD CONSTRAINT "profile_avatar_cleanup_jobs_pkey" PRIMARY KEY ("avatar_version_id");

ALTER TABLE ONLY "private"."profile_image_processing_jobs"
    ADD CONSTRAINT "profile_image_processing_jobs_avatar_version_id_key" UNIQUE ("avatar_version_id");

ALTER TABLE ONLY "private"."profile_image_processing_jobs"
    ADD CONSTRAINT "profile_image_processing_jobs_pkey" PRIMARY KEY ("asset_id");

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_avatar_version_id_key" UNIQUE ("avatar_version_id");

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_owner_id_request_id_key" UNIQUE ("owner_id", "request_id");

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_pkey" PRIMARY KEY ("asset_id");

ALTER TABLE ONLY "private"."retention_cleanup_jobs"
    ADD CONSTRAINT "retention_cleanup_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."retention_cleanup_jobs"
    ADD CONSTRAINT "retention_cleanup_jobs_policy_version_rule_code_subject_kin_key" UNIQUE ("policy_version", "rule_code", "subject_kind", "subject_id");

ALTER TABLE ONLY "private"."retention_cleanup_objects"
    ADD CONSTRAINT "retention_cleanup_objects_job_id_bucket_object_path_key" UNIQUE ("job_id", "bucket", "object_path");

ALTER TABLE ONLY "private"."retention_cleanup_objects"
    ADD CONSTRAINT "retention_cleanup_objects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."retention_runs"
    ADD CONSTRAINT "retention_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_id_owner_uq" UNIQUE ("id", "owner_id");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_object_path_uq" UNIQUE ("bucket", "object_path");

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile_avatar_versions"
    ADD CONSTRAINT "profile_avatar_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile_avatar_versions"
    ADD CONSTRAINT "profile_avatar_versions_public_object_path_key" UNIQUE ("public_object_path");

ALTER TABLE ONLY "public"."profile_avatar_versions"
    ADD CONSTRAINT "profile_avatar_versions_source_asset_id_key" UNIQUE ("source_asset_id");

CREATE INDEX "content_holds_active_idx" ON "private"."content_holds" USING "btree" ("target_kind", "placed_at", "id") WHERE ("released_at" IS NULL);

CREATE INDEX "content_holds_asset_idx" ON "private"."content_holds" USING "btree" ("target_asset_id") WHERE ("target_asset_id" IS NOT NULL);

CREATE INDEX "content_holds_contribution_idx" ON "private"."content_holds" USING "btree" ("target_contribution_id") WHERE ("target_contribution_id" IS NOT NULL);

CREATE INDEX "content_holds_profile_idx" ON "private"."content_holds" USING "btree" ("target_profile_id") WHERE ("target_profile_id" IS NOT NULL);

CREATE INDEX "content_holds_project_idx" ON "private"."content_holds" USING "btree" ("target_project_id") WHERE ("target_project_id" IS NOT NULL);

CREATE INDEX "deletion_request_workspaces_workspace_idx" ON "private"."deletion_request_workspaces" USING "btree" ("workspace_id");

CREATE INDEX "deletion_requests_due_idx" ON "private"."deletion_requests" USING "btree" ("restore_until", "id") WHERE ("status" = 'recoverable'::"text");

CREATE UNIQUE INDEX "deletion_requests_open_target_uq" ON "private"."deletion_requests" USING "btree" ("target_kind", COALESCE("target_profile_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("target_project_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("target_contribution_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("status" = 'recoverable'::"text");

CREATE INDEX "deletion_requests_parent_idx" ON "private"."deletion_requests" USING "btree" ("parent_request_id") WHERE ("parent_request_id" IS NOT NULL);

CREATE INDEX "moderation_actions_report_idx" ON "private"."moderation_actions" USING "btree" ("report_id", "created_at" DESC, "id" DESC) WHERE ("report_id" IS NOT NULL);

CREATE INDEX "moderation_actions_target_idx" ON "private"."moderation_actions" USING "btree" ("target_kind", "target_id", "created_at" DESC);

CREATE INDEX "moderation_reports_queue_idx" ON "private"."moderation_reports" USING "btree" ("created_at", "id") WHERE ("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text"]));

CREATE INDEX "moderation_reports_reporter_created_idx" ON "private"."moderation_reports" USING "btree" ("reporter_id", "created_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "moderation_reports_unresolved_target_uq" ON "private"."moderation_reports" USING "btree" ("reporter_id", "target_kind", COALESCE("target_profile_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("target_project_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("target_contribution_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text"]));

CREATE INDEX "profile_avatar_cleanup_due_idx" ON "private"."profile_avatar_cleanup_jobs" USING "btree" ("next_attempt_at", "avatar_version_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retry'::"text"]));

CREATE INDEX "profile_image_processing_due_idx" ON "private"."profile_image_processing_jobs" USING "btree" ("next_attempt_at", "asset_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retry'::"text"]));

CREATE INDEX "retention_cleanup_claim_idx" ON "private"."retention_cleanup_jobs" USING "btree" ("run_id", "next_attempt_at", "id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retry'::"text", 'leased'::"text"]));

CREATE INDEX "retention_cleanup_due_idx" ON "private"."retention_cleanup_jobs" USING "btree" ("status", "next_attempt_at", "id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'retry'::"text", 'leased'::"text"]));

CREATE INDEX "retention_cleanup_objects_job_idx" ON "private"."retention_cleanup_objects" USING "btree" ("job_id");

CREATE INDEX "retention_cleanup_run_idx" ON "private"."retention_cleanup_jobs" USING "btree" ("run_id", "status", "id");

CREATE INDEX "assets_owner_status_created_idx" ON "public"."assets" USING "btree" ("owner_id", "status", "created_at" DESC);

CREATE UNIQUE INDEX "profile_avatar_versions_current_uq" ON "public"."profile_avatar_versions" USING "btree" ("profile_id") WHERE ("status" = 'current'::"public"."profile_avatar_status");

CREATE INDEX "profile_avatar_versions_profile_created_idx" ON "public"."profile_avatar_versions" USING "btree" ("profile_id", "created_at" DESC);

CREATE OR REPLACE TRIGGER "moderation_actions_append_only" BEFORE DELETE OR UPDATE ON "private"."moderation_actions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_append_only_change"();

CREATE OR REPLACE TRIGGER "assets_immutable" BEFORE UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "private"."protect_asset_immutability"();

CREATE OR REPLACE TRIGGER "profiles_account_retention_barrier" BEFORE UPDATE OF "status" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_authorized_account_restore"();

CREATE OR REPLACE TRIGGER "profiles_avatar_retention_barrier" BEFORE UPDATE OF "avatar_version_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_authorized_avatar_restore"();

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_placed_by_fkey" FOREIGN KEY ("placed_by") REFERENCES "private"."app_admins"("user_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "private"."app_admins"("user_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_target_contribution_id_fkey" FOREIGN KEY ("target_contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."content_holds"
    ADD CONSTRAINT "content_holds_target_project_id_fkey" FOREIGN KEY ("target_project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_request_workspaces"
    ADD CONSTRAINT "deletion_request_workspaces_deletion_request_id_fkey" FOREIGN KEY ("deletion_request_id") REFERENCES "private"."deletion_requests"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_request_workspaces"
    ADD CONSTRAINT "deletion_request_workspaces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_parent_request_id_fkey" FOREIGN KEY ("parent_request_id") REFERENCES "private"."deletion_requests"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_target_contribution_id_fkey" FOREIGN KEY ("target_contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_target_project_id_fkey" FOREIGN KEY ("target_project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "private"."app_admins"("user_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "private"."moderation_reports"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "private"."app_admins"("user_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_target_contribution_id_fkey" FOREIGN KEY ("target_contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."moderation_reports"
    ADD CONSTRAINT "moderation_reports_target_project_id_fkey" FOREIGN KEY ("target_project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."profile_avatar_cleanup_jobs"
    ADD CONSTRAINT "profile_avatar_cleanup_jobs_avatar_version_id_fkey" FOREIGN KEY ("avatar_version_id") REFERENCES "public"."profile_avatar_versions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."profile_avatar_cleanup_jobs"
    ADD CONSTRAINT "profile_avatar_cleanup_jobs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."profile_avatar_cleanup_jobs"
    ADD CONSTRAINT "profile_avatar_cleanup_jobs_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."profile_image_processing_jobs"
    ADD CONSTRAINT "profile_image_processing_jobs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."profile_image_processing_jobs"
    ADD CONSTRAINT "profile_image_processing_jobs_avatar_version_id_fkey" FOREIGN KEY ("avatar_version_id") REFERENCES "public"."profile_avatar_versions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."profile_image_processing_jobs"
    ADD CONSTRAINT "profile_image_processing_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_avatar_version_id_fkey" FOREIGN KEY ("avatar_version_id") REFERENCES "public"."profile_avatar_versions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."profile_image_uploads"
    ADD CONSTRAINT "profile_image_uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."retention_cleanup_jobs"
    ADD CONSTRAINT "retention_cleanup_jobs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "private"."retention_runs"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "private"."retention_cleanup_objects"
    ADD CONSTRAINT "retention_cleanup_objects_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "private"."retention_cleanup_jobs"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."profile_avatar_versions"
    ADD CONSTRAINT "profile_avatar_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."profile_avatar_versions"
    ADD CONSTRAINT "profile_avatar_versions_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_avatar_version_fk" FOREIGN KEY ("avatar_version_id") REFERENCES "public"."profile_avatar_versions"("id") ON DELETE RESTRICT;

ALTER TABLE "private"."content_holds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."deletion_request_workspaces" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."deletion_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."moderation_actions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."moderation_reports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."profile_avatar_cleanup_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."profile_image_processing_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."profile_image_uploads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."retention_cleanup_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."retention_cleanup_objects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."retention_runs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_image_assets_read" ON "public"."assets" FOR SELECT TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));

ALTER TABLE "public"."profile_avatar_versions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION "private"."avatar_retention_blocked"("p_avatar_version_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."can_upload_reserved_profile_image"("p_bucket" "text", "p_name" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."can_upload_reserved_profile_image"("p_bucket" "text", "p_name" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "private"."hold_conflicts_authorized_retention"("p_target_kind" "text", "p_target_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."prevent_authorized_account_restore"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."prevent_authorized_avatar_restore"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."apply_moderation_action"("p_report_id" "uuid", "p_request_id" "uuid", "p_action" "text", "p_reason" "text", "p_expected_report_status" "text", "p_expected_target_version" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."apply_moderation_action"("p_report_id" "uuid", "p_request_id" "uuid", "p_action" "text", "p_reason" "text", "p_expected_report_status" "text", "p_expected_target_version" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."complete_profile_image_upload"("p_asset_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_profile_image_upload"("p_asset_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_own_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."delete_own_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_project"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."delete_project"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_admin_moderation_target"("p_report_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_admin_moderation_target"("p_report_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_admin_storage_summary"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_admin_storage_summary"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_own_account_recovery"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_own_account_recovery"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_project_revision_history_v3"("p_project_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_project_revision_history_v3"("p_project_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_admin_moderation_queue"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_admin_moderation_queue"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_public_profile_contributions"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_accepted_at" timestamp with time zone, "p_after_revision_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_public_profile_contributions"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_accepted_at" timestamp with time zone, "p_after_revision_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."list_public_profile_contributions"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_accepted_at" timestamp with time zone, "p_after_revision_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_public_profile_projects"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_public_profile_projects"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."list_public_profile_projects"("p_profile_id" "uuid", "p_discovery_version" bigint, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_viewer_reports"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_viewer_reports"("p_after_created_at" timestamp with time zone, "p_after_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."operator_claim_profile_avatar_cleanup"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_claim_profile_avatar_cleanup"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_claim_profile_image"("p_asset_id" "uuid", "p_owner_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_claim_profile_image"("p_asset_id" "uuid", "p_owner_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_claim_retention_job"("p_run_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_claim_retention_job"("p_run_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_complete_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_complete_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_complete_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_media_type" "text", "p_byte_size" bigint, "p_sha256" "text", "p_width" integer, "p_height" integer, "p_frame_count" smallint, "p_output_byte_size" integer, "p_output_sha256" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_complete_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_media_type" "text", "p_byte_size" bigint, "p_sha256" "text", "p_width" integer, "p_height" integer, "p_frame_count" smallint, "p_output_byte_size" integer, "p_output_sha256" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_complete_retention_run"("p_run_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_complete_retention_run"("p_run_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_count_due_profile_avatar_cleanup"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_count_due_profile_avatar_cleanup"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_finalize_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_deleted_object_ids" "uuid"[], "p_missing_object_ids" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_finalize_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_deleted_object_ids" "uuid"[], "p_missing_object_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_retention_preview"("p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_retention_preview"("p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_retry_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_retry_profile_avatar_cleanup"("p_avatar_version_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_retry_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_retry_profile_image"("p_asset_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_retry_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_retry_retention_job"("p_job_id" "uuid", "p_lease_token" "uuid", "p_error_code" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."operator_start_retention_run"("p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."operator_start_retention_run"("p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."place_content_hold"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_hold_type" "text", "p_reason" "text", "p_expires_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."place_content_hold"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_hold_type" "text", "p_reason" "text", "p_expires_at" timestamp with time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."release_content_hold"("p_hold_id" "uuid", "p_request_id" "uuid", "p_reason" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."release_content_hold"("p_hold_id" "uuid", "p_request_id" "uuid", "p_reason" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."remove_own_avatar"("p_expected_avatar_version_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."remove_own_avatar"("p_expected_avatar_version_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."request_account_deletion"("p_request_id" "uuid", "p_username" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."request_account_deletion"("p_request_id" "uuid", "p_username" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."reserve_profile_image_upload"("p_request_id" "uuid", "p_expected_byte_size" integer, "p_filename" "text", "p_declared_media_type" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."reserve_profile_image_upload"("p_request_id" "uuid", "p_expected_byte_size" integer, "p_filename" "text", "p_declared_media_type" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restore_own_account"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_own_account"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restore_own_contribution"("p_contribution_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_own_contribution"("p_contribution_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restore_project"("p_project_id" "uuid", "p_request_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_project"("p_project_id" "uuid", "p_request_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_moderation_report"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_reason" "text", "p_detail" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_moderation_report"("p_request_id" "uuid", "p_target_kind" "text", "p_target_id" "uuid", "p_reason" "text", "p_detail" "text") TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."assets" TO "service_role";

GRANT SELECT ON TABLE "public"."assets" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_avatar_versions" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."public_profiles" TO "service_role";


-- Avatar-only Storage boundary. Musical files never enter Storage.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('profile-images','profile-images',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('public-avatars','public-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();

create policy reserved_profile_image_insert on storage.objects for insert to authenticated
with check (bucket_id='profile-images' and owner_id=(select auth.uid())::text
  and (select private.can_upload_reserved_profile_image(storage.objects.bucket_id,storage.objects.name)));

-- Supabase defaults are broader than the application contract; application roles are read/RPC only.
revoke insert,update,delete,truncate,references,trigger,maintain on all tables in schema public from anon,authenticated;
grant select on public.public_profiles to anon,authenticated;
