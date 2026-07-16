-- PIVOT-08 contracts the expand-first MIDI v3 schema. This migration is
-- intentionally local/fresh-project only: no hosted legacy data is retained.

do $$
begin
  if exists(select 1 from public.project_revisions where manifest_version<>3)
    or exists(select 1 from public.contribution_versions where manifest_version<>3)
    or exists(select 1 from public.workspaces where manifest_version<>3)
  then
    raise exception 'pivot_08_requires_midi_v3_only_data';
  end if;
end $$;

create or replace function public.operator_claim_retention_job(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
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

create or replace function public.operator_finalize_retention_job(
  p_job_id uuid,p_lease_token uuid,p_deleted_object_ids uuid[],p_missing_object_ids uuid[]
)
returns text language plpgsql security definer set search_path='' as $$
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

-- Acceptance has its dedicated v3 command; this command retains only the
-- request-changes/reject review transitions used by the current application.
create or replace function public.review_contribution(
  p_contribution_id uuid,p_request_id uuid,p_decision public.contribution_review_decision,
  p_expected_status public.contribution_status,p_expected_current_version_id uuid,
  p_expected_project_revision_id uuid,p_note text default null
)
returns table(contribution_id uuid,contribution_version_id uuid,
  requested_decision public.contribution_review_decision,
  applied_decision public.contribution_review_decision,reason public.contribution_review_reason,
  status public.contribution_status,revision_id uuid,revision_number integer,reviewed_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_version public.contribution_versions%rowtype;
  v_workspace public.workspaces%rowtype; v_existing public.contribution_reviews%rowtype;
  v_review public.contribution_reviews%rowtype; v_note text:=nullif(btrim(p_note),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_review_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_review_actor_ineligible'; end if;
  if p_contribution_id is null or p_request_id is null
    or p_decision not in ('request_changes','reject') or p_expected_status<>'submitted'
    or p_expected_current_version_id is null or p_expected_project_revision_id is null
    or v_note is null or char_length(v_note)>5000 then
    raise sqlstate '22023' using message='contribution_review_invalid_input'; end if;
  select p.* into v_project from public.contributions c join public.projects p on p.id=c.project_id
    where c.id=p_contribution_id for update of p;
  if not found or v_project.owner_id<>v_actor or not exists(
    select 1 from public.project_members m where m.project_id=v_project.id
      and m.user_id=v_actor and m.role='owner') then
    raise sqlstate 'PT404' using message='contribution_review_not_found'; end if;
  select * into v_contribution from public.contributions
    where id=p_contribution_id and project_id=v_project.id for update;
  select * into v_existing from public.contribution_reviews cr
    where cr.contribution_id=p_contribution_id and cr.request_id=p_request_id;
  if found then
    if v_existing.requested_decision<>p_decision
      or v_existing.contribution_version_id<>p_expected_current_version_id
      or v_existing.expected_project_revision_id<>p_expected_project_revision_id
      or v_existing.note is distinct from v_note then
      raise sqlstate 'PT409' using message='contribution_review_request_conflict'; end if;
    return query select v_existing.contribution_id,v_existing.contribution_version_id,
      v_existing.requested_decision,v_existing.applied_decision,v_existing.reason,
      case v_existing.applied_decision when 'request_changes' then 'changes_requested'::public.contribution_status
        else 'rejected'::public.contribution_status end,null::uuid,null::integer,v_existing.created_at;
    return;
  end if;
  if v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or v_project.current_revision_id is null then
    raise sqlstate 'PT409' using message='contribution_review_project_unavailable'; end if;
  if v_project.current_revision_id<>p_expected_project_revision_id
    or v_contribution.status<>p_expected_status
    or v_contribution.current_version_id is distinct from p_expected_current_version_id then
    raise sqlstate 'PT409' using message='contribution_review_conflict'; end if;
  select * into v_version from public.contribution_versions cv
    where cv.id=p_expected_current_version_id and cv.contribution_id=v_contribution.id
      and cv.manifest_version=3 and cv.arrangement_version_id is not null for update;
  select * into v_workspace from public.workspaces w where w.contribution_id=v_contribution.id for update;
  if v_version.id is null or v_workspace.id is null or v_version.base_revision_id<>v_contribution.base_revision_id then
    raise sqlstate 'PT409' using message='contribution_review_invalid_version'; end if;
  insert into public.contribution_reviews(contribution_id,contribution_version_id,reviewer_id,request_id,
    requested_decision,applied_decision,reason,note,expected_project_revision_id)
  values(v_contribution.id,v_version.id,v_actor,p_request_id,p_decision,p_decision,
    'owner_feedback',v_note,p_expected_project_revision_id) returning * into v_review;
  if p_decision='request_changes' then
    update public.contributions set status='changes_requested',reviewed_at=v_review.created_at,
      reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at where id=v_contribution.id;
    update public.workspaces set status='active',updated_at=v_review.created_at where id=v_workspace.id;
    return query select v_contribution.id,v_version.id,p_decision,p_decision,
      'owner_feedback'::public.contribution_review_reason,'changes_requested'::public.contribution_status,
      null::uuid,null::integer,v_review.created_at;
  else
    update public.contributions set status='rejected',reviewed_at=v_review.created_at,
      reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at where id=v_contribution.id;
    update public.workspaces set status='archived',updated_at=v_review.created_at where id=v_workspace.id;
    return query select v_contribution.id,v_version.id,p_decision,p_decision,
      'owner_feedback'::public.contribution_review_reason,'rejected'::public.contribution_status,
      null::uuid,null::integer,v_review.created_at;
  end if;
end $$;

-- Stop all uploaded-audio background work before removing its commands.
do $$
declare v_job bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job in select jobid from cron.job
      where jobname in ('asset-verification-recovery','asset-verification-history-prune')
    loop
      perform cron.unschedule(v_job);
    end loop;
  end if;
end $$;

drop policy if exists owned_or_referenced_source_read on storage.objects;
drop policy if exists reserved_source_insert on storage.objects;
drop policy if exists own_workspace_snapshot_read on storage.objects;
drop policy if exists reserved_workspace_snapshot_insert on storage.objects;
drop policy if exists authorized_waveform_peak_read on storage.objects;
drop policy if exists reserved_waveform_peak_insert on storage.objects;
drop policy if exists unfinalized_waveform_peak_delete on storage.objects;

do $$
begin
  if exists(select 1 from storage.objects
    where bucket_id in ('source-audio','workspace-snapshots','derived-assets')) then
    raise exception 'pivot_08_storage_buckets_must_be_empty';
  end if;
end $$;
select set_config('storage.allow_delete_query','true',false);
delete from storage.buckets
where id in ('source-audio','workspace-snapshots','derived-assets');
select set_config('storage.allow_delete_query','false',false);

-- Remove every callable upload, verification, peak, quota, snapshot-Storage,
-- legacy projection, and legacy collaboration surface.
drop policy if exists owned_or_referenced_assets_read on public.assets;
drop policy if exists authorized_waveform_peak_derivatives_read on public.waveform_peak_derivatives;
drop policy if exists referenced_midi_stem_versions_read on public.midi_stem_versions;
drop trigger if exists assets_retention_reactivation_barrier on public.assets;
drop trigger if exists contribution_versions_snapshot_retention_barrier on public.contribution_versions;
drop trigger if exists workspaces_snapshot_retention_barrier on public.workspaces;
drop trigger if exists workspace_tracks_require_confirmed_credits on public.workspace_tracks;
drop trigger if exists workspace_tracks_retention_barrier on public.workspace_tracks;
drop trigger if exists refresh_public_midi_catalog_tracks on public.public_project_catalog;

drop function if exists public.cancel_source_upload(uuid);
drop function if exists public.cancel_waveform_peaks(uuid);
drop function if exists public.complete_source_upload(uuid);
drop function if exists public.confirm_source_asset_credits(uuid,uuid,jsonb);
drop function if exists public.finalize_waveform_peaks(uuid,bigint,text,smallint,text,smallint,integer,integer,integer);
drop function if exists public.get_admin_storage_summary();
drop function if exists public.get_project_revision_preview(uuid,uuid);
drop function if exists public.get_source_admission_capability();
drop function if exists public.get_source_verification_status(uuid);
drop function if exists public.list_admin_rejectable_uploads();
drop function if exists public.operator_claim_source_verification(uuid,uuid);
drop function if exists public.operator_complete_source_verification(uuid,uuid,text,bigint,text,integer,integer,smallint,text);
drop function if exists public.operator_fail_source_asset(uuid,text);
drop function if exists public.operator_fail_source_verification(uuid,uuid,text);
drop function if exists public.operator_promote_source_asset(uuid,text,bigint,text,integer,integer,smallint,text);
drop function if exists public.operator_retry_source_verification(uuid,uuid,text);
drop function if exists public.operator_set_source_admission_enabled(boolean);
drop function if exists public.reject_admin_upload(uuid,uuid,text,text);
drop function if exists public.reserve_source_asset(uuid,bigint,text,text,integer,text);
drop function if exists public.reserve_waveform_peaks(uuid,uuid,bigint);
drop function if exists public.reserve_workspace_snapshot(uuid,uuid,integer,text,integer);
drop function if exists public.retry_source_verification(uuid);
drop function if exists public.save_workspace(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.publish_project_revision(uuid,uuid,uuid,text,jsonb);
drop function if exists public.create_project_workspace(uuid,uuid,uuid);
drop function if exists public.create_contribution_workspace(uuid,uuid,uuid,text,text);
drop function if exists public.submit_contribution(uuid,uuid,integer,uuid,text,text);
drop function if exists public.review_contribution_v1(uuid,uuid,public.contribution_review_decision,public.contribution_status,uuid,uuid,text);
drop function if exists public.fork_project(uuid,uuid,uuid,text,text,text);
drop function if exists public.fork_project_v1(uuid,uuid,uuid,text,text,text);
drop function if exists public.save_midi_workspace(uuid,uuid,integer,jsonb);
drop function if exists public.publish_midi_workspace_revision(uuid,uuid,integer,uuid,text);
drop function if exists public.finalize_studio_midi_draft(uuid,uuid,integer,text,uuid,integer,text,uuid,uuid,integer);
drop function if exists public.publish_workspace_revision(uuid,uuid,integer,uuid,text);
drop function if exists public.restart_project_workspace(uuid,uuid,integer,uuid,uuid);
drop function if exists public.create_midi_stem_draft(uuid,text,text,uuid,text,integer);
drop function if exists public.create_imported_midi_stem_draft(uuid,uuid,jsonb);
drop function if exists public.create_midi_stem_draft_owner_v1(uuid,text,text,uuid,text,integer);
drop function if exists public.save_midi_stem_draft(uuid,uuid,integer,jsonb);
drop function if exists public.publish_midi_stem_version(uuid,uuid,integer,text);

drop function if exists private.asset_has_authorized_retention_job(uuid);
drop function if exists private.asset_quota_drift();
drop function if exists private.can_delete_unfinalized_waveform_peak(text,text);
drop function if exists private.can_read_source_asset(uuid);
drop function if exists private.can_read_source_object(text,text);
drop function if exists private.can_read_waveform_peak_object(text,text);
drop function if exists private.can_upload_reserved_source(text,text);
drop function if exists private.can_upload_waveform_peak(text,text);
drop function if exists private.can_upload_workspace_snapshot(text,text);
drop function if exists private.canonical_project_manifest_v2(uuid,jsonb,boolean);
drop function if exists private.clone_project_workspace(uuid,uuid,uuid,uuid);
drop function if exists private.contribution_v2_projection_matches(uuid,jsonb);
drop function if exists private.expire_source_assets();
drop function if exists private.expire_waveform_peak_uploads();
drop function if exists private.fail_source_asset(uuid,text);
drop function if exists private.fill_revision_midi_credit_defaults() cascade;
drop function if exists private.invoke_asset_verification_recovery();
drop function if exists private.prevent_authorized_asset_reactivation();
drop function if exists private.prevent_authorized_retention_reference() cascade;
drop function if exists private.project_storage_usage_drift();
drop function if exists private.project_v2_projections(uuid,jsonb);
drop function if exists private.promote_source_asset(uuid,text,bigint,text,integer,integer,smallint,text);
drop function if exists private.prune_asset_verification_history();
drop function if exists private.refresh_public_midi_catalog_tracks() cascade;
drop function if exists private.reject_confirmed_asset_credit_change() cascade;
drop function if exists private.require_confirmed_source_credits() cascade;
drop function if exists private.retention_blockers(uuid);
drop function if exists private.revision_v2_projection_matches(uuid,jsonb);
drop function if exists private.snapshot_contribution_midi_lineage() cascade;
drop function if exists private.snapshot_revision_midi_lineage() cascade;
drop function if exists private.snapshot_revision_track_credits() cascade;
drop function if exists private.workspace_v2_projection_matches(uuid,jsonb);

drop table if exists public.contribution_version_midi_track_credits;
drop table if exists public.revision_midi_track_credits;
drop table if exists public.revision_track_credits;
drop table if exists public.contribution_version_clips;
drop table if exists public.contribution_version_tracks;
drop table if exists public.revision_clips;
drop table if exists public.revision_tracks;
drop table if exists public.asset_credits;
drop table if exists public.asset_uploads;
drop table if exists public.waveform_peak_derivatives;
drop table if exists public.project_asset_references;
drop table if exists public.project_storage_usage;
drop table if exists public.user_storage_usage;
drop table if exists public.global_storage_usage;
drop table if exists private.asset_verification_jobs;
drop table if exists private.source_admission_control;
drop table if exists private.workspace_snapshot_uploads;

-- The generic asset record now represents only private avatar originals.
alter table public.assets
  drop constraint assets_credit_confirmation_shape,
  drop constraint assets_kind_storage_check,
  drop constraint assets_path_check,
  drop constraint assets_ready_check,
  drop constraint assets_reserved_size_check;
alter table public.assets
  alter column bucket set default 'profile-images',
  drop column kind,
  drop column duration_ms,
  drop column sample_rate_hz,
  drop column channels,
  drop column credits_confirmed_at,
  drop column credits_confirmation_request_id,
  drop column credits_confirmation_sha256;
alter table public.assets
  add constraint assets_avatar_bucket_check check(bucket='profile-images'),
  add constraint assets_avatar_path_check check(
    object_path=owner_id::text||'/'||id::text||'/original'),
  add constraint assets_reserved_size_check check(
    reserved_byte_size between 1 and 5242880),
  add constraint assets_ready_check check(
    (status='ready' and failure_code is null and failed_at is null and ready_at is not null
      and media_type in ('image/jpeg','image/png','image/webp')
      and byte_size between 1 and 5242880 and sha256 is not null
      and verification_version='profile-image-v1'
      and image_width between 128 and 4096 and image_height between 128 and 4096
      and image_width::bigint*image_height::bigint<=16777216 and frame_count=1)
    or (status<>'ready' and ready_at is null));

drop type if exists public.asset_kind;

create policy own_profile_image_assets_read on public.assets
for select to authenticated
using(owner_id=(select auth.uid()));

create or replace function private.protect_asset_immutability()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.owner_id<>new.owner_id or old.bucket<>new.bucket or old.object_path<>new.object_path
    or (old.status='ready' and not (
      new.status='deleted' or (new.status='ready' and to_jsonb(new) is not distinct from to_jsonb(old))
    )) then
    raise exception 'immutable_asset';
  end if;
  return new;
end $$;

drop extension if exists pg_net cascade;
drop extension if exists pg_cron cascade;

-- Make the v3 project creator independent from the removed v2 creator.
create or replace function public.create_midi_project_workspace_v3(
  p_request_id uuid,p_title text,p_description text,p_bpm numeric,p_musical_key text,
  p_time_signature_numerator smallint,p_time_signature_denominator smallint,
  p_license_code text,p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[]
)
returns table(project_id uuid,title text,lock_version integer,workspace_id uuid)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype; v_workspace_id uuid:=gen_random_uuid();
  v_manifest jsonb; v_hash text; v_bpm numeric:=coalesce(p_bpm,120);
  v_genre_ids uuid[]; v_tag_ids uuid[];
begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
  if p_request_id is null or p_title is null or p_title<>btrim(p_title)
    or char_length(p_title) not between 1 and 120 or p_description is null
    or p_description<>btrim(p_description) or char_length(p_description)>5000
    or v_bpm not between 20 and 300 or scale(v_bpm)>3
    or p_time_signature_numerator not between 1 and 32
    or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then
    raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into v_genre_ids
    from unnest(coalesce(p_genre_ids,'{}'::uuid[])) x;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into v_tag_ids
    from unnest(coalesce(p_tag_ids,'{}'::uuid[])) x;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'midi-project:'||v_actor::text||':'||p_request_id::text,0));
  select * into v_project from public.projects
    where owner_id=v_actor and create_request_id=p_request_id;
  if found then
    select * into v_workspace from public.workspaces w
      where w.project_id=v_project.id and w.owner_id=v_actor and w.status='active';
    if v_project.compatibility<>'midi' or v_workspace.id is null
      or v_workspace.manifest_version<>3 or v_project.title<>p_title
      or v_project.description is distinct from nullif(p_description,'')
      or v_project.bpm is distinct from v_bpm or v_project.musical_key is distinct from p_musical_key
      or v_project.time_signature_numerator<>p_time_signature_numerator
      or v_project.time_signature_denominator<>p_time_signature_denominator
      or v_project.license_code<>p_license_code
      or coalesce((select array_agg(pg.genre_id order by pg.genre_id) from public.project_genres pg
        where pg.project_id=v_project.id),'{}'::uuid[])<>v_genre_ids
      or (select pg.genre_id from public.project_genres pg where pg.project_id=v_project.id and pg.is_primary)
        is distinct from p_primary_genre_id
      or coalesce((select array_agg(pt.tag_id order by pt.tag_id) from public.project_tags pt
        where pt.project_id=v_project.id),'{}'::uuid[])<>v_tag_ids then
      raise sqlstate 'PT409' using message='project_request_conflict'; end if;
    return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id; return;
  end if;
  if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10
    or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x)
    or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x)
    or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}')))
    or not exists(select 1 from public.licenses where code=p_license_code and is_active)
    or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g
      on g.id=x and g.is_active where g.id is null)
    or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t
      on t.id=x and t.is_active where t.id is null) then
    raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
  insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,compatibility)
  values(v_actor,p_request_id,p_title,nullif(p_description,''),v_bpm,p_musical_key,
    p_time_signature_numerator,p_time_signature_denominator,p_license_code,'midi') returning * into v_project;
  insert into public.project_members(project_id,user_id,role,created_by)
    values(v_project.id,v_actor,'owner',v_actor);
  insert into public.project_genres(project_id,genre_id,is_primary)
    select v_project.id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x;
  insert into public.project_tags(project_id,tag_id)
    select v_project.id,x from unnest(coalesce(p_tag_ids,'{}')) x;
  v_manifest:=jsonb_build_object('manifestVersion',3,'engine','jam-session-midi',
    'engineVersion','jam-session-midi-3_tone-15.1.22_presets-1','projectId',v_project.id,
    'workspaceId',v_workspace_id,'tempoBpm',v_bpm,'timeSignature',jsonb_build_object(
      'numerator',p_time_signature_numerator,'denominator',p_time_signature_denominator),
    'musicalKey',p_musical_key,'ppq',480,'durationTicks',7680,'tracks','[]'::jsonb);
  v_manifest:=private.canonical_manifest_v3(v_manifest,v_project.id,v_workspace_id);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.workspaces(id,project_id,owner_id,create_request_id,manifest,
    manifest_version,engine,engine_version,manifest_sha256)
  values(v_workspace_id,v_project.id,v_actor,p_request_id,v_manifest,3,'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1',v_hash) returning * into v_workspace;
  return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id;
