-- MIDI-05: MIDI-capable projects, normalized v2 project clips, immutable
-- publication, and a public-safe current-revision preview contract.

alter table public.projects add column compatibility text;
update public.projects set compatibility = 'legacy_hybrid';
alter table public.projects
  alter column compatibility set default 'midi',
  alter column compatibility set not null,
  add constraint projects_compatibility_check
    check (compatibility in ('midi', 'legacy_hybrid'));

alter table public.workspaces
  drop constraint workspaces_manifest_version_check,
  drop constraint workspaces_engine_check,
  drop constraint workspaces_engine_version_check,
  add constraint workspaces_manifest_runtime_check check (
    (manifest_version = 1 and engine = 'waveform-playlist'
      and engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22')
    or
    (manifest_version = 2 and engine = 'jam-session-composite'
      and engine_version = 'jam-session-composite-2_tone-15.1.22')
  ),
  add column last_manifest_request_id uuid,
  add column last_manifest_expected_lock_version integer
    check (last_manifest_expected_lock_version > 0),
  add constraint workspaces_last_manifest_request_shape check (
    (last_manifest_request_id is null) =
      (last_manifest_expected_lock_version is null)
  );

alter table public.project_revisions
  drop constraint project_revisions_manifest_version_check,
  drop constraint project_revisions_engine_check,
  drop constraint project_revisions_engine_version_check,
  add constraint project_revisions_manifest_runtime_check check (
    (manifest_version = 1 and engine = 'waveform-playlist'
      and engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22')
    or
    (manifest_version = 2 and engine = 'jam-session-composite'
      and engine_version = 'jam-session-composite-2_tone-15.1.22')
  );

alter table public.workspace_tracks
  drop constraint workspace_tracks_workspace_id_sort_order_key,
  drop constraint workspace_tracks_sort_order_check,
  alter column asset_id drop not null,
  add column kind text not null default 'audio',
  add column preset_id text,
  add column preset_version integer,
  add constraint workspace_tracks_sort_order_check check(sort_order between 0 and 27),
  add constraint workspace_tracks_kind_check check (
    (kind = 'audio' and asset_id is not null and preset_id is null and preset_version is null)
    or
    (kind = 'midi' and asset_id is null and instrument_id is null
      and preset_id is not null and preset_version is not null)
  ),
  add constraint workspace_tracks_preset_fk foreign key(preset_id, preset_version)
    references private.midi_synth_presets(preset_id, version) on delete restrict,
  add constraint workspace_tracks_workspace_order_uq unique(workspace_id, sort_order);
alter table public.revision_tracks
  drop constraint revision_tracks_revision_id_sort_order_key,
  drop constraint revision_tracks_sort_order_check,
  alter column asset_id drop not null,
  add column kind text not null default 'audio',
  add column preset_id text,
  add column preset_version integer,
  add constraint revision_tracks_sort_order_check check(sort_order between 0 and 27),
  add constraint revision_tracks_kind_check check (
    (kind = 'audio' and asset_id is not null and preset_id is null and preset_version is null)
    or
    (kind = 'midi' and asset_id is null and instrument_id is null
      and preset_id is not null and preset_version is not null)
  ),
  add constraint revision_tracks_preset_fk foreign key(preset_id, preset_version)
    references private.midi_synth_presets(preset_id, version) on delete restrict,
  add constraint revision_tracks_revision_order_uq unique(revision_id, sort_order);

create table public.workspace_clips (
  workspace_id uuid not null,
  track_id uuid not null,
  clip_id uuid not null,
  kind text not null check(kind in ('audio','midi')),
  position_ms integer,
  trim_start_ms integer,
  duration_ms integer,
  midi_stem_version_id uuid references public.midi_stem_versions(id) on delete restrict,
  start_tick integer,
  duration_ticks integer,
  source_start_tick integer,
  loop boolean,
  primary key(workspace_id, clip_id),
  foreign key(workspace_id, track_id)
    references public.workspace_tracks(workspace_id, track_id) on delete cascade,
  check (
    (kind='audio' and position_ms >= 0 and trim_start_ms >= 0 and duration_ms > 0
      and midi_stem_version_id is null and start_tick is null
      and duration_ticks is null and source_start_tick is null and loop is null)
    or
    (kind='midi' and position_ms is null and trim_start_ms is null and duration_ms is null
      and midi_stem_version_id is not null and start_tick >= 0
      and duration_ticks > 0 and source_start_tick >= 0 and loop is not null)
  )
);
create index workspace_clips_track_idx on public.workspace_clips(workspace_id, track_id);
create index workspace_clips_stem_version_idx on public.workspace_clips(midi_stem_version_id)
  where midi_stem_version_id is not null;

create table public.revision_clips (
  revision_id uuid not null,
  track_id uuid not null,
  clip_id uuid not null,
  kind text not null check(kind in ('audio','midi')),
  position_ms integer,
  trim_start_ms integer,
  duration_ms integer,
  midi_stem_version_id uuid references public.midi_stem_versions(id) on delete restrict,
  start_tick integer,
  duration_ticks integer,
  source_start_tick integer,
  loop boolean,
  primary key(revision_id, clip_id),
  foreign key(revision_id, track_id)
    references public.revision_tracks(revision_id, id) on delete restrict,
  check (
    (kind='audio' and position_ms >= 0 and trim_start_ms >= 0 and duration_ms > 0
      and midi_stem_version_id is null and start_tick is null
      and duration_ticks is null and source_start_tick is null and loop is null)
    or
    (kind='midi' and position_ms is null and trim_start_ms is null and duration_ms is null
      and midi_stem_version_id is not null and start_tick >= 0
      and duration_ticks > 0 and source_start_tick >= 0 and loop is not null)
  )
);
create index revision_clips_track_idx on public.revision_clips(revision_id, track_id);
create index revision_clips_stem_version_idx on public.revision_clips(midi_stem_version_id)
  where midi_stem_version_id is not null;

create table public.revision_midi_track_credits (
  revision_id uuid not null,
  track_id uuid not null,
  midi_stem_version_id uuid not null references public.midi_stem_versions(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  creator_credit_name text not null check(
    creator_credit_name=btrim(creator_credit_name)
    and char_length(creator_credit_name) between 1 and 120
  ),
  created_at timestamptz not null default statement_timestamp(),
  primary key(revision_id, track_id, midi_stem_version_id),
  foreign key(revision_id, track_id)
    references public.revision_tracks(revision_id, id) on delete restrict
);
create index revision_midi_track_credits_creator_idx
  on public.revision_midi_track_credits(creator_id);

create trigger revision_clips_immutable before update or delete on public.revision_clips
  for each row execute function private.reject_immutable_change();
create trigger revision_midi_track_credits_immutable
  before update or delete on public.revision_midi_track_credits
  for each row execute function private.reject_immutable_change();

alter table public.workspace_clips enable row level security;
alter table public.revision_clips enable row level security;
alter table public.revision_midi_track_credits enable row level security;
revoke all on public.workspace_clips, public.revision_clips,
  public.revision_midi_track_credits from public, anon, authenticated;
grant select on public.workspace_clips, public.revision_clips,
  public.revision_midi_track_credits to authenticated;
create policy own_workspace_clips_read on public.workspace_clips for select to authenticated
using ((select private.is_active_project_actor()) and exists (
  select 1 from public.workspaces w where w.id=workspace_id
    and w.owner_id=(select auth.uid())
));
create policy member_revision_clips_read on public.revision_clips for select to authenticated
using ((select private.is_active_project_actor()) and exists (
  select 1 from public.project_revisions r where r.id=revision_id
    and (select private.is_project_member(r.project_id))
));
create policy member_revision_midi_credits_read
on public.revision_midi_track_credits for select to authenticated
using ((select private.is_active_project_actor()) and exists (
  select 1 from public.project_revisions r where r.id=revision_id
    and (select private.is_project_member(r.project_id))
));
create policy referenced_midi_stem_versions_read on public.midi_stem_versions
for select to authenticated using (
  (select private.is_active_midi_actor()) and (
    owner_id=(select auth.uid())
    or exists (
      select 1 from public.revision_clips rc
      join public.project_revisions r on r.id=rc.revision_id
      where rc.midi_stem_version_id=midi_stem_versions.id
        and (select private.is_project_member(r.project_id))
    )
  )
);

create function private.canonical_project_manifest_v2(
  p_project_id uuid,
  p_manifest jsonb,
  p_allow_empty boolean default false
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_project public.projects%rowtype;
  v_track jsonb;
  v_clip jsonb;
  v_tracks jsonb := '[]'::jsonb;
  v_clips jsonb;
  v_track_ids uuid[] := '{}'::uuid[];
  v_clip_ids uuid[] := '{}'::uuid[];
  v_orders integer[] := '{}'::integer[];
  v_midi_count integer := 0;
  v_audio_count integer := 0;
  v_duration_ticks integer;
  v_max_ticks integer;
  v_track_id uuid;
  v_clip_id uuid;
  v_stem public.midi_stem_versions%rowtype;
  v_position integer := 0;
begin
  select * into v_project from public.projects where id=p_project_id and deleted_at is null;
  if not found or v_project.compatibility not in ('midi','legacy_hybrid') then
    raise sqlstate 'PT404' using message='workspace_project_not_found';
  end if;
  if jsonb_typeof(p_manifest)<>'object'
    or not (p_manifest ?& array['manifestVersion','engine','engineVersion','projectId',
      'tempoBpm','timeSignature','durationTicks','tracks'])
    or (select count(*) from jsonb_object_keys(p_manifest))<>8
    or p_manifest->>'manifestVersion'<>'2'
    or p_manifest->>'engine'<>'jam-session-composite'
    or p_manifest->>'engineVersion'<>'jam-session-composite-2_tone-15.1.22'
    or p_manifest->>'projectId'<>p_project_id::text
    or jsonb_typeof(p_manifest->'tracks')<>'array'
    or jsonb_typeof(p_manifest->'timeSignature')<>'object' then
    raise sqlstate '22023' using message='workspace_invalid_manifest';
  end if;
  if (p_manifest->>'tempoBpm')::numeric<>v_project.bpm
    or (p_manifest#>>'{timeSignature,numerator}')::integer<>v_project.time_signature_numerator
    or (p_manifest#>>'{timeSignature,denominator}')::integer<>v_project.time_signature_denominator then
    raise sqlstate '22023' using message='workspace_project_timing_mismatch';
  end if;
  v_duration_ticks := (p_manifest->>'durationTicks')::integer;
  v_max_ticks := floor(10*60*(p_manifest->>'tempoBpm')::numeric*480);
  if v_duration_ticks not between 1 and v_max_ticks
    or jsonb_array_length(p_manifest->'tracks')>28
    or (not p_allow_empty and jsonb_array_length(p_manifest->'tracks')=0) then
    raise sqlstate '22023' using message='workspace_track_limit';
  end if;
  for v_track in select value from jsonb_array_elements(p_manifest->'tracks') loop
    if jsonb_typeof(v_track)<>'object'
      or not (v_track ?& array['kind','trackId','name','instrumentId','gainDb','pan',
        'muted','soloed','sortOrder','clips']) then
      raise sqlstate '22023' using message='workspace_invalid_manifest';
    end if;
    v_track_id := (v_track->>'trackId')::uuid;
    if v_track_id=any(v_track_ids) or (v_track->>'sortOrder')::integer=any(v_orders)
      or (v_track->>'sortOrder')::integer<>v_position
      or v_track->>'name'<>btrim(v_track->>'name')
      or char_length(v_track->>'name') not between 1 and 120
      or (v_track->>'gainDb')::numeric not between -60 and 6
      or (v_track->>'pan')::numeric not between -1 and 1
      or jsonb_typeof(v_track->'muted')<>'boolean'
      or jsonb_typeof(v_track->'soloed')<>'boolean'
      or jsonb_typeof(v_track->'clips')<>'array'
      or jsonb_array_length(v_track->'clips') not between 1 and 32 then
      raise sqlstate '22023' using message='workspace_invalid_manifest';
    end if;
    v_track_ids := array_append(v_track_ids,v_track_id);
    v_orders := array_append(v_orders,(v_track->>'sortOrder')::integer);
    v_clips := '[]'::jsonb;
    if v_track->>'kind'='midi' then
      v_midi_count := v_midi_count+1;
      if v_project.compatibility not in ('midi','legacy_hybrid') or v_midi_count>16
        or (select count(*) from jsonb_object_keys(v_track))<>12
        or not (v_track ?& array['presetId','presetVersion'])
        or (v_track->>'instrumentId') is not null
        or not exists(select 1 from private.midi_synth_presets p
          where p.preset_id=v_track->>'presetId'
            and p.version=(v_track->>'presetVersion')::integer) then
        raise sqlstate '22023' using message='workspace_invalid_midi_track';
      end if;
    elsif v_track->>'kind'='audio' then
      v_audio_count := v_audio_count+1;
      if v_project.compatibility<>'legacy_hybrid' or v_audio_count>12
        or (select count(*) from jsonb_object_keys(v_track))<>11
        or not (v_track ? 'assetId') then
        raise sqlstate '22023' using message='workspace_invalid_audio_track';
      end if;
      if not exists(select 1 from public.assets a where a.id=(v_track->>'assetId')::uuid
        and a.kind='source_audio' and a.status='ready' and a.deleted_at is null
        and (a.owner_id=(select auth.uid()) or exists(select 1 from public.revision_tracks rt
          join public.workspaces w on w.base_revision_id=rt.revision_id
          where w.project_id=p_project_id and rt.asset_id=a.id))) then
        raise sqlstate 'PT409' using message='workspace_asset_unavailable';
      end if;
    else
      raise sqlstate '22023' using message='workspace_invalid_manifest';
    end if;
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      v_clip_id := (v_clip->>'clipId')::uuid;
      if v_clip_id=any(v_clip_ids) then
        raise sqlstate '22023' using message='workspace_duplicate_clip';
      end if;
      v_clip_ids := array_append(v_clip_ids,v_clip_id);
      if v_track->>'kind'='midi' then
        if (select count(*) from jsonb_object_keys(v_clip))<>6
          or not (v_clip ?& array['clipId','midiStemVersionId','startTick',
            'durationTicks','sourceStartTick','loop']) then
          raise sqlstate '22023' using message='workspace_invalid_midi_clip';
        end if;
        select * into v_stem from public.midi_stem_versions
          where id=(v_clip->>'midiStemVersionId')::uuid;
        if not found or v_stem.owner_id<>(select auth.uid())
          or (v_clip->>'startTick')::integer<0
          or (v_clip->>'durationTicks')::integer<=0
          or (v_clip->>'sourceStartTick')::integer<0
          or (v_clip->>'sourceStartTick')::integer>=v_stem.duration_ticks
          or (v_clip->>'startTick')::integer+(v_clip->>'durationTicks')::integer>v_duration_ticks
          or jsonb_typeof(v_clip->'loop')<>'boolean' then
          raise sqlstate 'PT409' using message='workspace_stem_version_unavailable';
        end if;
      else
        if (select count(*) from jsonb_object_keys(v_clip))<>4
          or not (v_clip ?& array['clipId','positionMs','trimStartMs','durationMs'])
          or (v_clip->>'positionMs')::integer<0
          or (v_clip->>'trimStartMs')::integer<0
          or (v_clip->>'durationMs')::integer<=0 then
          raise sqlstate '22023' using message='workspace_invalid_audio_clip';
        end if;
      end if;
      v_clips:=v_clips||jsonb_build_array(v_clip);
    end loop;
    v_tracks:=v_tracks||jsonb_build_array(v_track||jsonb_build_object('clips',v_clips));
    v_position:=v_position+1;
  end loop;
  return jsonb_build_object(
    'manifestVersion',2,'engine','jam-session-composite',
    'engineVersion','jam-session-composite-2_tone-15.1.22',
    'projectId',p_project_id,'tempoBpm',v_project.bpm::double precision,
    'timeSignature',jsonb_build_object('numerator',v_project.time_signature_numerator,
      'denominator',v_project.time_signature_denominator),
    'durationTicks',v_duration_ticks,'tracks',v_tracks
  );
exception when invalid_text_representation or numeric_value_out_of_range
  or null_value_not_allowed then
  raise sqlstate '22023' using message='workspace_invalid_manifest';
end $$;
revoke all on function private.canonical_project_manifest_v2(uuid,jsonb,boolean)
  from public,anon,authenticated;

create function private.project_v2_projections(
  p_workspace_id uuid,
  p_manifest jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare v_track jsonb; v_clip jsonb;
begin
  delete from public.workspace_clips where workspace_id=p_workspace_id;
  delete from public.workspace_tracks where workspace_id=p_workspace_id;
  for v_track in select value from jsonb_array_elements(p_manifest->'tracks') loop
    insert into public.workspace_tracks(
      workspace_id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,
      duration_ms,gain_db,pan,muted,soloed,sort_order,kind,preset_id,preset_version
    ) values (
      p_workspace_id,(v_track->>'trackId')::uuid,
      case when v_track->>'kind'='audio' then (v_track->>'assetId')::uuid end,
      (v_track->>'instrumentId')::uuid,v_track->>'name',0,0,
      case when v_track->>'kind'='audio' then
        (select max((c->>'durationMs')::integer) from jsonb_array_elements(v_track->'clips') c)
        else greatest(1,round((select max((c->>'durationTicks')::integer)
          from jsonb_array_elements(v_track->'clips') c)*60000.0/
          ((p_manifest->>'tempoBpm')::numeric*480))::integer) end,
      (v_track->>'gainDb')::numeric,(v_track->>'pan')::numeric,
      (v_track->>'muted')::boolean,(v_track->>'soloed')::boolean,
      (v_track->>'sortOrder')::smallint,v_track->>'kind',
      v_track->>'presetId',(v_track->>'presetVersion')::integer
    );
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      insert into public.workspace_clips(
        workspace_id,track_id,clip_id,kind,position_ms,trim_start_ms,duration_ms,
        midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop
      ) values (
        p_workspace_id,(v_track->>'trackId')::uuid,(v_clip->>'clipId')::uuid,
        v_track->>'kind',(v_clip->>'positionMs')::integer,
        (v_clip->>'trimStartMs')::integer,(v_clip->>'durationMs')::integer,
        (v_clip->>'midiStemVersionId')::uuid,(v_clip->>'startTick')::integer,
        (v_clip->>'durationTicks')::integer,(v_clip->>'sourceStartTick')::integer,
        (v_clip->>'loop')::boolean
      );
    end loop;
  end loop;
end $$;
revoke all on function private.project_v2_projections(uuid,jsonb)
  from public,anon,authenticated;

create function public.create_midi_project_workspace(
  p_request_id uuid,p_title text,p_description text,p_bpm numeric,
  p_musical_key text,p_time_signature_numerator smallint,
  p_time_signature_denominator smallint,p_license_code text,
  p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[]
) returns table(project_id uuid,title text,lock_version integer,workspace_id uuid)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype; v_manifest jsonb; v_bpm numeric:=coalesce(p_bpm,120);
begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'midi-project:'||v_actor::text||':'||p_request_id::text,0));
  select * into v_project from public.projects
    where owner_id=v_actor and create_request_id=p_request_id;
  if found then
    select * into v_workspace from public.workspaces w
      where w.project_id=v_project.id and w.owner_id=v_actor and w.status='active';
    if v_project.compatibility<>'midi' or v_workspace.id is null
      or v_project.title<>btrim(p_title) then
      raise sqlstate 'PT409' using message='project_request_conflict'; end if;
    return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id;
    return;
  end if;
  if p_request_id is null or p_title is null or p_title<>btrim(p_title)
    or char_length(p_title) not between 1 and 120
    or p_description is null or p_description<>btrim(p_description)
    or char_length(p_description)>5000 or v_bpm not between 20 and 300
    or scale(v_bpm)>3 or p_time_signature_numerator not between 1 and 32
    or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then
    raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
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
    p_time_signature_numerator,p_time_signature_denominator,p_license_code,'midi')
  returning * into v_project;
  insert into public.project_members values(v_project.id,v_actor,'owner',v_actor,default);
  insert into public.project_genres(project_id,genre_id,is_primary)
    select v_project.id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x;
  insert into public.project_tags(project_id,tag_id)
    select v_project.id,x from unnest(coalesce(p_tag_ids,'{}')) x;
  v_manifest:=jsonb_build_object('manifestVersion',2,'engine','jam-session-composite',
    'engineVersion','jam-session-composite-2_tone-15.1.22','projectId',v_project.id,
    'tempoBpm',v_bpm::double precision,'timeSignature',jsonb_build_object(
      'numerator',p_time_signature_numerator,'denominator',p_time_signature_denominator),
    'durationTicks',7680,'tracks','[]'::jsonb);
  insert into public.workspaces(project_id,owner_id,create_request_id,manifest,
    manifest_version,engine,engine_version,manifest_sha256)
  values(v_project.id,v_actor,p_request_id,v_manifest,2,'jam-session-composite',
    'jam-session-composite-2_tone-15.1.22',encode(extensions.digest(
      convert_to(v_manifest::text,'UTF8'),'sha256'),'hex')) returning * into v_workspace;
  return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id;
end $$;
revoke all on function public.create_midi_project_workspace(uuid,text,text,numeric,text,
  smallint,smallint,text,uuid[],uuid,uuid[]) from public,anon;
grant execute on function public.create_midi_project_workspace(uuid,text,text,numeric,text,
  smallint,smallint,text,uuid[],uuid,uuid[]) to authenticated;

create function public.save_midi_workspace(
  p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,p_manifest jsonb
) returns table(workspace_id uuid,lock_version integer,manifest_sha256 text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_workspace public.workspaces%rowtype;
  v_canonical jsonb; v_checksum text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_unauthenticated'; end if;
  select * into v_workspace from public.workspaces where id=p_workspace_id
    and owner_id=v_actor and status='active' for update;
  if not found or not (select private.is_active_project_actor())
    or v_workspace.manifest_version<>2 then
    raise sqlstate 'PT404' using message='workspace_not_found'; end if;
  if v_workspace.last_manifest_request_id=p_request_id then
    if v_workspace.last_manifest_expected_lock_version<>p_expected_lock_version then
      raise sqlstate 'PT409' using message='workspace_request_conflict'; end if;
    return query select v_workspace.id,v_workspace.lock_version,
      v_workspace.manifest_sha256,v_workspace.updated_at; return;
  end if;
  if p_request_id is null or v_workspace.lock_version<>p_expected_lock_version then
    raise sqlstate 'PT409' using message='workspace_save_conflict'; end if;
  v_canonical:=private.canonical_project_manifest_v2(v_workspace.project_id,p_manifest,true);
  if v_canonical<>p_manifest then
    raise sqlstate '22023' using message='workspace_manifest_not_canonical'; end if;
  v_checksum:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  perform private.project_v2_projections(v_workspace.id,v_canonical);
  update public.workspaces set manifest=v_canonical,manifest_sha256=v_checksum,
    snapshot_asset_id=null,lock_version=workspaces.lock_version+1,
    last_manifest_request_id=p_request_id,
    last_manifest_expected_lock_version=p_expected_lock_version,
    updated_at=statement_timestamp() where id=v_workspace.id returning * into v_workspace;
  return query select v_workspace.id,v_workspace.lock_version,
    v_workspace.manifest_sha256,v_workspace.updated_at;
end $$;
revoke all on function public.save_midi_workspace(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_midi_workspace(uuid,uuid,integer,jsonb) to authenticated;

create function public.publish_midi_workspace_revision(
  p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,
  p_expected_base_revision_id uuid,p_message text
) returns table(revision_id uuid,revision_number integer,
  workspace_lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_workspace public.workspaces%rowtype;
  v_project public.projects%rowtype; v_existing public.project_revisions%rowtype;
  v_revision public.project_revisions%rowtype; v_track jsonb; v_clip jsonb;
  v_number integer; v_duration_ms integer; v_message text:=nullif(btrim(p_message),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_publish_unauthenticated'; end if;
  select * into v_workspace from public.workspaces where id=p_workspace_id
    and owner_id=v_actor and status='active' for update;
  if not found or not (select private.is_active_project_actor())
    or v_workspace.manifest_version<>2 then
    raise sqlstate 'PT404' using message='workspace_publish_not_found'; end if;
  select * into v_project from public.projects where id=v_workspace.project_id
    and owner_id=v_actor and compatibility in ('midi','legacy_hybrid')
    and deleted_at is null for update;
  if not found then raise sqlstate 'PT404' using message='workspace_publish_not_found'; end if;
  select * into v_existing from public.project_revisions r
    where r.project_id=v_project.id and r.publish_request_id=p_request_id;
  if found then
    if v_existing.manifest_sha256<>v_workspace.manifest_sha256
      or v_existing.expected_base_revision_id is distinct from p_expected_base_revision_id then
      raise sqlstate 'PT409' using message='workspace_publish_request_conflict'; end if;
    return query select v_existing.id,v_existing.revision_number,
      v_workspace.lock_version,v_existing.created_at; return;
  end if;
  if p_request_id is null or p_expected_lock_version<>v_workspace.lock_version
    or p_expected_base_revision_id is distinct from v_workspace.base_revision_id
    or p_expected_base_revision_id is distinct from v_project.current_revision_id
    or (v_message is not null and char_length(v_message)>500) then
    raise sqlstate 'PT409' using message='workspace_publish_conflict'; end if;
  if private.canonical_project_manifest_v2(v_project.id,v_workspace.manifest,false)
      <>v_workspace.manifest
    or encode(extensions.digest(convert_to(v_workspace.manifest::text,'UTF8'),'sha256'),'hex')
      <>v_workspace.manifest_sha256
    or (select count(*) from public.workspace_tracks where workspace_id=v_workspace.id)
      <>jsonb_array_length(v_workspace.manifest->'tracks') then
    raise sqlstate 'PT409' using message='workspace_publish_invalid_state'; end if;
  select coalesce(max(r.revision_number),0)+1 into v_number
    from public.project_revisions r where r.project_id=v_project.id;
  v_duration_ms:=ceil((v_workspace.manifest->>'durationTicks')::numeric*60000/
    ((v_workspace.manifest->>'tempoBpm')::numeric*480));
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,
    publish_request_id,expected_base_revision_id,message,manifest,manifest_version,engine,
    engine_version,manifest_sha256,duration_ms)
  values(v_project.id,v_number,v_project.current_revision_id,v_actor,p_request_id,
    p_expected_base_revision_id,v_message,v_workspace.manifest,2,'jam-session-composite',
    'jam-session-composite-2_tone-15.1.22',v_workspace.manifest_sha256,v_duration_ms)
  returning * into v_revision;
  for v_track in select value from jsonb_array_elements(v_workspace.manifest->'tracks') loop
    insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,position_ms,
      trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,kind,
      preset_id,preset_version)
    select v_revision.id,wt.track_id,wt.asset_id,wt.instrument_id,wt.name,wt.position_ms,
      wt.trim_start_ms,wt.duration_ms,wt.gain_db,wt.pan,wt.muted,wt.soloed,
      wt.sort_order,v_actor,wt.kind,wt.preset_id,wt.preset_version
      from public.workspace_tracks wt where wt.workspace_id=v_workspace.id
        and wt.track_id=(v_track->>'trackId')::uuid;
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      insert into public.revision_clips(revision_id,track_id,clip_id,kind,position_ms,
        trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,
        source_start_tick,loop)
      select v_revision.id,wc.track_id,wc.clip_id,wc.kind,wc.position_ms,wc.trim_start_ms,
        wc.duration_ms,wc.midi_stem_version_id,wc.start_tick,wc.duration_ticks,
        wc.source_start_tick,wc.loop from public.workspace_clips wc
        where wc.workspace_id=v_workspace.id and wc.clip_id=(v_clip->>'clipId')::uuid;
      if v_track->>'kind'='midi' then
        insert into public.revision_midi_track_credits(revision_id,track_id,
          midi_stem_version_id,creator_id,creator_credit_name)
        select v_revision.id,(v_track->>'trackId')::uuid,msv.id,msv.owner_id,
          msv.creator_credit_name from public.midi_stem_versions msv
          where msv.id=(v_clip->>'midiStemVersionId')::uuid
        on conflict do nothing;
      end if;
    end loop;
  end loop;
  update public.projects set current_revision_id=v_revision.id,status='active',
    published_at=coalesce(published_at,v_revision.created_at),
    lock_version=projects.lock_version+1,updated_at=v_revision.created_at
    where id=v_project.id;
  update public.workspaces set base_revision_id=v_revision.id,
    lock_version=workspaces.lock_version+1,updated_at=v_revision.created_at
    where id=v_workspace.id returning * into v_workspace;
  perform private.refresh_public_project(v_project.id);
  update public.public_project_catalog catalog set tracks=(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',rt.id,'kind',rt.kind,'name',rt.name,'durationMs',rt.duration_ms,
      'positionMs',rt.position_ms,'sortOrder',rt.sort_order,
      'preset',case when rt.kind='midi' then jsonb_build_object(
        'id',rt.preset_id,'version',rt.preset_version) else null end,
      'instrument',case when i.id is null then null else jsonb_build_object(
        'id',i.id,'slug',i.slug,'name',i.name) end,
      'credits',case when rt.kind='midi' then coalesce((select jsonb_agg(
        jsonb_build_object('position',ordered.position,'creditName',ordered.creator_credit_name,
          'role','creator','profileId',ordered.creator_id) order by ordered.position)
        from (select distinct on (creator_id,creator_credit_name) creator_id,
          creator_credit_name,row_number() over(order by creator_credit_name,creator_id)-1 position
          from public.revision_midi_track_credits where revision_id=rt.revision_id
            and track_id=rt.id order by creator_id,creator_credit_name) ordered),'[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object(
        'position',rtc.position,'creditName',rtc.credit_name,'role',rtc.role,
        'profileId',rtc.user_id) order by rtc.position)
        from public.revision_track_credits rtc where rtc.revision_id=rt.revision_id
          and rtc.track_id=rt.id),'[]'::jsonb) end
    ) order by rt.sort_order),'[]'::jsonb)
    from public.revision_tracks rt left join public.instruments i on i.id=rt.instrument_id
    where rt.revision_id=v_revision.id
  ) where catalog.project_id=v_project.id;
  return query select v_revision.id,v_revision.revision_number,
    v_workspace.lock_version,v_revision.created_at;
