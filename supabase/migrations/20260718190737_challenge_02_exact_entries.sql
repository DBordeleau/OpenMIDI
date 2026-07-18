-- CHALLENGE-02: normalized constraint-v1 evaluation, exact immutable entries,
-- explicit atomic replacement, and phase-scoped safe public projections.

create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_version_id uuid not null,
  entrant_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_revision_id uuid not null,
  project_title_snapshot text not null,
  entrant_username_snapshot text not null,
  entrant_display_name_snapshot text not null,
  entrant_credit_name_snapshot text not null,
  revision_number_snapshot integer not null,
  revision_message_snapshot text,
  attribution_snapshot jsonb not null,
  duration_ms_snapshot integer not null,
  display_attestation_version text not null,
  display_attested_at timestamptz not null,
  evaluator_version integer not null default 1,
  facts jsonb not null,
  evaluation jsonb not null,
  evaluation_sha256 text not null,
  status text not null default 'active',
  replacement_of_entry_id uuid,
  replaced_by_entry_id uuid,
  closed_at timestamptz,
  moderation_state text not null default 'visible',
  moderation_version integer not null default 1,
  moderation_updated_at timestamptz not null default statement_timestamp(),
  submit_request_id uuid not null,
  submitted_at timestamptz not null default statement_timestamp(),
  constraint challenge_entries_challenge_version_fk foreign key(challenge_id,challenge_version_id)
    references public.challenge_versions(challenge_id,id) on delete restrict,
  constraint challenge_entries_project_revision_fk foreign key(project_id,project_revision_id)
    references public.project_revisions(project_id,id) on delete restrict,
  constraint challenge_entries_replacement_of_fk foreign key(replacement_of_entry_id)
    references public.challenge_entries(id) on delete restrict deferrable initially deferred,
  constraint challenge_entries_replaced_by_fk foreign key(replaced_by_entry_id)
    references public.challenge_entries(id) on delete restrict deferrable initially deferred,
  constraint challenge_entries_project_title_check check (
    project_title_snapshot=btrim(project_title_snapshot) and char_length(project_title_snapshot) between 1 and 120
  ),
  constraint challenge_entries_username_check check (
    entrant_username_snapshot=btrim(entrant_username_snapshot) and char_length(entrant_username_snapshot) between 3 and 30
  ),
  constraint challenge_entries_display_name_check check (
    entrant_display_name_snapshot=btrim(entrant_display_name_snapshot) and char_length(entrant_display_name_snapshot) between 1 and 80
  ),
  constraint challenge_entries_credit_name_check check (
    entrant_credit_name_snapshot=btrim(entrant_credit_name_snapshot) and char_length(entrant_credit_name_snapshot) between 1 and 120
  ),
  constraint challenge_entries_revision_check check (
    revision_number_snapshot > 0 and duration_ms_snapshot >= 0 and
    (revision_message_snapshot is null or (revision_message_snapshot=btrim(revision_message_snapshot) and char_length(revision_message_snapshot) between 1 and 500))
  ),
  constraint challenge_entries_attribution_check check (jsonb_typeof(attribution_snapshot)='array'),
  constraint challenge_entries_attestation_check check (display_attestation_version='challenge-display-attestation-v1'),
  constraint challenge_entries_evaluator_check check (evaluator_version=1 and evaluation_sha256 ~ '^[0-9a-f]{64}$'),
  constraint challenge_entries_status_check check (status in ('active','replaced','withdrawn','disqualified')),
  constraint challenge_entries_moderation_check check (moderation_state in ('visible','hidden') and moderation_version > 0),
  constraint challenge_entries_lifecycle_shape check (
    (status='active' and replacement_of_entry_id is null or status='active' and replacement_of_entry_id is not null)
    and replaced_by_entry_id is null and closed_at is null
    or status='replaced' and replacement_of_entry_id is null or status='replaced' and replacement_of_entry_id is not null
      and replaced_by_entry_id is not null and closed_at is not null
    or status in ('withdrawn','disqualified') and replaced_by_entry_id is null and closed_at is not null
  ),
  unique(entrant_id,submit_request_id)
);

-- Make the lifecycle expression unambiguous (the first check is intentionally
-- broad about whether an active entry is itself a replacement).
alter table public.challenge_entries drop constraint challenge_entries_lifecycle_shape;
alter table public.challenge_entries add constraint challenge_entries_lifecycle_shape check (
  (status='active' and replaced_by_entry_id is null and closed_at is null)
  or (status='replaced' and replaced_by_entry_id is not null and closed_at is not null)
  or (status in ('withdrawn','disqualified') and replaced_by_entry_id is null and closed_at is not null)
);

