-- PIVOT-09 reviewed baseline: MIDI projects, workspaces, patterns, arrangements, and immutable revisions.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."assert_project_owner_invariant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_project uuid;
begin
  if tg_table_name = 'projects' then
    v_project := coalesce(new.id, old.id);
  else
    v_project := coalesce(new.project_id, old.project_id);
  end if;
  if not exists(select 1 from public.projects p join public.project_members m on m.project_id=p.id and m.role='owner' and m.user_id=p.owner_id and m.created_by=p.owner_id where p.id=v_project)
     or (select count(*) from public.project_members where project_id=v_project and role='owner') <> 1 then
    raise exception using errcode='23514', message='project_owner_invariant';
  end if;
  return null;
end $$;

ALTER FUNCTION "private"."assert_project_owner_invariant"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."assert_project_taxonomy_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_project uuid := coalesce(new.project_id,old.project_id); begin
 if (select count(*) from public.project_genres where project_id=v_project)>3 or (select count(*) from public.project_tags where project_id=v_project)>10 then raise exception using errcode='23514',message='project_taxonomy_limit'; end if; return null;
end $$;

ALTER FUNCTION "private"."assert_project_taxonomy_limits"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."bump_discovery_for_profile_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.username is distinct from old.username
    or new.display_name is distinct from old.display_name
    or new.status is distinct from old.status
    or new.profile_completed_at is distinct from old.profile_completed_at then
    perform private.bump_discovery_version();
    if old.id is not null then
      perform private.refresh_public_project(p.id)
      from public.projects p where p.owner_id = old.id;
    end if;
  end if;
  return new;
end
$$;

ALTER FUNCTION "private"."bump_discovery_for_profile_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."can_read_arrangement"("p_arrangement_version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."can_read_arrangement"("p_arrangement_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."can_read_pattern_version"("p_pattern_version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."can_read_pattern_version"("p_pattern_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."canonical_manifest_v3"("p_manifest" "jsonb", "p_project_id" "uuid", "p_workspace_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."canonical_manifest_v3"("p_manifest" "jsonb", "p_project_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."canonical_midi_pattern_notes_v3"("p_notes" "jsonb", "p_duration_ticks" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."canonical_midi_pattern_notes_v3"("p_notes" "jsonb", "p_duration_ticks" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."freeze_workspace_arrangement_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_actor" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "private"."freeze_workspace_arrangement_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_actor" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_project_member"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (select private.is_active_project_actor())
    and exists (
      select 1 from public.project_members m
      where m.project_id = p_project_id
        and m.user_id = (select auth.uid())
    )
$$;

ALTER FUNCTION "private"."is_project_member"("p_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."refresh_all_project_stats"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_project_id uuid; v_count integer := 0;
begin
  for v_project_id in select p.id from public.projects p loop
    perform private.refresh_public_project(v_project_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

ALTER FUNCTION "private"."refresh_all_project_stats"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."replace_workspace_projection_v3"("p_workspace_id" "uuid", "p_manifest" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_track jsonb; v_clip jsonb;
begin
  delete from public.workspace_clips where workspace_id=p_workspace_id;
  delete from public.workspace_tracks where workspace_id=p_workspace_id;
  for v_track in select value from jsonb_array_elements(p_manifest->'tracks') loop
    insert into public.workspace_tracks(workspace_id,track_id,name,gain_db,pan,muted,soloed,sort_order,preset_id,preset_version)
    values(p_workspace_id,(v_track->>'trackId')::uuid,v_track->>'name',
      (v_track->>'gainDb')::numeric,(v_track->>'pan')::numeric,(v_track->>'muted')::boolean,
      (v_track->>'soloed')::boolean,(v_track->>'sortOrder')::smallint,
      v_track->>'presetId',(v_track->>'presetVersion')::integer);
    for v_clip in select value from jsonb_array_elements(v_track->'clips') loop
      insert into public.workspace_clips(workspace_id,track_id,clip_id,midi_pattern_version_id,start_tick,
        duration_ticks,source_start_tick,loop)
      values(p_workspace_id,(v_track->>'trackId')::uuid,(v_clip->>'clipId')::uuid,
        (v_clip->>'midiPatternVersionId')::uuid,(v_clip->>'startTick')::integer,
        (v_clip->>'durationTicks')::integer,(v_clip->>'sourceStartTick')::integer,(v_clip->>'loop')::boolean);
    end loop;
  end loop;
end;
$$;

ALTER FUNCTION "private"."replace_workspace_projection_v3"("p_workspace_id" "uuid", "p_manifest" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_midi_pattern_v3"("p_request_id" "uuid", "p_name" "text", "p_source_pattern_version_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("pattern_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."create_midi_pattern_v3"("p_request_id" "uuid", "p_name" "text", "p_source_pattern_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_midi_pattern_version_v3"("p_pattern_id" "uuid", "p_request_id" "uuid", "p_expected_version_number" integer, "p_ppq" smallint, "p_duration_ticks" integer, "p_notes" "jsonb", "p_publish_for_reuse" boolean DEFAULT false, "p_rights_attestation_version" "text" DEFAULT NULL::"text") RETURNS TABLE("pattern_version_id" "uuid", "version_number" integer, "content_sha256" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."create_midi_pattern_version_v3"("p_pattern_id" "uuid", "p_request_id" "uuid", "p_expected_version_number" integer, "p_ppq" smallint, "p_duration_ticks" integer, "p_notes" "jsonb", "p_publish_for_reuse" boolean, "p_rights_attestation_version" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_midi_project_workspace_v3"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) RETURNS TABLE("project_id" "uuid", "title" "text", "lock_version" integer, "workspace_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."create_midi_project_workspace_v3"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_project"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "title" "text", "lock_version" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_id uuid; v_description text:=nullif(btrim(p_description),'');
begin
 if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
 if not exists(select 1 from public.profiles where profiles.id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||p_request_id::text,0));
 select p.id into v_id from public.projects p where p.owner_id=v_actor and p.create_request_id=p_request_id;
 if found then
  if exists(select 1 from public.projects p where p.id=v_id and (p.title<>btrim(p_title) or p.description is distinct from v_description or p.bpm is distinct from p_bpm or p.musical_key is distinct from p_musical_key or p.time_signature_numerator<>p_time_signature_numerator or p.time_signature_denominator<>p_time_signature_denominator or p.license_code<>p_license_code))
    or (select coalesce(array_agg(genre_id order by genre_id),'{}'::uuid[]) from public.project_genres where project_id=v_id) <> (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_genre_ids,'{}')) x)
    or (select coalesce(array_agg(tag_id order by tag_id),'{}'::uuid[]) from public.project_tags where project_id=v_id) <> (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_tag_ids,'{}')) x)
    or (select genre_id from public.project_genres where project_id=v_id and is_primary) is distinct from p_primary_genre_id then raise sqlstate 'PT409' using message='project_request_conflict'; end if;
  return query select p.id,p.title,p.lock_version from public.projects p where p.id=v_id; return;
 end if;
 if p_request_id is null or p_title is null or p_title<>btrim(p_title) or char_length(p_title) not between 1 and 120 or (p_description is not null and (p_description<>btrim(p_description) or char_length(p_description)>5000)) or (p_bpm is not null and (p_bpm not between 20 and 400 or scale(p_bpm)>3)) or p_time_signature_numerator not between 1 and 32 or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
 if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10 or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x) or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x) or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}'))) then raise sqlstate 'PT400' using message='project_taxonomy_invalid'; end if;
 if not exists(select 1 from public.licenses where code=p_license_code and is_active) or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g on g.id=x and g.is_active where g.id is null) or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t on t.id=x and t.is_active where t.id is null) then raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
 insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,license_code) values(v_actor,p_request_id,p_title,v_description,p_bpm,p_musical_key,p_time_signature_numerator,p_time_signature_denominator,p_license_code) returning projects.id into v_id;
 insert into public.project_members values(v_id,v_actor,'owner',v_actor,default);
 insert into public.project_genres(project_id,genre_id,is_primary) select v_id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x;
 insert into public.project_tags(project_id,tag_id) select v_id,x from unnest(coalesce(p_tag_ids,'{}')) x;
 return query select p.id,p.title,p.lock_version from public.projects p where p.id=v_id;
end $$;

