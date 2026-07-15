-- MIDI-06: exact MIDI contribution, credit-lineage, acceptance, and fork support.

alter table public.contribution_versions
  alter column snapshot_asset_id drop not null,
  drop constraint contribution_versions_manifest_version_check,
  drop constraint contribution_versions_engine_check,
  drop constraint contribution_versions_engine_version_check,
  add constraint contribution_versions_format_check check (
    (manifest_version = 1 and engine = 'waveform-playlist'
      and engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22'
      and snapshot_asset_id is not null)
    or
    (manifest_version = 2 and engine = 'jam-session-composite'
      and engine_version = 'jam-session-composite-2_tone-15.1.22'
      and snapshot_asset_id is null)
  );

alter table public.contribution_version_tracks
  drop constraint contribution_version_tracks_asset_id_fkey,
  drop constraint contribution_version_tracks_position_ms_check,
  drop constraint contribution_version_tracks_trim_start_ms_check,
  drop constraint contribution_version_tracks_duration_ms_check,
  drop constraint contribution_version_tracks_sort_order_check,
  alter column asset_id drop not null,
  alter column position_ms drop not null,
  alter column trim_start_ms drop not null,
  alter column duration_ms drop not null,
  add column kind text not null default 'audio',
  add column preset_id text,
  add column preset_version integer,
  add constraint contribution_version_tracks_asset_fk foreign key(asset_id)
    references public.assets(id) on delete restrict,
  add constraint contribution_version_tracks_sort_order_check
    check(sort_order between 0 and 27),
  add constraint contribution_version_tracks_kind_check check (
    (kind = 'audio' and asset_id is not null and position_ms is not null
      and trim_start_ms is not null and duration_ms is not null
      and preset_id is null and preset_version is null)
    or
    (kind = 'midi' and asset_id is null and instrument_id is null
      and position_ms = 0 and trim_start_ms = 0 and duration_ms > 0
      and preset_id is not null and preset_version is not null)
  ),
  add constraint contribution_version_tracks_preset_fk
    foreign key(preset_id, preset_version)
    references private.midi_synth_presets(preset_id, version) on delete restrict;

create table public.contribution_version_clips (
  contribution_version_id uuid not null references public.contribution_versions(id) on delete restrict,
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
  primary key(contribution_version_id, clip_id),
  foreign key(contribution_version_id, track_id)
    references public.contribution_version_tracks(contribution_version_id, track_id)
    on delete restrict,
  check (
    (kind='audio' and position_ms>=0 and trim_start_ms>=0 and duration_ms>0
      and midi_stem_version_id is null and start_tick is null
      and duration_ticks is null and source_start_tick is null and loop is null)
    or
    (kind='midi' and position_ms is null and trim_start_ms is null and duration_ms is null
      and midi_stem_version_id is not null and start_tick>=0
      and duration_ticks>0 and source_start_tick>=0 and loop is not null)
  )
);
create index contribution_version_clips_track_idx
  on public.contribution_version_clips(contribution_version_id, track_id);
create index contribution_version_clips_stem_version_idx
  on public.contribution_version_clips(midi_stem_version_id)
  where midi_stem_version_id is not null;

alter table public.revision_midi_track_credits
  add column credited_stem_version_id uuid references public.midi_stem_versions(id) on delete restrict,
  add column credit_role text;

update public.revision_midi_track_credits
set credited_stem_version_id = midi_stem_version_id,
    credit_role = 'creator';

alter table public.revision_midi_track_credits
  alter column credited_stem_version_id set not null,
  alter column credit_role set not null,
  add constraint revision_midi_track_credits_role_check
    check(credit_role in ('creator','derivation_source')),
  drop constraint revision_midi_track_credits_pkey,
  add primary key(revision_id, track_id, midi_stem_version_id,
    credited_stem_version_id, credit_role);