end $$;

-- Clone an exact v3 arrangement into a contributor-owned mutable workspace.
create or replace function public.create_contribution_workspace_v3(
  p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid,
  p_title text,p_description text
)
returns table(contribution_id uuid,workspace_id uuid,base_revision_id uuid,lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype; v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype; v_workspace_id uuid:=gen_random_uuid();
  v_title text:=btrim(p_title); v_description text:=nullif(btrim(p_description),'');
  v_manifest jsonb; v_hash text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  if p_project_id is null or p_request_id is null or p_expected_current_revision_id is null
    or v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description)>5000) then
    raise sqlstate '22023' using message='contribution_invalid_input'; end if;
  select * into v_contribution from public.contributions c
    where c.author_id=v_actor and c.create_request_id=p_request_id;
  if found then
    if v_contribution.project_id<>p_project_id or v_contribution.base_revision_id<>p_expected_current_revision_id
      or v_contribution.title<>v_title or v_contribution.description is distinct from v_description then
      raise sqlstate 'PT409' using message='contribution_request_conflict'; end if;
    select * into v_workspace from public.workspaces w where w.contribution_id=v_contribution.id;
    return query select v_contribution.id,v_workspace.id,v_contribution.base_revision_id,
      v_workspace.lock_version,v_contribution.created_at; return;
  end if;
  select * into v_project from public.projects where id=p_project_id for update;
  if not found or v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or not v_project.open_to_contributions then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if v_project.owner_id=v_actor or (v_project.visibility='private' and not exists(
    select 1 from public.project_members m where m.project_id=p_project_id and m.user_id=v_actor
      and m.role in ('editor','viewer'))) then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if exists(select 1 from public.contributions c where c.project_id=p_project_id and c.author_id=v_actor
      and c.status in ('draft','submitted','changes_requested'))
    or exists(select 1 from public.workspaces w where w.project_id=p_project_id and w.owner_id=v_actor
      and w.status='active') then raise sqlstate 'PT409' using message='contribution_live_exists'; end if;
  select * into v_revision from public.project_revisions r
    where r.project_id=p_project_id and r.id=p_expected_current_revision_id
      and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='contribution_base_not_midi_v3'; end if;
  v_manifest:=v_revision.manifest||jsonb_build_object('workspaceId',v_workspace_id);
  v_manifest:=private.canonical_manifest_v3(v_manifest,p_project_id,v_workspace_id);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.contributions(project_id,author_id,create_request_id,base_revision_id,title,description)
    values(p_project_id,v_actor,p_request_id,p_expected_current_revision_id,v_title,v_description)
    returning * into v_contribution;
  insert into public.workspaces(id,project_id,owner_id,create_request_id,base_revision_id,contribution_id,
    manifest,manifest_version,engine,engine_version,manifest_sha256)
  values(v_workspace_id,p_project_id,v_actor,p_request_id,p_expected_current_revision_id,v_contribution.id,
    v_manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',v_hash)
    returning * into v_workspace;
  perform private.replace_workspace_projection_v3(v_workspace.id,v_manifest);
  return query select v_contribution.id,v_workspace.id,v_contribution.base_revision_id,
    v_workspace.lock_version,v_contribution.created_at;
exception when unique_violation then raise sqlstate 'PT409' using message='contribution_live_exists';
end $$;

create or replace function private.refresh_public_project(p_project_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_project public.projects%rowtype; v_revision public.project_revisions%rowtype;
  v_version bigint; v_revision_events integer; v_accepted integer; v_forks integer;
  v_last_activity timestamptz; v_signal numeric; v_score numeric(18,6);
  v_genres jsonb; v_genre_slugs text[]; v_tags jsonb; v_tag_slugs text[];
  v_tracks jsonb; v_preset_ids text[]; v_attributions jsonb; v_search_text text;
begin
  if p_project_id is null then return; end if;
  v_version:=private.bump_discovery_version();
  select * into v_project from public.projects where id=p_project_id;
  if not found then
    delete from public.public_project_catalog where project_id=p_project_id;
    delete from public.project_stats where project_id=p_project_id; return;
  end if;
  select count(*)::integer,max(created_at) into v_revision_events,v_last_activity
    from public.activity_events where project_id=p_project_id and event_type='project_revision_published';
  select count(*)::integer into v_accepted from public.project_revisions r
    join public.revision_attributions ra on ra.revision_id=r.id
    where r.project_id=p_project_id and ra.kind='accepted_contributor';
  select count(*)::integer into v_forks from public.projects child
    where child.source_project_id=p_project_id and child.visibility='public'
      and child.status='active' and child.deleted_at is null;
  v_signal:=1+least(v_revision_events,5)+4*least(v_accepted,5)+3*least(v_forks,10);
  v_score:=round((ln(v_signal)+extract(epoch from (coalesce(v_last_activity,v_project.published_at,
    v_project.created_at)-timestamptz '2026-01-01 00:00:00+00'))/450000)::numeric,6);
  insert into public.project_stats(project_id,revision_events,accepted_contributions,public_direct_forks,
    last_public_activity_at,trending_score,updated_at)
  values(p_project_id,v_revision_events,v_accepted,v_forks,v_last_activity,v_score,statement_timestamp())
  on conflict(project_id) do update set revision_events=excluded.revision_events,
    accepted_contributions=excluded.accepted_contributions,public_direct_forks=excluded.public_direct_forks,
    last_public_activity_at=excluded.last_public_activity_at,trending_score=excluded.trending_score,
    updated_at=excluded.updated_at;
  if v_project.visibility<>'public' or v_project.status<>'active' or v_project.deleted_at is not null
    or v_project.current_revision_id is null or not exists(select 1 from public.profiles p
      where p.id=v_project.owner_id and p.status='active' and p.profile_completed_at is not null) then
    delete from public.public_project_catalog where project_id=p_project_id; return;
  end if;
  select * into v_revision from public.project_revisions r where r.id=v_project.current_revision_id
    and r.project_id=v_project.id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then delete from public.public_project_catalog where project_id=p_project_id; return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'slug',g.slug,'name',g.name,
      'isPrimary',pg.is_primary) order by pg.is_primary desc,g.sort_order),'[]'::jsonb),
    coalesce(array_agg(g.slug order by g.slug),'{}'::text[])
    into v_genres,v_genre_slugs from public.project_genres pg join public.genres g on g.id=pg.genre_id
    where pg.project_id=p_project_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'slug',t.slug,'name',t.display_name)
      order by t.sort_order),'[]'::jsonb),coalesce(array_agg(t.slug order by t.slug),'{}'::text[]),
    coalesce(string_agg(t.display_name,' ' order by t.sort_order),'') into v_tags,v_tag_slugs,v_search_text
    from public.project_tags pt join public.tags t on t.id=pt.tag_id where pt.project_id=p_project_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',at.track_id,'kind','midi','name',at.name,
      'durationMs',v_revision.duration_ms,'positionMs',0,'sortOrder',at.sort_order,
      'preset',jsonb_build_object('id',at.preset_id,'version',at.preset_version),
      'instrument',null,'credits','[]'::jsonb) order by at.sort_order),'[]'::jsonb),
    coalesce(array_agg(distinct at.preset_id),'{}'::text[]) into v_tracks,v_preset_ids
    from public.arrangement_tracks at where at.arrangement_version_id=v_revision.arrangement_version_id;
  select coalesce(jsonb_agg(jsonb_build_object('kind',ra.kind,'creditName',ra.credit_name,
      'profileId',ra.user_id) order by case ra.kind when 'publisher' then 0 else 1 end),'[]'::jsonb)
    into v_attributions from public.revision_attributions ra where ra.revision_id=v_revision.id;
  insert into public.public_project_catalog(project_id,owner_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,license_name,license_url,
    license_summary,license_allows_derivatives,open_to_contributions,current_revision_id,revision_number,
    duration_ms,published_at,updated_at,genres,genre_slugs,tags,tag_slugs,tracks,instrument_slugs,
    attributions,trending_score,discovery_version,search_vector,refreshed_at)
  select v_project.id,v_project.owner_id,v_project.title,v_project.description,v_project.bpm,
    v_project.musical_key,v_project.time_signature_numerator,v_project.time_signature_denominator,
    l.code,l.name,l.url,l.summary,l.allows_derivatives,v_project.open_to_contributions,v_revision.id,
    v_revision.revision_number,v_revision.duration_ms,v_project.published_at,v_project.updated_at,
    v_genres,v_genre_slugs,v_tags,v_tag_slugs,v_tracks,v_preset_ids,v_attributions,v_score,v_version,
    setweight(to_tsvector('simple',v_project.title),'A')||
      setweight(to_tsvector('simple',coalesce(v_project.description,'')),'B')||
      setweight(to_tsvector('simple',v_search_text),'C'),statement_timestamp()
    from public.licenses l where l.code=v_project.license_code
  on conflict(project_id) do update set owner_id=excluded.owner_id,title=excluded.title,
    description=excluded.description,bpm=excluded.bpm,musical_key=excluded.musical_key,
    time_signature_numerator=excluded.time_signature_numerator,
    time_signature_denominator=excluded.time_signature_denominator,license_code=excluded.license_code,
    license_name=excluded.license_name,license_url=excluded.license_url,
    license_summary=excluded.license_summary,license_allows_derivatives=excluded.license_allows_derivatives,
    open_to_contributions=excluded.open_to_contributions,current_revision_id=excluded.current_revision_id,
    revision_number=excluded.revision_number,duration_ms=excluded.duration_ms,published_at=excluded.published_at,
    updated_at=excluded.updated_at,genres=excluded.genres,genre_slugs=excluded.genre_slugs,tags=excluded.tags,
    tag_slugs=excluded.tag_slugs,tracks=excluded.tracks,instrument_slugs=excluded.instrument_slugs,
    attributions=excluded.attributions,trending_score=excluded.trending_score,
    discovery_version=excluded.discovery_version,search_vector=excluded.search_vector,
    refreshed_at=excluded.refreshed_at;
