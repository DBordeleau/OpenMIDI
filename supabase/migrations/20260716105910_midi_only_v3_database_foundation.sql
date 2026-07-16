-- PIVOT-03: additive MIDI-only manifest-v3 relational authority.
-- Legacy audio/composite tables and commands remain until their owned removal slices.

alter table private.midi_synth_presets
  add column if not exists engine_version text,
  add column if not exists is_active boolean not null default true;

update private.midi_synth_presets
set engine_version = 'jam-session-composite-2_tone-15.1.22'
where engine_version is null;

alter table private.midi_synth_presets
  alter column engine_version set not null;

insert into private.midi_synth_presets(preset_id,version,min_note,max_note,engine_version)
values
  ('drum-machine',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('electro-kit',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('lofi-kit',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('percussion-rack',1,35,81,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('sub-bass',1,24,60,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('analog-bass',1,24,67,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('fm-bass',1,24,72,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('pluck-bass',1,28,72,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('warm-keys',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('electric-keys',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('organ',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('glass-keys',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('saw-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('square-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('fm-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('soft-lead',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('warm-pad',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('air-pad',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('string-pad',1,24,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('choir-pad',1,36,96,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('muted-pluck',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('bright-pluck',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('bell',1,48,108,'jam-session-midi-3_tone-15.1.22_presets-1'),
  ('mallet',1,36,108,'jam-session-midi-3_tone-15.1.22_presets-1')
on conflict(preset_id,version) do update set
  min_note=excluded.min_note,max_note=excluded.max_note,
  engine_version=excluded.engine_version,is_active=true;

create table public.midi_patterns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  name text not null check(name=btrim(name) and char_length(name) between 1 and 120),
  source_pattern_id uuid references public.midi_patterns(id) on delete restrict,
  source_pattern_version_id uuid,
  visibility text not null default 'private' check(visibility in ('private','public')),
  rights_attestation_version text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(owner_id,create_request_id),
  unique(id,owner_id),
  unique(id,source_pattern_version_id),
  check(source_pattern_id is null or source_pattern_id<>id),
  check((source_pattern_id is null)=(source_pattern_version_id is null)),
  check((visibility='private' and rights_attestation_version is null and published_at is null)
    or (visibility='public' and rights_attestation_version='cc-by-4.0-attestation-v1' and published_at is not null))
);
create index midi_patterns_owner_updated_idx on public.midi_patterns(owner_id,updated_at desc,id desc);
create index midi_patterns_source_idx on public.midi_patterns(source_pattern_id) where source_pattern_id is not null;

create table public.midi_pattern_versions (
  id uuid primary key default gen_random_uuid(),
  midi_pattern_id uuid not null references public.midi_patterns(id) on delete restrict,
  version_number integer not null check(version_number>0),
  create_request_id uuid not null,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  creator_credit_name text not null check(creator_credit_name=btrim(creator_credit_name) and char_length(creator_credit_name) between 1 and 120),
  parent_pattern_version_id uuid,
  source_pattern_version_id uuid references public.midi_pattern_versions(id) on delete restrict,
  ppq smallint not null check(ppq=480),
  duration_ticks integer not null check(duration_ticks between 1 and 86400000),
  note_count integer not null check(note_count between 0 and 2048),
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  reuse_license_code text check(reuse_license_code is null or reuse_license_code='CC-BY-4.0'),
  reuse_license_version text check(reuse_license_version is null or reuse_license_version='4.0'),
  reuse_license_url text check(reuse_license_url is null or reuse_license_url='https://creativecommons.org/licenses/by/4.0/'),
  created_at timestamptz not null default statement_timestamp(),
  unique(midi_pattern_id,version_number),
  unique(midi_pattern_id,create_request_id),
  unique(midi_pattern_id,id),
  unique(id,midi_pattern_id),
  foreign key(midi_pattern_id,parent_pattern_version_id)
    references public.midi_pattern_versions(midi_pattern_id,id) on delete restrict,
  check(parent_pattern_version_id is null or parent_pattern_version_id<>id),
  check(source_pattern_version_id is null or source_pattern_version_id<>id),
  check((reuse_license_code is null and reuse_license_version is null and reuse_license_url is null)
    or (reuse_license_code is not null and reuse_license_version is not null and reuse_license_url is not null))
);
create index midi_pattern_versions_creator_created_idx on public.midi_pattern_versions(creator_id,created_at desc,id desc);
create index midi_pattern_versions_parent_idx on public.midi_pattern_versions(parent_pattern_version_id) where parent_pattern_version_id is not null;
create index midi_pattern_versions_source_idx on public.midi_pattern_versions(source_pattern_version_id) where source_pattern_version_id is not null;

alter table public.midi_patterns add constraint midi_patterns_source_version_fk
  foreign key(source_pattern_id,source_pattern_version_id)
  references public.midi_pattern_versions(midi_pattern_id,id) on delete restrict;

create table public.midi_pattern_notes (
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  note_id uuid not null,
  start_tick integer not null check(start_tick>=0),
  duration_ticks integer not null check(duration_ticks>0),
  pitch smallint not null check(pitch between 0 and 127),
  velocity smallint not null check(velocity between 1 and 127),
  primary key(midi_pattern_version_id,note_id)
);
create index midi_pattern_notes_timeline_idx on public.midi_pattern_notes(midi_pattern_version_id,start_tick,pitch,note_id);

create table public.arrangement_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  manifest_version smallint not null check(manifest_version=3),
  engine text not null check(engine='jam-session-midi'),
  engine_version text not null check(engine_version='jam-session-midi-3_tone-15.1.22_presets-1'),
  manifest jsonb not null,
  manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  tempo_bpm numeric not null check(tempo_bpm between 20 and 300),
  time_signature_numerator smallint not null check(time_signature_numerator between 1 and 32),
  time_signature_denominator smallint not null check(time_signature_denominator in (1,2,4,8,16,32)),
  musical_key text check(musical_key is null or musical_key in (
    'c-major','c-sharp-major','d-major','e-flat-major','e-major','f-major','f-sharp-major','g-major',
    'a-flat-major','a-major','b-flat-major','b-major','c-minor','c-sharp-minor','d-minor','e-flat-minor',
    'e-minor','f-minor','f-sharp-minor','g-minor','g-sharp-minor','a-minor','b-flat-minor','b-minor')),
  ppq smallint not null check(ppq=480),
  duration_ticks integer not null check(duration_ticks between 1 and 86400000),
  created_at timestamptz not null default statement_timestamp(),
  unique(project_id,create_request_id),
  unique(project_id,id)
);
create index arrangement_versions_creator_created_idx on public.arrangement_versions(created_by,created_at desc,id desc);
create index arrangement_versions_project_created_idx on public.arrangement_versions(project_id,created_at desc,id desc);

create table public.arrangement_tracks (
  arrangement_version_id uuid not null,
  project_id uuid not null,
  track_id uuid not null,
  sort_order smallint not null check(sort_order between 0 and 15),
  name text not null check(name=btrim(name) and char_length(name) between 1 and 120),
  preset_id text not null,
  preset_version integer not null,
  gain_db numeric not null check(gain_db between -60 and 6),
  pan numeric not null check(pan between -1 and 1),
  muted boolean not null,
  soloed boolean not null,
  primary key(arrangement_version_id,track_id),
  unique(project_id,arrangement_version_id,track_id),
  unique(arrangement_version_id,sort_order),
  foreign key(project_id,arrangement_version_id) references public.arrangement_versions(project_id,id) on delete restrict,
  foreign key(preset_id,preset_version) references private.midi_synth_presets(preset_id,version) on delete restrict
);
create index arrangement_tracks_preset_idx on public.arrangement_tracks(preset_id,preset_version);

create table public.arrangement_clips (
  arrangement_version_id uuid not null,
  project_id uuid not null,
  track_id uuid not null,
  clip_id uuid not null,
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  start_tick integer not null check(start_tick>=0),
  duration_ticks integer not null check(duration_ticks>0),
  source_start_tick integer not null check(source_start_tick>=0),
  loop boolean not null,
  primary key(arrangement_version_id,clip_id),
  foreign key(project_id,arrangement_version_id,track_id)
    references public.arrangement_tracks(project_id,arrangement_version_id,track_id) on delete restrict
);
create index arrangement_clips_track_idx on public.arrangement_clips(arrangement_version_id,track_id,start_tick,clip_id);
create index arrangement_clips_pattern_version_idx on public.arrangement_clips(midi_pattern_version_id);

alter table public.workspaces add constraint workspaces_project_identity_uq unique(id,project_id,owner_id);

create table private.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  owner_id uuid not null,
  request_id uuid not null,
  lock_version integer not null check(lock_version>0),
  manifest jsonb not null,
  manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  unique(workspace_id,request_id),
  unique(workspace_id,lock_version),
  foreign key(workspace_id,project_id,owner_id)
    references public.workspaces(id,project_id,owner_id) on delete cascade
);
create index workspace_snapshots_prune_idx on private.workspace_snapshots(workspace_id,lock_version desc);
alter table private.workspace_snapshots enable row level security;
revoke all on private.workspace_snapshots from public,anon,authenticated;

alter table public.workspace_clips
  add column midi_pattern_version_id uuid references public.midi_pattern_versions(id) on delete restrict,
  drop constraint workspace_clips_check,
  add constraint workspace_clips_shape_check check(
    (kind='audio' and position_ms>=0 and trim_start_ms>=0 and duration_ms>0
      and midi_stem_version_id is null and midi_pattern_version_id is null
      and start_tick is null and duration_ticks is null and source_start_tick is null and loop is null)
    or
    (kind='midi' and position_ms is null and trim_start_ms is null and duration_ms is null
      and ((midi_stem_version_id is not null and midi_pattern_version_id is null)
        or (midi_stem_version_id is null and midi_pattern_version_id is not null))
      and start_tick>=0 and duration_ticks>0 and source_start_tick>=0 and loop is not null)
  );
create index workspace_clips_pattern_version_idx on public.workspace_clips(midi_pattern_version_id)
  where midi_pattern_version_id is not null;

alter table public.workspaces drop constraint workspaces_manifest_runtime_check;
alter table public.workspaces add constraint workspaces_manifest_runtime_check check(
  (manifest_version=1 and engine='waveform-playlist' and engine_version='browser-15.3.4_playout-12.5.4_tone-15.1.22')
  or (manifest_version=2 and engine='jam-session-composite' and engine_version='jam-session-composite-2_tone-15.1.22')
  or (manifest_version=3 and engine='jam-session-midi' and engine_version='jam-session-midi-3_tone-15.1.22_presets-1' and snapshot_asset_id is null)
);

alter table public.project_revisions
  add column arrangement_version_id uuid,
  drop constraint project_revisions_manifest_runtime_check,
  add constraint project_revisions_manifest_runtime_check check(
    (manifest_version=1 and engine='waveform-playlist' and engine_version='browser-15.3.4_playout-12.5.4_tone-15.1.22' and arrangement_version_id is null)
    or (manifest_version=2 and engine='jam-session-composite' and engine_version='jam-session-composite-2_tone-15.1.22' and arrangement_version_id is null)
    or (manifest_version=3 and engine='jam-session-midi' and engine_version='jam-session-midi-3_tone-15.1.22_presets-1' and arrangement_version_id is not null and snapshot_asset_id is null)
  ),
  add constraint project_revisions_arrangement_fk foreign key(project_id,arrangement_version_id)
    references public.arrangement_versions(project_id,id) on delete restrict;
create unique index project_revisions_arrangement_uq on public.project_revisions(arrangement_version_id)
  where arrangement_version_id is not null;

alter table public.contribution_versions
  add column project_id uuid,
  add column arrangement_version_id uuid;
update public.contribution_versions v set project_id=c.project_id
from public.contributions c where c.id=v.contribution_id;
alter table public.contribution_versions
  alter column project_id set not null,
  drop constraint contribution_versions_format_check,
  add constraint contribution_versions_format_check check(
    (manifest_version=1 and engine='waveform-playlist' and engine_version='browser-15.3.4_playout-12.5.4_tone-15.1.22' and snapshot_asset_id is not null and arrangement_version_id is null)
    or (manifest_version=2 and engine='jam-session-composite' and engine_version='jam-session-composite-2_tone-15.1.22' and snapshot_asset_id is null and arrangement_version_id is null)
    or (manifest_version=3 and engine='jam-session-midi' and engine_version='jam-session-midi-3_tone-15.1.22_presets-1' and snapshot_asset_id is null and arrangement_version_id is not null)
  ),
  add constraint contribution_versions_contribution_project_fk foreign key(project_id,contribution_id)
    references public.contributions(project_id,id) on delete restrict,
  add constraint contribution_versions_arrangement_fk foreign key(project_id,arrangement_version_id)
    references public.arrangement_versions(project_id,id) on delete restrict;
create unique index contribution_versions_arrangement_uq on public.contribution_versions(arrangement_version_id)
  where arrangement_version_id is not null;

create function private.fill_contribution_version_project_v3() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_project_id uuid;
begin
  select c.project_id into v_project_id from public.contributions c where c.id=new.contribution_id;
  if v_project_id is null then raise sqlstate '23503' using message='contribution_version_parent_missing'; end if;
  if new.project_id is not null and new.project_id<>v_project_id then
    raise sqlstate '23503' using message='contribution_version_project_mismatch';
  end if;
  new.project_id:=v_project_id;
  return new;
end;
$$;
create trigger contribution_versions_fill_project_v3
before insert on public.contribution_versions for each row
execute function private.fill_contribution_version_project_v3();
revoke all on function private.fill_contribution_version_project_v3() from public,anon,authenticated;

create trigger midi_pattern_versions_immutable before update or delete on public.midi_pattern_versions
  for each row execute function private.reject_immutable_change();
create trigger midi_pattern_notes_immutable before update or delete on public.midi_pattern_notes
  for each row execute function private.reject_immutable_change();
create trigger arrangement_versions_immutable before update or delete on public.arrangement_versions
  for each row execute function private.reject_immutable_change();
create trigger arrangement_tracks_immutable before update or delete on public.arrangement_tracks
  for each row execute function private.reject_immutable_change();
create trigger arrangement_clips_immutable before update or delete on public.arrangement_clips
  for each row execute function private.reject_immutable_change();

alter table public.midi_patterns enable row level security;
alter table public.midi_pattern_versions enable row level security;
alter table public.midi_pattern_notes enable row level security;
alter table public.arrangement_versions enable row level security;
alter table public.arrangement_tracks enable row level security;
alter table public.arrangement_clips enable row level security;

revoke all on public.midi_patterns,public.midi_pattern_versions,public.midi_pattern_notes,
  public.arrangement_versions,public.arrangement_tracks,public.arrangement_clips
  from public,anon,authenticated;
grant select on public.midi_patterns,public.midi_pattern_versions,public.midi_pattern_notes,
  public.arrangement_versions,public.arrangement_tracks,public.arrangement_clips
  to anon,authenticated;

create function private.can_read_arrangement(p_arrangement_version_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.arrangement_versions a
    join public.projects p on p.id=a.project_id
    where a.id=p_arrangement_version_id and p.deleted_at is null and p.moderation_state='visible'
      and (
        (p.visibility='public' and p.status='active' and exists(
          select 1 from public.project_revisions r where r.project_id=p.id
            and r.arrangement_version_id=a.id))
        or ((select auth.uid()) is not null and (select private.is_active_project_actor()) and (
          exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=(select auth.uid()))
          or exists(select 1 from public.contribution_versions cv join public.contributions c on c.id=cv.contribution_id
            where cv.arrangement_version_id=a.id and (c.author_id=(select auth.uid()) or p.owner_id=(select auth.uid())))
        ))
      )
  );
$$;
revoke all on function private.can_read_arrangement(uuid) from public,anon,authenticated;
grant execute on function private.can_read_arrangement(uuid) to anon,authenticated;

create function private.can_read_pattern_version(p_pattern_version_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.midi_pattern_versions v join public.midi_patterns p on p.id=v.midi_pattern_id
    where v.id=p_pattern_version_id and p.deleted_at is null and (
      (p.visibility='public' and v.reuse_license_code='CC-BY-4.0')
      or (p.owner_id=(select auth.uid()) and (select private.is_active_project_actor()))
      or exists(select 1 from public.arrangement_clips c where c.midi_pattern_version_id=v.id
        and (select private.can_read_arrangement(c.arrangement_version_id)))
    )
  );
$$;
revoke all on function private.can_read_pattern_version(uuid) from public,anon,authenticated;
grant execute on function private.can_read_pattern_version(uuid) to anon,authenticated;

create policy midi_patterns_read on public.midi_patterns for select to anon,authenticated using(
  deleted_at is null and ((visibility='public') or (owner_id=(select auth.uid()) and (select private.is_active_project_actor())))
);
create policy midi_pattern_versions_read on public.midi_pattern_versions for select to anon,authenticated
  using((select private.can_read_pattern_version(id)));
create policy midi_pattern_notes_read on public.midi_pattern_notes for select to anon,authenticated
  using((select private.can_read_pattern_version(midi_pattern_version_id)));
create policy arrangement_versions_read on public.arrangement_versions for select to anon,authenticated
  using((select private.can_read_arrangement(id)));
create policy arrangement_tracks_read on public.arrangement_tracks for select to anon,authenticated
  using((select private.can_read_arrangement(arrangement_version_id)));
create policy arrangement_clips_read on public.arrangement_clips for select to anon,authenticated
  using((select private.can_read_arrangement(arrangement_version_id)));

create function private.canonical_midi_pattern_notes_v3(p_notes jsonb,p_duration_ticks integer)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_count integer; v_result jsonb;
begin
  if jsonb_typeof(p_notes)<>'array' or p_duration_ticks not between 1 and 86400000 then
    raise sqlstate '22023' using message='midi_pattern_notes_invalid';
  end if;
  v_count:=jsonb_array_length(p_notes);
  if v_count>2048 or exists(select 1 from jsonb_array_elements(p_notes) n
    where jsonb_typeof(n)<>'object' or not (n ?& array['noteId','startTick','durationTicks','pitch','velocity'])
      or (select count(*) from jsonb_object_keys(n))<>5) then
    raise sqlstate '22023' using message='midi_pattern_notes_invalid';
  end if;
  with notes as (
    select * from jsonb_to_recordset(p_notes) n(
      "noteId" uuid,"startTick" integer,"durationTicks" integer,pitch smallint,velocity smallint)
  )
  select jsonb_agg(jsonb_build_object('noteId',"noteId",'startTick',"startTick",
    'durationTicks',"durationTicks",'pitch',pitch,'velocity',velocity)
    order by "startTick",pitch,"noteId"),count(*)
  into v_result,v_count from notes
  having count(distinct "noteId")=count(*) and coalesce(bool_and(
    "noteId" is not null and "startTick">=0 and "durationTicks">0
    and "startTick"+"durationTicks"<=p_duration_ticks
    and pitch between 0 and 127 and velocity between 1 and 127),true);
  if v_result is null then
    if jsonb_array_length(p_notes)=0 then return '[]'::jsonb; end if;
    raise sqlstate '22023' using message='midi_pattern_notes_invalid';
  end if;
  if v_count<>jsonb_array_length(p_notes) then
    raise sqlstate '22023' using message='midi_pattern_notes_invalid';
  end if;
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
  raise sqlstate '22023' using message='midi_pattern_notes_invalid';
end;
$$;
revoke all on function private.canonical_midi_pattern_notes_v3(jsonb,integer) from public,anon,authenticated;

create function private.canonical_manifest_v3(
  p_manifest jsonb,p_project_id uuid,p_workspace_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_track jsonb; v_clip jsonb; v_tracks jsonb:='[]'::jsonb; v_clips jsonb;
  v_track_count integer; v_clip_count integer:=0; v_resolved_note_count integer:=0; v_position integer:=0;
  v_tempo numeric; v_num smallint; v_den smallint; v_ppq smallint; v_duration integer;
  v_key text; v_pattern public.midi_pattern_versions%rowtype;
begin
  if jsonb_typeof(p_manifest)<>'object'
    or not (p_manifest ?& array['manifestVersion','engine','engineVersion','projectId','tempoBpm',
      'timeSignature','musicalKey','ppq','durationTicks','tracks'])
    or (p_workspace_id is null and (select count(*) from jsonb_object_keys(p_manifest))<>10)
    or (p_workspace_id is not null and (
      not p_manifest ? 'workspaceId' or (select count(*) from jsonb_object_keys(p_manifest))<>11))
    or p_manifest->>'manifestVersion'<>'3' or p_manifest->>'engine'<>'jam-session-midi'
    or p_manifest->>'engineVersion'<>'jam-session-midi-3_tone-15.1.22_presets-1'
    or p_manifest->>'projectId'<>p_project_id::text
    or (p_workspace_id is null and p_manifest ? 'workspaceId')
    or (p_workspace_id is not null and p_manifest->>'workspaceId'<>p_workspace_id::text)
    or jsonb_typeof(p_manifest->'timeSignature')<>'object'
    or not ((p_manifest->'timeSignature') ?& array['numerator','denominator'])
    or (select count(*) from jsonb_object_keys(p_manifest->'timeSignature'))<>2
    or jsonb_typeof(p_manifest->'tracks')<>'array' then
    raise sqlstate '22023' using message='midi_manifest_v3_invalid';
  end if;
  begin
    v_tempo:=(p_manifest->>'tempoBpm')::numeric;
    v_num:=(p_manifest->'timeSignature'->>'numerator')::smallint;
    v_den:=(p_manifest->'timeSignature'->>'denominator')::smallint;
    v_ppq:=(p_manifest->>'ppq')::smallint;
    v_duration:=(p_manifest->>'durationTicks')::integer;
    v_key:=p_manifest->>'musicalKey';
  exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
    raise sqlstate '22023' using message='midi_manifest_v3_invalid';
  end;
  if v_tempo not between 20 and 300 or v_num not between 1 and 32
    or v_den not in (1,2,4,8,16,32) or v_ppq<>480
    or v_duration not between 1 and 86400000
    or v_duration>floor(600*v_tempo*480)
    or (v_key is not null and v_key not in (
      'c-major','c-sharp-major','d-major','e-flat-major','e-major','f-major','f-sharp-major','g-major',
      'a-flat-major','a-major','b-flat-major','b-major','c-minor','c-sharp-minor','d-minor','e-flat-minor',
      'e-minor','f-minor','f-sharp-minor','g-minor','g-sharp-minor','a-minor','b-flat-minor','b-minor')) then
    raise sqlstate '22023' using message='midi_manifest_v3_invalid';
  end if;
  v_track_count:=jsonb_array_length(p_manifest->'tracks');
  if v_track_count>16 then raise sqlstate '22023' using message='midi_manifest_v3_track_limit'; end if;
  for v_track in select value from jsonb_array_elements(p_manifest->'tracks') loop
    if jsonb_typeof(v_track)<>'object'
      or not (v_track ?& array['trackId','sortOrder','name','presetId','presetVersion','gainDb','pan','muted','soloed','clips'])
      or (select count(*) from jsonb_object_keys(v_track))<>10
      or (v_track->>'sortOrder')::integer<>v_position
      or (v_track->>'name')<>btrim(v_track->>'name') or char_length(v_track->>'name') not between 1 and 120
      or (v_track->>'gainDb')::numeric not between -60 and 6
      or (v_track->>'pan')::numeric not between -1 and 1
      or jsonb_typeof(v_track->'muted')<>'boolean' or jsonb_typeof(v_track->'soloed')<>'boolean'
      or jsonb_typeof(v_track->'clips')<>'array'
      or not exists(select 1 from private.midi_synth_presets p
        where p.preset_id=v_track->>'presetId' and p.version=(v_track->>'presetVersion')::integer
          and p.engine_version='jam-session-midi-3_tone-15.1.22_presets-1' and p.is_active) then
      raise sqlstate '22023' using message='midi_manifest_v3_invalid';
    end if;
    if jsonb_array_length(v_track->'clips')>32 then
      raise sqlstate '22023' using message='midi_manifest_v3_clip_limit';
    end if;
    v_clips:='[]'::jsonb;
    for v_clip in select value from jsonb_array_elements(v_track->'clips')
      order by (value->>'startTick')::integer,(value->>'clipId')::uuid loop
      v_clip_count:=v_clip_count+1;
      if v_clip_count>512 or jsonb_typeof(v_clip)<>'object'
        or not (v_clip ?& array['clipId','midiPatternVersionId','startTick','durationTicks','sourceStartTick','loop'])
        or (select count(*) from jsonb_object_keys(v_clip))<>6
        or jsonb_typeof(v_clip->'loop')<>'boolean' then
        raise sqlstate '22023' using message='midi_manifest_v3_invalid';
      end if;
      select * into v_pattern from public.midi_pattern_versions where id=(v_clip->>'midiPatternVersionId')::uuid;
      if not found or not (select private.can_read_pattern_version(v_pattern.id))
        or (v_clip->>'startTick')::integer<0 or (v_clip->>'durationTicks')::integer<=0
        or (v_clip->>'sourceStartTick')::integer<0
        or (v_clip->>'startTick')::integer+(v_clip->>'durationTicks')::integer>v_duration
        or (v_clip->>'sourceStartTick')::integer>=v_pattern.duration_ticks
        or (not (v_clip->>'loop')::boolean and
          (v_clip->>'sourceStartTick')::integer+(v_clip->>'durationTicks')::integer>v_pattern.duration_ticks) then
        raise sqlstate '22023' using message='midi_manifest_v3_pattern_unavailable';
      end if;
      v_resolved_note_count:=v_resolved_note_count+v_pattern.note_count;
      if v_resolved_note_count>16384 then
        raise sqlstate '22023' using message='midi_manifest_v3_note_limit';
      end if;
      v_clips:=v_clips||jsonb_build_array(jsonb_build_object(
        'clipId',(v_clip->>'clipId')::uuid,'midiPatternVersionId',(v_clip->>'midiPatternVersionId')::uuid,
        'startTick',(v_clip->>'startTick')::integer,'durationTicks',(v_clip->>'durationTicks')::integer,
        'sourceStartTick',(v_clip->>'sourceStartTick')::integer,'loop',(v_clip->>'loop')::boolean));
    end loop;
    v_tracks:=v_tracks||jsonb_build_array(jsonb_build_object(
      'trackId',(v_track->>'trackId')::uuid,'sortOrder',v_position,'name',v_track->>'name',
      'presetId',v_track->>'presetId','presetVersion',(v_track->>'presetVersion')::integer,
      'gainDb',(v_track->>'gainDb')::numeric,'pan',(v_track->>'pan')::numeric,
      'muted',(v_track->>'muted')::boolean,'soloed',(v_track->>'soloed')::boolean,'clips',v_clips));
    v_position:=v_position+1;
  end loop;
  if (select count(distinct value->>'trackId') from jsonb_array_elements(v_tracks))<>v_track_count
    or (select count(distinct c->>'clipId') from jsonb_array_elements(v_tracks) t
      cross join jsonb_array_elements(t->'clips') c)<>v_clip_count then
    raise sqlstate '22023' using message='midi_manifest_v3_duplicate_id';
  end if;
  return jsonb_build_object('manifestVersion',3,'engine','jam-session-midi',
    'engineVersion','jam-session-midi-3_tone-15.1.22_presets-1','projectId',p_project_id,
    'tempoBpm',v_tempo,'timeSignature',jsonb_build_object('numerator',v_num,'denominator',v_den),
    'musicalKey',v_key,'ppq',480,'durationTicks',v_duration,'tracks',v_tracks)
    || case when p_workspace_id is null then '{}'::jsonb else jsonb_build_object('workspaceId',p_workspace_id) end;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
  raise sqlstate '22023' using message='midi_manifest_v3_invalid';
end;
$$;
revoke all on function private.canonical_manifest_v3(jsonb,uuid,uuid) from public,anon,authenticated;

create function public.create_midi_pattern_v3(
  p_request_id uuid,p_name text,p_source_pattern_version_id uuid default null
) returns table(pattern_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_pattern public.midi_patterns%rowtype;
  v_source public.midi_pattern_versions%rowtype; v_name text:=btrim(p_name);
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_pattern_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_pattern_actor_ineligible'; end if;
  if p_request_id is null or p_name is null or p_name<>v_name or char_length(v_name) not between 1 and 120 then
    raise sqlstate '22023' using message='midi_pattern_invalid'; end if;
  select * into v_pattern from public.midi_patterns where owner_id=v_actor and create_request_id=p_request_id;
  if found then
    if v_pattern.name<>v_name or v_pattern.source_pattern_version_id is distinct from p_source_pattern_version_id then
      raise sqlstate 'PT409' using message='midi_pattern_request_conflict'; end if;
    return query select v_pattern.id,v_pattern.created_at; return;
  end if;
  if p_source_pattern_version_id is not null then
    select * into v_source from public.midi_pattern_versions where id=p_source_pattern_version_id;
    if not found or v_source.reuse_license_code<>'CC-BY-4.0'
      or not (select private.can_read_pattern_version(v_source.id)) then
      raise sqlstate 'PT404' using message='midi_pattern_source_not_found'; end if;
  end if;
  insert into public.midi_patterns(owner_id,create_request_id,name,source_pattern_id,source_pattern_version_id)
  values(v_actor,p_request_id,v_name,v_source.midi_pattern_id,v_source.id) returning * into v_pattern;
  return query select v_pattern.id,v_pattern.created_at;
end;
$$;

create function public.create_midi_pattern_version_v3(
  p_pattern_id uuid,p_request_id uuid,p_expected_version_number integer,
  p_ppq smallint,p_duration_ticks integer,p_notes jsonb,p_publish_for_reuse boolean default false,
  p_rights_attestation_version text default null
) returns table(pattern_version_id uuid,version_number integer,content_sha256 text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_pattern public.midi_patterns%rowtype;
  v_existing public.midi_pattern_versions%rowtype; v_parent public.midi_pattern_versions%rowtype;
  v_notes jsonb; v_hash text; v_credit text; v_source uuid; v_number integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_pattern_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_pattern_actor_ineligible'; end if;
  select * into v_pattern from public.midi_patterns where id=p_pattern_id and owner_id=v_actor and deleted_at is null for update;
  if not found then raise sqlstate 'PT404' using message='midi_pattern_not_found'; end if;
  if p_request_id is null or p_ppq<>480
    or (p_publish_for_reuse and p_rights_attestation_version<>'cc-by-4.0-attestation-v1')
    or (not p_publish_for_reuse and p_rights_attestation_version is not null) then
    raise sqlstate 'PT409' using message='midi_pattern_version_conflict'; end if;
  v_notes:=private.canonical_midi_pattern_notes_v3(p_notes,p_duration_ticks);
  if v_notes<>p_notes then raise sqlstate '22023' using message='midi_pattern_notes_not_canonical'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('ppq',480,
    'durationTicks',p_duration_ticks,'notes',v_notes)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from public.midi_pattern_versions where midi_pattern_id=p_pattern_id and create_request_id=p_request_id;
  if found then
    if v_existing.version_number<>p_expected_version_number or v_existing.duration_ticks<>p_duration_ticks
      or v_existing.content_sha256<>v_hash
      or (v_existing.reuse_license_code is not null)<>p_publish_for_reuse then
      raise sqlstate 'PT409' using message='midi_pattern_version_request_conflict';
    end if;
    return query select v_existing.id,v_existing.version_number,v_existing.content_sha256,v_existing.created_at; return;
  end if;
  v_number:=coalesce((select max(pv.version_number)+1 from public.midi_pattern_versions pv where pv.midi_pattern_id=p_pattern_id),1);
  if p_expected_version_number<>v_number then
    raise sqlstate 'PT409' using message='midi_pattern_version_conflict'; end if;
  select credit_name into v_credit from public.profiles where id=v_actor;
  select * into v_parent from public.midi_pattern_versions where midi_pattern_id=p_pattern_id order by version_number desc limit 1;
  v_source:=coalesce(v_pattern.source_pattern_version_id,v_parent.source_pattern_version_id,v_parent.id);
  insert into public.midi_pattern_versions(midi_pattern_id,version_number,create_request_id,creator_id,
    creator_credit_name,parent_pattern_version_id,source_pattern_version_id,ppq,duration_ticks,note_count,
    content_sha256,reuse_license_code,reuse_license_version,reuse_license_url)
  values(p_pattern_id,v_number,p_request_id,v_actor,v_credit,v_parent.id,v_source,480,p_duration_ticks,
    jsonb_array_length(v_notes),v_hash,case when p_publish_for_reuse then 'CC-BY-4.0' end,
    case when p_publish_for_reuse then '4.0' end,
    case when p_publish_for_reuse then 'https://creativecommons.org/licenses/by/4.0/' end)
  returning * into v_existing;
  insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
  select v_existing.id,"noteId","startTick","durationTicks",pitch,velocity
  from jsonb_to_recordset(v_notes) n("noteId" uuid,"startTick" integer,"durationTicks" integer,pitch smallint,velocity smallint);
  if p_publish_for_reuse then update public.midi_patterns set visibility='public',
    rights_attestation_version=p_rights_attestation_version,published_at=coalesce(published_at,statement_timestamp()),
    updated_at=statement_timestamp() where id=p_pattern_id; end if;
  return query select v_existing.id,v_existing.version_number,v_existing.content_sha256,v_existing.created_at;
end;
$$;

revoke all on function public.create_midi_pattern_v3(uuid,text,uuid),
  public.create_midi_pattern_version_v3(uuid,uuid,integer,smallint,integer,jsonb,boolean,text)
  from public,anon;
grant execute on function public.create_midi_pattern_v3(uuid,text,uuid),
  public.create_midi_pattern_version_v3(uuid,uuid,integer,smallint,integer,jsonb,boolean,text)
  to authenticated;

create function private.replace_workspace_projection_v3(p_workspace_id uuid,p_manifest jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_track jsonb; v_clip jsonb; v_track_duration integer;
begin
  delete from public.workspace_clips where workspace_id=p_workspace_id;
  delete from public.workspace_tracks where workspace_id=p_workspace_id;
  for v_track in select value from jsonb_array_elements(p_manifest->'tracks') loop
    select greatest(1,coalesce(max((c->>'startTick')::integer+(c->>'durationTicks')::integer),1))
    into v_track_duration from jsonb_array_elements(v_track->'clips') c;
    insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,name,
      position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,kind,preset_id,preset_version)
    values(p_workspace_id,(v_track->>'trackId')::uuid,null,null,v_track->>'name',0,0,
      greatest(1,ceil(v_track_duration*60000.0/((p_manifest->>'tempoBpm')::numeric*480))::integer),
      (v_track->>'gainDb')::numeric,(v_track->>'pan')::numeric,(v_track->>'muted')::boolean,
      (v_track->>'soloed')::boolean,(v_track->>'sortOrder')::smallint,'midi',
      v_track->>'presetId',(v_track->>'presetVersion')::integer);
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      insert into public.workspace_clips(workspace_id,track_id,clip_id,kind,position_ms,
        trim_start_ms,duration_ms,midi_stem_version_id,midi_pattern_version_id,start_tick,
        duration_ticks,source_start_tick,loop)
      values(p_workspace_id,(v_track->>'trackId')::uuid,(v_clip->>'clipId')::uuid,'midi',
        null,null,null,null,(v_clip->>'midiPatternVersionId')::uuid,(v_clip->>'startTick')::integer,
        (v_clip->>'durationTicks')::integer,(v_clip->>'sourceStartTick')::integer,(v_clip->>'loop')::boolean);
    end loop;
  end loop;
end;
$$;
revoke all on function private.replace_workspace_projection_v3(uuid,jsonb) from public,anon,authenticated;

create function private.freeze_workspace_arrangement_v3(
  p_workspace_id uuid,p_request_id uuid,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_workspace public.workspaces%rowtype; v_existing public.arrangement_versions%rowtype;
  v_manifest jsonb; v_hash text; v_arrangement public.arrangement_versions%rowtype;
begin
  select * into v_workspace from public.workspaces where id=p_workspace_id;
  if not found or v_workspace.owner_id<>p_actor or v_workspace.status<>'active' or v_workspace.manifest_version<>3 then
    raise sqlstate 'PT404' using message='midi_workspace_not_found'; end if;
  v_manifest:=v_workspace.manifest-'workspaceId';
  v_manifest:=private.canonical_manifest_v3(v_manifest,v_workspace.project_id,null);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from public.arrangement_versions a
    where a.project_id=v_workspace.project_id and a.create_request_id=p_request_id;
  if found then
    if v_existing.created_by<>p_actor or v_existing.manifest_sha256<>v_hash or v_existing.manifest<>v_manifest then
      raise sqlstate 'PT409' using message='midi_arrangement_request_conflict';
    end if;
    return v_existing.id;
  end if;
  insert into public.arrangement_versions(project_id,created_by,create_request_id,manifest_version,
    engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,
    time_signature_denominator,musical_key,ppq,duration_ticks)
  values(v_workspace.project_id,p_actor,p_request_id,3,'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1',v_manifest,v_hash,
    (v_manifest->>'tempoBpm')::numeric,(v_manifest->'timeSignature'->>'numerator')::smallint,
    (v_manifest->'timeSignature'->>'denominator')::smallint,v_manifest->>'musicalKey',480,
    (v_manifest->>'durationTicks')::integer) returning * into v_arrangement;
  insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,
    preset_id,preset_version,gain_db,pan,muted,soloed)
  select v_arrangement.id,v_arrangement.project_id,(t->>'trackId')::uuid,(t->>'sortOrder')::smallint,
    t->>'name',t->>'presetId',(t->>'presetVersion')::integer,(t->>'gainDb')::numeric,
    (t->>'pan')::numeric,(t->>'muted')::boolean,(t->>'soloed')::boolean
  from jsonb_array_elements(v_manifest->'tracks') t;
  insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,
    midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop)
  select v_arrangement.id,v_arrangement.project_id,(t->>'trackId')::uuid,(c->>'clipId')::uuid,
    (c->>'midiPatternVersionId')::uuid,(c->>'startTick')::integer,(c->>'durationTicks')::integer,
    (c->>'sourceStartTick')::integer,(c->>'loop')::boolean
  from jsonb_array_elements(v_manifest->'tracks') t
  cross join jsonb_array_elements(t->'clips') c;
  return v_arrangement.id;
end;
$$;
revoke all on function private.freeze_workspace_arrangement_v3(uuid,uuid,uuid) from public,anon,authenticated;

create function public.create_midi_project_workspace_v3(
  p_request_id uuid,p_title text,p_description text,p_bpm numeric,p_musical_key text,
  p_time_signature_numerator smallint,p_time_signature_denominator smallint,p_license_code text,
  p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[]
) returns table(project_id uuid,title text,lock_version integer,workspace_id uuid)
language plpgsql security definer set search_path='' as $$
declare v_result record; v_workspace public.workspaces%rowtype; v_manifest jsonb; v_hash text;
begin
  select * into v_result from public.create_midi_project_workspace(p_request_id,p_title,p_description,
    p_bpm,p_musical_key,p_time_signature_numerator,p_time_signature_denominator,p_license_code,
    p_genre_ids,p_primary_genre_id,p_tag_ids);
  select * into v_workspace from public.workspaces where id=v_result.workspace_id for update;
  if v_workspace.manifest_version=2 then
    v_manifest:=jsonb_build_object('manifestVersion',3,'engine','jam-session-midi',
      'engineVersion','jam-session-midi-3_tone-15.1.22_presets-1','projectId',v_result.project_id,
      'workspaceId',v_workspace.id,'tempoBpm',p_bpm,'timeSignature',jsonb_build_object(
        'numerator',p_time_signature_numerator,'denominator',p_time_signature_denominator),
      'musicalKey',p_musical_key,'ppq',480,'durationTicks',7680,'tracks','[]'::jsonb);
    v_manifest:=private.canonical_manifest_v3(v_manifest,v_result.project_id,v_workspace.id);
    v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
    update public.workspaces set manifest=v_manifest,manifest_version=3,engine='jam-session-midi',
      engine_version='jam-session-midi-3_tone-15.1.22_presets-1',manifest_sha256=v_hash,
      snapshot_asset_id=null where id=v_workspace.id;
  elsif v_workspace.manifest_version<>3 then
    raise sqlstate 'PT409' using message='project_request_conflict';
  end if;
  return query select v_result.project_id,v_result.title,v_result.lock_version,v_result.workspace_id;
end;
$$;

create function public.save_midi_workspace_v3(
  p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,p_manifest jsonb
) returns table(workspace_id uuid,lock_version integer,manifest_sha256 text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_workspace public.workspaces%rowtype;
  v_canonical jsonb; v_hash text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_workspace_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_workspace_actor_ineligible'; end if;
  select * into v_workspace from public.workspaces where id=p_workspace_id and owner_id=v_actor and status='active' for update;
  if not found or v_workspace.manifest_version<>3 or (v_workspace.contribution_id is not null and not exists(
    select 1 from public.contributions c where c.id=v_workspace.contribution_id and c.author_id=v_actor
      and c.status in ('draft','changes_requested'))) then
    raise sqlstate 'PT404' using message='midi_workspace_not_found'; end if;
  v_canonical:=private.canonical_manifest_v3(p_manifest,v_workspace.project_id,v_workspace.id);
  if v_canonical<>p_manifest then raise sqlstate '22023' using message='midi_manifest_v3_not_canonical'; end if;
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  if v_workspace.last_manifest_request_id=p_request_id then
    if v_workspace.last_manifest_expected_lock_version<>p_expected_lock_version or v_workspace.manifest_sha256<>v_hash then
      raise sqlstate 'PT409' using message='midi_workspace_request_conflict'; end if;
    return query select v_workspace.id,v_workspace.lock_version,v_workspace.manifest_sha256,v_workspace.updated_at; return;
  end if;
  if p_request_id is null or v_workspace.lock_version<>p_expected_lock_version then
    raise sqlstate 'PT409' using message='midi_workspace_save_conflict'; end if;
  perform private.replace_workspace_projection_v3(v_workspace.id,v_canonical);
  update public.workspaces set manifest=v_canonical,manifest_sha256=v_hash,
    lock_version=public.workspaces.lock_version+1,last_manifest_request_id=p_request_id,
    last_manifest_expected_lock_version=p_expected_lock_version,updated_at=statement_timestamp()
  where id=v_workspace.id returning * into v_workspace;
  insert into private.workspace_snapshots(workspace_id,project_id,owner_id,request_id,lock_version,manifest,manifest_sha256)
  values(v_workspace.id,v_workspace.project_id,v_actor,p_request_id,v_workspace.lock_version,v_canonical,v_hash);
  delete from private.workspace_snapshots s where s.workspace_id=v_workspace.id and s.id in (
    select s2.id from private.workspace_snapshots s2 where s2.workspace_id=v_workspace.id
    order by s2.lock_version desc offset 20);
  return query select v_workspace.id,v_workspace.lock_version,v_workspace.manifest_sha256,v_workspace.updated_at;
end;
$$;

create function public.publish_midi_workspace_revision_v3(
  p_workspace_id uuid,p_request_id uuid,p_expected_workspace_lock_version integer,
  p_expected_base_revision_id uuid,p_message text
) returns table(revision_id uuid,revision_number integer,arrangement_version_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_workspace public.workspaces%rowtype;
  v_project public.projects%rowtype; v_existing public.project_revisions%rowtype;
  v_arrangement public.arrangement_versions%rowtype; v_revision public.project_revisions%rowtype;
  v_arrangement_id uuid; v_number integer; v_duration_ms integer; v_message text:=nullif(btrim(p_message),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_publish_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_publish_actor_ineligible'; end if;
  select * into v_workspace from public.workspaces where id=p_workspace_id and owner_id=v_actor
    and contribution_id is null and status='active' for update;
  if not found or v_workspace.manifest_version<>3 then raise sqlstate 'PT404' using message='midi_workspace_not_found'; end if;
  select * into v_existing from public.project_revisions r where r.project_id=v_workspace.project_id and r.publish_request_id=p_request_id;
  if found then
    if v_existing.expected_base_revision_id is distinct from p_expected_base_revision_id
      or v_existing.message is distinct from v_message
      or v_workspace.lock_version<>p_expected_workspace_lock_version
      or v_existing.manifest<>(v_workspace.manifest-'workspaceId') then
      raise sqlstate 'PT409' using message='midi_publish_request_conflict';
    end if;
    return query select v_existing.id,v_existing.revision_number,v_existing.arrangement_version_id,v_existing.created_at; return;
  end if;
  select * into v_project from public.projects where id=v_workspace.project_id and owner_id=v_actor
    and deleted_at is null and moderation_state='visible' for update;
  if not found then raise sqlstate 'PT404' using message='midi_publish_project_not_found'; end if;
  if v_workspace.lock_version<>p_expected_workspace_lock_version
    or v_workspace.base_revision_id is distinct from p_expected_base_revision_id
    or v_project.current_revision_id is distinct from p_expected_base_revision_id
    or (v_message is not null and char_length(v_message)>500) then
    raise sqlstate 'PT409' using message='midi_publish_conflict'; end if;
  v_arrangement_id:=private.freeze_workspace_arrangement_v3(v_workspace.id,p_request_id,v_actor);
  select * into strict v_arrangement from public.arrangement_versions where id=v_arrangement_id;
  select coalesce(max(r.revision_number)+1,1) into v_number from public.project_revisions r where r.project_id=v_project.id;
  v_duration_ms:=ceil(v_arrangement.duration_ticks*60000.0/(v_arrangement.tempo_bpm*v_arrangement.ppq));
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,
    publish_request_id,expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,
    manifest_sha256,duration_ms,snapshot_asset_id,arrangement_version_id)
  values(v_project.id,v_number,v_project.current_revision_id,v_actor,p_request_id,p_expected_base_revision_id,
    v_message,v_arrangement.manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    v_arrangement.manifest_sha256,v_duration_ms,null,v_arrangement.id) returning * into v_revision;
  update public.projects set current_revision_id=v_revision.id,status='active',published_at=coalesce(published_at,statement_timestamp()),
    lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_project.id;
  update public.workspaces set base_revision_id=v_revision.id,updated_at=statement_timestamp() where id=v_workspace.id;
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_project.id,v_revision.id,'project_revision_published',jsonb_build_object('revisionNumber',v_number));
  return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at;
end;
$$;

revoke all on function public.create_midi_project_workspace_v3(uuid,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]),
  public.save_midi_workspace_v3(uuid,uuid,integer,jsonb),
  public.publish_midi_workspace_revision_v3(uuid,uuid,integer,uuid,text)
  from public,anon;
grant execute on function public.create_midi_project_workspace_v3(uuid,text,text,numeric,text,smallint,smallint,text,uuid[],uuid,uuid[]),
  public.save_midi_workspace_v3(uuid,uuid,integer,jsonb),
  public.publish_midi_workspace_revision_v3(uuid,uuid,integer,uuid,text)
  to authenticated;

create function public.create_contribution_workspace_v3(
  p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid,p_title text,p_description text
) returns table(contribution_id uuid,workspace_id uuid,base_revision_id uuid,lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_result record; v_workspace public.workspaces%rowtype;
  v_manifest jsonb; v_hash text;
begin
  perform 1 from public.project_revisions r where r.project_id=p_project_id
    and r.id=p_expected_current_revision_id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='contribution_base_not_midi_v3'; end if;
  select * into v_result from public.create_contribution_workspace(p_project_id,p_request_id,
    p_expected_current_revision_id,p_title,p_description);
  select * into v_workspace from public.workspaces where id=v_result.workspace_id for update;
  if v_workspace.manifest_version=3 and not v_workspace.manifest ? 'workspaceId' then
    v_manifest:=v_workspace.manifest||jsonb_build_object('workspaceId',v_workspace.id);
    v_manifest:=private.canonical_manifest_v3(v_manifest,p_project_id,v_workspace.id);
    v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
    update public.workspaces set manifest=v_manifest,manifest_sha256=v_hash where id=v_workspace.id;
    perform private.replace_workspace_projection_v3(v_workspace.id,v_manifest);
  elsif v_workspace.manifest_version<>3 then
    raise sqlstate 'PT409' using message='contribution_request_conflict';
  end if;
  return query select v_result.contribution_id,v_result.workspace_id,v_result.base_revision_id,
    v_result.lock_version,v_result.created_at;
end;
$$;

create function public.submit_contribution_v3(
  p_contribution_id uuid,p_request_id uuid,p_expected_workspace_lock_version integer,
  p_expected_base_revision_id uuid,p_expected_manifest_sha256 text,p_attestation_version text
) returns table(contribution_id uuid,contribution_version_id uuid,version_number integer,
  arrangement_version_id uuid,status public.contribution_status,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype; v_existing public.contribution_versions%rowtype;
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

create function public.accept_contribution_v3(
  p_contribution_id uuid,p_request_id uuid,p_expected_contribution_version_id uuid,
  p_expected_project_revision_id uuid,p_message text default null
) returns table(revision_id uuid,revision_number integer,arrangement_version_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_version public.contribution_versions%rowtype;
  v_existing public.contribution_reviews%rowtype; v_revision public.project_revisions%rowtype;
  v_number integer; v_message text:=nullif(btrim(p_message),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_review_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='contribution_review_actor_ineligible'; end if;
  select * into v_contribution from public.contributions where id=p_contribution_id for update;
  if not found then raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_project from public.projects where id=v_contribution.project_id and owner_id=v_actor
    and deleted_at is null and moderation_state='visible' for update;
  if not found then raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_existing from public.contribution_reviews cr where cr.contribution_id=p_contribution_id and cr.request_id=p_request_id;
  if found then
    if v_existing.requested_decision<>'accept' or v_existing.contribution_version_id<>p_expected_contribution_version_id
      or v_existing.expected_project_revision_id<>p_expected_project_revision_id then
      raise sqlstate 'PT409' using message='contribution_review_request_conflict'; end if;
    if v_existing.resulting_revision_id is null then raise sqlstate 'PT409' using message='contribution_base_outdated'; end if;
    select * into v_revision from public.project_revisions where id=v_existing.resulting_revision_id;
    return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at; return;
  end if;
  select * into v_version from public.contribution_versions cv where cv.contribution_id=p_contribution_id
    and cv.id=p_expected_contribution_version_id and cv.arrangement_version_id is not null;
  if not found or v_contribution.status<>'submitted' or v_contribution.current_version_id<>v_version.id
    or v_project.current_revision_id<>p_expected_project_revision_id
    or v_contribution.base_revision_id<>p_expected_project_revision_id
    or (v_message is not null and char_length(v_message)>500) then
    raise sqlstate 'PT409' using message='contribution_base_outdated'; end if;
  select coalesce(max(r.revision_number)+1,1) into v_number from public.project_revisions r where r.project_id=v_project.id;
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,publish_request_id,
    expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,
    snapshot_asset_id,accepted_contribution_id,accepted_contribution_version_id,arrangement_version_id)
  values(v_project.id,v_number,v_project.current_revision_id,v_actor,p_request_id,p_expected_project_revision_id,
    v_message,v_version.manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    v_version.manifest_sha256,v_version.duration_ms,null,v_contribution.id,v_version.id,v_version.arrangement_version_id)
  returning * into v_revision;
  insert into public.contribution_reviews(contribution_id,contribution_version_id,reviewer_id,request_id,
    requested_decision,applied_decision,reason,note,expected_project_revision_id,resulting_revision_id)
  values(v_contribution.id,v_version.id,v_actor,p_request_id,'accept','accept',null,null,
    p_expected_project_revision_id,v_revision.id);
  update public.contributions set status='accepted',reviewed_at=statement_timestamp(),reviewed_by=v_actor,
    review_note=null,updated_at=statement_timestamp() where id=v_contribution.id;
  update public.projects set current_revision_id=v_revision.id,lock_version=lock_version+1,
    updated_at=statement_timestamp() where id=v_project.id;
  update public.workspaces set status='archived',updated_at=statement_timestamp()
    where contribution_id=v_contribution.id and status='active';
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_project.id,v_revision.id,'project_revision_published',jsonb_build_object('revisionNumber',v_number));
  return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at;
end;
$$;

revoke all on function public.create_contribution_workspace_v3(uuid,uuid,uuid,text,text),
  public.submit_contribution_v3(uuid,uuid,integer,uuid,text,text),
  public.accept_contribution_v3(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.create_contribution_workspace_v3(uuid,uuid,uuid,text,text),
  public.submit_contribution_v3(uuid,uuid,integer,uuid,text,text),
  public.accept_contribution_v3(uuid,uuid,uuid,uuid,text) to authenticated;

create function public.fork_project_v3(
  p_source_project_id uuid,p_source_revision_id uuid,p_request_id uuid,
  p_expected_license_code text,p_title text,p_description text
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
      or p_expected_license_code<>'cc-by-4.0' then
      raise sqlstate 'PT409' using message='fork_request_conflict'; end if;
    select * into v_revision from public.project_revisions r where r.project_id=v_existing.id and r.revision_number=1;
    select * into v_workspace from public.workspaces w where w.project_id=v_existing.id and w.owner_id=v_actor and w.status='active';
    return query select v_existing.id,v_revision.id,v_revision.arrangement_version_id,v_workspace.id,v_existing.created_at; return;
  end if;
  if p_request_id is null or v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description)>5000) then
    raise sqlstate '22023' using message='fork_invalid_input'; end if;
  select * into v_source from public.projects where id=p_source_project_id and visibility='public'
    and status='active' and deleted_at is null and moderation_state='visible';
  if not found or v_source.license_code<>'cc-by-4.0' or p_expected_license_code<>'cc-by-4.0' then
    raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  select * into v_source_revision from public.project_revisions r where r.project_id=v_source.id
    and r.id=p_source_revision_id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  select * into v_source_arrangement from public.arrangement_versions a where a.id=v_source_revision.arrangement_version_id;
  insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,compatibility,source_project_id,source_revision_id)
  values(v_actor,p_request_id,v_title,v_description,v_source_arrangement.tempo_bpm,v_source_arrangement.musical_key,
    v_source_arrangement.time_signature_numerator,v_source_arrangement.time_signature_denominator,
    'cc-by-4.0','midi',v_source.id,v_source_revision.id) returning * into v_target;
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

revoke all on function public.fork_project_v3(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.fork_project_v3(uuid,uuid,uuid,text,text,text) to authenticated;

comment on table public.midi_patterns is 'Reusable MIDI pattern identity; immutable versions carry exact creator and source lineage.';
comment on table public.midi_pattern_versions is 'Immutable manifest-v3 MIDI note content and CC BY reuse metadata.';
comment on table public.arrangement_versions is 'Immutable complete MIDI-only manifest-v3 snapshot shared by revision and contribution wrappers.';
comment on table private.workspace_snapshots is 'Bounded Postgres recovery history for private optimistic workspaces; commands retain at most 20 rows.';
comment on column public.project_revisions.arrangement_version_id is 'Expand-first manifest-v3 arrangement reference; null for transitional v1/v2 revisions.';
comment on column public.contribution_versions.arrangement_version_id is 'Expand-first manifest-v3 arrangement reference; null for transitional v1/v2 submissions.';