create table public.contribution_version_midi_track_credits (
  contribution_version_id uuid not null,
  track_id uuid not null,
  midi_stem_version_id uuid not null references public.midi_stem_versions(id) on delete restrict,
  credited_stem_version_id uuid not null references public.midi_stem_versions(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  creator_credit_name text not null check(
    creator_credit_name=btrim(creator_credit_name)
    and char_length(creator_credit_name) between 1 and 120
  ),
  credit_role text not null check(credit_role in ('creator','derivation_source')),
  primary key(contribution_version_id, track_id, midi_stem_version_id,
    credited_stem_version_id, credit_role),
  foreign key(contribution_version_id, track_id)
    references public.contribution_version_tracks(contribution_version_id, track_id)
    on delete restrict
);
create index contribution_version_midi_credits_creator_idx
  on public.contribution_version_midi_track_credits(creator_id);
create index contribution_version_midi_credits_referenced_idx
  on public.contribution_version_midi_track_credits(midi_stem_version_id);

create trigger contribution_version_clips_immutable
  before update or delete on public.contribution_version_clips
  for each row execute function private.reject_immutable_change();
create trigger contribution_version_midi_credits_immutable
  before update or delete on public.contribution_version_midi_track_credits
  for each row execute function private.reject_immutable_change();

alter table public.contribution_version_clips enable row level security;
alter table public.contribution_version_midi_track_credits enable row level security;
revoke all on public.contribution_version_clips,
  public.contribution_version_midi_track_credits from public, anon, authenticated;
grant select on public.contribution_version_clips,
  public.contribution_version_midi_track_credits to authenticated;

create policy contribution_version_clip_participants_read
on public.contribution_version_clips for select to authenticated using (
  (select private.is_active_project_actor()) and exists (
    select 1 from public.contribution_versions v
    join public.contributions c on c.id=v.contribution_id
    where v.id=contribution_version_clips.contribution_version_id
      and (c.author_id=(select auth.uid()) or
        (c.status<>'draft' and exists(select 1 from public.projects p
          where p.id=c.project_id and p.owner_id=(select auth.uid()))))
  )
);
create policy contribution_version_midi_credit_participants_read
on public.contribution_version_midi_track_credits for select to authenticated using (
  (select private.is_active_project_actor()) and exists (
    select 1 from public.contribution_versions v
    join public.contributions c on c.id=v.contribution_id
    where v.id=contribution_version_midi_track_credits.contribution_version_id
      and (c.author_id=(select auth.uid()) or
        (c.status<>'draft' and exists(select 1 from public.projects p
          where p.id=c.project_id and p.owner_id=(select auth.uid()))))
  )
);

drop policy referenced_midi_stem_versions_read on public.midi_stem_versions;
create policy referenced_midi_stem_versions_read on public.midi_stem_versions
for select to authenticated using (
  (select private.is_active_midi_actor()) and (
    owner_id=(select auth.uid())
    or exists(select 1 from public.workspace_clips wc
      join public.workspaces w on w.id=wc.workspace_id
      where wc.midi_stem_version_id=midi_stem_versions.id
        and w.owner_id=(select auth.uid()) and w.status='active')
    or exists(select 1 from public.revision_clips rc
      join public.project_revisions r on r.id=rc.revision_id
      where rc.midi_stem_version_id=midi_stem_versions.id
        and ((select private.is_project_member(r.project_id)) or exists(
          select 1 from public.public_project_catalog catalog
          where catalog.project_id=r.project_id and catalog.current_revision_id=r.id)))
    or exists(select 1 from public.contribution_version_clips cvc
      join public.contribution_versions cv on cv.id=cvc.contribution_version_id
      join public.contributions c on c.id=cv.contribution_id
      join public.projects p on p.id=c.project_id
      where cvc.midi_stem_version_id=midi_stem_versions.id
        and (c.author_id=(select auth.uid())
          or (c.status<>'draft' and p.owner_id=(select auth.uid())))
    )
  )
);

create function private.fill_revision_midi_credit_defaults()
returns trigger language plpgsql set search_path='' as $$
begin
  new.credited_stem_version_id := coalesce(new.credited_stem_version_id,
    new.midi_stem_version_id);
  new.credit_role := coalesce(new.credit_role, 'creator');
  return new;
end $$;
create trigger fill_revision_midi_credit_defaults
before insert on public.revision_midi_track_credits
for each row execute function private.fill_revision_midi_credit_defaults();

create function private.snapshot_revision_midi_lineage()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind<>'midi' then return new; end if;
  with recursive lineage as (
    select v.id,v.owner_id,v.creator_credit_name,v.parent_stem_version_id,0 as depth
    from public.midi_stem_versions v where v.id=new.midi_stem_version_id
    union all
    select parent.id,parent.owner_id,parent.creator_credit_name,
      parent.parent_stem_version_id,lineage.depth+1
    from lineage join public.midi_stem_versions parent
      on parent.id=lineage.parent_stem_version_id
  )
  insert into public.revision_midi_track_credits(
    revision_id,track_id,midi_stem_version_id,credited_stem_version_id,
    creator_id,creator_credit_name,credit_role
  ) select new.revision_id,new.track_id,new.midi_stem_version_id,id,
      owner_id,creator_credit_name,
      case when depth=0 then 'creator' else 'derivation_source' end
    from lineage on conflict do nothing;
  return new;
end $$;
create trigger snapshot_revision_midi_lineage
after insert on public.revision_clips
for each row execute function private.snapshot_revision_midi_lineage();

create function private.snapshot_contribution_midi_lineage()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind<>'midi' then return new; end if;
  with recursive lineage as (
    select v.id,v.owner_id,v.creator_credit_name,v.parent_stem_version_id,0 as depth
    from public.midi_stem_versions v where v.id=new.midi_stem_version_id
    union all
    select parent.id,parent.owner_id,parent.creator_credit_name,
      parent.parent_stem_version_id,lineage.depth+1
    from lineage join public.midi_stem_versions parent
      on parent.id=lineage.parent_stem_version_id
  )
  insert into public.contribution_version_midi_track_credits(
    contribution_version_id,track_id,midi_stem_version_id,
    credited_stem_version_id,creator_id,creator_credit_name,credit_role
  ) select new.contribution_version_id,new.track_id,new.midi_stem_version_id,id,
      owner_id,creator_credit_name,
      case when depth=0 then 'creator' else 'derivation_source' end
    from lineage on conflict do nothing;
  return new;
end $$;
create trigger snapshot_contribution_midi_lineage
after insert on public.contribution_version_clips
for each row execute function private.snapshot_contribution_midi_lineage();

revoke all on function private.fill_revision_midi_credit_defaults(),
  private.snapshot_revision_midi_lineage(),
  private.snapshot_contribution_midi_lineage()
from public, anon, authenticated;

create or replace function private.canonical_project_manifest_v2(
  p_project_id uuid,p_manifest jsonb,p_allow_empty boolean default false
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_project public.projects%rowtype; v_track jsonb; v_clip jsonb;
  v_tracks jsonb:='[]'::jsonb; v_clips jsonb;
  v_track_ids uuid[]:='{}'::uuid[]; v_clip_ids uuid[]:='{}'::uuid[];
  v_orders integer[]:='{}'::integer[]; v_midi_count integer:=0;
  v_audio_count integer:=0; v_duration_ticks integer; v_max_ticks integer;
  v_track_id uuid; v_clip_id uuid; v_stem public.midi_stem_versions%rowtype;
  v_position integer:=0;
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
  v_duration_ticks:=(p_manifest->>'durationTicks')::integer;
  v_max_ticks:=floor(10*60*(p_manifest->>'tempoBpm')::numeric*480);
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
    v_track_id:=(v_track->>'trackId')::uuid;
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
    v_track_ids:=array_append(v_track_ids,v_track_id);
    v_orders:=array_append(v_orders,(v_track->>'sortOrder')::integer);
    v_clips:='[]'::jsonb;
    if v_track->>'kind'='midi' then
      v_midi_count:=v_midi_count+1;
      if v_midi_count>16 or (select count(*) from jsonb_object_keys(v_track))<>12
        or not (v_track ?& array['presetId','presetVersion'])
        or (v_track->>'instrumentId') is not null
        or not exists(select 1 from private.midi_synth_presets p
          where p.preset_id=v_track->>'presetId'
            and p.version=(v_track->>'presetVersion')::integer) then
        raise sqlstate '22023' using message='workspace_invalid_midi_track';
      end if;
    elsif v_track->>'kind'='audio' then
      v_audio_count:=v_audio_count+1;
      if v_project.compatibility<>'legacy_hybrid' or v_audio_count>12
        or (select count(*) from jsonb_object_keys(v_track))<>11
        or not (v_track ? 'assetId') then
        raise sqlstate '22023' using message='workspace_invalid_audio_track';
      end if;
      if not exists(select 1 from public.assets a
        where a.id=(v_track->>'assetId')::uuid and a.kind='source_audio'
          and a.status='ready' and a.deleted_at is null
          and (a.owner_id=(select auth.uid()) or exists(
            select 1 from public.revision_tracks rt
            join public.project_revisions r on r.id=rt.revision_id
            where r.project_id=p_project_id and rt.asset_id=a.id))) then
        raise sqlstate 'PT409' using message='workspace_asset_unavailable';
      end if;
    else
      raise sqlstate '22023' using message='workspace_invalid_manifest';
    end if;
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      v_clip_id:=(v_clip->>'clipId')::uuid;
      if v_clip_id=any(v_clip_ids) then
        raise sqlstate '22023' using message='workspace_duplicate_clip';
      end if;
      v_clip_ids:=array_append(v_clip_ids,v_clip_id);
      if v_track->>'kind'='midi' then
        if (select count(*) from jsonb_object_keys(v_clip))<>6
          or not (v_clip ?& array['clipId','midiStemVersionId','startTick',
            'durationTicks','sourceStartTick','loop']) then
          raise sqlstate '22023' using message='workspace_invalid_midi_clip';
        end if;
        select * into v_stem from public.midi_stem_versions
          where id=(v_clip->>'midiStemVersionId')::uuid;
        if not found
          or (v_stem.owner_id<>(select auth.uid()) and not exists(
            select 1 from public.revision_clips rc
            join public.project_revisions r on r.id=rc.revision_id
            where r.project_id=p_project_id
              and rc.midi_stem_version_id=v_stem.id) and not exists(
            select 1 from public.contribution_version_clips cvc
            join public.contribution_versions cv on cv.id=cvc.contribution_version_id
            join public.contributions c on c.id=cv.contribution_id
            join public.projects p on p.id=c.project_id
            where c.project_id=p_project_id and cvc.midi_stem_version_id=v_stem.id
              and c.status<>'draft' and p.owner_id=(select auth.uid())))
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

alter function public.create_midi_stem_draft(uuid,text,text,uuid,text,integer)
rename to create_midi_stem_draft_owner_v1;
revoke all on function public.create_midi_stem_draft_owner_v1(uuid,text,text,uuid,text,integer)
from public,anon,authenticated;

create function public.create_midi_stem_draft(
  p_request_id uuid,p_name text,p_entry_mode text default 'blank',
  p_parent_stem_version_id uuid default null,
  p_default_preset_id text default 'warm-poly',p_default_preset_version integer default 1
) returns table(stem_id uuid,draft_id uuid,lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_name text:=btrim(p_name);
  v_stem public.midi_stems%rowtype; v_draft public.midi_stem_drafts%rowtype;
  v_parent public.midi_stem_versions%rowtype; v_checksum text;
begin
  if p_entry_mode<>'derive' then
    return query select * from public.create_midi_stem_draft_owner_v1(
      p_request_id,p_name,p_entry_mode,p_parent_stem_version_id,
      p_default_preset_id,p_default_preset_version);
    return;
  end if;
  if v_actor is null then
    raise sqlstate 'PT401' using message='midi_stem_unauthenticated'; end if;
  if not (select private.is_active_midi_actor()) then
    raise sqlstate 'PT403' using message='midi_stem_actor_inactive'; end if;
  if p_request_id is null or p_name is null or p_name<>v_name
    or char_length(v_name) not between 1 and 120
    or p_parent_stem_version_id is null then
    raise sqlstate '22023' using message='midi_stem_create_invalid'; end if;
  select * into v_stem from public.midi_stems
    where owner_id=v_actor and create_request_id=p_request_id;
  if found then
    select * into strict v_draft from public.midi_stem_drafts d
      where d.stem_id=v_stem.id;
    if v_stem.name<>v_name or v_draft.entry_mode<>'derive'
      or v_draft.parent_stem_version_id is distinct from p_parent_stem_version_id then
      raise sqlstate 'PT409' using message='midi_stem_request_conflict'; end if;
    return query select v_stem.id,v_draft.id,v_draft.lock_version,v_draft.created_at;
    return;
  end if;
  if (select count(*) from public.midi_stems where owner_id=v_actor)>=100 then
    raise sqlstate 'PT409' using message='midi_stem_limit_reached'; end if;
  select * into v_parent from public.midi_stem_versions
    where id=p_parent_stem_version_id;
  if not found or (v_parent.owner_id<>v_actor and not exists(
    select 1 from public.revision_clips rc
    join public.project_revisions r on r.id=rc.revision_id
    join public.projects p on p.id=r.project_id
    where rc.midi_stem_version_id=v_parent.id
      and (p.visibility='public' or exists(select 1 from public.project_members m
        where m.project_id=r.project_id and m.user_id=v_actor)))) then
    raise sqlstate 'PT404' using message='midi_stem_parent_not_found'; end if;
  v_checksum:=encode(extensions.digest(convert_to(jsonb_build_object(
    'name',v_name,'defaultPresetId',v_parent.default_preset_id,
    'defaultPresetVersion',v_parent.default_preset_version,'ppq',480,
    'durationTicks',v_parent.duration_ticks,'notes',v_parent.notes
  )::text,'UTF8'),'sha256'),'hex');
  insert into public.midi_stems(owner_id,create_request_id,name)
    values(v_actor,p_request_id,v_name) returning * into v_stem;
  insert into public.midi_stem_drafts(stem_id,owner_id,entry_mode,
    parent_stem_version_id,name,default_preset_id,default_preset_version,ppq,
    duration_ticks,notes,note_count,content_sha256)
  values(v_stem.id,v_actor,'derive',v_parent.id,v_name,v_parent.default_preset_id,
    v_parent.default_preset_version,480,v_parent.duration_ticks,v_parent.notes,
    v_parent.note_count,v_checksum) returning * into v_draft;
  return query select v_stem.id,v_draft.id,v_draft.lock_version,v_draft.created_at;
end $$;
revoke all on function public.create_midi_stem_draft(uuid,text,text,uuid,text,integer)
from public,anon;
grant execute on function public.create_midi_stem_draft(uuid,text,text,uuid,text,integer)
to authenticated;

create or replace function public.create_contribution_workspace(
  p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid,
  p_title text,p_description text
) returns table(contribution_id uuid,workspace_id uuid,base_revision_id uuid,
  lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_contribution public.contributions%rowtype; v_workspace public.workspaces%rowtype;
  v_title text:=btrim(p_title); v_description text:=nullif(btrim(p_description),'');
  v_manifest jsonb; v_checksum text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  if p_project_id is null or p_request_id is null
    or p_expected_current_revision_id is null or v_title is null
    or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description)>5000) then
    raise sqlstate '22023' using message='contribution_invalid_input';
  end if;
  select * into v_contribution from public.contributions c
    where c.author_id=v_actor and c.create_request_id=p_request_id;
  if found then
    if v_contribution.project_id<>p_project_id
      or v_contribution.base_revision_id<>p_expected_current_revision_id
      or v_contribution.title<>v_title
      or v_contribution.description is distinct from v_description then
      raise sqlstate 'PT409' using message='contribution_request_conflict'; end if;
    select * into v_workspace from public.workspaces w
      where w.contribution_id=v_contribution.id;
    return query select v_contribution.id,v_workspace.id,
      v_contribution.base_revision_id,v_workspace.lock_version,v_contribution.created_at;
    return;
  end if;
  select * into v_project from public.projects p where p.id=p_project_id for update;
  if not found or v_project.status<>'active'
    or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or not v_project.open_to_contributions then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if v_project.owner_id=v_actor or (v_project.visibility='private' and not exists(
    select 1 from public.project_members m where m.project_id=p_project_id
      and m.user_id=v_actor and m.role in ('editor','viewer'))) then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if exists(select 1 from public.contributions c where c.project_id=p_project_id
      and c.author_id=v_actor and c.status in ('draft','submitted','changes_requested'))
    or exists(select 1 from public.workspaces w where w.project_id=p_project_id
      and w.owner_id=v_actor and w.status='active') then
    raise sqlstate 'PT409' using message='contribution_live_exists'; end if;
  select * into v_revision from public.project_revisions r
    where r.project_id=p_project_id and r.id=p_expected_current_revision_id;
  if not found then raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  v_manifest:=case when v_revision.manifest_version=1
    then jsonb_set(v_revision.manifest,'{tempoBpm}',
      to_jsonb((v_revision.manifest->>'tempoBpm')::double precision))
    else v_revision.manifest end;
  v_checksum:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.contributions(project_id,author_id,create_request_id,
    base_revision_id,title,description)
  values(p_project_id,v_actor,p_request_id,p_expected_current_revision_id,v_title,v_description)
  returning * into v_contribution;
  insert into public.workspaces(project_id,owner_id,create_request_id,base_revision_id,
    contribution_id,manifest,manifest_version,engine,engine_version,manifest_sha256)
  values(p_project_id,v_actor,p_request_id,p_expected_current_revision_id,
    v_contribution.id,v_manifest,v_revision.manifest_version,v_revision.engine,
    v_revision.engine_version,v_checksum) returning * into v_workspace;
  insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,
    name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,
    kind,preset_id,preset_version)
  select v_workspace.id,rt.id,rt.asset_id,rt.instrument_id,rt.name,rt.position_ms,
    rt.trim_start_ms,rt.duration_ms,rt.gain_db,rt.pan,rt.muted,rt.soloed,rt.sort_order,
    rt.kind,rt.preset_id,rt.preset_version
  from public.revision_tracks rt where rt.revision_id=v_revision.id order by rt.sort_order;
  if v_revision.manifest_version=2 then
    insert into public.workspace_clips(workspace_id,track_id,clip_id,kind,position_ms,
      trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,
      source_start_tick,loop)
    select v_workspace.id,rc.track_id,rc.clip_id,rc.kind,rc.position_ms,
      rc.trim_start_ms,rc.duration_ms,rc.midi_stem_version_id,rc.start_tick,
      rc.duration_ticks,rc.source_start_tick,rc.loop
    from public.revision_clips rc where rc.revision_id=v_revision.id;
  end if;
  return query select v_contribution.id,v_workspace.id,v_contribution.base_revision_id,
    v_workspace.lock_version,v_contribution.created_at;
exception when unique_violation then
  raise sqlstate 'PT409' using message='contribution_live_exists';
end $$;

create or replace function public.save_midi_workspace(
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
    or v_workspace.manifest_version<>2
    or (v_workspace.contribution_id is not null and not exists(
      select 1 from public.contributions c where c.id=v_workspace.contribution_id
        and c.author_id=v_actor and c.status in ('draft','changes_requested'))) then
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

create function private.workspace_v2_projection_matches(
  p_workspace_id uuid,p_manifest jsonb
) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(p_manifest->'tracks','[]'::jsonb)=coalesce((
    select jsonb_agg(
      (case when wt.kind='audio' then jsonb_build_object(
        'kind','audio','trackId',wt.track_id,'name',wt.name,
        'instrumentId',wt.instrument_id,'assetId',wt.asset_id,
        'gainDb',wt.gain_db,'pan',wt.pan,'muted',wt.muted,'soloed',wt.soloed,
        'sortOrder',wt.sort_order
      ) else jsonb_build_object(
        'kind','midi','trackId',wt.track_id,'name',wt.name,
        'instrumentId',null,'presetId',wt.preset_id,'presetVersion',wt.preset_version,
        'gainDb',wt.gain_db,'pan',wt.pan,'muted',wt.muted,'soloed',wt.soloed,
        'sortOrder',wt.sort_order
      ) end)||jsonb_build_object('clips',coalesce((
          select jsonb_agg(case when wc.kind='audio' then jsonb_build_object(
            'clipId',wc.clip_id,'positionMs',wc.position_ms,
            'trimStartMs',wc.trim_start_ms,'durationMs',wc.duration_ms
          ) else jsonb_build_object(
            'clipId',wc.clip_id,'midiStemVersionId',wc.midi_stem_version_id,
            'startTick',wc.start_tick,'durationTicks',wc.duration_ticks,
            'sourceStartTick',wc.source_start_tick,'loop',wc.loop
          ) end order by case when wc.kind='midi' then wc.start_tick else wc.position_ms end,
            wc.clip_id)
          from public.workspace_clips wc
          where wc.workspace_id=wt.workspace_id and wc.track_id=wt.track_id
        ),'[]'::jsonb)) order by wt.sort_order)
    from public.workspace_tracks wt where wt.workspace_id=p_workspace_id
  ),'[]'::jsonb)
$$;
revoke all on function private.workspace_v2_projection_matches(uuid,jsonb)
  from public,anon,authenticated;

create or replace function public.submit_contribution(
  p_contribution_id uuid,p_request_id uuid,p_expected_workspace_lock_version integer,
  p_expected_base_revision_id uuid,p_expected_manifest_sha256 text,
  p_attestation_version text
) returns table(contribution_id uuid,version_id uuid,version_number integer,
  status public.contribution_status,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_workspace public.workspaces%rowtype;
  v_version public.contribution_versions%rowtype; v_duration integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  if p_contribution_id is null or p_request_id is null
    or p_expected_workspace_lock_version is null or p_expected_workspace_lock_version<1
    or p_expected_base_revision_id is null
    or p_expected_manifest_sha256!~'^[0-9a-f]{64}$'
    or p_attestation_version<>'contributor-attestation-v1' then
    raise sqlstate '22023' using message='contribution_invalid_submission';
  end if;
  select c.project_id into v_project.id from public.contributions c
    where c.id=p_contribution_id and c.author_id=v_actor;
  if not found then raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_project from public.projects p where p.id=v_project.id for update;
  select * into v_contribution from public.contributions c
    where c.id=p_contribution_id and c.author_id=v_actor for update;
  select * into v_version from public.contribution_versions v
    where v.contribution_id=p_contribution_id and v.submission_request_id=p_request_id;
  if found then
    if v_version.workspace_lock_version<>p_expected_workspace_lock_version
      or v_version.base_revision_id<>p_expected_base_revision_id
      or v_version.manifest_sha256<>p_expected_manifest_sha256
      or v_version.attestation_version<>p_attestation_version then
      raise sqlstate 'PT409' using message='contribution_request_conflict'; end if;
    return query select v_contribution.id,v_version.id,v_version.version_number,
      v_contribution.status,v_version.created_at; return;
  end if;
  select * into v_workspace from public.workspaces w
    where w.contribution_id=p_contribution_id and w.owner_id=v_actor for update;
  if v_contribution.status not in ('draft','changes_requested')
    or v_workspace.id is null or v_workspace.status<>'active' then
    raise sqlstate 'PT409' using message='contribution_not_editable'; end if;
  if v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or not v_project.open_to_contributions then
    raise sqlstate 'PT409' using message='contribution_submissions_closed'; end if;
  if v_project.current_revision_id is distinct from p_expected_base_revision_id
    or v_contribution.base_revision_id<>p_expected_base_revision_id
    or v_workspace.base_revision_id<>p_expected_base_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if not exists(select 1 from public.project_members m
    where m.project_id=v_project.id and m.user_id=v_actor)
    and v_contribution.author_id<>v_actor then
    raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  if v_workspace.lock_version<>p_expected_workspace_lock_version
    or v_workspace.manifest_sha256<>p_expected_manifest_sha256
    or v_workspace.updated_at<=v_workspace.created_at then
    raise sqlstate 'PT409' using message='contribution_workspace_stale'; end if;
  if encode(extensions.digest(convert_to(v_workspace.manifest::text,'UTF8'),'sha256'),'hex')
      <>v_workspace.manifest_sha256 then
    raise sqlstate 'PT409' using message='contribution_workspace_invalid'; end if;

  if v_workspace.manifest_version=1 then
    if v_workspace.engine<>'waveform-playlist'
      or v_workspace.engine_version<>'browser-15.3.4_playout-12.5.4_tone-15.1.22'
      or v_workspace.manifest->>'workspaceId'<>v_project.id::text
      or v_workspace.snapshot_asset_id is null
      or not exists(select 1 from public.assets a
        where a.id=v_workspace.snapshot_asset_id and a.owner_id=v_actor
          and a.kind='workspace_snapshot' and a.status='ready'
          and a.sha256=v_workspace.manifest_sha256)
      or (select count(*) from public.workspace_tracks wt
        where wt.workspace_id=v_workspace.id) not between 1 and 12
      or exists(select 1 from public.workspace_tracks wt
        left join public.assets a on a.id=wt.asset_id
        left join public.instruments i on i.id=wt.instrument_id
        where wt.workspace_id=v_workspace.id and (
          wt.kind<>'audio' or a.id is null or a.kind<>'source_audio'
          or a.status<>'ready' or a.deleted_at is not null
          or wt.trim_start_ms+wt.duration_ms>a.duration_ms
          or (wt.instrument_id is not null and (i.id is null or not i.is_active))
          or (a.owner_id<>v_actor and not exists(select 1 from public.revision_tracks rt
            where rt.revision_id=v_contribution.base_revision_id and rt.asset_id=a.id)))) then
      raise sqlstate 'PT409' using message='contribution_workspace_invalid'; end if;
    select coalesce(max(wt.position_ms+wt.duration_ms),0) into v_duration
      from public.workspace_tracks wt where wt.workspace_id=v_workspace.id;
  elsif v_workspace.manifest_version=2 then
    if v_workspace.engine<>'jam-session-composite'
      or v_workspace.engine_version<>'jam-session-composite-2_tone-15.1.22'
      or v_workspace.snapshot_asset_id is not null
      or private.canonical_project_manifest_v2(v_project.id,v_workspace.manifest,false)
        <>v_workspace.manifest
      or not private.workspace_v2_projection_matches(v_workspace.id,v_workspace.manifest) then
      raise sqlstate 'PT409' using message='contribution_workspace_invalid'; end if;
    v_duration:=ceil((v_workspace.manifest->>'durationTicks')::numeric*60000/
      ((v_workspace.manifest->>'tempoBpm')::numeric*480));
  else
    raise sqlstate 'PT409' using message='contribution_workspace_invalid';
  end if;

  insert into public.contribution_versions(contribution_id,version_number,
    submission_request_id,base_revision_id,snapshot_asset_id,workspace_lock_version,
    manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,
    attestation_version,created_by)
  values(v_contribution.id,coalesce((select max(v.version_number)+1
      from public.contribution_versions v where v.contribution_id=v_contribution.id),1),
    p_request_id,v_contribution.base_revision_id,v_workspace.snapshot_asset_id,
    v_workspace.lock_version,v_workspace.manifest,v_workspace.manifest_version,
    v_workspace.engine,v_workspace.engine_version,v_workspace.manifest_sha256,
    v_duration,p_attestation_version,v_actor) returning * into v_version;
  insert into public.contribution_version_tracks(contribution_version_id,track_id,
    asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,
    muted,soloed,sort_order,added_by,kind,preset_id,preset_version)
  select v_version.id,wt.track_id,wt.asset_id,wt.instrument_id,wt.name,wt.position_ms,
    wt.trim_start_ms,wt.duration_ms,wt.gain_db,wt.pan,wt.muted,wt.soloed,wt.sort_order,
    coalesce((select rt.added_by from public.revision_tracks rt
      where rt.revision_id=v_contribution.base_revision_id and rt.id=wt.track_id
        and rt.kind=wt.kind),v_actor),wt.kind,wt.preset_id,wt.preset_version
  from public.workspace_tracks wt where wt.workspace_id=v_workspace.id order by wt.sort_order;
  if v_workspace.manifest_version=2 then
    insert into public.contribution_version_clips(contribution_version_id,track_id,
      clip_id,kind,position_ms,trim_start_ms,duration_ms,midi_stem_version_id,
      start_tick,duration_ticks,source_start_tick,loop)
    select v_version.id,wc.track_id,wc.clip_id,wc.kind,wc.position_ms,wc.trim_start_ms,
      wc.duration_ms,wc.midi_stem_version_id,wc.start_tick,wc.duration_ticks,
      wc.source_start_tick,wc.loop
    from public.workspace_clips wc where wc.workspace_id=v_workspace.id;
  end if;
  update public.contributions c set current_version_id=v_version.id,status='submitted',
    submitted_at=coalesce(c.submitted_at,statement_timestamp()),
    updated_at=statement_timestamp() where c.id=v_contribution.id returning * into v_contribution;
  return query select v_contribution.id,v_version.id,v_version.version_number,
    v_contribution.status,v_version.created_at;
end $$;

create or replace function private.require_confirmed_source_credits()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='midi' then return new; end if;
  if not exists(select 1 from public.assets a where a.id=new.asset_id
    and a.kind='source_audio' and a.status='ready' and a.deleted_at is null
    and a.credits_confirmed_at is not null and exists(select 1 from public.asset_credits ac
      where ac.asset_id=a.id and ac.role='creator')) then
    raise sqlstate 'PT409' using message='asset_credits_unconfirmed'; end if;
  return new;
end $$;

create function private.contribution_v2_projection_matches(
  p_version_id uuid,p_manifest jsonb
) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(p_manifest->'tracks','[]'::jsonb)=coalesce((
    select jsonb_agg(
      (case when cvt.kind='audio' then jsonb_build_object(
        'kind','audio','trackId',cvt.track_id,'name',cvt.name,
        'instrumentId',cvt.instrument_id,'assetId',cvt.asset_id,
        'gainDb',cvt.gain_db,'pan',cvt.pan,'muted',cvt.muted,'soloed',cvt.soloed,
        'sortOrder',cvt.sort_order
      ) else jsonb_build_object(
        'kind','midi','trackId',cvt.track_id,'name',cvt.name,
        'instrumentId',null,'presetId',cvt.preset_id,'presetVersion',cvt.preset_version,
        'gainDb',cvt.gain_db,'pan',cvt.pan,'muted',cvt.muted,'soloed',cvt.soloed,
        'sortOrder',cvt.sort_order
      ) end)||jsonb_build_object('clips',coalesce((
        select jsonb_agg(case when cvc.kind='audio' then jsonb_build_object(
          'clipId',cvc.clip_id,'positionMs',cvc.position_ms,
          'trimStartMs',cvc.trim_start_ms,'durationMs',cvc.duration_ms
        ) else jsonb_build_object(
          'clipId',cvc.clip_id,'midiStemVersionId',cvc.midi_stem_version_id,
          'startTick',cvc.start_tick,'durationTicks',cvc.duration_ticks,
          'sourceStartTick',cvc.source_start_tick,'loop',cvc.loop
        ) end order by case when cvc.kind='midi' then cvc.start_tick else cvc.position_ms end,
          cvc.clip_id)
        from public.contribution_version_clips cvc
        where cvc.contribution_version_id=cvt.contribution_version_id
          and cvc.track_id=cvt.track_id
      ),'[]'::jsonb)) order by cvt.sort_order)
    from public.contribution_version_tracks cvt
    where cvt.contribution_version_id=p_version_id
  ),'[]'::jsonb)
$$;
revoke all on function private.contribution_v2_projection_matches(uuid,jsonb)
from public,anon,authenticated;

alter function public.review_contribution(uuid,uuid,
  public.contribution_review_decision,public.contribution_status,uuid,uuid,text)
rename to review_contribution_v1;
revoke all on function public.review_contribution_v1(uuid,uuid,
  public.contribution_review_decision,public.contribution_status,uuid,uuid,text)
from public,anon,authenticated;

create function public.review_contribution(
  p_contribution_id uuid,p_request_id uuid,
  p_decision public.contribution_review_decision,
  p_expected_status public.contribution_status,p_expected_current_version_id uuid,
  p_expected_project_revision_id uuid,p_note text default null
) returns table(contribution_id uuid,contribution_version_id uuid,
  requested_decision public.contribution_review_decision,
  applied_decision public.contribution_review_decision,
  reason public.contribution_review_reason,status public.contribution_status,
  revision_id uuid,revision_number integer,reviewed_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_version public.contribution_versions%rowtype;
  v_workspace public.workspaces%rowtype; v_existing public.contribution_reviews%rowtype;
  v_review public.contribution_reviews%rowtype; v_revision public.project_revisions%rowtype;
  v_note text:=nullif(btrim(p_note),''); v_added_bytes bigint:=0;
  v_added_count integer:=0;
begin
  select * into v_version from public.contribution_versions cv
    where cv.id=p_expected_current_version_id and cv.contribution_id=p_contribution_id;
  if v_version.manifest_version is distinct from 2 or p_decision<>'accept' then
    return query select * from public.review_contribution_v1(
      p_contribution_id,p_request_id,p_decision,p_expected_status,
      p_expected_current_version_id,p_expected_project_revision_id,p_note
    );
    return;
  end if;
  if v_actor is null then
    raise sqlstate 'PT401' using message='contribution_review_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_review_actor_ineligible'; end if;
  if p_contribution_id is null or p_request_id is null
    or p_expected_status<>'submitted' or p_expected_current_version_id is null
    or p_expected_project_revision_id is null
    or (v_note is not null and char_length(v_note)>5000) then
    raise sqlstate '22023' using message='contribution_review_invalid_input'; end if;
  select p.* into v_project from public.contributions c
    join public.projects p on p.id=c.project_id where c.id=p_contribution_id
    for update of p;
  if not found or v_project.owner_id<>v_actor or not exists(
    select 1 from public.project_members m where m.project_id=v_project.id
      and m.user_id=v_actor and m.role='owner') then
    raise sqlstate 'PT404' using message='contribution_review_not_found'; end if;
  select * into v_contribution from public.contributions c
    where c.id=p_contribution_id and c.project_id=v_project.id for update;
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
      case v_existing.applied_decision
        when 'request_changes' then 'changes_requested'::public.contribution_status
        when 'reject' then 'rejected'::public.contribution_status
        else 'accepted'::public.contribution_status end,
      v_existing.resulting_revision_id,r.revision_number,v_existing.created_at
    from (select 1) x left join public.project_revisions r
      on r.id=v_existing.resulting_revision_id;
    return;
  end if;
  if v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or v_project.current_revision_id is null then
    raise sqlstate 'PT409' using message='contribution_review_project_unavailable'; end if;
  if v_contribution.status<>p_expected_status
    or v_contribution.current_version_id is distinct from p_expected_current_version_id then
    raise sqlstate 'PT409' using message='contribution_review_conflict'; end if;
  select * into v_version from public.contribution_versions cv
    where cv.id=p_expected_current_version_id and cv.contribution_id=v_contribution.id
    for update;
  if not found or v_version.base_revision_id<>v_contribution.base_revision_id then
    raise sqlstate 'PT409' using message='contribution_review_invalid_version'; end if;
  select * into v_workspace from public.workspaces w
    where w.contribution_id=v_contribution.id for update;
  if not found then
    raise sqlstate 'PT409' using message='contribution_review_invalid_version'; end if;
  if v_project.current_revision_id<>p_expected_project_revision_id
    or v_version.base_revision_id<>v_project.current_revision_id then
    insert into public.contribution_reviews(contribution_id,contribution_version_id,
      reviewer_id,request_id,requested_decision,applied_decision,reason,note,
      expected_project_revision_id)
    values(v_contribution.id,v_version.id,v_actor,p_request_id,'accept',
      'request_changes','base_outdated',v_note,p_expected_project_revision_id)
    returning * into v_review;
    update public.contributions set status='changes_requested',reviewed_at=v_review.created_at,
      reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at
      where id=v_contribution.id;
    update public.workspaces set status='active',updated_at=v_review.created_at
      where id=v_workspace.id;
    return query select v_contribution.id,v_version.id,
      'accept'::public.contribution_review_decision,
      'request_changes'::public.contribution_review_decision,
      'base_outdated'::public.contribution_review_reason,
      'changes_requested'::public.contribution_status,null::uuid,null::integer,
      v_review.created_at;
    return;
  end if;
  if v_version.engine<>'jam-session-composite'
    or v_version.engine_version<>'jam-session-composite-2_tone-15.1.22'
    or encode(extensions.digest(convert_to(v_version.manifest::text,'UTF8'),'sha256'),'hex')
      <>v_version.manifest_sha256
    or private.canonical_project_manifest_v2(v_project.id,v_version.manifest,false)
      <>v_version.manifest
    or not private.contribution_v2_projection_matches(v_version.id,v_version.manifest)
    or v_version.duration_ms<>ceil((v_version.manifest->>'durationTicks')::numeric*60000/
      ((v_version.manifest->>'tempoBpm')::numeric*480)) then
    raise sqlstate 'PT409' using message='contribution_review_invalid_version'; end if;

  insert into public.project_storage_usage(project_id) values(v_project.id)
    on conflict do nothing;
  perform 1 from public.project_storage_usage where project_id=v_project.id for update;
  select coalesce(sum(a.byte_size),0),count(*) into v_added_bytes,v_added_count
  from public.contribution_version_tracks cvt join public.assets a on a.id=cvt.asset_id
  left join public.project_asset_references par
    on par.project_id=v_project.id and par.asset_id=a.id
  where cvt.contribution_version_id=v_version.id and cvt.kind='audio'
    and par.asset_id is null;
  if (select source_bytes from public.project_storage_usage where project_id=v_project.id)
      +v_added_bytes>262144000 then
    raise sqlstate 'PT429' using message='contribution_review_project_quota_exceeded'; end if;
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,
    created_by,publish_request_id,expected_base_revision_id,message,manifest,
    manifest_version,engine,engine_version,manifest_sha256,duration_ms,
    accepted_contribution_id,accepted_contribution_version_id)
  values(v_project.id,(select r.revision_number+1 from public.project_revisions r
      where r.id=v_project.current_revision_id),v_project.current_revision_id,v_actor,
    p_request_id,p_expected_project_revision_id,
    left('Accepted contribution: '||v_contribution.title,500),v_version.manifest,2,
    v_version.engine,v_version.engine_version,v_version.manifest_sha256,
    v_version.duration_ms,v_contribution.id,v_version.id) returning * into v_revision;
  insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,
    position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,
    added_by,kind,preset_id,preset_version)
  select v_revision.id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,
    duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,kind,preset_id,preset_version
  from public.contribution_version_tracks where contribution_version_id=v_version.id
  order by sort_order;
  insert into public.revision_clips(revision_id,track_id,clip_id,kind,position_ms,
    trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,
    source_start_tick,loop)
  select v_revision.id,track_id,clip_id,kind,position_ms,trim_start_ms,duration_ms,
    midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop
  from public.contribution_version_clips where contribution_version_id=v_version.id;
  insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by)
  select v_project.id,asset_id,v_revision.id,added_by
  from public.contribution_version_tracks
  where contribution_version_id=v_version.id and kind='audio' on conflict do nothing;
  update public.project_storage_usage set source_bytes=source_bytes+v_added_bytes,
    unique_source_count=unique_source_count+v_added_count,updated_at=statement_timestamp()
    where project_id=v_project.id;
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_project.id,v_revision.id,'project_revision_published',
    jsonb_build_object('revisionNumber',v_revision.revision_number));
  update public.projects set current_revision_id=v_revision.id,lock_version=lock_version+1,
    updated_at=statement_timestamp() where id=v_project.id;
  insert into public.contribution_reviews(contribution_id,contribution_version_id,
    reviewer_id,request_id,requested_decision,applied_decision,reason,note,
    expected_project_revision_id,resulting_revision_id)
  values(v_contribution.id,v_version.id,v_actor,p_request_id,'accept','accept',null,
    v_note,p_expected_project_revision_id,v_revision.id) returning * into v_review;
  update public.contributions set status='accepted',reviewed_at=v_review.created_at,
    reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at
    where id=v_contribution.id;
  update public.workspaces set status='archived',updated_at=v_review.created_at
    where id=v_workspace.id;
  return query select v_contribution.id,v_version.id,
    'accept'::public.contribution_review_decision,
    'accept'::public.contribution_review_decision,
    null::public.contribution_review_reason,'accepted'::public.contribution_status,
    v_revision.id,v_revision.revision_number,v_review.created_at;