end $$;

create or replace function private.refresh_public_project_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_project_id uuid; v_old_source uuid; v_new_source uuid;
begin
  if tg_table_name='projects' then
    if tg_op='DELETE' then v_project_id:=old.id; v_old_source:=old.source_project_id;
    elsif tg_op='INSERT' then v_project_id:=new.id; v_new_source:=new.source_project_id;
    else v_project_id:=new.id; v_old_source:=old.source_project_id; v_new_source:=new.source_project_id;
    end if;
  elsif tg_table_name in ('project_genres','project_tags') then
    v_project_id:=coalesce(new.project_id,old.project_id);
  elsif tg_table_name='activity_events' then
    v_project_id:=coalesce(new.project_id,old.project_id);
  elsif tg_table_name='revision_attributions' then
    select r.project_id into v_project_id from public.project_revisions r
      where r.id=coalesce(new.revision_id,old.revision_id);
  end if;
  perform private.refresh_public_project(v_project_id);
  if v_old_source is not null and v_old_source is distinct from v_project_id then
    perform private.refresh_public_project(v_old_source); end if;
  if v_new_source is not null and v_new_source is distinct from v_old_source
    and v_new_source is distinct from v_project_id then
    perform private.refresh_public_project(v_new_source); end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function public.reserve_profile_image_upload(
  p_request_id uuid,p_expected_byte_size integer,p_filename text,p_declared_media_type text
)
returns table(asset_id uuid,avatar_version_id uuid,bucket text,object_path text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
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

create or replace function public.operator_complete_profile_avatar_cleanup(
  p_avatar_version_id uuid,p_lease_token uuid
)
returns void language plpgsql security definer set search_path='' as $$
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

-- Retention remains authoritative for avatars, deletion recovery, and
-- moderation metadata, but has no source/peak/snapshot subject type.
delete from private.retention_cleanup_objects o using private.retention_cleanup_jobs j
where o.job_id=j.id and j.subject_kind in ('asset','peak');
delete from private.retention_cleanup_jobs where subject_kind in ('asset','peak');
alter table private.retention_cleanup_jobs
  drop constraint retention_cleanup_jobs_rule_code_check,
  drop constraint retention_cleanup_jobs_subject_kind_check;
alter table private.retention_cleanup_jobs
  add constraint retention_cleanup_jobs_rule_code_check check(
    rule_code in ('avatar_superseded','deletion_expired_30d','moderation_metadata_180d')),
  add constraint retention_cleanup_jobs_subject_kind_check check(
    subject_kind in ('avatar','deletion','metadata'));

create or replace function private.avatar_retention_blocked(p_avatar_version_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.avatar_version_id=p_avatar_version_id)
    or exists(
      select 1 from public.profile_avatar_versions v join private.content_holds h
        on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp())
        and (h.target_asset_id=v.source_asset_id or h.target_profile_id=v.profile_id)
      where v.id=p_avatar_version_id)
$$;
revoke all on function private.avatar_retention_blocked(uuid) from public,anon,authenticated;

create or replace function private.hold_conflicts_authorized_retention(
  p_target_kind text,p_target_id uuid
)
returns boolean language sql stable security definer set search_path='' as $$
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

create or replace function public.operator_retention_preview(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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

create or replace function public.operator_start_retention_run(p_limit integer default 100)
returns uuid language plpgsql security definer set search_path='' as $$
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