ALTER FUNCTION "public"."create_project"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_project_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid") RETURNS TABLE("workspace_id" "uuid", "base_revision_id" "uuid", "lock_version" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_workspace_id uuid := gen_random_uuid();
  v_manifest jsonb;
  v_manifest_sha256 text;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'workspace_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'workspace_actor_ineligible';
  end if;
  if p_project_id is null or p_request_id is null
    or p_expected_current_revision_id is null then
    raise sqlstate '22023' using message = 'workspace_invalid_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'project-workspace:' || v_actor::text || ':' || p_request_id::text,
    0
  ));

  select * into v_workspace
  from public.workspaces w
  where w.owner_id = v_actor and w.create_request_id = p_request_id;
  if found then
    if v_workspace.project_id <> p_project_id
      or v_workspace.base_revision_id is distinct from p_expected_current_revision_id
      or v_workspace.manifest_version <> 3
      or v_workspace.contribution_id is not null then
      raise sqlstate 'PT409' using message = 'workspace_request_conflict';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  select * into v_project
  from public.projects p
  where p.id = p_project_id and p.owner_id = v_actor
    and p.status = 'active' and p.deleted_at is null
    and p.moderation_state = 'visible'
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_project_not_found';
  end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.project_id = p_project_id and w.owner_id = v_actor
    and w.contribution_id is null and w.status = 'active'
  for update;
  if found then
    if v_workspace.base_revision_id is distinct from p_expected_current_revision_id
      or v_workspace.manifest_version <> 3 then
      raise sqlstate 'PT409' using message = 'workspace_active_base_mismatch';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  select * into v_revision
  from public.project_revisions r
  where r.id = p_expected_current_revision_id
    and r.project_id = p_project_id
    and r.manifest_version = 3
    and r.arrangement_version_id is not null;
  if not found then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  v_manifest := v_revision.manifest || jsonb_build_object('workspaceId', v_workspace_id);
  v_manifest := private.canonical_manifest_v3(v_manifest, p_project_id, v_workspace_id);
  v_manifest_sha256 := encode(extensions.digest(
    convert_to(v_manifest::text, 'UTF8'),
    'sha256'
  ), 'hex');

  insert into public.workspaces(
    id, project_id, owner_id, create_request_id, base_revision_id,
    manifest, manifest_version, engine, engine_version, manifest_sha256
  ) values (
    v_workspace_id, p_project_id, v_actor, p_request_id, v_revision.id,
    v_manifest, 3, 'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1', v_manifest_sha256
  ) returning * into v_workspace;

  perform private.replace_workspace_projection_v3(v_workspace.id, v_manifest);
  insert into private.workspace_snapshots(
    workspace_id, project_id, owner_id, request_id, lock_version,
    manifest, manifest_sha256
  ) values (
    v_workspace.id, v_workspace.project_id, v_actor, p_request_id,
    v_workspace.lock_version, v_manifest, v_manifest_sha256
  );
  delete from private.workspace_snapshots s
  where s.workspace_id = v_workspace.id and s.id in (
    select s2.id
    from private.workspace_snapshots s2
    where s2.workspace_id = v_workspace.id
    order by s2.lock_version desc
    offset 20
  );

  return query
    select v_workspace.id, v_workspace.base_revision_id,
      v_workspace.lock_version, v_workspace.created_at;
end;
$$;

ALTER FUNCTION "public"."create_project_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fork_project_v3"("p_source_project_id" "uuid", "p_source_revision_id" "uuid", "p_request_id" "uuid", "p_expected_license_code" "text", "p_rights_attestation_version" "text", "p_title" "text", "p_description" "text") RETURNS TABLE("project_id" "uuid", "revision_id" "uuid", "arrangement_version_id" "uuid", "workspace_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
  values(v_target.id,1,null,v_actor,p_request_id,null,'Forked from revision '||v_source_revision.revision_number,
    v_manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',v_hash,
    ceil(v_arrangement.duration_ticks*60000.0/(v_arrangement.tempo_bpm*480)),v_arrangement.id)
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

ALTER FUNCTION "public"."fork_project_v3"("p_source_project_id" "uuid", "p_source_revision_id" "uuid", "p_request_id" "uuid", "p_expected_license_code" "text", "p_rights_attestation_version" "text", "p_title" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."publish_midi_workspace_revision_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_message" "text") RETURNS TABLE("revision_id" "uuid", "revision_number" integer, "arrangement_version_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    manifest_sha256,duration_ms,arrangement_version_id)
  values(v_project.id,v_number,v_project.current_revision_id,v_actor,p_request_id,p_expected_base_revision_id,
    v_message,v_arrangement.manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    v_arrangement.manifest_sha256,v_duration_ms,v_arrangement.id) returning * into v_revision;
  update public.projects set current_revision_id=v_revision.id,status='active',published_at=coalesce(published_at,statement_timestamp()),
    lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_project.id;
  update public.workspaces set base_revision_id=v_revision.id,updated_at=statement_timestamp() where id=v_workspace.id;
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_project.id,v_revision.id,'project_revision_published',jsonb_build_object('revisionNumber',v_number));
  return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at;
end;
$$;

ALTER FUNCTION "public"."publish_midi_workspace_revision_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."revision_manifest_checksum_valid"("p_project_id" "uuid", "p_revision_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select coalesce((select encode(extensions.digest(convert_to(r.manifest::text,'UTF8'),'sha256'),'hex')=r.manifest_sha256 from public.project_revisions r where r.project_id=p_project_id and r.id=p_revision_id),false)
$$;

ALTER FUNCTION "public"."revision_manifest_checksum_valid"("p_project_id" "uuid", "p_revision_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_midi_workspace_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer, "p_manifest" "jsonb") RETURNS TABLE("workspace_id" "uuid", "lock_version" integer, "manifest_sha256" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."save_midi_workspace_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer, "p_manifest" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_project_contributions_open"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_open" boolean) RETURNS TABLE("project_id" "uuid", "open_to_contributions" boolean, "lock_version" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'contributions_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'contributions_actor_ineligible'; end if;
  if p_project_id is null or p_expected_lock_version is null or p_expected_lock_version < 1 or p_open is null then
    raise sqlstate '22023' using message = 'contributions_invalid_input';
  end if;
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or v_project.owner_id <> v_actor or not exists (
    select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = v_actor and m.role = 'owner'
  ) then raise sqlstate 'PT404' using message = 'contributions_project_not_found'; end if;
  if v_project.status <> 'active' or v_project.visibility not in ('private', 'public') or v_project.deleted_at is not null or v_project.current_revision_id is null then
    raise sqlstate 'PT409' using message = 'contributions_project_unavailable';
  end if;
  if v_project.lock_version <> p_expected_lock_version then raise sqlstate 'PT409' using message = 'contributions_project_conflict'; end if;
  if v_project.open_to_contributions = p_open then
    return query select v_project.id, v_project.open_to_contributions, v_project.lock_version, v_project.updated_at;
    return;
  end if;
  update public.projects p set open_to_contributions = p_open, lock_version = p.lock_version + 1, updated_at = statement_timestamp()
    where p.id = p_project_id returning * into v_project;
  return query select v_project.id, v_project.open_to_contributions, v_project.lock_version, v_project.updated_at;
end $$;

ALTER FUNCTION "public"."set_project_contributions_open"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_open" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_project_visibility"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_visibility" "public"."project_visibility") RETURNS TABLE("project_id" "uuid", "visibility" "public"."project_visibility", "lock_version" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := (select auth.uid()); v_project public.projects%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'visibility_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'visibility_actor_ineligible';
  end if;
  if p_project_id is null or p_expected_lock_version is null
    or p_expected_lock_version < 1 or p_visibility not in ('private', 'public') then
    raise sqlstate '22023' using message = 'visibility_invalid_input';
  end if;
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or v_project.owner_id <> v_actor or not exists (
    select 1 from public.project_members m where m.project_id = p_project_id
      and m.user_id = v_actor and m.role = 'owner'
  ) then raise sqlstate 'PT404' using message = 'visibility_project_not_found'; end if;
  if v_project.status <> 'active' or v_project.current_revision_id is null
    or v_project.published_at is null or v_project.deleted_at is not null then
    raise sqlstate 'PT409' using message = 'visibility_project_unavailable';
  end if;
  if v_project.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'visibility_project_conflict';
  end if;
  if v_project.visibility = p_visibility then
    return query select v_project.id, v_project.visibility,
      v_project.lock_version, v_project.updated_at;
    return;
  end if;
  update public.projects p set visibility = p_visibility,
    lock_version = p.lock_version + 1, updated_at = statement_timestamp()
  where p.id = p_project_id returning * into v_project;
  return query select v_project.id, v_project.visibility,
    v_project.lock_version, v_project.updated_at;
end
$$;

ALTER FUNCTION "public"."set_project_visibility"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_visibility" "public"."project_visibility") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_project_metadata"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "title" "text", "lock_version" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_description text:=nullif(btrim(p_description),''); v_changed boolean;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
 if not exists(select 1 from public.profiles where profiles.id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
 select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.status in ('draft','active') and p.deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='project_not_found'; end if;
 if v_project.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='project_edit_conflict'; end if;
 if p_title is null or p_title<>btrim(p_title) or char_length(p_title) not between 1 and 120 or (p_description is not null and (p_description<>btrim(p_description) or char_length(p_description)>5000)) or (p_bpm is not null and (p_bpm not between 20 and 400 or scale(p_bpm)>3)) or p_time_signature_numerator not between 1 and 32 or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
 if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10 or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x) or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x) or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}'))) then raise sqlstate 'PT400' using message='project_taxonomy_invalid'; end if;
 if not exists(select 1 from public.licenses where code=p_license_code and is_active) or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g on g.id=x and g.is_active where g.id is null) or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t on t.id=x and t.is_active where t.id is null) then raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
 v_changed := v_project.title<>p_title or v_project.description is distinct from v_description or v_project.bpm is distinct from p_bpm or v_project.musical_key is distinct from p_musical_key or v_project.time_signature_numerator<>p_time_signature_numerator or v_project.time_signature_denominator<>p_time_signature_denominator or v_project.license_code<>p_license_code or (select coalesce(array_agg(genre_id order by genre_id),'{}'::uuid[]) from public.project_genres where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_genre_ids,'{}')) x) or (select coalesce(array_agg(tag_id order by tag_id),'{}'::uuid[]) from public.project_tags where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_tag_ids,'{}')) x) or (select genre_id from public.project_genres where project_id=p_project_id and is_primary) is distinct from p_primary_genre_id;
 if v_changed then delete from public.project_genres where project_id=p_project_id; delete from public.project_tags where project_id=p_project_id; insert into public.project_genres(project_id,genre_id,is_primary) select p_project_id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x; insert into public.project_tags(project_id,tag_id) select p_project_id,x from unnest(coalesce(p_tag_ids,'{}')) x; update public.projects p set title=p_title,description=v_description,bpm=p_bpm,musical_key=p_musical_key,time_signature_numerator=p_time_signature_numerator,time_signature_denominator=p_time_signature_denominator,license_code=p_license_code,lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id; end if;
 return query select p.id,p.title,p.lock_version from public.projects p where p.id=p_project_id;
