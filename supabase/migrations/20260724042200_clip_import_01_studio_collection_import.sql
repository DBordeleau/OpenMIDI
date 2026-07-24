-- CLIP-IMPORT-01: bounded Studio clip collection, exact preview, and atomic import.

create table private.studio_clip_import_receipts (
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  request_payload_sha256 text not null check (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_kind text check (source_kind in ('owned','saved')),
  source_pattern_id uuid references public.midi_patterns(id) on delete restrict,
  source_pattern_version_id uuid references public.midi_pattern_versions(id) on delete restrict,
  source_listing_id uuid references public.midi_library_listings(id) on delete restrict,
  source_creator_credit_name text,
  reuse_license_code text,
  reuse_license_version text,
  reuse_license_url text,
  external_credits jsonb check (external_credits is null or jsonb_typeof(external_credits)='array'),
  project_id uuid references public.projects(id) on delete restrict,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  contribution_id uuid references public.contributions(id) on delete restrict,
  track_id uuid,
  clip_id uuid,
  resulting_workspace_lock_version integer,
  resulting_manifest_sha256 text check (
    resulting_manifest_sha256 is null or resulting_manifest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  response jsonb check (response is null or jsonb_typeof(response)='object'),
  created_at timestamptz not null default statement_timestamp(),
  primary key(actor_id,request_id),
  check (
    (response is null and source_kind is null and source_pattern_id is null
      and source_pattern_version_id is null and project_id is null and workspace_id is null
      and track_id is null and clip_id is null and resulting_workspace_lock_version is null
      and resulting_manifest_sha256 is null)
    or
    (response is not null and source_kind is not null and source_pattern_id is not null
      and source_pattern_version_id is not null and source_creator_credit_name is not null
      and external_credits is not null and project_id is not null and workspace_id is not null
      and track_id is not null and clip_id is not null
      and resulting_workspace_lock_version is not null and resulting_manifest_sha256 is not null)
  ),
  check (
    source_kind is null
    or (source_kind='owned' and source_listing_id is null)
    or (source_kind='saved' and source_listing_id is not null
      and reuse_license_code='CC-BY-4.0' and reuse_license_version='4.0'
      and reuse_license_url='https://creativecommons.org/licenses/by/4.0/')
  )
);

comment on table private.studio_clip_import_receipts is
  'Private serialized CLIP-IMPORT-01 request/result authority. It preserves exact source provenance and makes workspace imports replay-safe without a public domain table.';

create index studio_clip_import_receipts_workspace_idx
  on private.studio_clip_import_receipts(workspace_id,created_at desc)
  where workspace_id is not null;

create or replace function private.resolve_studio_clip_preset(
  p_pattern_version_id uuid,
  p_actor uuid,
  p_listing_id uuid default null
) returns table(preset_id text,preset_version integer,preset_name text)
language sql stable security definer set search_path=''
as $$
  with candidates as (
    select lp.preset_id,lp.version,lp.display_name,0 priority,null::timestamptz used_at,lp.sort_order
    from public.midi_library_listings l
    join public.midi_library_presets lp
      on lp.preset_id=l.suggested_preset_id and lp.version=l.suggested_preset_version and lp.active
    join private.midi_synth_presets sp
      on sp.preset_id=lp.preset_id and sp.version=lp.version and sp.is_active
      and sp.engine_version='openmidi-midi-3_tone-15.1.22_presets-1'
    where l.id=p_listing_id and l.midi_pattern_version_id=p_pattern_version_id
      and not exists(
        select 1 from public.midi_pattern_notes n
        where n.midi_pattern_version_id=p_pattern_version_id
          and n.pitch not between sp.min_note and sp.max_note
      )
    union all
    select lp.preset_id,lp.version,lp.display_name,1,w.updated_at,lp.sort_order
    from public.workspace_clips wc
    join public.workspace_tracks wt
      on wt.workspace_id=wc.workspace_id and wt.track_id=wc.track_id
    join public.workspaces w on w.id=wc.workspace_id and w.owner_id=p_actor and w.status='active'
    join public.midi_library_presets lp
      on lp.preset_id=wt.preset_id and lp.version=wt.preset_version and lp.active
    join private.midi_synth_presets sp
      on sp.preset_id=lp.preset_id and sp.version=lp.version and sp.is_active
      and sp.engine_version='openmidi-midi-3_tone-15.1.22_presets-1'
    where wc.midi_pattern_version_id=p_pattern_version_id
      and not exists(
        select 1 from public.midi_pattern_notes n
        where n.midi_pattern_version_id=p_pattern_version_id
          and n.pitch not between sp.min_note and sp.max_note
      )
    union all
    select lp.preset_id,lp.version,lp.display_name,2,null::timestamptz,lp.sort_order
    from public.midi_library_presets lp
    join private.midi_synth_presets sp
      on sp.preset_id=lp.preset_id and sp.version=lp.version and sp.is_active
      and sp.engine_version='openmidi-midi-3_tone-15.1.22_presets-1'
    where lp.active and not exists(
      select 1 from public.midi_pattern_notes n
      where n.midi_pattern_version_id=p_pattern_version_id
        and n.pitch not between sp.min_note and sp.max_note
    )
  )
  select c.preset_id,c.version,c.display_name
  from candidates c
  order by c.priority,c.used_at desc nulls last,c.sort_order,c.preset_id,c.version
  limit 1
$$;

create or replace function private.get_studio_clip_authority(
  p_pattern_version_id uuid,
  p_actor uuid
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_pattern public.midi_patterns%rowtype;
  v_version public.midi_pattern_versions%rowtype;
  v_saved public.saved_midi_patterns%rowtype;
  v_listing public.midi_library_listings%rowtype;
  v_owner_profile public.profiles%rowtype;
  v_preset record;
  v_is_owned boolean:=false;
  v_is_saved boolean:=false;
  v_saved_availability text;
  v_saved_can_import boolean:=false;
  v_availability text;
  v_can_import boolean;
  v_source text;
begin
  select v.* into v_version from public.midi_pattern_versions v
  where v.id=p_pattern_version_id;
  if not found then return null; end if;
  select p.* into strict v_pattern from public.midi_patterns p
  where p.id=v_version.midi_pattern_id;
  v_is_owned:=v_pattern.owner_id=p_actor and v_pattern.deleted_at is null;

  select s.* into v_saved from public.saved_midi_patterns s
  where s.user_id=p_actor and s.midi_pattern_version_id=p_pattern_version_id;
  v_is_saved:=found;
  if v_is_saved then
    select l.* into v_listing from public.midi_library_listings l
    where l.id=v_saved.source_listing_id;
    if found then
      select p.* into v_owner_profile from public.profiles p where p.id=v_listing.owner_id;
    end if;
  end if;
  if not v_is_owned and not v_is_saved then return null; end if;

  select * into v_preset from private.resolve_studio_clip_preset(
    p_pattern_version_id,p_actor,case when v_is_saved then v_saved.source_listing_id else null end
  );

  if v_is_saved then
    v_saved_availability:=case
      when v_listing.id is null or v_listing.midi_pattern_id<>v_pattern.id
        or v_listing.midi_pattern_version_id<>p_pattern_version_id
        then 'source_unavailable'
      when v_listing.moderation_hidden_at is not null then 'moderation_hidden'
      when v_pattern.deleted_at is not null
        or v_owner_profile.id is null or v_owner_profile.status<>'active'
        or v_owner_profile.moderation_state<>'visible' or v_owner_profile.purged_at is not null
        then 'source_unavailable'
      when v_listing.reuse_mode<>'commercial_reuse' then 'reference_only'
      when v_version.reuse_license_code is distinct from 'CC-BY-4.0'
        or v_version.reuse_license_version is distinct from '4.0'
        or v_version.reuse_license_url is distinct from 'https://creativecommons.org/licenses/by/4.0/'
        then 'license_unavailable'
      when not exists(
        select 1
        from public.midi_library_presets lp
        join private.midi_synth_presets sp
          on sp.preset_id=lp.preset_id and sp.version=lp.version and sp.is_active
          and sp.engine_version='openmidi-midi-3_tone-15.1.22_presets-1'
        where lp.preset_id=v_listing.suggested_preset_id
          and lp.version=v_listing.suggested_preset_version and lp.active
          and not exists(
            select 1 from public.midi_pattern_notes n
            where n.midi_pattern_version_id=p_pattern_version_id
              and n.pitch not between sp.min_note and sp.max_note
          )
      ) then 'preset_unavailable'
      when v_listing.unlisted_at is not null then 'unlisted'
      else 'available'
    end;
    v_saved_can_import:=v_saved_availability in ('available','unlisted');
  end if;

  v_source:=case when v_is_owned then 'owned' else 'saved' end;
  v_availability:=case
    when v_is_owned and v_preset.preset_id is null then 'preset_unavailable'
    when v_is_owned then 'available'
    else v_saved_availability
  end;
  v_can_import:=case when v_is_owned then v_preset.preset_id is not null else v_saved_can_import end;

  return jsonb_strip_nulls(jsonb_build_object(
    'patternId',v_pattern.id,
    'patternVersionId',v_version.id,
    'patternName',v_pattern.name,
    'versionNumber',v_version.version_number,
    'creatorId',v_version.creator_id,
    'creatorCreditName',v_version.creator_credit_name,
    'durationTicks',v_version.duration_ticks,
    'noteCount',v_version.note_count,
    'createdAt',v_version.created_at,
    'hasLineage',v_pattern.source_pattern_version_id is not null
      or v_version.parent_pattern_version_id is not null
      or v_version.source_pattern_version_id is not null,
    'source',v_source,
    'isOwned',v_is_owned,
    'isSaved',v_is_saved,
    'savedListingId',case when v_is_saved then v_saved.source_listing_id end,
    'savedAt',case when v_is_saved then v_saved.created_at end,
    'savedAvailability',v_saved_availability,
    'savedCanImport',case when v_is_saved then v_saved_can_import end,
    'availability',v_availability,
    'canImport',v_can_import,
    'preset',case when v_preset.preset_id is null then null else jsonb_build_object(
      'id',v_preset.preset_id,'version',v_preset.preset_version,'name',v_preset.preset_name
    ) end,
    'reuseLicense',case
      when v_version.reuse_license_code='CC-BY-4.0'
        and v_version.reuse_license_version='4.0'
        and v_version.reuse_license_url='https://creativecommons.org/licenses/by/4.0/'
      then jsonb_build_object('code',v_version.reuse_license_code,
        'version',v_version.reuse_license_version,'url',v_version.reuse_license_url)
      else null end
  ));
end $$;

create or replace function public.list_studio_clip_collection(
  p_source text default 'all',
  p_query text default null,
  p_limit integer default 100
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_query text:=nullif(btrim(p_query),'');
  v_result jsonb;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message='studio_clip_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='studio_clip_actor_ineligible';
  end if;
  if p_source is null or p_source not in ('all','owned','saved')
    or (v_query is not null and char_length(v_query)>80)
    or p_limit is null or p_limit not between 1 and 100 then
    raise sqlstate '22023' using message='studio_clip_collection_invalid';
  end if;

  with candidates as (
    select v.id,
      greatest(v.created_at,coalesce(s.created_at,'-infinity'::timestamptz)) sort_at
    from public.midi_pattern_versions v
    join public.midi_patterns p on p.id=v.midi_pattern_id
    left join public.saved_midi_patterns s
      on s.user_id=v_actor and s.midi_pattern_version_id=v.id
    where (
      (p_source in ('all','owned') and p.owner_id=v_actor and p.deleted_at is null)
      or (p_source in ('all','saved') and s.user_id is not null)
    )
      and (v_query is null or p.name ilike '%'||v_query||'%'
        or v.creator_credit_name ilike '%'||v_query||'%')
    order by sort_at desc,v.id desc
    limit p_limit
  ), projected as (
    select c.id,c.sort_at,private.get_studio_clip_authority(c.id,v_actor) item
    from candidates c
  )
  select jsonb_build_object('items',coalesce(jsonb_agg(p.item order by p.sort_at desc,p.id desc),'[]'::jsonb))
  into v_result from projected p where p.item is not null;
  return v_result;
end $$;

create or replace function public.get_studio_clip_detail(
  p_pattern_version_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_authority jsonb;
  v_version public.midi_pattern_versions%rowtype;
  v_credits jsonb;
  v_notes jsonb;
  v_listing_id uuid;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message='studio_clip_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='studio_clip_actor_ineligible';
  end if;
  v_authority:=private.get_studio_clip_authority(p_pattern_version_id,v_actor);
  if v_authority is null then
    raise sqlstate 'PT404' using message='studio_clip_source_unavailable';
  end if;
  if not (v_authority->>'canImport')::boolean then
    return jsonb_build_object('metadata',v_authority,'pattern',null,'externalCredits','[]'::jsonb);
  end if;

  select v.* into strict v_version from public.midi_pattern_versions v
  where v.id=p_pattern_version_id;
  v_listing_id:=(v_authority->>'savedListingId')::uuid;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,
    'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,
    'attributionNote',ec.attribution_note
  )) order by ec.position),'[]'::jsonb) into v_credits
  from public.midi_pattern_external_credits ec
  where ec.midi_pattern_version_id=p_pattern_version_id
    and (
      ((v_authority->>'source')='saved' and ec.listing_id=v_listing_id)
      or ((v_authority->>'source')='owned' and (
        ec.listing_id is null
        or (
          not exists(
            select 1 from public.midi_pattern_external_credits inherited
            where inherited.midi_pattern_version_id=p_pattern_version_id
              and inherited.listing_id is null
          )
          and ec.listing_id=(
            select l.id from public.midi_library_listings l
            where l.midi_pattern_version_id=p_pattern_version_id
            order by l.listed_at desc,l.id desc limit 1
          )
        )
      ))
    );
  select coalesce(jsonb_agg(jsonb_build_object(
    'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,
    'pitch',n.pitch,'velocity',n.velocity
  ) order by n.start_tick,n.pitch,n.note_id),'[]'::jsonb) into v_notes
  from public.midi_pattern_notes n where n.midi_pattern_version_id=p_pattern_version_id;

  return jsonb_build_object(
    'metadata',v_authority,
    'externalCredits',v_credits,
    'pattern',jsonb_build_object(
      'midiPatternVersionId',v_version.id,
      'midiPatternId',v_version.midi_pattern_id,
      'version',v_version.version_number,
      'creatorId',v_version.creator_id,
      'creatorCreditName',v_version.creator_credit_name,
      'parentMidiPatternVersionId',v_version.parent_pattern_version_id,
      'sourceMidiPatternVersionId',v_version.source_pattern_version_id,
      'contentSha256',v_version.content_sha256,
      'noteCount',v_version.note_count,
      'ppq',v_version.ppq,
      'durationTicks',v_version.duration_ticks,
      'reuseLicense',v_authority->'reuseLicense',
      'createdAt',v_version.created_at,
      'notes',v_notes,
      'name',v_authority->>'patternName',
      'presetId',v_authority->'preset'->>'id',
      'presetVersion',(v_authority->'preset'->>'version')::integer
    )
  );
end $$;

create or replace function public.import_studio_clip(
  p_pattern_version_id uuid,
  p_source text,
  p_workspace_id uuid,
  p_request_id uuid,
  p_expected_workspace_lock_version integer,
  p_start_tick integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_payload_hash text;
  v_inserted integer;
  v_receipt private.studio_clip_import_receipts%rowtype;
  v_authority jsonb;
  v_version public.midi_pattern_versions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_project public.projects%rowtype;
  v_track_id uuid:=gen_random_uuid();
  v_clip_id uuid:=gen_random_uuid();
  v_track jsonb;
  v_manifest jsonb;
  v_manifest_hash text;
  v_notes jsonb;
  v_credits jsonb;
  v_pattern jsonb;
  v_response jsonb;
  v_listing_id uuid;
  v_max_duration bigint;
  v_existing_note_count integer;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message='studio_clip_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='studio_clip_actor_ineligible';
  end if;
  if p_request_id is null or p_pattern_version_id is null or p_workspace_id is null
    or p_source is null or p_source not in ('owned','saved')
    or p_expected_workspace_lock_version is null or p_expected_workspace_lock_version<1 then
    raise sqlstate '22023' using message='studio_clip_import_invalid';
  end if;
  if p_start_tick is null or p_start_tick<0 or p_start_tick>86400000 then
    raise sqlstate '22023' using message='studio_clip_invalid_start_tick';
  end if;
  v_payload_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'patternVersionId',p_pattern_version_id,'source',p_source,'workspaceId',p_workspace_id,
    'expectedWorkspaceLockVersion',p_expected_workspace_lock_version,'startTick',p_start_tick
  )::text,'UTF8'),'sha256'),'hex');

  insert into private.studio_clip_import_receipts(actor_id,request_id,request_payload_sha256)
  values(v_actor,p_request_id,v_payload_hash)
  on conflict(actor_id,request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select r.* into strict v_receipt from private.studio_clip_import_receipts r
    where r.actor_id=v_actor and r.request_id=p_request_id;
    if v_receipt.request_payload_sha256<>v_payload_hash then
      raise sqlstate 'PT409' using message='studio_clip_import_request_mismatch';
    end if;
    if v_receipt.response is null then
      raise sqlstate 'PT409' using message='studio_clip_import_request_incomplete';
    end if;
    return v_receipt.response;
  end if;

  v_authority:=private.get_studio_clip_authority(p_pattern_version_id,v_actor);
  if v_authority is null or (p_source='owned' and not (v_authority->>'isOwned')::boolean) then
    raise sqlstate 'PT404' using message='studio_clip_source_unavailable';
  end if;
  if p_source='saved' and (
    not coalesce((v_authority->>'isSaved')::boolean,false)
    or not coalesce((v_authority->>'savedCanImport')::boolean,false)
  ) then
    raise sqlstate 'PT409' using message='studio_clip_saved_source_unavailable';
  end if;
  if not (v_authority->>'canImport')::boolean then
    raise sqlstate 'PT409' using message='studio_clip_source_unavailable';
  end if;

  select v.* into strict v_version from public.midi_pattern_versions v
  where v.id=p_pattern_version_id;
  if p_source='saved' then
    insert into private.midi_library_reuse_access(
      actor_id,midi_pattern_version_id,source_listing_id
    ) values(v_actor,v_version.id,(v_authority->>'savedListingId')::uuid)
    on conflict(actor_id,midi_pattern_version_id) do nothing;
  end if;
  select w.* into v_workspace from public.workspaces w
  where w.id=p_workspace_id and w.owner_id=v_actor and w.status='active'
    and w.manifest_version=3 and w.engine='openmidi-midi'
    and w.engine_version='openmidi-midi-3_tone-15.1.22_presets-1'
  for update;
  if not found then
    raise sqlstate 'PT404' using message='studio_clip_workspace_unavailable';
  end if;
  select p.* into v_project from public.projects p where p.id=v_workspace.project_id;
  if v_workspace.contribution_id is null then
    if v_project.owner_id<>v_actor or v_project.status not in ('draft','active')
      or v_project.deleted_at is not null then
      raise sqlstate 'PT404' using message='studio_clip_workspace_unavailable';
    end if;
  elsif not exists(
    select 1 from public.contributions c
    where c.id=v_workspace.contribution_id and c.project_id=v_workspace.project_id
      and c.author_id=v_actor and c.status in ('draft','changes_requested')
      and c.deleted_at is null and c.purged_at is null and c.moderation_state='visible'
  ) then
    raise sqlstate 'PT404' using message='studio_clip_workspace_unavailable';
  end if;
  if v_workspace.lock_version<>p_expected_workspace_lock_version then
    raise sqlstate 'PT409' using message='studio_clip_workspace_stale';
  end if;
  if jsonb_array_length(v_workspace.manifest->'tracks')>=16 then
    raise sqlstate 'PT409' using message='studio_clip_track_limit';
  end if;
  select coalesce(sum(v.note_count),0)::integer into v_existing_note_count
  from public.midi_pattern_versions v
  join public.workspace_clips wc on wc.midi_pattern_version_id=v.id
  where wc.workspace_id=v_workspace.id;
  if v_existing_note_count+v_version.note_count>16384 then
    raise sqlstate 'PT409' using message='studio_clip_note_limit';
  end if;
  v_max_duration:=least(86400000::bigint,floor(
    600*(v_workspace.manifest->>'tempoBpm')::numeric*480
  )::bigint);
  if p_start_tick::bigint+v_version.duration_ticks::bigint>v_max_duration then
    raise sqlstate '22023' using message='studio_clip_invalid_start_tick';
  end if;

  v_track:=jsonb_build_object(
    'trackId',v_track_id,
    'sortOrder',jsonb_array_length(v_workspace.manifest->'tracks'),
    'name',v_authority->>'patternName',
    'presetId',v_authority->'preset'->>'id',
    'presetVersion',(v_authority->'preset'->>'version')::integer,
    'gainDb',-6,'pan',0,'muted',false,'soloed',false,
    'clips',jsonb_build_array(jsonb_build_object(
      'clipId',v_clip_id,'midiPatternVersionId',v_version.id,'startTick',p_start_tick,
      'durationTicks',v_version.duration_ticks,'sourceStartTick',0,'loop',false
    ))
  );
  v_manifest:=jsonb_set(v_workspace.manifest,'{durationTicks}',to_jsonb(greatest(
    (v_workspace.manifest->>'durationTicks')::integer,p_start_tick+v_version.duration_ticks
  )));
  v_manifest:=jsonb_set(v_manifest,'{tracks}',(v_manifest->'tracks')||jsonb_build_array(v_track));
  v_manifest:=private.canonical_manifest_v3(v_manifest,v_workspace.project_id,v_workspace.id);
  v_manifest_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  perform private.replace_workspace_projection_v3(v_workspace.id,v_manifest);
  update public.workspaces w set manifest=v_manifest,manifest_sha256=v_manifest_hash,
    lock_version=w.lock_version+1,last_manifest_request_id=p_request_id,
    last_manifest_expected_lock_version=p_expected_workspace_lock_version,
    updated_at=statement_timestamp()
  where w.id=v_workspace.id returning w.* into v_workspace;
  insert into private.workspace_snapshots(
    workspace_id,project_id,owner_id,request_id,lock_version,manifest,manifest_sha256
  ) values(
    v_workspace.id,v_workspace.project_id,v_actor,p_request_id,v_workspace.lock_version,
    v_manifest,v_manifest_hash
  );
  delete from private.workspace_snapshots s where s.workspace_id=v_workspace.id and s.id in (
    select s2.id from private.workspace_snapshots s2 where s2.workspace_id=v_workspace.id
    order by s2.lock_version desc offset 20
  );

  v_listing_id:=case when p_source='saved' then (v_authority->>'savedListingId')::uuid end;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,
    'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,
    'attributionNote',ec.attribution_note
  )) order by ec.position),'[]'::jsonb) into v_credits
  from public.midi_pattern_external_credits ec
  where ec.midi_pattern_version_id=v_version.id
    and ((p_source='saved' and ec.listing_id=v_listing_id)
      or (p_source='owned' and (
        ec.listing_id is null
        or (
          not exists(
            select 1 from public.midi_pattern_external_credits inherited
            where inherited.midi_pattern_version_id=v_version.id
              and inherited.listing_id is null
          )
          and ec.listing_id=(
            select l.id from public.midi_library_listings l
            where l.midi_pattern_version_id=v_version.id
            order by l.listed_at desc,l.id desc limit 1
          )
        )
      )));
  select coalesce(jsonb_agg(jsonb_build_object(
    'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,
    'pitch',n.pitch,'velocity',n.velocity
  ) order by n.start_tick,n.pitch,n.note_id),'[]'::jsonb) into v_notes
  from public.midi_pattern_notes n where n.midi_pattern_version_id=v_version.id;
  v_pattern:=jsonb_build_object(
    'midiPatternVersionId',v_version.id,'midiPatternId',v_version.midi_pattern_id,
    'version',v_version.version_number,'creatorId',v_version.creator_id,
    'creatorCreditName',v_version.creator_credit_name,
    'parentMidiPatternVersionId',v_version.parent_pattern_version_id,
    'sourceMidiPatternVersionId',v_version.source_pattern_version_id,
    'contentSha256',v_version.content_sha256,'noteCount',v_version.note_count,
    'ppq',v_version.ppq,'durationTicks',v_version.duration_ticks,
    'reuseLicense',v_authority->'reuseLicense','createdAt',v_version.created_at,
    'notes',v_notes,'name',v_authority->>'patternName',
    'presetId',v_authority->'preset'->>'id',
    'presetVersion',(v_authority->'preset'->>'version')::integer
  );
  v_response:=jsonb_build_object(
    'source',jsonb_build_object(
      'kind',p_source,'savedListingId',v_listing_id,'externalCredits',v_credits
    ),
    'projectId',v_workspace.project_id,
    'workspaceId',v_workspace.id,
    'contributionId',v_workspace.contribution_id,
    'lockVersion',v_workspace.lock_version,
    'manifestSha256',v_manifest_hash,
    'manifest',v_manifest,
    'trackId',v_track_id,
    'clipId',v_clip_id,
    'importedPattern',v_pattern
  );
  update private.studio_clip_import_receipts r set
    source_kind=p_source,
    source_pattern_id=v_version.midi_pattern_id,
    source_pattern_version_id=v_version.id,
    source_listing_id=v_listing_id,
    source_creator_credit_name=v_version.creator_credit_name,
    reuse_license_code=case when p_source='saved' then v_version.reuse_license_code end,
    reuse_license_version=case when p_source='saved' then v_version.reuse_license_version end,
    reuse_license_url=case when p_source='saved' then v_version.reuse_license_url end,
    external_credits=v_credits,
    project_id=v_workspace.project_id,
    workspace_id=v_workspace.id,
    contribution_id=v_workspace.contribution_id,
    track_id=v_track_id,
    clip_id=v_clip_id,
    resulting_workspace_lock_version=v_workspace.lock_version,
    resulting_manifest_sha256=v_manifest_hash,
    response=v_response
  where r.actor_id=v_actor and r.request_id=p_request_id;
  return v_response;
end $$;

revoke all on table private.studio_clip_import_receipts from public,anon,authenticated;
revoke all on function private.resolve_studio_clip_preset(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.get_studio_clip_authority(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_studio_clip_collection(text,text,integer) from public,anon;
grant execute on function public.list_studio_clip_collection(text,text,integer) to authenticated;
revoke all on function public.get_studio_clip_detail(uuid) from public,anon;
grant execute on function public.get_studio_clip_detail(uuid) to authenticated;
revoke all on function public.import_studio_clip(uuid,text,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.import_studio_clip(uuid,text,uuid,uuid,integer,integer) to authenticated;