exception when invalid_text_representation or numeric_value_out_of_range
  or null_value_not_allowed then
  raise sqlstate '22023' using message='contribution_review_invalid_input';
end $$;
revoke all on function public.review_contribution(uuid,uuid,
  public.contribution_review_decision,public.contribution_status,uuid,uuid,text)
from public,anon;
grant execute on function public.review_contribution(uuid,uuid,
  public.contribution_review_decision,public.contribution_status,uuid,uuid,text)
to authenticated;

create function private.revision_v2_projection_matches(
  p_revision_id uuid,p_manifest jsonb
) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(p_manifest->'tracks','[]'::jsonb)=coalesce((
    select jsonb_agg(
      (case when rt.kind='audio' then jsonb_build_object(
        'kind','audio','trackId',rt.id,'name',rt.name,
        'instrumentId',rt.instrument_id,'assetId',rt.asset_id,
        'gainDb',rt.gain_db,'pan',rt.pan,'muted',rt.muted,'soloed',rt.soloed,
        'sortOrder',rt.sort_order
      ) else jsonb_build_object(
        'kind','midi','trackId',rt.id,'name',rt.name,
        'instrumentId',null,'presetId',rt.preset_id,'presetVersion',rt.preset_version,
        'gainDb',rt.gain_db,'pan',rt.pan,'muted',rt.muted,'soloed',rt.soloed,
        'sortOrder',rt.sort_order
      ) end)||jsonb_build_object('clips',coalesce((
        select jsonb_agg(case when rc.kind='audio' then jsonb_build_object(
          'clipId',rc.clip_id,'positionMs',rc.position_ms,
          'trimStartMs',rc.trim_start_ms,'durationMs',rc.duration_ms
        ) else jsonb_build_object(
          'clipId',rc.clip_id,'midiStemVersionId',rc.midi_stem_version_id,
          'startTick',rc.start_tick,'durationTicks',rc.duration_ticks,
          'sourceStartTick',rc.source_start_tick,'loop',rc.loop
        ) end order by case when rc.kind='midi' then rc.start_tick else rc.position_ms end,
          rc.clip_id)
        from public.revision_clips rc
        where rc.revision_id=rt.revision_id and rc.track_id=rt.id
      ),'[]'::jsonb)) order by rt.sort_order)
    from public.revision_tracks rt where rt.revision_id=p_revision_id
  ),'[]'::jsonb)