end $$;
revoke all on function public.publish_midi_workspace_revision(uuid,uuid,integer,uuid,text)
  from public,anon;
grant execute on function public.publish_midi_workspace_revision(uuid,uuid,integer,uuid,text)
  to authenticated;

create or replace function private.require_confirmed_source_credits()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name in ('workspace_tracks','revision_tracks') then
    if new.kind='midi' then return new; end if;
  end if;
  if not exists(select 1 from public.assets a where a.id=new.asset_id
    and a.kind='source_audio' and a.status='ready' and a.deleted_at is null
    and a.credits_confirmed_at is not null and exists(select 1 from public.asset_credits ac
      where ac.asset_id=a.id and ac.role='creator')) then
    raise sqlstate 'PT409' using message='asset_credits_unconfirmed'; end if;
  return new;
end $$;
create or replace function private.snapshot_revision_track_credits()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='midi' then return new; end if;
  insert into public.revision_track_credits(revision_id,track_id,asset_id,position,
    source_credit_position,user_id,credit_name,role)
  select new.revision_id,new.id,new.asset_id,ac.position,ac.position,ac.user_id,
    ac.credit_name,ac.role from public.asset_credits ac where ac.asset_id=new.asset_id
    order by ac.position;
  return new;
end $$;

create or replace function public.get_project_revision_preview(
  p_project_id uuid,p_revision_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_project public.projects%rowtype; v_revision public.project_revisions%rowtype;
  v_sources jsonb; v_stems jsonb;
begin
  if p_project_id is null or p_revision_id is null then
    raise sqlstate '22023' using message='preview_invalid_input'; end if;
  select p.* into v_project from public.projects p where p.id=p_project_id
    and p.current_revision_id=p_revision_id and p.status='active' and p.deleted_at is null
    and (exists(select 1 from public.public_project_catalog c where c.project_id=p.id)
      or ((select private.is_active_project_actor()) and (select private.is_project_member(p.id))));
  if not found then raise sqlstate 'PT404' using message='preview_not_found'; end if;
  select * into v_revision from public.project_revisions where id=p_revision_id
    and project_id=p_project_id;
  if not found then raise sqlstate 'PT404' using message='preview_not_found'; end if;
  if v_revision.manifest_version=1 then
    select jsonb_agg(jsonb_build_object('assetId',a.id,'bucket',a.bucket,
      'objectPath',a.object_path) order by rt.sort_order) into v_sources
      from public.revision_tracks rt join public.assets a on a.id=rt.asset_id
      where rt.revision_id=v_revision.id and rt.kind='audio' and a.kind='source_audio'
        and a.status='ready' and a.deleted_at is null;
    if coalesce(jsonb_array_length(v_sources),0)<>
      jsonb_array_length(v_revision.manifest->'tracks') then
      raise sqlstate 'PT409' using message='preview_audio_unavailable'; end if;
    return jsonb_build_object('projectId',v_project.id,'revisionId',v_revision.id,
      'durationMs',v_revision.duration_ms,'manifest',v_revision.manifest,
      'sources',v_sources,'stems','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('assetId',audio.asset_id,
    'bucket',audio.bucket,'objectPath',audio.object_path) order by audio.asset_id),
    '[]'::jsonb) into v_sources from (select distinct a.id as asset_id,a.bucket,
    a.object_path from public.revision_tracks rt join public.assets a on a.id=rt.asset_id
    where rt.revision_id=v_revision.id and rt.kind='audio' and a.kind='source_audio'
      and a.status='ready' and a.deleted_at is null) audio;
  if (select count(distinct asset_id) from public.revision_tracks
      where revision_id=v_revision.id and kind='audio')<>jsonb_array_length(v_sources) then
    raise sqlstate 'PT409' using message='preview_audio_unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'stemVersionId',msv.id,'stemId',msv.stem_id,'version',msv.version,
    'creatorId',msv.owner_id,'parentStemVersionId',msv.parent_stem_version_id,
    'name',msv.name,'defaultPresetId',msv.default_preset_id,
    'defaultPresetVersion',msv.default_preset_version,'ppq',msv.ppq,
    'durationTicks',msv.duration_ticks,'notes',msv.notes,
    'contentSha256',msv.content_sha256) order by msv.id),'[]'::jsonb) into v_stems
  from public.midi_stem_versions msv where exists(select 1 from public.revision_clips rc
    where rc.revision_id=v_revision.id and rc.midi_stem_version_id=msv.id);
  if (select count(distinct midi_stem_version_id) from public.revision_clips
      where revision_id=v_revision.id and kind='midi')<>jsonb_array_length(v_stems) then
    raise sqlstate 'PT409' using message='preview_midi_unavailable'; end if;
  return jsonb_build_object('projectId',v_project.id,'revisionId',v_revision.id,
    'durationMs',v_revision.duration_ms,'manifest',v_revision.manifest,
    'sources',v_sources,'stems',v_stems);