create unique index challenge_entries_one_active_idx
  on public.challenge_entries(challenge_id,entrant_id) where status='active';
create index challenge_entries_public_order_idx
  on public.challenge_entries(challenge_id,submitted_at,id) where status='active' and moderation_state='visible';
create index challenge_entries_revision_idx on public.challenge_entries(project_id,project_revision_id);
create index challenge_entries_replacement_idx on public.challenge_entries(replacement_of_entry_id)
  where replacement_of_entry_id is not null;

create table private.challenge_entry_commands (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  request_id uuid not null,
  request_payload_sha256 text not null,
  challenge_id uuid not null,
  challenge_version_id uuid not null,
  project_revision_id uuid not null,
  action text not null,
  expected_prior_entry_id uuid,
  resulting_entry_id uuid references public.challenge_entries(id) on delete restrict,
  outcome text not null,
  error_code text,
  error_message text,
  response jsonb,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique(actor_id,request_id),
  constraint challenge_entry_commands_action_check check (action in ('submit','replace')),
  constraint challenge_entry_commands_outcome_check check (outcome in ('succeeded','rejected')),
  constraint challenge_entry_commands_hash_check check (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint challenge_entry_commands_shape_check check (
    (action='submit' and expected_prior_entry_id is null) or
    (action='replace' and expected_prior_entry_id is not null)
  ),
  constraint challenge_entry_commands_result_check check (
    (outcome='succeeded' and resulting_entry_id is not null and error_code is null and error_message is null and response is not null and completed_at is not null)
    or (outcome='rejected' and resulting_entry_id is null and error_code is not null and error_message is not null and response is not null and completed_at is not null)
  )
);

create index challenge_entry_commands_challenge_idx
  on private.challenge_entry_commands(challenge_id,created_at desc,id desc);

create or replace function private.protect_challenge_entry_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then raise sqlstate 'PT403' using message='challenge_entry_immutable'; end if;
  if row(
      new.id,new.challenge_id,new.challenge_version_id,new.entrant_id,new.project_id,new.project_revision_id,
      new.project_title_snapshot,new.entrant_username_snapshot,new.entrant_display_name_snapshot,
      new.entrant_credit_name_snapshot,new.revision_number_snapshot,new.revision_message_snapshot,
      new.attribution_snapshot,new.duration_ms_snapshot,new.display_attestation_version,new.display_attested_at,
      new.evaluator_version,new.facts,new.evaluation,new.evaluation_sha256,new.replacement_of_entry_id,
      new.submit_request_id,new.submitted_at
    ) is distinct from row(
      old.id,old.challenge_id,old.challenge_version_id,old.entrant_id,old.project_id,old.project_revision_id,
      old.project_title_snapshot,old.entrant_username_snapshot,old.entrant_display_name_snapshot,
      old.entrant_credit_name_snapshot,old.revision_number_snapshot,old.revision_message_snapshot,
      old.attribution_snapshot,old.duration_ms_snapshot,old.display_attestation_version,old.display_attested_at,
      old.evaluator_version,old.facts,old.evaluation,old.evaluation_sha256,old.replacement_of_entry_id,
      old.submit_request_id,old.submitted_at
    ) then raise sqlstate 'PT403' using message='challenge_entry_immutable'; end if;
  return new;
end;
$$;

create trigger challenge_entries_protected before update or delete on public.challenge_entries
  for each row execute function private.protect_challenge_entry_change();
create trigger challenge_entry_commands_immutable before update or delete on private.challenge_entry_commands
  for each row execute function private.reject_append_only_change();

create or replace function private.challenge_revision_facts_v1(p_revision_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_revision public.project_revisions%rowtype;
  v_arrangement public.arrangement_versions%rowtype;
  v_presets jsonb;
  v_families jsonb;
begin
  select * into v_revision from public.project_revisions where id=p_revision_id and manifest_version=3;
  if not found or v_revision.arrangement_version_id is null then
    raise sqlstate 'PT404' using message='challenge_revision_not_found';
  end if;
  select * into v_arrangement from public.arrangement_versions
    where id=v_revision.arrangement_version_id and project_id=v_revision.project_id;
  if not found then raise sqlstate 'PT404' using message='challenge_revision_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('presetId',x.preset_id,'version',x.preset_version)
      order by x.preset_id,x.preset_version),'[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(x.family_code) order by x.family_code),'[]'::jsonb)
  into v_presets,v_families
  from (
    select distinct t.preset_id,t.preset_version,p.family_code
    from public.arrangement_tracks t
    join public.midi_library_presets p on p.preset_id=t.preset_id and p.version=t.preset_version
    where t.arrangement_version_id=v_arrangement.id
  ) x;
  -- Families are a distinct observed set even when several preset versions share one family.
  select coalesce(jsonb_agg(to_jsonb(x.family_code) order by x.family_code),'[]'::jsonb)
    into v_families from (
      select distinct p.family_code from public.arrangement_tracks t
      join public.midi_library_presets p on p.preset_id=t.preset_id and p.version=t.preset_version
      where t.arrangement_version_id=v_arrangement.id
    ) x;
  return jsonb_build_object(
    'trackCount',(select count(*) from public.arrangement_tracks where arrangement_version_id=v_arrangement.id),
    'distinctInstrumentCount',(select count(*) from (
      select distinct preset_id,preset_version from public.arrangement_tracks where arrangement_version_id=v_arrangement.id
    ) d),
    'presetVersions',v_presets,'families',v_families,'tempoBpm',v_arrangement.tempo_bpm,
    'timeSignature',jsonb_build_object('numerator',v_arrangement.time_signature_numerator,'denominator',v_arrangement.time_signature_denominator),
    'musicalKey',v_arrangement.musical_key
  );
end;
$$;

create or replace function private.challenge_range_requirement_v1(p_range jsonb,p_noun text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_range->>'exact' is not null then 'exactly '||(p_range->>'exact')||' '||p_noun||
      case when p_noun='BPM' or (p_range->>'exact')::numeric=1 then '' else 's' end
    when p_range->>'minimum' is not null and p_range->>'maximum' is not null then
      (p_range->>'minimum')||'–'||(p_range->>'maximum')||' '||p_noun||case when p_noun='BPM' or (p_range->>'maximum')::numeric=1 then '' else 's' end
    when p_range->>'minimum' is not null then 'at least '||(p_range->>'minimum')||' '||p_noun||
      case when p_noun='BPM' or (p_range->>'minimum')::numeric=1 then '' else 's' end
    else 'at most '||(p_range->>'maximum')||' '||p_noun||case when p_noun='BPM' or (p_range->>'maximum')::numeric=1 then '' else 's' end
  end
$$;

create or replace function private.challenge_format_key_v1(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_key is null then 'No key declared' else
    upper(split_part(p_key,'-',1))||
    case when p_key like '%-sharp-%' then '♯' when p_key like '%-flat-%' then '♭' else '' end||' '||
    case when p_key like '%-minor' then 'minor' else 'major' end end
$$;

create or replace function private.evaluate_challenge_constraints_v1(p_constraints jsonb,p_facts jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_constraints jsonb := private.validate_challenge_constraints_v1(p_constraints);
  v_rules jsonb := '[]'::jsonb;
  v_range jsonb;
  v_observed numeric;
  v_passed boolean;
  v_required text;
  v_noun text;
  v_rule text;
  v_disallowed text[];
  v_missing text[];
  v_instruments jsonb;
  v_expected jsonb;
  v_observed_key text;
begin
  if p_facts is null or jsonb_typeof(p_facts)<>'object'
    or not p_facts ?& array['trackCount','distinctInstrumentCount','presetVersions','families','tempoBpm','timeSignature','musicalKey']
    or (select count(*) from jsonb_object_keys(p_facts))<>7
    or jsonb_typeof(p_facts->'presetVersions')<>'array' or jsonb_typeof(p_facts->'families')<>'array'
    or jsonb_typeof(p_facts->'timeSignature')<>'object'
  then raise sqlstate '22023' using message='challenge_facts_invalid'; end if;

  foreach v_rule in array array['track_count','distinct_instrument_count','tempo_bpm'] loop
    v_range := case v_rule when 'track_count' then v_constraints->'trackCount'
      when 'distinct_instrument_count' then v_constraints->'distinctInstrumentCount' else v_constraints->'tempoBpm' end;
    if v_range is not null and v_range<>'null'::jsonb then
      v_observed := case v_rule when 'track_count' then (p_facts->>'trackCount')::numeric
        when 'distinct_instrument_count' then (p_facts->>'distinctInstrumentCount')::numeric else (p_facts->>'tempoBpm')::numeric end;
      v_noun := case v_rule when 'track_count' then 'track' when 'distinct_instrument_count' then 'distinct instrument' else 'BPM' end;
      v_passed := case when v_range->>'exact' is not null then v_observed=(v_range->>'exact')::numeric
        else (v_range->>'minimum' is null or v_observed >= (v_range->>'minimum')::numeric)
          and (v_range->>'maximum' is null or v_observed <= (v_range->>'maximum')::numeric) end;
      v_required := private.challenge_range_requirement_v1(v_range,v_noun);
      v_rules := v_rules||jsonb_build_array(jsonb_build_object('rule',v_rule,'passed',v_passed,'observed',v_observed,
        'required',v_range,'message','Observed '||v_observed::text||' '||v_noun||
          case when v_noun='BPM' or v_observed=1 then '' else 's' end||
          case when v_passed then '; requirement: '||v_required||'.' else '; change the arrangement to '||v_required||'.' end));
    end if;
    if v_rule='distinct_instrument_count' then
      v_instruments := v_constraints->'instruments';
      if v_instruments is not null and v_instruments<>'null'::jsonb then
        if jsonb_array_length(v_instruments->'allowedPresetVersions')>0 or jsonb_array_length(v_instruments->'allowedFamilies')>0 then
          select coalesce(array_agg((x.item->>'presetId')||' v'||(x.item->>'version') order by x.item->>'presetId',x.item->>'version'),'{}')
          into v_disallowed from jsonb_array_elements(p_facts->'presetVersions') x(item)
          join public.midi_library_presets p on p.preset_id=x.item->>'presetId' and p.version=(x.item->>'version')::integer
          where not exists(select 1 from jsonb_array_elements(v_instruments->'allowedPresetVersions') a(item)
              where a.item->>'presetId'=x.item->>'presetId' and (a.item->>'version')::integer=(x.item->>'version')::integer)
            and not (v_instruments->'allowedFamilies' ? p.family_code);
          v_passed := cardinality(v_disallowed)=0;
          v_rules := v_rules||jsonb_build_array(jsonb_build_object('rule','allowed_instruments','passed',v_passed,
            'observed',jsonb_build_object('presetVersions',p_facts->'presetVersions','families',p_facts->'families'),
            'required',jsonb_build_object('allowedPresetVersions',v_instruments->'allowedPresetVersions','allowedFamilies',v_instruments->'allowedFamilies'),
            'message',case when v_passed then 'Every track uses an allowed preset version or instrument family.'
              else 'Change '||array_to_string(v_disallowed,', ')||' to an allowed preset version or family.' end));
        end if;
        if jsonb_array_length(v_instruments->'requiredPresetVersions')>0 or jsonb_array_length(v_instruments->'requiredFamilies')>0 then
          select coalesce(array_agg(label order by position,label),'{}') into v_missing from (
            select 1 position,(r.item->>'presetId')||' v'||(r.item->>'version') label
            from jsonb_array_elements(v_instruments->'requiredPresetVersions') r(item)
            where not exists(select 1 from jsonb_array_elements(p_facts->'presetVersions') f(item)
              where f.item->>'presetId'=r.item->>'presetId' and (f.item->>'version')::integer=(r.item->>'version')::integer)
            union all
            select 2,replace(f.family,'-',' ') from jsonb_array_elements_text(v_instruments->'requiredFamilies') f(family)
            where not (p_facts->'families' ? f.family)
          ) missing;
          v_passed := cardinality(v_missing)=0;
          v_rules := v_rules||jsonb_build_array(jsonb_build_object('rule','required_instruments','passed',v_passed,
            'observed',jsonb_build_object('presetVersions',p_facts->'presetVersions','families',p_facts->'families'),
            'required',jsonb_build_object('requiredPresetVersions',v_instruments->'requiredPresetVersions','requiredFamilies',v_instruments->'requiredFamilies'),
            'message',case when v_passed then 'Every required preset version and instrument family is present.'
              else 'Add a track for each missing requirement: '||array_to_string(v_missing,', ')||'.' end));
        end if;
      end if;
    end if;
  end loop;

  v_expected := v_constraints->'timeSignature';
  if v_expected is not null and v_expected<>'null'::jsonb then
    v_passed := p_facts->'timeSignature'=v_expected;
    v_rules := v_rules||jsonb_build_array(jsonb_build_object('rule','time_signature','passed',v_passed,
      'observed',p_facts->'timeSignature','required',v_expected,'message','Observed '||(p_facts#>>'{timeSignature,numerator}')||'/'||(p_facts#>>'{timeSignature,denominator}')||
      case when v_passed then '; the required meter is ' else '; change the meter to ' end||(v_expected->>'numerator')||'/'||(v_expected->>'denominator')||'.'));
  end if;
  if v_constraints->>'musicalKey' is not null then
    v_observed_key := p_facts->>'musicalKey';
    v_passed := v_observed_key is not distinct from v_constraints->>'musicalKey';
    v_rules := v_rules||jsonb_build_array(jsonb_build_object('rule','musical_key','passed',v_passed,
      'observed',p_facts->'musicalKey','required',v_constraints->'musicalKey','message','Observed '||private.challenge_format_key_v1(v_observed_key)||
      case when v_passed then '; the required key is ' else '; declare the project key as ' end||
      private.challenge_format_key_v1(v_constraints->>'musicalKey')||'.'));
  end if;
  return jsonb_build_object('schemaVersion',1,'eligible',not exists(select 1 from jsonb_array_elements(v_rules) r where not (r->>'passed')::boolean),
    'facts',p_facts,'rules',v_rules);
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
  raise sqlstate '22023' using message='challenge_facts_invalid';
end;
$$;

create or replace function public.list_my_challenge_revision_options(p_challenge_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_challenge public.challenges%rowtype; v_version public.challenge_versions%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_entry_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null and moderation_state='visible' and purged_at is null)
    then raise sqlstate 'PT403' using message='challenge_entry_actor_ineligible'; end if;
  select * into v_challenge from public.challenges where id=p_challenge_id and state='published';
  if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
  select * into v_version from public.challenge_versions where id=v_challenge.current_version_id;
  if not found or statement_timestamp()<v_version.opens_at or statement_timestamp()>=v_version.submissions_close_at then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('projectId',x.id,'projectTitle',x.title,'revisionId',x.revision_id,
      'revisionNumber',x.revision_number,'revisionMessage',x.message,'durationMs',x.duration_ms,'visibility',x.visibility)
      order by x.updated_at desc,x.id desc)
    from (select p.id,p.title,p.visibility,p.updated_at,r.id revision_id,r.revision_number,r.message,r.duration_ms
      from public.projects p join public.project_revisions r on r.id=p.current_revision_id and r.project_id=p.id
      where p.owner_id=v_actor and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
        and r.manifest_version=3 and r.arrangement_version_id is not null
      order by p.updated_at desc,p.id desc limit 50) x),'[]'::jsonb);
end;
$$;

create or replace function public.preflight_challenge_revision(p_challenge_id uuid,p_challenge_version_id uuid,p_revision_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid()); v_challenge public.challenges%rowtype; v_version public.challenge_versions%rowtype;
  v_project public.projects%rowtype; v_revision public.project_revisions%rowtype; v_facts jsonb; v_evaluation jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_entry_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null and moderation_state='visible' and purged_at is null)
    then raise sqlstate 'PT403' using message='challenge_entry_actor_ineligible'; end if;
  select * into v_challenge from public.challenges where id=p_challenge_id and state='published';
  if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
  select * into v_version from public.challenge_versions where id=p_challenge_version_id and challenge_id=v_challenge.id;
  if not found or v_challenge.current_version_id<>v_version.id then raise sqlstate 'PT409' using message='challenge_version_stale'; end if;
  if statement_timestamp()<v_version.opens_at or statement_timestamp()>=v_version.submissions_close_at
    then raise sqlstate 'PT409' using message='challenge_submissions_closed'; end if;
  select * into v_revision from public.project_revisions r
    where r.id=p_revision_id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='challenge_revision_not_found'; end if;
  select * into v_project from public.projects p where p.id=v_revision.project_id and p.owner_id=v_actor
    and p.current_revision_id=v_revision.id and p.status='active' and p.deleted_at is null and p.moderation_state='visible';
  if not found then raise sqlstate 'PT404' using message='challenge_revision_not_found'; end if;
  v_facts := private.challenge_revision_facts_v1(v_revision.id);
  v_evaluation := private.evaluate_challenge_constraints_v1(v_version.constraints,v_facts);
  return jsonb_build_object('challengeId',v_challenge.id,'challengeVersionId',v_version.id,'projectId',v_project.id,
    'projectTitle',v_project.title,'revisionId',v_revision.id,'revisionNumber',v_revision.revision_number,
    'revisionMessage',v_revision.message,'facts',v_facts,'evaluation',v_evaluation);
end;
$$;

create or replace function public.submit_challenge_entry(
  p_challenge_id uuid,
  p_challenge_version_id uuid,
  p_project_revision_id uuid,
  p_request_id uuid,
  p_expected_active_entry_id uuid,
  p_display_attestation_version text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid()); v_profile public.profiles%rowtype; v_challenge public.challenges%rowtype;
  v_version public.challenge_versions%rowtype; v_project public.projects%rowtype; v_revision public.project_revisions%rowtype;
  v_active public.challenge_entries%rowtype; v_entry public.challenge_entries%rowtype; v_command private.challenge_entry_commands%rowtype;
  v_facts jsonb; v_evaluation jsonb; v_payload_hash text; v_entry_id uuid := gen_random_uuid(); v_action text;
  v_attributions jsonb; v_profile_found boolean; v_response jsonb; v_error_code text; v_error_message text;
begin
  if v_actor is null then return jsonb_build_object('errorCode','PT401'); end if;
  if p_request_id is null then return jsonb_build_object('errorCode','PT400'); end if;
  select * into v_profile from public.profiles where id=v_actor for update;
  v_profile_found := found;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text,0));
  v_payload_hash := encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('challengeId',p_challenge_id,'challengeVersionId',p_challenge_version_id,
    'revisionId',p_project_revision_id,'expectedEntryId',p_expected_active_entry_id,'attestation',p_display_attestation_version)::text,'UTF8'),'sha256'),'hex');
  select * into v_command from private.challenge_entry_commands where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_command.request_payload_sha256<>v_payload_hash then return jsonb_build_object('errorCode','PT409'); end if;
    return v_command.response;
  end if;
  if (select count(*) from private.challenge_entry_commands where actor_id=v_actor and created_at>statement_timestamp()-interval '1 hour')>=20
    then return jsonb_build_object('errorCode','PT429'); end if;
  v_action := case when p_expected_active_entry_id is null then 'submit' else 'replace' end;
  begin
    if not v_profile_found or v_profile.status<>'active' or v_profile.profile_completed_at is null
      or v_profile.moderation_state<>'visible' or v_profile.purged_at is not null
      or v_profile.username is null or v_profile.display_name is null or v_profile.credit_name is null
      then raise sqlstate 'PT403' using message='challenge_entry_actor_ineligible'; end if;
    if p_display_attestation_version is distinct from 'challenge-display-attestation-v1'
      then raise sqlstate 'PT400' using message='challenge_entry_attestation_required'; end if;
    select * into v_challenge from public.challenges where id=p_challenge_id for update;
    if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
    select * into v_version from public.challenge_versions where id=p_challenge_version_id and challenge_id=v_challenge.id;
    if not found or v_challenge.state<>'published' or v_challenge.current_version_id<>v_version.id
      then raise sqlstate 'PT409' using message='challenge_version_stale'; end if;
    if statement_timestamp()<v_version.opens_at or statement_timestamp()>=v_version.submissions_close_at
      then raise sqlstate 'PT409' using message='challenge_submissions_closed'; end if;
    select * into v_active from public.challenge_entries where challenge_id=v_challenge.id and entrant_id=v_actor and status='active' for update;
    if p_expected_active_entry_id is null and found then raise sqlstate 'PT409' using message='challenge_entry_expected_first'; end if;
    if p_expected_active_entry_id is not null and (not found or v_active.id<>p_expected_active_entry_id)
      then raise sqlstate 'PT409' using message='challenge_entry_stale'; end if;
    select * into v_revision from public.project_revisions r where r.id=p_project_revision_id
      and r.manifest_version=3 and r.arrangement_version_id is not null;
    if not found then raise sqlstate 'PT404' using message='challenge_revision_not_found'; end if;
    select * into v_project from public.projects p where p.id=v_revision.project_id and p.owner_id=v_actor
      and p.current_revision_id=v_revision.id and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
      for update;
    if not found then raise sqlstate 'PT404' using message='challenge_revision_not_found'; end if;
    v_facts := private.challenge_revision_facts_v1(v_revision.id);
    v_evaluation := private.evaluate_challenge_constraints_v1(v_version.constraints,v_facts);
    if not (v_evaluation->>'eligible')::boolean then raise sqlstate 'PT422' using message='challenge_revision_ineligible'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('kind',ra.kind,'creditName',ra.credit_name) order by ra.kind),'[]'::jsonb)
      into v_attributions from public.revision_attributions ra where ra.revision_id=v_revision.id;
    if p_expected_active_entry_id is not null then
      update public.challenge_entries set status='replaced',replaced_by_entry_id=v_entry_id,closed_at=statement_timestamp()
        where id=v_active.id;
    end if;
    insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,
      project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,
      revision_number_snapshot,revision_message_snapshot,attribution_snapshot,duration_ms_snapshot,
      display_attestation_version,display_attested_at,evaluator_version,facts,evaluation,evaluation_sha256,status,
      replacement_of_entry_id,submit_request_id,submitted_at)
    values(v_entry_id,v_challenge.id,v_version.id,v_actor,v_project.id,v_revision.id,v_project.title,v_profile.username,
      v_profile.display_name,v_profile.credit_name,v_revision.revision_number,v_revision.message,v_attributions,v_revision.duration_ms,
      p_display_attestation_version,statement_timestamp(),1,v_facts,v_evaluation,
      encode(extensions.digest(pg_catalog.convert_to(v_evaluation::text,'UTF8'),'sha256'),'hex'),'active',p_expected_active_entry_id,p_request_id,statement_timestamp())
    returning * into v_entry;
    v_response := jsonb_build_object('entryId',v_entry.id,'challengeId',v_entry.challenge_id,'challengeVersionId',v_entry.challenge_version_id,
      'projectId',v_entry.project_id,'revisionId',v_entry.project_revision_id,'status',v_entry.status,'submittedAt',v_entry.submitted_at,
      'replacedEntryId',p_expected_active_entry_id);
  exception when others then
    get stacked diagnostics v_error_code=returned_sqlstate,v_error_message=message_text;
    v_response := jsonb_build_object('errorCode',case when left(v_error_code,2)='PT' then v_error_code else 'PT500' end);
  end;
  if v_error_code is null then
    insert into private.challenge_entry_commands(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,
      project_revision_id,action,expected_prior_entry_id,resulting_entry_id,outcome,response,completed_at)
    values(v_actor,p_request_id,v_payload_hash,p_challenge_id,p_challenge_version_id,p_project_revision_id,v_action,
      p_expected_active_entry_id,v_entry.id,'succeeded',v_response,statement_timestamp());
  else
    insert into private.challenge_entry_commands(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,
      project_revision_id,action,expected_prior_entry_id,outcome,error_code,error_message,response,completed_at)
    values(v_actor,p_request_id,v_payload_hash,p_challenge_id,p_challenge_version_id,p_project_revision_id,v_action,
      p_expected_active_entry_id,'rejected',v_error_code,v_error_message,v_response,statement_timestamp());
  end if;
  return v_response;