$$;
revoke all on function private.revision_v2_projection_matches(uuid,jsonb)
from public,anon,authenticated;

alter function public.fork_project(uuid,uuid,uuid,text,text,text)
rename to fork_project_v1;
revoke all on function public.fork_project_v1(uuid,uuid,uuid,text,text,text)
from public,anon,authenticated;

create function public.fork_project(
  p_source_project_id uuid,p_source_revision_id uuid,p_request_id uuid,
  p_expected_license_code text,p_title text,p_description text
) returns table(project_id uuid,revision_id uuid,revision_number integer,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_source public.projects%rowtype;
  v_source_revision public.project_revisions%rowtype; v_existing public.projects%rowtype;
  v_target public.projects%rowtype; v_target_revision public.project_revisions%rowtype;
  v_legacy record; v_target_id uuid:=gen_random_uuid();
  v_target_revision_id uuid:=gen_random_uuid(); v_title text:=btrim(p_title);
  v_description text:=nullif(btrim(p_description),''); v_manifest jsonb;
  v_manifest_sha256 text; v_source_bytes bigint:=0; v_source_count integer:=0;
begin
  select * into v_source_revision from public.project_revisions r
    where r.id=p_source_revision_id and r.project_id=p_source_project_id;
  if v_source_revision.manifest_version is distinct from 2 then
    select * into v_legacy from public.fork_project_v1(p_source_project_id,
      p_source_revision_id,p_request_id,p_expected_license_code,p_title,p_description);
    select * into v_source from public.projects where id=p_source_project_id;
    update public.projects set compatibility=v_source.compatibility
      where id=v_legacy.project_id;
    return query select v_legacy.project_id,v_legacy.revision_id,
      v_legacy.revision_number,v_legacy.created_at;
    return;
  end if;
  if v_actor is null then raise sqlstate 'PT401' using message='fork_unauthenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor
    and p.status='active' and p.profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='fork_actor_ineligible'; end if;
  if p_source_project_id is null or p_source_revision_id is null or p_request_id is null
    or p_expected_license_code is null or p_expected_license_code<>btrim(p_expected_license_code)
    or char_length(p_expected_license_code) not between 1 and 40
    or p_title is null or p_title<>v_title or char_length(v_title) not between 1 and 120
    or (p_description is not null and (p_description<>btrim(p_description)
      or char_length(p_description)>5000)) then
    raise sqlstate '22023' using message='fork_invalid_input'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text||p_request_id::text,0));
  select * into v_existing from public.projects p
    where p.owner_id=v_actor and p.create_request_id=p_request_id;
  if found then
    if v_existing.source_project_id is distinct from p_source_project_id
      or v_existing.source_revision_id is distinct from p_source_revision_id
      or v_existing.license_code<>p_expected_license_code
      or v_existing.title<>v_title or v_existing.description is distinct from v_description
      or v_existing.current_revision_id is null then
      raise sqlstate 'PT409' using message='fork_request_conflict'; end if;
    return query select v_existing.id,v_existing.current_revision_id,1,v_existing.created_at;
    return;
  end if;
  select * into v_source from public.projects p where p.id=p_source_project_id for update;
  if not found or v_source.status<>'active'
    or v_source.visibility not in ('private','public')
    or v_source.deleted_at is not null or v_source.current_revision_id is null
    or (v_source.visibility='private' and not exists(
      select 1 from public.project_members m
      where m.project_id=v_source.id and m.user_id=v_actor)) then
    raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  if v_source.license_code<>p_expected_license_code or not exists(
    select 1 from public.licenses l where l.code=v_source.license_code
      and l.allows_derivatives) then
    raise sqlstate 'PT409' using message='fork_license_unavailable'; end if;
  select * into v_source_revision from public.project_revisions r
    where r.id=p_source_revision_id and r.project_id=v_source.id;
  if not found then raise sqlstate 'PT404' using message='fork_source_not_found'; end if;
  if v_source_revision.manifest_version<>2
    or encode(extensions.digest(convert_to(v_source_revision.manifest::text,'UTF8'),'sha256'),'hex')
      <>v_source_revision.manifest_sha256
    or private.canonical_project_manifest_v2(v_source.id,v_source_revision.manifest,false)
      <>v_source_revision.manifest
    or not private.revision_v2_projection_matches(v_source_revision.id,
      v_source_revision.manifest) then
    raise sqlstate 'PT409' using message='fork_source_invalid'; end if;
  v_manifest:=jsonb_set(v_source_revision.manifest,'{projectId}',
    to_jsonb(v_target_id::text),false);
  v_manifest_sha256:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.projects(id,owner_id,create_request_id,title,description,bpm,
    musical_key,time_signature_numerator,time_signature_denominator,license_code,
    source_project_id,source_revision_id,compatibility)
  values(v_target_id,v_actor,p_request_id,v_title,v_description,
    (v_manifest->>'tempoBpm')::numeric,v_source.musical_key,
    v_source.time_signature_numerator,v_source.time_signature_denominator,
    v_source.license_code,v_source.id,v_source_revision.id,v_source.compatibility)
  returning * into v_target;
  insert into public.project_members(project_id,user_id,role,created_by)
    values(v_target.id,v_actor,'owner',v_actor);
  insert into public.project_genres(project_id,genre_id,is_primary)
    select v_target.id,genre_id,is_primary from public.project_genres
      where project_id=v_source.id;
  insert into public.project_tags(project_id,tag_id)
    select v_target.id,tag_id from public.project_tags where project_id=v_source.id;
  insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,
    created_by,publish_request_id,expected_base_revision_id,message,manifest,
    manifest_version,engine,engine_version,manifest_sha256,duration_ms)
  values(v_target_revision_id,v_target.id,1,null,v_actor,p_request_id,null,null,v_manifest,
    2,v_source_revision.engine,v_source_revision.engine_version,v_manifest_sha256,
    v_source_revision.duration_ms) returning * into v_target_revision;
  insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,
    position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,
    added_by,kind,preset_id,preset_version)
  select v_target_revision.id,id,asset_id,instrument_id,name,position_ms,trim_start_ms,
    duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,kind,preset_id,preset_version
  from public.revision_tracks where revision_id=v_source_revision.id order by sort_order;
  insert into public.revision_clips(revision_id,track_id,clip_id,kind,position_ms,
    trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,
    source_start_tick,loop)
  select v_target_revision.id,track_id,clip_id,kind,position_ms,trim_start_ms,
    duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop
  from public.revision_clips where revision_id=v_source_revision.id;
  if exists((select track_id,midi_stem_version_id,credited_stem_version_id,
      creator_id,creator_credit_name,credit_role
      from public.revision_midi_track_credits where revision_id=v_source_revision.id
      except select track_id,midi_stem_version_id,credited_stem_version_id,
      creator_id,creator_credit_name,credit_role
      from public.revision_midi_track_credits where revision_id=v_target_revision.id)
    union all (select track_id,midi_stem_version_id,credited_stem_version_id,
      creator_id,creator_credit_name,credit_role
      from public.revision_midi_track_credits where revision_id=v_target_revision.id
      except select track_id,midi_stem_version_id,credited_stem_version_id,
      creator_id,creator_credit_name,credit_role
      from public.revision_midi_track_credits where revision_id=v_source_revision.id)) then
    raise sqlstate 'PT409' using message='fork_credit_snapshot_mismatch'; end if;
  insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by)
  select v_target.id,rt.asset_id,v_target_revision.id,par.added_by
  from public.revision_tracks rt join public.project_asset_references par
    on par.project_id=v_source.id and par.asset_id=rt.asset_id
  where rt.revision_id=v_source_revision.id and rt.kind='audio';
  select coalesce(sum(a.byte_size),0),count(*)::integer into v_source_bytes,v_source_count
  from public.project_asset_references par join public.assets a on a.id=par.asset_id
  where par.project_id=v_target.id;
  if v_source_count>12 or v_source_bytes>262144000 then
    raise sqlstate 'PT429' using message='fork_project_quota_exceeded'; end if;
  insert into public.project_storage_usage(project_id,source_bytes,unique_source_count)
    values(v_target.id,v_source_bytes,v_source_count);
  update public.projects p set current_revision_id=v_target_revision.id,status='active',
    published_at=statement_timestamp(),lock_version=p.lock_version+1,
    updated_at=statement_timestamp() where p.id=v_target.id returning * into v_target;
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_target.id,v_target_revision.id,'project_forked',
    jsonb_build_object('revisionNumber',1));
  return query select v_target.id,v_target_revision.id,1,v_target.created_at;