end $$;
revoke all on function public.get_project_revision_preview(uuid,uuid) from public;
grant execute on function public.get_project_revision_preview(uuid,uuid) to anon,authenticated;

create function private.refresh_public_midi_catalog_tracks()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_revision_id uuid;
begin
  select p.current_revision_id into v_revision_id from public.projects p
    join public.project_revisions pr on pr.id=p.current_revision_id
    where p.id=new.project_id and pr.manifest_version=2;
  if v_revision_id is null or coalesce(new.tracks->0->>'kind','')='midi' then
    return new;
  end if;
  update public.public_project_catalog catalog set tracks=(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',rt.id,'kind',rt.kind,'name',rt.name,'durationMs',rt.duration_ms,
      'positionMs',rt.position_ms,'sortOrder',rt.sort_order,
      'preset',jsonb_build_object('id',rt.preset_id,'version',rt.preset_version),
      'instrument',case when i.id is null then null else jsonb_build_object(
        'id',i.id,'slug',i.slug,'name',i.name) end,
      'credits',coalesce((select jsonb_agg(jsonb_build_object(
        'position',credit.position,'creditName',credit.creator_credit_name,
        'role','creator','profileId',credit.creator_id) order by credit.position)
        from (select distinct_credit.creator_id,distinct_credit.creator_credit_name,
          row_number() over(order by distinct_credit.creator_credit_name,
            distinct_credit.creator_id)-1 as position
          from (select distinct creator_id,creator_credit_name
            from public.revision_midi_track_credits
            where revision_id=rt.revision_id and track_id=rt.id) distinct_credit
        ) credit),'[]'::jsonb)
    ) order by rt.sort_order),'[]'::jsonb)
    from public.revision_tracks rt left join public.instruments i on i.id=rt.instrument_id
    where rt.revision_id=v_revision_id and rt.kind='midi'
  ) where catalog.project_id=new.project_id;
  return new;
end $$;
create trigger refresh_public_midi_catalog_tracks
after insert or update of tracks on public.public_project_catalog
for each row execute function private.refresh_public_midi_catalog_tracks();
revoke all on function private.refresh_public_midi_catalog_tracks()
  from public,anon,authenticated;

comment on column public.projects.compatibility is
  'MIDI workflow invariant: midi projects prohibit source audio; legacy_hybrid projects preserve audio and may add MIDI.';
comment on table public.workspace_clips is
  'Optimistically replaced normalized v2 clip projection; MIDI clips reference exact immutable stem versions.';
comment on table public.revision_clips is
  'Immutable normalized clip projection for a published manifest v2 revision.';