end;
$$;

create or replace function private.challenge_entry_owner_projection(p_entry_id uuid,p_actor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('entryId',e.id,'challengeId',e.challenge_id,'challengeVersionId',e.challenge_version_id,
    'projectId',e.project_id,'projectTitle',e.project_title_snapshot,'revisionId',e.project_revision_id,
    'revisionNumber',e.revision_number_snapshot,'revisionMessage',e.revision_message_snapshot,'status',e.status,
    'submittedAt',e.submitted_at,'displayAttestedAt',e.display_attested_at,'facts',e.facts,'evaluation',e.evaluation,
    'replacementOfEntryId',e.replacement_of_entry_id)
  from public.challenge_entries e where e.id=p_entry_id and e.entrant_id=p_actor
$$;

create or replace function public.get_my_challenge_entry(p_challenge_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_entry_unauthenticated'; end if;
  select id into v_id from public.challenge_entries where challenge_id=p_challenge_id and entrant_id=v_actor and status='active';
  return private.challenge_entry_owner_projection(v_id,v_actor);
end;
$$;

create or replace function private.challenge_entry_is_public(p_entry public.challenge_entries,p_now timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entry.status='active' and p_entry.moderation_state='visible' and exists(
    select 1 from public.challenges c join public.challenge_versions v on v.id=p_entry.challenge_version_id and v.challenge_id=c.id
    join public.projects p on p.id=p_entry.project_id
    join public.profiles entrant on entrant.id=p_entry.entrant_id
    where c.id=p_entry.challenge_id and c.current_version_id=p_entry.challenge_version_id
      and (c.state='completed' or (c.state='published' and p_now>=v.voting_opens_at))
      and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
      and entrant.status='active' and entrant.profile_completed_at is not null and entrant.moderation_state='visible' and entrant.purged_at is null
  )
$$;

create or replace function private.challenge_entry_public_projection(p_entry_id uuid,p_now timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('entryId',e.id,'challengeId',e.challenge_id,'challengeVersionId',e.challenge_version_id,
    'projectTitle',e.project_title_snapshot,'entrantUsername',e.entrant_username_snapshot,
    'entrantDisplayName',e.entrant_display_name_snapshot,'entrantCreditName',e.entrant_credit_name_snapshot,
    'revisionNumber',e.revision_number_snapshot,'revisionMessage',e.revision_message_snapshot,
    'attributions',e.attribution_snapshot,'durationMs',e.duration_ms_snapshot,'submittedAt',e.submitted_at)
  from public.challenge_entries e where e.id=p_entry_id and private.challenge_entry_is_public(e,p_now)
$$;

create or replace function public.list_public_challenge_entries(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_challenge public.challenges%rowtype; v_now timestamptz := statement_timestamp();
begin
  select * into v_challenge from public.challenges where slug=p_slug and state<>'draft';
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(private.challenge_entry_public_projection(e.id,v_now) order by e.submitted_at,e.id)
    from (select id,submitted_at from public.challenge_entries candidate where challenge_id=v_challenge.id and status='active'
      and private.challenge_entry_is_public(candidate,v_now)
      order by submitted_at,id limit 25) e
    ),'[]'::jsonb);
end;
$$;

create or replace function public.get_public_challenge_entry(p_slug text,p_entry_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.challenge_entry_public_projection(e.id,statement_timestamp())
  from public.challenge_entries e join public.challenges c on c.id=e.challenge_id
  where c.slug=p_slug and e.id=p_entry_id
$$;

create or replace function public.get_public_challenge_entry_preview(p_slug text,p_entry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_entry public.challenge_entries%rowtype; v_revision public.project_revisions%rowtype;
begin
  select e.* into v_entry from public.challenge_entries e join public.challenges c on c.id=e.challenge_id
    where c.slug=p_slug and e.id=p_entry_id;
  if not found or not private.challenge_entry_is_public(v_entry,statement_timestamp()) then return null; end if;
  select * into v_revision from public.project_revisions where id=v_entry.project_revision_id and project_id=v_entry.project_id;
  return jsonb_build_object('projectId',v_entry.project_id,'revisionId',v_entry.project_revision_id,
    'revisionNumber',v_entry.revision_number_snapshot,'projectTitle',v_entry.project_title_snapshot,'manifest',v_revision.manifest,
    'patternVersions',coalesce((select jsonb_agg(jsonb_build_object(
      'midiPatternVersionId',pv.id,'midiPatternId',pv.midi_pattern_id,'version',pv.version_number,
      'creatorId',pv.creator_id,'creatorCreditName',pv.creator_credit_name,
      'parentMidiPatternVersionId',pv.parent_pattern_version_id,'sourceMidiPatternVersionId',pv.source_pattern_version_id,
      'contentSha256',pv.content_sha256,'noteCount',pv.note_count,'ppq',pv.ppq,'durationTicks',pv.duration_ticks,
      'reuseLicense',case when pv.reuse_license_code is null then null else jsonb_build_object('code',pv.reuse_license_code,'version',pv.reuse_license_version,'url',pv.reuse_license_url) end,
      'createdAt',pv.created_at,'notes',coalesce((select jsonb_agg(jsonb_build_object('noteId',n.note_id,'startTick',n.start_tick,
        'durationTicks',n.duration_ticks,'pitch',n.pitch,'velocity',n.velocity) order by n.start_tick,n.pitch,n.note_id)
        from public.midi_pattern_notes n where n.midi_pattern_version_id=pv.id),'[]'::jsonb)
    ) order by pv.id) from public.midi_pattern_versions pv where pv.id in (
      select distinct ac.midi_pattern_version_id from public.arrangement_clips ac where ac.arrangement_version_id=v_revision.arrangement_version_id
    )),'[]'::jsonb),'attributions',v_entry.attribution_snapshot);
end;
$$;

alter table public.challenge_entries enable row level security;
alter table private.challenge_entry_commands enable row level security;
revoke all on table public.challenge_entries,private.challenge_entry_commands from public,anon,authenticated;
grant select,insert,update,delete on table public.challenge_entries,private.challenge_entry_commands to service_role;

revoke all on function private.protect_challenge_entry_change() from public,anon,authenticated;
revoke all on function private.challenge_revision_facts_v1(uuid) from public,anon,authenticated;
revoke all on function private.challenge_range_requirement_v1(jsonb,text) from public,anon,authenticated;
revoke all on function private.challenge_format_key_v1(text) from public,anon,authenticated;
revoke all on function private.evaluate_challenge_constraints_v1(jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.challenge_entry_owner_projection(uuid,uuid) from public,anon,authenticated;
revoke all on function private.challenge_entry_is_public(public.challenge_entries,timestamptz) from public,anon,authenticated;
revoke all on function private.challenge_entry_public_projection(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.list_my_challenge_revision_options(uuid) from public,anon;
revoke all on function public.preflight_challenge_revision(uuid,uuid,uuid) from public,anon;
revoke all on function public.submit_challenge_entry(uuid,uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.get_my_challenge_entry(uuid) from public,anon;
revoke all on function public.list_public_challenge_entries(text) from public;
revoke all on function public.get_public_challenge_entry(text,uuid) from public;
revoke all on function public.get_public_challenge_entry_preview(text,uuid) from public;
grant execute on function public.list_my_challenge_revision_options(uuid) to authenticated;
grant execute on function public.preflight_challenge_revision(uuid,uuid,uuid) to authenticated;
grant execute on function public.submit_challenge_entry(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.get_my_challenge_entry(uuid) to authenticated;
grant execute on function public.list_public_challenge_entries(text) to anon,authenticated;
grant execute on function public.get_public_challenge_entry(text,uuid) to anon,authenticated;
grant execute on function public.get_public_challenge_entry_preview(text,uuid) to anon,authenticated;

comment on table public.challenge_entries is 'Exact immutable challenge-version and current project-revision entries with command-owned lifecycle fields.';
comment on table private.challenge_entry_commands is 'Private append-only attempt, rejection, idempotency, replacement, and rate-limit audit authority.';