end $$;

ALTER FUNCTION "public"."update_project_metadata"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."midi_synth_presets" (
    "preset_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "min_note" smallint NOT NULL,
    "max_note" smallint NOT NULL,
    "engine_version" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "midi_synth_presets_check" CHECK (((("max_note" >= 0) AND ("max_note" <= 127)) AND ("max_note" >= "min_note"))),
    CONSTRAINT "midi_synth_presets_min_note_check" CHECK ((("min_note" >= 0) AND ("min_note" <= 127))),
    CONSTRAINT "midi_synth_presets_preset_id_check" CHECK (("preset_id" ~ '^[a-z0-9-]{1,64}$'::"text")),
    CONSTRAINT "midi_synth_presets_version_check" CHECK (("version" > 0))
);

ALTER TABLE "private"."midi_synth_presets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."workspace_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "lock_version" integer NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "manifest_sha256" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "workspace_snapshots_lock_version_check" CHECK (("lock_version" > 0)),
    CONSTRAINT "workspace_snapshots_manifest_sha256_check" CHECK (("manifest_sha256" ~ '^[0-9a-f]{64}$'::"text"))
);

ALTER TABLE "private"."workspace_snapshots" OWNER TO "postgres";

COMMENT ON TABLE "private"."workspace_snapshots" IS 'Bounded Postgres recovery history for private optimistic workspaces; commands retain at most 20 rows.';

CREATE TABLE IF NOT EXISTS "public"."arrangement_clips" (
    "arrangement_version_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "clip_id" "uuid" NOT NULL,
    "midi_pattern_version_id" "uuid" NOT NULL,
    "start_tick" integer NOT NULL,
    "duration_ticks" integer NOT NULL,
    "source_start_tick" integer NOT NULL,
    "loop" boolean NOT NULL,
    CONSTRAINT "arrangement_clips_duration_ticks_check" CHECK (("duration_ticks" > 0)),
    CONSTRAINT "arrangement_clips_source_start_tick_check" CHECK (("source_start_tick" >= 0)),
    CONSTRAINT "arrangement_clips_start_tick_check" CHECK (("start_tick" >= 0))
);

ALTER TABLE "public"."arrangement_clips" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."arrangement_tracks" (
    "arrangement_version_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "sort_order" smallint NOT NULL,
    "name" "text" NOT NULL,
    "preset_id" "text" NOT NULL,
    "preset_version" integer NOT NULL,
    "gain_db" numeric NOT NULL,
    "pan" numeric NOT NULL,
    "muted" boolean NOT NULL,
    "soloed" boolean NOT NULL,
    CONSTRAINT "arrangement_tracks_gain_db_check" CHECK ((("gain_db" >= ('-60'::integer)::numeric) AND ("gain_db" <= (6)::numeric))),
    CONSTRAINT "arrangement_tracks_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 120)))),
    CONSTRAINT "arrangement_tracks_pan_check" CHECK ((("pan" >= ('-1'::integer)::numeric) AND ("pan" <= (1)::numeric))),
    CONSTRAINT "arrangement_tracks_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 15)))
);