exception when invalid_text_representation or numeric_value_out_of_range
  or not_null_violation then
  raise sqlstate '22023' using message='fork_invalid_input';
end $$;
revoke all on function public.fork_project(uuid,uuid,uuid,text,text,text)
from public,anon;
grant execute on function public.fork_project(uuid,uuid,uuid,text,text,text)
to authenticated;

comment on table public.contribution_version_clips is
  'Immutable normalized clip projection for an exact submitted manifest-v2 contribution.';
comment on table public.contribution_version_midi_track_credits is
  'Immutable MIDI creator and derivation-lineage credit snapshots, separate from source-asset credits.';

create or replace function private.refresh_public_midi_catalog_tracks()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_revision_id uuid;
begin
  if pg_trigger_depth()>2 then return new; end if;
  select p.current_revision_id into v_revision_id from public.projects p
    join public.project_revisions pr on pr.id=p.current_revision_id
    where p.id=new.project_id and pr.manifest_version=2;
  if v_revision_id is null then return new; end if;
  update public.public_project_catalog catalog set tracks=(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',rt.id,'kind',rt.kind,'name',rt.name,'durationMs',rt.duration_ms,
      'positionMs',rt.position_ms,'sortOrder',rt.sort_order,
      'preset',case when rt.kind='midi' then jsonb_build_object(
        'id',rt.preset_id,'version',rt.preset_version) else null end,
      'instrument',case when i.id is null then null else jsonb_build_object(
        'id',i.id,'slug',i.slug,'name',i.name) end,
      'credits',case when rt.kind='midi' then coalesce((select jsonb_agg(
        jsonb_build_object('position',ordered.position,
          'creditName',ordered.creator_credit_name,
          'role',case when ordered.credit_role='derivation_source'
            then 'derivation' else 'creator' end,
          'profileId',ordered.creator_id) order by ordered.position)
        from (select creator_id,creator_credit_name,credit_role,
          row_number() over(order by case when credit_role='creator' then 0 else 1 end,
            creator_credit_name,creator_id)-1 as position
          from public.revision_midi_track_credits
          where revision_id=rt.revision_id and track_id=rt.id) ordered),'[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object(
        'position',rtc.position,'creditName',rtc.credit_name,'role',rtc.role,
        'profileId',rtc.user_id) order by rtc.position)
        from public.revision_track_credits rtc where rtc.revision_id=rt.revision_id
          and rtc.track_id=rt.id),'[]'::jsonb) end
    ) order by rt.sort_order),'[]'::jsonb)
    from public.revision_tracks rt left join public.instruments i on i.id=rt.instrument_id
    where rt.revision_id=v_revision_id
  ) where catalog.project_id=new.project_id;
  return new;
end $$;
revoke all on function private.refresh_public_midi_catalog_tracks()
from public,anon,authenticated;
