alter table public.projects
  add column rights_attestation_version text,
  add constraint projects_rights_attestation_version_check
    check (
      rights_attestation_version is null
      or rights_attestation_version = 'cc-by-4.0-reuse-attestation-v1'
    );

create or replace function public.submit_contribution_v3(
  p_contribution_id uuid,p_request_id uuid,p_expected_workspace_lock_version integer,
  p_expected_base_revision_id uuid,p_expected_manifest_sha256 text,p_attestation_version text
) returns table(contribution_id uuid,contribution_version_id uuid,version_number integer,
  arrangement_version_id uuid,status public.contribution_status,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype; v_project public.projects%rowtype;
  v_existing public.contribution_versions%rowtype;
  v_arrangement public.arrangement_versions%rowtype; v_version public.contribution_versions%rowtype;
  v_arrangement_id uuid; v_number integer; v_duration_ms integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  select * into v_contribution from public.contributions where id=p_contribution_id and author_id=v_actor for update;
  if not found then
    raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_workspace from public.workspaces w where w.contribution_id=p_contribution_id
    and w.owner_id=v_actor and w.status='active' for update;
  if not found or v_workspace.manifest_version<>3 then
    raise sqlstate 'PT404' using message='contribution_workspace_not_found'; end if;
  select * into v_existing from public.contribution_versions cv
    where cv.contribution_id=p_contribution_id and cv.submission_request_id=p_request_id;
  if found then
    if v_workspace.lock_version<>p_expected_workspace_lock_version
      or v_workspace.base_revision_id<>p_expected_base_revision_id
      or v_workspace.manifest_sha256<>p_expected_manifest_sha256
      or v_existing.base_revision_id<>p_expected_base_revision_id
      or v_existing.attestation_version<>p_attestation_version then
      raise sqlstate 'PT409' using message='contribution_submission_request_conflict';
    end if;
    return query select v_contribution.id,v_existing.id,v_existing.version_number,
      v_existing.arrangement_version_id,v_contribution.status,v_contribution.submitted_at; return;
  end if;
  select * into v_project from public.projects p where p.id=v_contribution.project_id
    and p.deleted_at is null and p.moderation_state='visible' for update;
  if not found then raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if v_project.license_code<>'cc-by-4.0' then
    raise sqlstate 'PT409' using message='contribution_license_unavailable'; end if;
  if v_project.current_revision_id<>p_expected_base_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if not v_project.open_to_contributions then
    raise sqlstate 'PT409' using message='contribution_submissions_closed'; end if;
  if v_contribution.status not in ('draft','changes_requested') then
    raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  if v_workspace.lock_version<>p_expected_workspace_lock_version
    or v_workspace.base_revision_id<>p_expected_base_revision_id
    or v_workspace.manifest_sha256<>p_expected_manifest_sha256
    or v_contribution.base_revision_id<>p_expected_base_revision_id
    or p_attestation_version<>'contributor-attestation-v1' then
    raise sqlstate 'PT409' using message='contribution_submission_conflict'; end if;
  v_arrangement_id:=private.freeze_workspace_arrangement_v3(v_workspace.id,p_request_id,v_actor);
  select * into strict v_arrangement from public.arrangement_versions where id=v_arrangement_id;
  select coalesce(max(cv.version_number)+1,1) into v_number from public.contribution_versions cv
    where cv.contribution_id=p_contribution_id;
  v_duration_ms:=ceil(v_arrangement.duration_ticks*60000.0/(v_arrangement.tempo_bpm*v_arrangement.ppq));
  insert into public.contribution_versions(contribution_id,project_id,version_number,submission_request_id,
    base_revision_id,snapshot_asset_id,workspace_lock_version,manifest,manifest_version,engine,engine_version,
    manifest_sha256,duration_ms,attestation_version,created_by,arrangement_version_id)
  values(v_contribution.id,v_contribution.project_id,v_number,p_request_id,v_contribution.base_revision_id,
    null,v_workspace.lock_version,v_arrangement.manifest,3,'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1',v_arrangement.manifest_sha256,v_duration_ms,
    p_attestation_version,v_actor,v_arrangement.id) returning * into v_version;
  update public.contributions set status='submitted',current_version_id=v_version.id,
    submitted_at=statement_timestamp(),withdrawn_at=null,reviewed_at=null,reviewed_by=null,
    review_note=null,updated_at=statement_timestamp() where id=v_contribution.id returning * into v_contribution;
  return query select v_contribution.id,v_version.id,v_version.version_number,v_version.arrangement_version_id,
    v_contribution.status,v_contribution.submitted_at;
end;
$$;

revoke all on function public.fork_project_v3(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
drop function public.fork_project_v3(uuid,uuid,uuid,text,text,text);

create function public.fork_project_v3(
  p_source_project_id uuid,p_source_revision_id uuid,p_request_id uuid,
  p_expected_license_code text,p_rights_attestation_version text,p_title text,p_description text
) returns table(project_id uuid,revision_id uuid,arrangement_version_id uuid,workspace_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_source public.projects%rowtype;
  v_source_revision public.project_revisions%rowtype; v_source_arrangement public.arrangement_versions%rowtype;
  v_existing public.projects%rowtype; v_target public.projects%rowtype;
  v_arrangement public.arrangement_versions%rowtype; v_revision public.project_revisions%rowtype;
  v_workspace public.workspaces%rowtype; v_manifest jsonb; v_workspace_manifest jsonb;
  v_hash text; v_title text:=btrim(p_title); v_description text:=nullif(btrim(p_description),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='fork_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='fork_actor_ineligible'; end if;
  select * into v_existing from public.projects p where p.owner_id=v_actor and p.create_request_id=p_request_id;
  if found then
    if v_existing.source_project_id<>p_source_project_id or v_existing.source_revision_id<>p_source_revision_id
      or v_existing.title<>v_title or v_existing.description is distinct from v_description
      or v_existing.rights_attestation_version is distinct from p_rights_attestation_version
      or p_expected_license_code<>'cc-by-4.0' then
      raise sqlstate 'PT409' using message='fork_request_conflict'; end if;
    select * into v_revision from public.project_revisions r where r.project_id=v_existing.id and r.revision_number=1;
    select * into v_workspace from public.workspaces w where w.project_id=v_existing.id and w.owner_id=v_actor and w.status='active';
    return query select v_existing.id,v_revision.id,v_revision.arrangement_version_id,v_workspace.id,v_existing.created_at; return;
  end if;
  if p_request_id is null or v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description)>5000)
    or p_rights_attestation_version<>'cc-by-4.0-reuse-attestation-v1' then
    raise sqlstate '22023' using message='fork_invalid_input'; end if;
  select * into v_source from public.projects where id=p_source_project_id and visibility='public'
    and status='active' and deleted_at is null and moderation_state='visible' for update;
  if not found or v_source.license_code<>'cc-by-4.0' or p_expected_license_code<>'cc-by-4.0' then
    raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  select * into v_source_revision from public.project_revisions r where r.project_id=v_source.id
    and r.id=p_source_revision_id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  select * into v_source_arrangement from public.arrangement_versions a where a.id=v_source_revision.arrangement_version_id;
  insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,compatibility,source_project_id,
    source_revision_id,rights_attestation_version)
  values(v_actor,p_request_id,v_title,v_description,v_source_arrangement.tempo_bpm,v_source_arrangement.musical_key,
    v_source_arrangement.time_signature_numerator,v_source_arrangement.time_signature_denominator,
    'cc-by-4.0','midi',v_source.id,v_source_revision.id,p_rights_attestation_version) returning * into v_target;
  insert into public.project_members(project_id,user_id,role,created_by)
    values(v_target.id,v_actor,'owner',v_actor);
  insert into public.project_genres(project_id,genre_id,is_primary)
    select v_target.id,pg.genre_id,pg.is_primary from public.project_genres pg where pg.project_id=v_source.id;
  insert into public.project_tags(project_id,tag_id)
    select v_target.id,pt.tag_id from public.project_tags pt where pt.project_id=v_source.id;
  v_manifest:=jsonb_set(v_source_arrangement.manifest,'{projectId}',to_jsonb(v_target.id));
  v_manifest:=private.canonical_manifest_v3(v_manifest,v_target.id,null);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.arrangement_versions(project_id,created_by,create_request_id,manifest_version,engine,
    engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,
    musical_key,ppq,duration_ticks)
  values(v_target.id,v_actor,p_request_id,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    v_manifest,v_hash,v_source_arrangement.tempo_bpm,v_source_arrangement.time_signature_numerator,
    v_source_arrangement.time_signature_denominator,v_source_arrangement.musical_key,480,
    v_source_arrangement.duration_ticks) returning * into v_arrangement;
  insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,
    preset_version,gain_db,pan,muted,soloed)
  select v_arrangement.id,v_target.id,t.track_id,t.sort_order,t.name,t.preset_id,t.preset_version,
    t.gain_db,t.pan,t.muted,t.soloed
    from public.arrangement_tracks t where t.arrangement_version_id=v_source_arrangement.id;
  insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,
    midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop)
  select v_arrangement.id,v_target.id,c.track_id,c.clip_id,c.midi_pattern_version_id,c.start_tick,
    c.duration_ticks,c.source_start_tick,c.loop from public.arrangement_clips c
    where c.arrangement_version_id=v_source_arrangement.id;
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,publish_request_id,
    expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,
    snapshot_asset_id,arrangement_version_id)
  values(v_target.id,1,null,v_actor,p_request_id,null,'Forked from revision '||v_source_revision.revision_number,
    v_manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',v_hash,
    ceil(v_arrangement.duration_ticks*60000.0/(v_arrangement.tempo_bpm*480)),null,v_arrangement.id)
  returning * into v_revision;
  update public.projects set current_revision_id=v_revision.id,status='active',published_at=statement_timestamp(),
    lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_target.id returning * into v_target;
  v_workspace_manifest:=v_manifest||jsonb_build_object('workspaceId',gen_random_uuid());
  insert into public.workspaces(id,project_id,owner_id,create_request_id,base_revision_id,manifest,manifest_version,
    engine,engine_version,manifest_sha256,status)
  values((v_workspace_manifest->>'workspaceId')::uuid,v_target.id,v_actor,p_request_id,v_revision.id,
    v_workspace_manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    encode(extensions.digest(convert_to(v_workspace_manifest::text,'UTF8'),'sha256'),'hex'),'active')
  returning * into v_workspace;
  perform private.replace_workspace_projection_v3(v_workspace.id,v_workspace_manifest);
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_target.id,v_revision.id,'project_forked',jsonb_build_object('revisionNumber',1));
  return query select v_target.id,v_revision.id,v_arrangement.id,v_workspace.id,v_target.created_at;
end;
$$;

revoke all on function public.fork_project_v3(uuid,uuid,uuid,text,text,text,text)
  from public,anon;
grant execute on function public.fork_project_v3(uuid,uuid,uuid,text,text,text,text)
  to authenticated;