ALTER TABLE "public"."arrangement_tracks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."arrangement_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "manifest_version" smallint NOT NULL,
    "engine" "text" NOT NULL,
    "engine_version" "text" NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "manifest_sha256" "text" NOT NULL,
    "tempo_bpm" numeric NOT NULL,
    "time_signature_numerator" smallint NOT NULL,
    "time_signature_denominator" smallint NOT NULL,
    "musical_key" "text",
    "ppq" smallint NOT NULL,
    "duration_ticks" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "arrangement_versions_duration_ticks_check" CHECK ((("duration_ticks" >= 1) AND ("duration_ticks" <= 86400000))),
    CONSTRAINT "arrangement_versions_engine_check" CHECK (("engine" = 'jam-session-midi'::"text")),
    CONSTRAINT "arrangement_versions_engine_version_check" CHECK (("engine_version" = 'jam-session-midi-3_tone-15.1.22_presets-1'::"text")),
    CONSTRAINT "arrangement_versions_manifest_sha256_check" CHECK (("manifest_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "arrangement_versions_manifest_version_check" CHECK (("manifest_version" = 3)),
    CONSTRAINT "arrangement_versions_musical_key_check" CHECK ((("musical_key" IS NULL) OR ("musical_key" = ANY (ARRAY['c-major'::"text", 'c-sharp-major'::"text", 'd-major'::"text", 'e-flat-major'::"text", 'e-major'::"text", 'f-major'::"text", 'f-sharp-major'::"text", 'g-major'::"text", 'a-flat-major'::"text", 'a-major'::"text", 'b-flat-major'::"text", 'b-major'::"text", 'c-minor'::"text", 'c-sharp-minor'::"text", 'd-minor'::"text", 'e-flat-minor'::"text", 'e-minor'::"text", 'f-minor'::"text", 'f-sharp-minor'::"text", 'g-minor'::"text", 'g-sharp-minor'::"text", 'a-minor'::"text", 'b-flat-minor'::"text", 'b-minor'::"text"])))),
    CONSTRAINT "arrangement_versions_ppq_check" CHECK (("ppq" = 480)),
    CONSTRAINT "arrangement_versions_tempo_bpm_check" CHECK ((("tempo_bpm" >= (20)::numeric) AND ("tempo_bpm" <= (300)::numeric))),
    CONSTRAINT "arrangement_versions_time_signature_denominator_check" CHECK (("time_signature_denominator" = ANY (ARRAY[1, 2, 4, 8, 16, 32]))),
    CONSTRAINT "arrangement_versions_time_signature_numerator_check" CHECK ((("time_signature_numerator" >= 1) AND ("time_signature_numerator" <= 32)))
);

ALTER TABLE "public"."arrangement_versions" OWNER TO "postgres";

COMMENT ON TABLE "public"."arrangement_versions" IS 'Immutable complete MIDI-only manifest-v3 snapshot shared by revision and contribution wrappers.';

CREATE TABLE IF NOT EXISTS "public"."midi_pattern_notes" (
    "midi_pattern_version_id" "uuid" NOT NULL,
    "note_id" "uuid" NOT NULL,
    "start_tick" integer NOT NULL,
    "duration_ticks" integer NOT NULL,
    "pitch" smallint NOT NULL,
    "velocity" smallint NOT NULL,
    CONSTRAINT "midi_pattern_notes_duration_ticks_check" CHECK (("duration_ticks" > 0)),
    CONSTRAINT "midi_pattern_notes_pitch_check" CHECK ((("pitch" >= 0) AND ("pitch" <= 127))),
    CONSTRAINT "midi_pattern_notes_start_tick_check" CHECK (("start_tick" >= 0)),
    CONSTRAINT "midi_pattern_notes_velocity_check" CHECK ((("velocity" >= 1) AND ("velocity" <= 127)))
);

ALTER TABLE "public"."midi_pattern_notes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."midi_pattern_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "midi_pattern_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "creator_credit_name" "text" NOT NULL,
    "parent_pattern_version_id" "uuid",
    "source_pattern_version_id" "uuid",
    "ppq" smallint NOT NULL,
    "duration_ticks" integer NOT NULL,
    "note_count" integer NOT NULL,
    "content_sha256" "text" NOT NULL,
    "reuse_license_code" "text",
    "reuse_license_version" "text",
    "reuse_license_url" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "midi_pattern_versions_check" CHECK ((("parent_pattern_version_id" IS NULL) OR ("parent_pattern_version_id" <> "id"))),
    CONSTRAINT "midi_pattern_versions_check1" CHECK ((("source_pattern_version_id" IS NULL) OR ("source_pattern_version_id" <> "id"))),
    CONSTRAINT "midi_pattern_versions_check2" CHECK (((("reuse_license_code" IS NULL) AND ("reuse_license_version" IS NULL) AND ("reuse_license_url" IS NULL)) OR (("reuse_license_code" IS NOT NULL) AND ("reuse_license_version" IS NOT NULL) AND ("reuse_license_url" IS NOT NULL)))),
    CONSTRAINT "midi_pattern_versions_content_sha256_check" CHECK (("content_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "midi_pattern_versions_creator_credit_name_check" CHECK ((("creator_credit_name" = "btrim"("creator_credit_name")) AND (("char_length"("creator_credit_name") >= 1) AND ("char_length"("creator_credit_name") <= 120)))),
    CONSTRAINT "midi_pattern_versions_duration_ticks_check" CHECK ((("duration_ticks" >= 1) AND ("duration_ticks" <= 86400000))),
    CONSTRAINT "midi_pattern_versions_note_count_check" CHECK ((("note_count" >= 0) AND ("note_count" <= 2048))),
    CONSTRAINT "midi_pattern_versions_ppq_check" CHECK (("ppq" = 480)),
    CONSTRAINT "midi_pattern_versions_reuse_license_code_check" CHECK ((("reuse_license_code" IS NULL) OR ("reuse_license_code" = 'CC-BY-4.0'::"text"))),
    CONSTRAINT "midi_pattern_versions_reuse_license_url_check" CHECK ((("reuse_license_url" IS NULL) OR ("reuse_license_url" = 'https://creativecommons.org/licenses/by/4.0/'::"text"))),
    CONSTRAINT "midi_pattern_versions_reuse_license_version_check" CHECK ((("reuse_license_version" IS NULL) OR ("reuse_license_version" = '4.0'::"text"))),
    CONSTRAINT "midi_pattern_versions_version_number_check" CHECK (("version_number" > 0))
);

ALTER TABLE "public"."midi_pattern_versions" OWNER TO "postgres";

COMMENT ON TABLE "public"."midi_pattern_versions" IS 'Immutable manifest-v3 MIDI note content and CC BY reuse metadata.';

CREATE TABLE IF NOT EXISTS "public"."midi_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "source_pattern_id" "uuid",
    "source_pattern_version_id" "uuid",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "rights_attestation_version" "text",
    "published_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "midi_patterns_check" CHECK ((("source_pattern_id" IS NULL) OR ("source_pattern_id" <> "id"))),
    CONSTRAINT "midi_patterns_check1" CHECK ((("source_pattern_id" IS NULL) = ("source_pattern_version_id" IS NULL))),
    CONSTRAINT "midi_patterns_check2" CHECK (((("visibility" = 'private'::"text") AND ("rights_attestation_version" IS NULL) AND ("published_at" IS NULL)) OR (("visibility" = 'public'::"text") AND ("rights_attestation_version" = 'cc-by-4.0-attestation-v1'::"text") AND ("published_at" IS NOT NULL)))),
    CONSTRAINT "midi_patterns_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 120)))),
    CONSTRAINT "midi_patterns_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'public'::"text"])))
);

ALTER TABLE "public"."midi_patterns" OWNER TO "postgres";

COMMENT ON TABLE "public"."midi_patterns" IS 'Reusable MIDI pattern identity; immutable versions carry exact creator and source lineage.';

CREATE TABLE IF NOT EXISTS "public"."project_genres" (
    "project_id" "uuid" NOT NULL,
    "genre_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."project_genres" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."project_members" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "revision_number" integer NOT NULL,
    "parent_revision_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "publish_request_id" "uuid" NOT NULL,
    "expected_base_revision_id" "uuid",
    "message" "text",
    "manifest" "jsonb" NOT NULL,
    "manifest_version" smallint NOT NULL,
    "engine" "text" NOT NULL,
    "engine_version" "text" NOT NULL,
    "manifest_sha256" "text" NOT NULL,
    "duration_ms" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "accepted_contribution_id" "uuid",
    "accepted_contribution_version_id" "uuid",
    "arrangement_version_id" "uuid",
    CONSTRAINT "project_revisions_accepted_shape" CHECK (((("accepted_contribution_id" IS NULL) AND ("accepted_contribution_version_id" IS NULL)) OR (("accepted_contribution_id" IS NOT NULL) AND ("accepted_contribution_version_id" IS NOT NULL)))),
    CONSTRAINT "project_revisions_duration_ms_check" CHECK (("duration_ms" >= 0)),
    CONSTRAINT "project_revisions_manifest_sha256_check" CHECK (("manifest_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "project_revisions_message_check" CHECK ((("message" IS NULL) OR (("message" = "btrim"("message")) AND (("char_length"("message") >= 1) AND ("char_length"("message") <= 500))))),
    CONSTRAINT "project_revisions_parent_not_self" CHECK ((("parent_revision_id" IS NULL) OR ("parent_revision_id" <> "id"))),
    CONSTRAINT "project_revisions_parent_shape" CHECK (((("revision_number" = 1) AND ("parent_revision_id" IS NULL)) OR (("revision_number" > 1) AND ("parent_revision_id" IS NOT NULL)))),
    CONSTRAINT "project_revisions_revision_number_check" CHECK (("revision_number" > 0)),
    CONSTRAINT "project_revisions_manifest_runtime_check" CHECK (("manifest_version" = 3) AND ("engine" = 'jam-session-midi'::"text") AND ("engine_version" = 'jam-session-midi-3_tone-15.1.22_presets-1'::"text") AND ("arrangement_version_id" IS NOT NULL))
);

ALTER TABLE "public"."project_revisions" OWNER TO "postgres";

COMMENT ON TABLE "public"."project_revisions" IS 'Immutable canonical Jam Session project revisions.';

COMMENT ON COLUMN "public"."project_revisions"."accepted_contribution_id" IS 'Private normalized lineage for a revision created by accepted contribution.';

COMMENT ON COLUMN "public"."project_revisions"."arrangement_version_id" IS 'Expand-first manifest-v3 arrangement reference; null for transitional v1/v2 revisions.';

CREATE TABLE IF NOT EXISTS "public"."project_tags" (
    "project_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."project_tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "visibility" "public"."project_visibility" DEFAULT 'private'::"public"."project_visibility" NOT NULL,
    "status" "public"."project_status" DEFAULT 'draft'::"public"."project_status" NOT NULL,
    "open_to_contributions" boolean DEFAULT false NOT NULL,
    "bpm" numeric(6,3),
    "musical_key" "text",
    "time_signature_numerator" smallint DEFAULT 4 NOT NULL,
    "time_signature_denominator" smallint DEFAULT 4 NOT NULL,
    "license_code" "text" NOT NULL,
    "lock_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "current_revision_id" "uuid",
    "source_project_id" "uuid",
    "source_revision_id" "uuid",
    "compatibility" "text" DEFAULT 'midi'::"text" NOT NULL,
    "moderation_state" "text" DEFAULT 'visible'::"text" NOT NULL,
    "moderation_version" integer DEFAULT 1 NOT NULL,
    "moderation_updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "purged_at" timestamp with time zone,
    "rights_attestation_version" "text",
    CONSTRAINT "projects_bpm_check" CHECK ((("bpm" IS NULL) OR ((("bpm" >= (20)::numeric) AND ("bpm" <= (400)::numeric)) AND ("scale"("bpm") <= 3)))),
    CONSTRAINT "projects_compatibility_check" CHECK (("compatibility" = ANY (ARRAY['midi'::"text", 'legacy_hybrid'::"text"]))),
    CONSTRAINT "projects_description_check" CHECK ((("description" IS NULL) OR (("description" = "btrim"("description")) AND (("char_length"("description") >= 1) AND ("char_length"("description") <= 5000))))),
    CONSTRAINT "projects_fork_not_self" CHECK ((("source_project_id" IS NULL) OR ("source_project_id" <> "id"))),
    CONSTRAINT "projects_fork_source_shape" CHECK (((("source_project_id" IS NULL) AND ("source_revision_id" IS NULL)) OR (("source_project_id" IS NOT NULL) AND ("source_revision_id" IS NOT NULL)))),
    CONSTRAINT "projects_key_check" CHECK ((("musical_key" IS NULL) OR ("musical_key" = ANY (ARRAY['c-major'::"text", 'c-sharp-major'::"text", 'd-major'::"text", 'e-flat-major'::"text", 'e-major'::"text", 'f-major'::"text", 'f-sharp-major'::"text", 'g-major'::"text", 'a-flat-major'::"text", 'a-major'::"text", 'b-flat-major'::"text", 'b-major'::"text", 'c-minor'::"text", 'c-sharp-minor'::"text", 'd-minor'::"text", 'e-flat-minor'::"text", 'e-minor'::"text", 'f-minor'::"text", 'f-sharp-minor'::"text", 'g-minor'::"text", 'g-sharp-minor'::"text", 'a-minor'::"text", 'b-flat-minor'::"text", 'b-minor'::"text"])))),
    CONSTRAINT "projects_lock_version_check" CHECK (("lock_version" > 0)),
    CONSTRAINT "projects_moderation_state_check" CHECK (("moderation_state" = ANY (ARRAY['visible'::"text", 'hidden'::"text"]))),
    CONSTRAINT "projects_moderation_version_check" CHECK (("moderation_version" > 0)),
    CONSTRAINT "projects_revision_lifecycle_check" CHECK (((("visibility" = ANY (ARRAY['private'::"public"."project_visibility", 'public'::"public"."project_visibility"])) AND ("deleted_at" IS NULL) AND ((("status" = 'draft'::"public"."project_status") AND ("visibility" = 'private'::"public"."project_visibility") AND ("current_revision_id" IS NULL) AND ("published_at" IS NULL) AND (NOT "open_to_contributions")) OR (("status" = 'active'::"public"."project_status") AND ("current_revision_id" IS NOT NULL) AND ("published_at" IS NOT NULL)))) OR (("status" = 'deleted'::"public"."project_status") AND ("visibility" = 'private'::"public"."project_visibility") AND (NOT "open_to_contributions") AND ("deleted_at" IS NOT NULL) AND ((("current_revision_id" IS NULL) AND ("published_at" IS NULL)) OR (("current_revision_id" IS NOT NULL) AND ("published_at" IS NOT NULL)))))),
    CONSTRAINT "projects_rights_attestation_version_check" CHECK ((("rights_attestation_version" IS NULL) OR ("rights_attestation_version" = 'cc-by-4.0-reuse-attestation-v1'::"text"))),
    CONSTRAINT "projects_time_signature_check" CHECK (((("time_signature_numerator" >= 1) AND ("time_signature_numerator" <= 32)) AND ("time_signature_denominator" = ANY (ARRAY[1, 2, 4, 8, 16, 32])))),
    CONSTRAINT "projects_title_check" CHECK ((("title" = "btrim"("title")) AND (("char_length"("title") >= 1) AND ("char_length"("title") <= 120))))
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

COMMENT ON COLUMN "public"."projects"."source_project_id" IS 'Immutable direct source project for a copy-on-write fork; null for original projects.';

COMMENT ON COLUMN "public"."projects"."source_revision_id" IS 'Exact immutable source revision used to create a copy-on-write fork.';

COMMENT ON COLUMN "public"."projects"."compatibility" IS 'MIDI-only project invariant.';

CREATE TABLE IF NOT EXISTS "public"."workspace_clips" (
    "workspace_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "clip_id" "uuid" NOT NULL,
    "start_tick" integer,
    "duration_ticks" integer,
    "source_start_tick" integer,
    "loop" boolean,
    "midi_pattern_version_id" "uuid"
);

ALTER TABLE "public"."workspace_clips" OWNER TO "postgres";

COMMENT ON TABLE "public"."workspace_clips" IS 'Optimistically replaced normalized v2 clip projection; MIDI clips reference exact immutable stem versions.';

CREATE TABLE IF NOT EXISTS "public"."workspace_tracks" (
    "workspace_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "gain_db" numeric NOT NULL,
    "pan" numeric NOT NULL,
    "muted" boolean NOT NULL,
    "soloed" boolean NOT NULL,
    "sort_order" smallint NOT NULL,
    "preset_id" "text",
    "preset_version" integer,
    CONSTRAINT "workspace_tracks_gain_db_check" CHECK ((("gain_db" >= ('-60'::integer)::numeric) AND ("gain_db" <= (6)::numeric))),
    CONSTRAINT "workspace_tracks_name_check" CHECK ((("name" = "btrim"("name")) AND (("char_length"("name") >= 1) AND ("char_length"("name") <= 120)))),
    CONSTRAINT "workspace_tracks_pan_check" CHECK ((("pan" >= ('-1'::integer)::numeric) AND ("pan" <= (1)::numeric))),
    CONSTRAINT "workspace_tracks_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 27)))
);

ALTER TABLE "public"."workspace_tracks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "base_revision_id" "uuid",
    "manifest" "jsonb" NOT NULL,
    "manifest_version" smallint NOT NULL,
    "engine" "text" NOT NULL,
    "engine_version" "text" NOT NULL,
    "manifest_sha256" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "lock_version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "contribution_id" "uuid",
    "last_manifest_request_id" "uuid",
    "last_manifest_expected_lock_version" integer,
    CONSTRAINT "workspaces_last_manifest_expected_lock_version_check" CHECK (("last_manifest_expected_lock_version" > 0)),
    CONSTRAINT "workspaces_last_manifest_request_shape" CHECK ((("last_manifest_request_id" IS NULL) = ("last_manifest_expected_lock_version" IS NULL))),
    CONSTRAINT "workspaces_lock_version_check" CHECK (("lock_version" > 0)),
    CONSTRAINT "workspaces_manifest_sha256_check" CHECK (("manifest_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "workspaces_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"]))),
    CONSTRAINT "workspaces_manifest_runtime_check" CHECK (("manifest_version" = 3) AND ("engine" = 'jam-session-midi'::"text") AND ("engine_version" = 'jam-session-midi-3_tone-15.1.22_presets-1'::"text"))
);

ALTER TABLE "public"."workspaces" OWNER TO "postgres";

COMMENT ON COLUMN "public"."workspaces"."contribution_id" IS 'Null for owner project workspaces; set for author-owned contribution workspaces.';

ALTER TABLE ONLY "private"."midi_synth_presets"
    ADD CONSTRAINT "midi_synth_presets_pkey" PRIMARY KEY ("preset_id", "version");

ALTER TABLE ONLY "private"."workspace_snapshots"
    ADD CONSTRAINT "workspace_snapshots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "private"."workspace_snapshots"
    ADD CONSTRAINT "workspace_snapshots_workspace_id_lock_version_key" UNIQUE ("workspace_id", "lock_version");

ALTER TABLE ONLY "private"."workspace_snapshots"
    ADD CONSTRAINT "workspace_snapshots_workspace_id_request_id_key" UNIQUE ("workspace_id", "request_id");

ALTER TABLE ONLY "public"."arrangement_clips"
    ADD CONSTRAINT "arrangement_clips_pkey" PRIMARY KEY ("arrangement_version_id", "clip_id");

ALTER TABLE ONLY "public"."arrangement_tracks"
    ADD CONSTRAINT "arrangement_tracks_arrangement_version_id_sort_order_key" UNIQUE ("arrangement_version_id", "sort_order");

ALTER TABLE ONLY "public"."arrangement_tracks"
    ADD CONSTRAINT "arrangement_tracks_pkey" PRIMARY KEY ("arrangement_version_id", "track_id");

ALTER TABLE ONLY "public"."arrangement_tracks"
    ADD CONSTRAINT "arrangement_tracks_project_id_arrangement_version_id_track__key" UNIQUE ("project_id", "arrangement_version_id", "track_id");

ALTER TABLE ONLY "public"."arrangement_versions"
    ADD CONSTRAINT "arrangement_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."arrangement_versions"
    ADD CONSTRAINT "arrangement_versions_project_id_create_request_id_key" UNIQUE ("project_id", "create_request_id");

ALTER TABLE ONLY "public"."arrangement_versions"
    ADD CONSTRAINT "arrangement_versions_project_id_id_key" UNIQUE ("project_id", "id");

ALTER TABLE ONLY "public"."midi_pattern_notes"
    ADD CONSTRAINT "midi_pattern_notes_pkey" PRIMARY KEY ("midi_pattern_version_id", "note_id");

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_id_midi_pattern_id_key" UNIQUE ("id", "midi_pattern_id");

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_midi_pattern_id_create_request_id_key" UNIQUE ("midi_pattern_id", "create_request_id");

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_midi_pattern_id_id_key" UNIQUE ("midi_pattern_id", "id");

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_midi_pattern_id_version_number_key" UNIQUE ("midi_pattern_id", "version_number");

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_id_owner_id_key" UNIQUE ("id", "owner_id");

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_id_source_pattern_version_id_key" UNIQUE ("id", "source_pattern_version_id");

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_owner_id_create_request_id_key" UNIQUE ("owner_id", "create_request_id");

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_genres"
    ADD CONSTRAINT "project_genres_pkey" PRIMARY KEY ("project_id", "genre_id");

ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id");

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_accepted_result_uq" UNIQUE ("accepted_contribution_id", "id");

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_project_id_id_key" UNIQUE ("project_id", "id");

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_project_id_publish_request_id_key" UNIQUE ("project_id", "publish_request_id");

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_project_id_revision_number_key" UNIQUE ("project_id", "revision_number");

ALTER TABLE ONLY "public"."project_tags"
    ADD CONSTRAINT "project_tags_pkey" PRIMARY KEY ("project_id", "tag_id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_request_uq" UNIQUE ("owner_id", "create_request_id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_id_id_uq" UNIQUE ("id", "current_revision_id");

ALTER TABLE ONLY "public"."workspace_clips"
    ADD CONSTRAINT "workspace_clips_pkey" PRIMARY KEY ("workspace_id", "clip_id");

ALTER TABLE ONLY "public"."workspace_tracks"
    ADD CONSTRAINT "workspace_tracks_pkey" PRIMARY KEY ("workspace_id", "track_id");

ALTER TABLE ONLY "public"."workspace_tracks"
    ADD CONSTRAINT "workspace_tracks_workspace_order_uq" UNIQUE ("workspace_id", "sort_order");

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_create_request_id_key" UNIQUE ("owner_id", "create_request_id");

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_project_identity_uq" UNIQUE ("id", "project_id", "owner_id");

CREATE INDEX "workspace_snapshots_prune_idx" ON "private"."workspace_snapshots" USING "btree" ("workspace_id", "lock_version" DESC);

CREATE INDEX "arrangement_clips_pattern_version_idx" ON "public"."arrangement_clips" USING "btree" ("midi_pattern_version_id");

CREATE INDEX "arrangement_clips_track_idx" ON "public"."arrangement_clips" USING "btree" ("arrangement_version_id", "track_id", "start_tick", "clip_id");

CREATE INDEX "arrangement_tracks_preset_idx" ON "public"."arrangement_tracks" USING "btree" ("preset_id", "preset_version");

CREATE INDEX "arrangement_versions_creator_created_idx" ON "public"."arrangement_versions" USING "btree" ("created_by", "created_at" DESC, "id" DESC);

CREATE INDEX "arrangement_versions_project_created_idx" ON "public"."arrangement_versions" USING "btree" ("project_id", "created_at" DESC, "id" DESC);

CREATE INDEX "midi_pattern_notes_timeline_idx" ON "public"."midi_pattern_notes" USING "btree" ("midi_pattern_version_id", "start_tick", "pitch", "note_id");

CREATE INDEX "midi_pattern_versions_creator_created_idx" ON "public"."midi_pattern_versions" USING "btree" ("creator_id", "created_at" DESC, "id" DESC);

CREATE INDEX "midi_pattern_versions_parent_idx" ON "public"."midi_pattern_versions" USING "btree" ("parent_pattern_version_id") WHERE ("parent_pattern_version_id" IS NOT NULL);

CREATE INDEX "midi_pattern_versions_source_idx" ON "public"."midi_pattern_versions" USING "btree" ("source_pattern_version_id") WHERE ("source_pattern_version_id" IS NOT NULL);

CREATE INDEX "midi_patterns_owner_updated_idx" ON "public"."midi_patterns" USING "btree" ("owner_id", "updated_at" DESC, "id" DESC);

CREATE INDEX "midi_patterns_source_idx" ON "public"."midi_patterns" USING "btree" ("source_pattern_id") WHERE ("source_pattern_id" IS NOT NULL);

CREATE INDEX "project_genres_genre_id_idx" ON "public"."project_genres" USING "btree" ("genre_id");

CREATE UNIQUE INDEX "project_genres_one_primary_idx" ON "public"."project_genres" USING "btree" ("project_id") WHERE "is_primary";

CREATE INDEX "project_members_created_by_idx" ON "public"."project_members" USING "btree" ("created_by");

CREATE UNIQUE INDEX "project_members_one_owner_idx" ON "public"."project_members" USING "btree" ("project_id") WHERE ("role" = 'owner'::"public"."member_role");

CREATE INDEX "project_members_user_id_idx" ON "public"."project_members" USING "btree" ("user_id");

CREATE UNIQUE INDEX "project_revisions_accepted_contribution_uq" ON "public"."project_revisions" USING "btree" ("accepted_contribution_id") WHERE ("accepted_contribution_id" IS NOT NULL);

CREATE UNIQUE INDEX "project_revisions_accepted_version_uq" ON "public"."project_revisions" USING "btree" ("accepted_contribution_version_id") WHERE ("accepted_contribution_version_id" IS NOT NULL);

CREATE UNIQUE INDEX "project_revisions_arrangement_uq" ON "public"."project_revisions" USING "btree" ("arrangement_version_id") WHERE ("arrangement_version_id" IS NOT NULL);

CREATE INDEX "project_revisions_created_by_idx" ON "public"."project_revisions" USING "btree" ("created_by");

CREATE INDEX "project_revisions_expected_base_idx" ON "public"."project_revisions" USING "btree" ("expected_base_revision_id") WHERE ("expected_base_revision_id" IS NOT NULL);

CREATE INDEX "project_revisions_parent_idx" ON "public"."project_revisions" USING "btree" ("parent_revision_id") WHERE ("parent_revision_id" IS NOT NULL);

CREATE INDEX "project_revisions_project_created_idx" ON "public"."project_revisions" USING "btree" ("project_id", "created_at" DESC, "id" DESC);

CREATE INDEX "project_tags_tag_id_idx" ON "public"."project_tags" USING "btree" ("tag_id");

CREATE INDEX "projects_license_code_idx" ON "public"."projects" USING "btree" ("license_code");

CREATE INDEX "projects_moderation_idx" ON "public"."projects" USING "btree" ("moderation_state", "id");

CREATE INDEX "projects_owner_dashboard_idx" ON "public"."projects" USING "btree" ("owner_id", "updated_at" DESC, "id" DESC) WHERE (("deleted_at" IS NULL) AND ("status" = ANY (ARRAY['draft'::"public"."project_status", 'active'::"public"."project_status"])));

CREATE INDEX "projects_owner_id_idx" ON "public"."projects" USING "btree" ("owner_id");

CREATE INDEX "projects_source_children_idx" ON "public"."projects" USING "btree" ("source_project_id", "created_at" DESC, "id") WHERE ("source_project_id" IS NOT NULL);

CREATE INDEX "workspace_clips_pattern_version_idx" ON "public"."workspace_clips" USING "btree" ("midi_pattern_version_id") WHERE ("midi_pattern_version_id" IS NOT NULL);

CREATE INDEX "workspace_clips_track_idx" ON "public"."workspace_clips" USING "btree" ("workspace_id", "track_id");

CREATE UNIQUE INDEX "workspaces_active_owner_project_uq" ON "public"."workspaces" USING "btree" ("project_id", "owner_id") WHERE ("status" = 'active'::"text");

CREATE INDEX "workspaces_active_owner_updated_idx" ON "public"."workspaces" USING "btree" ("owner_id", "updated_at" DESC, "id" DESC) WHERE ("status" = 'active'::"text");

CREATE INDEX "workspaces_base_revision_idx" ON "public"."workspaces" USING "btree" ("base_revision_id") WHERE ("base_revision_id" IS NOT NULL);

CREATE INDEX "workspaces_contribution_idx" ON "public"."workspaces" USING "btree" ("contribution_id") WHERE ("contribution_id" IS NOT NULL);

CREATE UNIQUE INDEX "workspaces_contribution_uq" ON "public"."workspaces" USING "btree" ("contribution_id") WHERE ("contribution_id" IS NOT NULL);

CREATE INDEX "workspaces_owner_idx" ON "public"."workspaces" USING "btree" ("owner_id");

CREATE OR REPLACE TRIGGER "arrangement_clips_immutable" BEFORE DELETE OR UPDATE ON "public"."arrangement_clips" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "arrangement_tracks_immutable" BEFORE DELETE OR UPDATE ON "public"."arrangement_tracks" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "arrangement_versions_immutable" BEFORE DELETE OR UPDATE ON "public"."arrangement_versions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE CONSTRAINT TRIGGER "members_owner_invariant" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_members" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_project_owner_invariant"();

CREATE OR REPLACE TRIGGER "midi_pattern_notes_immutable" BEFORE DELETE OR UPDATE ON "public"."midi_pattern_notes" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "midi_pattern_versions_immutable" BEFORE DELETE OR UPDATE ON "public"."midi_pattern_versions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "profiles_bump_public_discovery" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."bump_discovery_for_profile_trigger"();

CREATE CONSTRAINT TRIGGER "project_genres_limit" AFTER INSERT OR UPDATE ON "public"."project_genres" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_project_taxonomy_limits"();

CREATE OR REPLACE TRIGGER "project_revisions_immutable" BEFORE DELETE OR UPDATE ON "public"."project_revisions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE CONSTRAINT TRIGGER "project_tags_limit" AFTER INSERT OR UPDATE ON "public"."project_tags" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_project_taxonomy_limits"();

CREATE OR REPLACE TRIGGER "projects_fork_lineage_immutable" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "private"."protect_project_fork_lineage"();

CREATE OR REPLACE TRIGGER "projects_hidden_mutation" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_hidden_content_mutation"();

CREATE CONSTRAINT TRIGGER "projects_owner_invariant" AFTER INSERT OR UPDATE ON "public"."projects" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_project_owner_invariant"();

ALTER TABLE ONLY "private"."workspace_snapshots"
    ADD CONSTRAINT "workspace_snapshots_workspace_id_project_id_owner_id_fkey" FOREIGN KEY ("workspace_id", "project_id", "owner_id") REFERENCES "public"."workspaces"("id", "project_id", "owner_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."arrangement_clips"
    ADD CONSTRAINT "arrangement_clips_midi_pattern_version_id_fkey" FOREIGN KEY ("midi_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."arrangement_clips"
    ADD CONSTRAINT "arrangement_clips_project_id_arrangement_version_id_track__fkey" FOREIGN KEY ("project_id", "arrangement_version_id", "track_id") REFERENCES "public"."arrangement_tracks"("project_id", "arrangement_version_id", "track_id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."arrangement_tracks"
    ADD CONSTRAINT "arrangement_tracks_preset_id_preset_version_fkey" FOREIGN KEY ("preset_id", "preset_version") REFERENCES "private"."midi_synth_presets"("preset_id", "version") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."arrangement_tracks"
    ADD CONSTRAINT "arrangement_tracks_project_id_arrangement_version_id_fkey" FOREIGN KEY ("project_id", "arrangement_version_id") REFERENCES "public"."arrangement_versions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."arrangement_versions"
    ADD CONSTRAINT "arrangement_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."arrangement_versions"
    ADD CONSTRAINT "arrangement_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_pattern_notes"
    ADD CONSTRAINT "midi_pattern_notes_midi_pattern_version_id_fkey" FOREIGN KEY ("midi_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_midi_pattern_id_fkey" FOREIGN KEY ("midi_pattern_id") REFERENCES "public"."midi_patterns"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_midi_pattern_id_parent_pattern_versi_fkey" FOREIGN KEY ("midi_pattern_id", "parent_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("midi_pattern_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_pattern_versions"
    ADD CONSTRAINT "midi_pattern_versions_source_pattern_version_id_fkey" FOREIGN KEY ("source_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_source_pattern_id_fkey" FOREIGN KEY ("source_pattern_id") REFERENCES "public"."midi_patterns"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."midi_patterns"
    ADD CONSTRAINT "midi_patterns_source_version_fk" FOREIGN KEY ("source_pattern_id", "source_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("midi_pattern_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_genres"
    ADD CONSTRAINT "project_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_genres"
    ADD CONSTRAINT "project_genres_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_arrangement_fk" FOREIGN KEY ("project_id", "arrangement_version_id") REFERENCES "public"."arrangement_versions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_expected_base_project_fk" FOREIGN KEY ("project_id", "expected_base_revision_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_parent_project_fk" FOREIGN KEY ("project_id", "parent_revision_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_tags"
    ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_tags"
    ADD CONSTRAINT "project_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_current_revision_fk" FOREIGN KEY ("id", "current_revision_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_fork_source_revision_fk" FOREIGN KEY ("source_project_id", "source_revision_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_license_code_fkey" FOREIGN KEY ("license_code") REFERENCES "public"."licenses"("code") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspace_clips"
    ADD CONSTRAINT "workspace_clips_midi_pattern_version_id_fkey" FOREIGN KEY ("midi_pattern_version_id") REFERENCES "public"."midi_pattern_versions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspace_clips"
    ADD CONSTRAINT "workspace_clips_workspace_id_track_id_fkey" FOREIGN KEY ("workspace_id", "track_id") REFERENCES "public"."workspace_tracks"("workspace_id", "track_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."workspace_tracks"
    ADD CONSTRAINT "workspace_tracks_preset_fk" FOREIGN KEY ("preset_id", "preset_version") REFERENCES "private"."midi_synth_presets"("preset_id", "version") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspace_tracks"
    ADD CONSTRAINT "workspace_tracks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_base_revision_id_fkey" FOREIGN KEY ("base_revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE "private"."workspace_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."arrangement_clips" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arrangement_clips_read" ON "public"."arrangement_clips" FOR SELECT TO "authenticated", "anon" USING (( SELECT "private"."can_read_arrangement"("arrangement_clips"."arrangement_version_id") AS "can_read_arrangement"));

ALTER TABLE "public"."arrangement_tracks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arrangement_tracks_read" ON "public"."arrangement_tracks" FOR SELECT TO "authenticated", "anon" USING (( SELECT "private"."can_read_arrangement"("arrangement_tracks"."arrangement_version_id") AS "can_read_arrangement"));

ALTER TABLE "public"."arrangement_versions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arrangement_versions_read" ON "public"."arrangement_versions" FOR SELECT TO "authenticated", "anon" USING (( SELECT "private"."can_read_arrangement"("arrangement_versions"."id") AS "can_read_arrangement"));

CREATE POLICY "member_genres_read" ON "public"."project_genres" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_project_member"("project_genres"."project_id") AS "is_project_member"));

CREATE POLICY "member_projects_read" ON "public"."projects" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_project_member"("projects"."id") AS "is_project_member"));

CREATE POLICY "member_revisions_read" ON "public"."project_revisions" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_project_member"("project_revisions"."project_id") AS "is_project_member"));

CREATE POLICY "public_revisions_read" ON "public"."project_revisions" FOR SELECT TO "authenticated", "anon" USING (("arrangement_version_id" IS NOT NULL) AND ( SELECT "private"."can_read_arrangement"("project_revisions"."arrangement_version_id") AS "can_read_arrangement"));

CREATE POLICY "member_tags_read" ON "public"."project_tags" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_project_member"("project_tags"."project_id") AS "is_project_member"));

ALTER TABLE "public"."midi_pattern_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "midi_pattern_notes_read" ON "public"."midi_pattern_notes" FOR SELECT TO "authenticated", "anon" USING (( SELECT "private"."can_read_pattern_version"("midi_pattern_notes"."midi_pattern_version_id") AS "can_read_pattern_version"));

ALTER TABLE "public"."midi_pattern_versions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "midi_pattern_versions_read" ON "public"."midi_pattern_versions" FOR SELECT TO "authenticated", "anon" USING (( SELECT "private"."can_read_pattern_version"("midi_pattern_versions"."id") AS "can_read_pattern_version"));

ALTER TABLE "public"."midi_patterns" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "midi_patterns_read" ON "public"."midi_patterns" FOR SELECT TO "authenticated", "anon" USING ((("deleted_at" IS NULL) AND (("visibility" = 'public'::"text") OR (("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor")))));

CREATE POLICY "own_workspace_clips_read" ON "public"."workspace_clips" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "workspace_clips"."workspace_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "own_workspace_tracks_read" ON "public"."workspace_tracks" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "workspace_tracks"."workspace_id") AND ("w"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "own_workspaces_read" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor")));

ALTER TABLE "public"."project_genres" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_membership_read" ON "public"."project_members" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor")));

ALTER TABLE "public"."workspace_clips" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."workspace_tracks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION "private"."assert_project_owner_invariant"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_project_taxonomy_limits"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."bump_discovery_for_profile_trigger"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."can_read_arrangement"("p_arrangement_version_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."can_read_arrangement"("p_arrangement_version_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "private"."can_read_arrangement"("p_arrangement_version_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "private"."can_read_pattern_version"("p_pattern_version_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."can_read_pattern_version"("p_pattern_version_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "private"."can_read_pattern_version"("p_pattern_version_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "private"."canonical_manifest_v3"("p_manifest" "jsonb", "p_project_id" "uuid", "p_workspace_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."canonical_midi_pattern_notes_v3"("p_notes" "jsonb", "p_duration_ticks" integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."freeze_workspace_arrangement_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_actor" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."is_project_member"("p_project_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."is_project_member"("p_project_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "private"."refresh_all_project_stats"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."replace_workspace_projection_v3"("p_workspace_id" "uuid", "p_manifest" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."create_midi_pattern_v3"("p_request_id" "uuid", "p_name" "text", "p_source_pattern_version_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_midi_pattern_v3"("p_request_id" "uuid", "p_name" "text", "p_source_pattern_version_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_midi_pattern_version_v3"("p_pattern_id" "uuid", "p_request_id" "uuid", "p_expected_version_number" integer, "p_ppq" smallint, "p_duration_ticks" integer, "p_notes" "jsonb", "p_publish_for_reuse" boolean, "p_rights_attestation_version" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_midi_pattern_version_v3"("p_pattern_id" "uuid", "p_request_id" "uuid", "p_expected_version_number" integer, "p_ppq" smallint, "p_duration_ticks" integer, "p_notes" "jsonb", "p_publish_for_reuse" boolean, "p_rights_attestation_version" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_midi_project_workspace_v3"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_midi_project_workspace_v3"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_project"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_project"("p_request_id" "uuid", "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_project_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_project_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."fork_project_v3"("p_source_project_id" "uuid", "p_source_revision_id" "uuid", "p_request_id" "uuid", "p_expected_license_code" "text", "p_rights_attestation_version" "text", "p_title" "text", "p_description" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fork_project_v3"("p_source_project_id" "uuid", "p_source_revision_id" "uuid", "p_request_id" "uuid", "p_expected_license_code" "text", "p_rights_attestation_version" "text", "p_title" "text", "p_description" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."publish_midi_workspace_revision_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."publish_midi_workspace_revision_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_message" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."revision_manifest_checksum_valid"("p_project_id" "uuid", "p_revision_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."revision_manifest_checksum_valid"("p_project_id" "uuid", "p_revision_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_midi_workspace_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer, "p_manifest" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_midi_workspace_v3"("p_workspace_id" "uuid", "p_request_id" "uuid", "p_expected_lock_version" integer, "p_manifest" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_project_contributions_open"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_open" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_project_contributions_open"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_open" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_project_visibility"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_visibility" "public"."project_visibility") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_project_visibility"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_visibility" "public"."project_visibility") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_project_metadata"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_project_metadata"("p_project_id" "uuid", "p_expected_lock_version" integer, "p_title" "text", "p_description" "text", "p_bpm" numeric, "p_musical_key" "text", "p_time_signature_numerator" smallint, "p_time_signature_denominator" smallint, "p_license_code" "text", "p_genre_ids" "uuid"[], "p_primary_genre_id" "uuid", "p_tag_ids" "uuid"[]) TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."arrangement_clips" TO "service_role";

GRANT SELECT ON TABLE "public"."arrangement_clips" TO "anon";

GRANT SELECT ON TABLE "public"."arrangement_clips" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."arrangement_tracks" TO "service_role";

GRANT SELECT ON TABLE "public"."arrangement_tracks" TO "anon";

GRANT SELECT ON TABLE "public"."arrangement_tracks" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."arrangement_versions" TO "service_role";

GRANT SELECT ON TABLE "public"."arrangement_versions" TO "anon";

GRANT SELECT ON TABLE "public"."arrangement_versions" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."midi_pattern_notes" TO "service_role";

GRANT SELECT ON TABLE "public"."midi_pattern_notes" TO "anon";

GRANT SELECT ON TABLE "public"."midi_pattern_notes" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."midi_pattern_versions" TO "service_role";

GRANT SELECT ON TABLE "public"."midi_pattern_versions" TO "anon";

GRANT SELECT ON TABLE "public"."midi_pattern_versions" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."midi_patterns" TO "service_role";

GRANT SELECT ON TABLE "public"."midi_patterns" TO "anon";

GRANT SELECT ON TABLE "public"."midi_patterns" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_genres" TO "service_role";

GRANT SELECT ON TABLE "public"."project_genres" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_members" TO "service_role";

GRANT SELECT ON TABLE "public"."project_members" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_revisions" TO "service_role";

GRANT SELECT ON TABLE "public"."project_revisions" TO "anon";

GRANT SELECT ON TABLE "public"."project_revisions" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_tags" TO "service_role";

GRANT SELECT ON TABLE "public"."project_tags" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "service_role";

GRANT SELECT ON TABLE "public"."projects" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workspace_clips" TO "service_role";

GRANT SELECT ON TABLE "public"."workspace_clips" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workspace_tracks" TO "service_role";

GRANT SELECT ON TABLE "public"."workspace_tracks" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."workspaces" TO "service_role";

GRANT SELECT ON TABLE "public"."workspaces" TO "authenticated";
