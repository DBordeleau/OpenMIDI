-- CHALLENGE-01: stable challenge identities, immutable versions, audited
-- administrator lifecycle commands, and bounded public projections.

create or replace function private.challenge_constraint_range_v1(
  p_value jsonb,
  p_kind text
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_min numeric;
  v_max numeric;
  v_exact numeric;
  -- Manifest-v3 arrangements use the same 300 BPM ceiling.
  v_limit numeric := case when p_kind = 'tempo' then 300 else 32 end;
  v_floor numeric := case when p_kind = 'tempo' then 20 else 0 end;
begin
  if p_value is null or p_value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) <> 'object' then
    raise sqlstate '22023' using message = 'challenge_constraint_range_invalid';
  end if;
  for v_key in select jsonb_object_keys(p_value) loop
    if v_key not in ('minimum','maximum','exact') then
      raise sqlstate '22023' using message = 'challenge_constraint_unknown_key';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_each(p_value) e
    where e.value <> 'null'::jsonb and jsonb_typeof(e.value) <> 'number'
  ) then raise sqlstate '22023' using message = 'challenge_constraint_range_invalid'; end if;
  v_min := nullif(p_value->>'minimum','')::numeric;
  v_max := nullif(p_value->>'maximum','')::numeric;
  v_exact := nullif(p_value->>'exact','')::numeric;
  if v_min is null and v_max is null and v_exact is null then
    raise sqlstate '22023' using message = 'challenge_constraint_range_empty';
  end if;
  if v_exact is not null and (v_min is not null or v_max is not null) then
    raise sqlstate '22023' using message = 'challenge_constraint_range_exclusive';
  end if;
  if v_min is not null and v_max is not null and v_min > v_max then
    raise sqlstate '22023' using message = 'challenge_constraint_range_order';
  end if;
  if exists (
    select 1 from unnest(array[v_min,v_max,v_exact]) value
    where value is not null and (
      value < v_floor or value > v_limit
      or (p_kind = 'integer' and value <> trunc(value))
      or (p_kind = 'tempo' and scale(value) > 3)
    )
  ) then raise sqlstate '22023' using message = 'challenge_constraint_range_bounds'; end if;
  return jsonb_build_object('minimum',v_min,'maximum',v_max,'exact',v_exact);
end;
$$;

create or replace function private.validate_challenge_constraints_v1(p_value jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_track jsonb;
  v_distinct jsonb;
  v_tempo jsonb;
  v_instruments jsonb;
  v_time_signature jsonb;
  v_musical_key text;
  v_allowed_presets jsonb := '[]'::jsonb;
  v_required_presets jsonb := '[]'::jsonb;
  v_allowed_families jsonb := '[]'::jsonb;
  v_required_families jsonb := '[]'::jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object'
    or p_value->>'schemaVersion' <> '1' then
    raise sqlstate '22023' using message = 'challenge_constraints_invalid';
  end if;
  for v_key in select jsonb_object_keys(p_value) loop
    if v_key not in ('schemaVersion','trackCount','distinctInstrumentCount','instruments','tempoBpm','timeSignature','musicalKey') then
      raise sqlstate '22023' using message = 'challenge_constraint_unknown_key';
    end if;
  end loop;
  v_track := private.challenge_constraint_range_v1(p_value->'trackCount','integer');
  v_distinct := private.challenge_constraint_range_v1(p_value->'distinctInstrumentCount','integer');
  v_tempo := private.challenge_constraint_range_v1(p_value->'tempoBpm','tempo');
  v_instruments := p_value->'instruments';
  if v_instruments is not null and v_instruments <> 'null'::jsonb then
    if jsonb_typeof(v_instruments) <> 'object' then
      raise sqlstate '22023' using message = 'challenge_constraint_instruments_invalid';
    end if;
    for v_key in select jsonb_object_keys(v_instruments) loop
      if v_key not in ('allowedPresetVersions','requiredPresetVersions','allowedFamilies','requiredFamilies') then
        raise sqlstate '22023' using message = 'challenge_constraint_unknown_key';
      end if;
    end loop;
    if exists (
      select 1 from unnest(array['allowedPresetVersions','requiredPresetVersions','allowedFamilies','requiredFamilies']) key
      where v_instruments ? key and jsonb_typeof(v_instruments->key) <> 'array'
    ) then raise sqlstate '22023' using message = 'challenge_constraint_instruments_invalid'; end if;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_instruments->'allowedPresetVersions','[]')) item
      where jsonb_typeof(item) <> 'object'
        or (select count(*) from jsonb_object_keys(item)) <> 2
        or not item ?& array['presetId','version']
        or jsonb_typeof(item->'presetId') <> 'string'
        or jsonb_typeof(item->'version') <> 'number'
        or (item->>'version')::numeric <> trunc((item->>'version')::numeric)
        or not exists (
          select 1 from public.midi_library_presets p
          where p.preset_id=item->>'presetId' and p.version=(item->>'version')::integer and p.active
        )
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(v_instruments->'requiredPresetVersions','[]')) item
      where jsonb_typeof(item) <> 'object'
        or (select count(*) from jsonb_object_keys(item)) <> 2
        or not item ?& array['presetId','version']
        or jsonb_typeof(item->'presetId') <> 'string'
        or jsonb_typeof(item->'version') <> 'number'
        or (item->>'version')::numeric <> trunc((item->>'version')::numeric)
        or not exists (
          select 1 from public.midi_library_presets p
          where p.preset_id=item->>'presetId' and p.version=(item->>'version')::integer and p.active
        )
    ) then raise sqlstate '22023' using message = 'challenge_constraint_preset_invalid'; end if;

    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_instruments->'allowedFamilies','[]')) family
      where family <> all(array['drums-percussion','basses','keys','leads','pads-strings','plucks-bells-textures'])
    ) or exists (
      select 1 from jsonb_array_elements_text(coalesce(v_instruments->'requiredFamilies','[]')) family
      where family <> all(array['drums-percussion','basses','keys','leads','pads-strings','plucks-bells-textures'])
    ) then raise sqlstate '22023' using message = 'challenge_constraint_family_invalid'; end if;

    if (select count(*) <> count(distinct item::text) from jsonb_array_elements(coalesce(v_instruments->'allowedPresetVersions','[]')) item)
      or (select count(*) <> count(distinct item::text) from jsonb_array_elements(coalesce(v_instruments->'requiredPresetVersions','[]')) item)
      or (select count(*) <> count(distinct family) from jsonb_array_elements_text(coalesce(v_instruments->'allowedFamilies','[]')) family)
      or (select count(*) <> count(distinct family) from jsonb_array_elements_text(coalesce(v_instruments->'requiredFamilies','[]')) family)
    then raise sqlstate '22023' using message = 'challenge_constraint_duplicate'; end if;

    select coalesce(jsonb_agg(jsonb_build_object('presetId',item->>'presetId','version',(item->>'version')::integer)
      order by item->>'presetId',(item->>'version')::integer),'[]') into v_allowed_presets
      from jsonb_array_elements(coalesce(v_instruments->'allowedPresetVersions','[]')) item;
    select coalesce(jsonb_agg(jsonb_build_object('presetId',item->>'presetId','version',(item->>'version')::integer)
      order by item->>'presetId',(item->>'version')::integer),'[]') into v_required_presets
      from jsonb_array_elements(coalesce(v_instruments->'requiredPresetVersions','[]')) item;
    select coalesce(jsonb_agg(to_jsonb(family) order by family),'[]') into v_allowed_families
      from jsonb_array_elements_text(coalesce(v_instruments->'allowedFamilies','[]')) family;
    select coalesce(jsonb_agg(to_jsonb(family) order by family),'[]') into v_required_families
      from jsonb_array_elements_text(coalesce(v_instruments->'requiredFamilies','[]')) family;
  else v_instruments := null; end if;

  v_time_signature := p_value->'timeSignature';
  if v_time_signature is not null and v_time_signature <> 'null'::jsonb then
    if jsonb_typeof(v_time_signature) <> 'object'
      or (select count(*) from jsonb_object_keys(v_time_signature)) <> 2
      or not v_time_signature ?& array['numerator','denominator']
      or jsonb_typeof(v_time_signature->'numerator') <> 'number'
      or jsonb_typeof(v_time_signature->'denominator') <> 'number'
      or (v_time_signature->>'numerator')::integer not between 1 and 32
      or (v_time_signature->>'denominator')::integer <> all(array[1,2,4,8,16,32])
    then raise sqlstate '22023' using message = 'challenge_constraint_meter_invalid'; end if;
    v_time_signature := jsonb_build_object(
      'numerator',(v_time_signature->>'numerator')::integer,
      'denominator',(v_time_signature->>'denominator')::integer
    );
  else v_time_signature := null; end if;

  v_musical_key := nullif(p_value->>'musicalKey','');
  if v_musical_key is not null and v_musical_key <> all(array[
    'c-major','c-sharp-major','d-major','e-flat-major','e-major','f-major','f-sharp-major','g-major','a-flat-major','a-major','b-flat-major','b-major',
    'c-minor','c-sharp-minor','d-minor','e-flat-minor','e-minor','f-minor','f-sharp-minor','g-minor','g-sharp-minor','a-minor','b-flat-minor','b-minor'
  ]) then raise sqlstate '22023' using message = 'challenge_constraint_key_invalid'; end if;

  if v_track is null and v_distinct is null and v_tempo is null and v_time_signature is null
    and v_musical_key is null and (
      v_instruments is null or jsonb_array_length(v_allowed_presets)+jsonb_array_length(v_required_presets)
        +jsonb_array_length(v_allowed_families)+jsonb_array_length(v_required_families)=0
    )
  then raise sqlstate '22023' using message = 'challenge_constraints_empty'; end if;

  return jsonb_build_object(
    'schemaVersion',1,
    'trackCount',v_track,
    'distinctInstrumentCount',v_distinct,
    'instruments',case when v_instruments is null then null else jsonb_build_object(
      'allowedPresetVersions',v_allowed_presets,
      'requiredPresetVersions',v_required_presets,
      'allowedFamilies',v_allowed_families,
      'requiredFamilies',v_required_families
    ) end,
    'tempoBpm',v_tempo,
    'timeSignature',v_time_signature,
    'musicalKey',v_musical_key
  );
end;
$$;

create or replace function private.challenge_public_phase(
  p_state text,
  p_opens_at timestamptz,
  p_submissions_close_at timestamptz,
  p_now timestamptz default statement_timestamp()
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_state in ('draft','completed','cancelled') then p_state
    when p_now < p_opens_at then 'scheduled'
    when p_now < p_submissions_close_at then 'open'
    else 'voting'
  end
$$;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'draft',
  current_version_id uuid,
  lifecycle_version integer not null default 1,
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancellation_note text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint challenges_slug_check check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  constraint challenges_state_check check (state in ('draft','published','completed','cancelled')),
  constraint challenges_lifecycle_version_check check (lifecycle_version > 0),
  constraint challenges_cancellation_note_check check (cancellation_note is null or (cancellation_note=btrim(cancellation_note) and char_length(cancellation_note) between 1 and 500)),
  constraint challenges_timestamps_check check (updated_at >= created_at),
  constraint challenges_state_shape check (
    (state='draft' and published_at is null and completed_at is null and cancelled_at is null and cancelled_by is null and cancellation_note is null)
    or (state='published' and published_at is not null and completed_at is null and cancelled_at is null and cancelled_by is null and cancellation_note is null)
    or (state='completed' and published_at is not null and completed_at is not null and cancelled_at is null and cancelled_by is null and cancellation_note is null)
    or (state='cancelled' and completed_at is null and cancelled_at is not null and cancelled_by is not null and cancellation_note is not null)
  )
);

create table public.challenge_versions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  version_number integer not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  title text not null,
  prompt text not null,
  description text not null,
  eligibility_terms text not null,
  presentation_code text not null,
  opens_at timestamptz not null,
  submissions_close_at timestamptz not null,
  voting_opens_at timestamptz not null,
  voting_closes_at timestamptz not null,
  results_expected_at timestamptz not null,
  judging_mode text not null,
  official_placement_count integer not null,
  starter_project_id uuid,
  starter_revision_id uuid,
  starter_project_title text,
  starter_creator_credit_name text,
  starter_revision_number integer,
  starter_license_code text,
  constraint_schema_version integer not null default 1,
  constraints jsonb not null,
  constraints_sha256 text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint challenge_versions_number_check check (version_number > 0),
  constraint challenge_versions_title_check check (title=btrim(title) and char_length(title) between 1 and 120),
  constraint challenge_versions_prompt_check check (prompt=btrim(prompt) and char_length(prompt) between 1 and 500),
  constraint challenge_versions_description_check check (description=btrim(description) and char_length(description) between 1 and 5000),
  constraint challenge_versions_terms_check check (eligibility_terms=btrim(eligibility_terms) and char_length(eligibility_terms) between 1 and 2000),
  constraint challenge_versions_presentation_check check (presentation_code in ('pulse','nocturne','sunrise')),
  constraint challenge_versions_schedule_check check (opens_at < submissions_close_at and submissions_close_at < voting_opens_at and voting_opens_at < voting_closes_at and voting_closes_at < results_expected_at),
  constraint challenge_versions_judging_check check (judging_mode in ('community','judged','hybrid') and official_placement_count between 0 and 20 and (judging_mode='community' or official_placement_count > 0)),
  constraint challenge_versions_starter_shape check (
    (starter_project_id is null and starter_revision_id is null and starter_project_title is null and starter_creator_credit_name is null and starter_revision_number is null and starter_license_code is null)
    or (starter_project_id is not null and starter_revision_id is not null and starter_project_title is not null and starter_creator_credit_name is not null and starter_revision_number > 0 and starter_license_code is not null)
  ),
  constraint challenge_versions_schema_check check (constraint_schema_version=1),
  constraint challenge_versions_constraints_hash_check check (constraints_sha256 ~ '^[0-9a-f]{64}$'),
  unique(challenge_id,version_number),
  unique(challenge_id,create_request_id),
  unique(challenge_id,id),
  constraint challenge_versions_starter_fk foreign key(starter_project_id,starter_revision_id) references public.project_revisions(project_id,id) on delete restrict
);

alter table public.challenges add constraint challenges_current_version_fk
  foreign key(id,current_version_id) references public.challenge_versions(challenge_id,id)
  on delete restrict deferrable initially deferred;

create table public.challenge_judge_credits (
  challenge_version_id uuid not null references public.challenge_versions(id) on delete restrict,
  position smallint not null,
  role text not null,
  display_name text not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  credit_name text not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(challenge_version_id,position),
  constraint challenge_judge_position_check check (position between 1 and 10),
  constraint challenge_judge_role_check check (role in ('host','judge')),
  constraint challenge_judge_display_check check (display_name=btrim(display_name) and char_length(display_name) between 1 and 120),
  constraint challenge_judge_credit_check check (credit_name=btrim(credit_name) and char_length(credit_name) between 1 and 120)
);

create table private.challenge_admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  request_payload_sha256 text not null,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_version_id uuid references public.challenge_versions(id) on delete restrict,
  action text not null,
  prior_lifecycle_version integer,
  new_lifecycle_version integer not null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  unique(actor_id,request_id),
  constraint challenge_admin_action_check check (action in ('create','revise','publish','cancel')),
  constraint challenge_admin_hash_check check (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint challenge_admin_versions_check check (new_lifecycle_version > 0 and (prior_lifecycle_version is null or new_lifecycle_version=prior_lifecycle_version+1)),
  constraint challenge_admin_reason_check check (reason is null or (reason=btrim(reason) and char_length(reason) between 1 and 500))
);

create index challenges_public_recent_idx on public.challenges(updated_at desc,id desc) where state <> 'draft';
create index challenge_versions_phase_idx on public.challenge_versions(opens_at,submissions_close_at,voting_opens_at,voting_closes_at);
create index challenge_versions_challenge_created_idx on public.challenge_versions(challenge_id,created_at desc,id desc);
create index challenge_judge_profile_idx on public.challenge_judge_credits(profile_id) where profile_id is not null;
create index challenge_admin_actions_challenge_idx on private.challenge_admin_actions(challenge_id,created_at desc,id desc);

create trigger challenge_versions_immutable before update or delete on public.challenge_versions
  for each row execute function private.reject_immutable_change();
create trigger challenge_judge_credits_immutable before update or delete on public.challenge_judge_credits
  for each row execute function private.reject_immutable_change();
create trigger challenge_admin_actions_immutable before update or delete on private.challenge_admin_actions
  for each row execute function private.reject_append_only_change();

create or replace function private.insert_challenge_version(
  p_challenge_id uuid,
  p_version_number integer,
  p_actor uuid,
  p_request_id uuid,
  p_version jsonb,
  p_judges jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_constraints jsonb;
  v_starter_project public.projects%rowtype;
  v_starter_revision public.project_revisions%rowtype;
  v_starter_credit text;
  v_item jsonb;
  v_position integer := 0;
  v_profile public.profiles%rowtype;
begin
  if p_version is null or jsonb_typeof(p_version)<>'object'
    or p_judges is null or jsonb_typeof(p_judges)<>'array'
    or jsonb_array_length(p_judges) not between 1 and 10 then
    raise sqlstate '22023' using message='challenge_version_invalid';
  end if;
  if exists(select 1 from jsonb_object_keys(p_version) key where key not in (
    'title','prompt','description','eligibilityTerms','presentationCode','opensAt','submissionsCloseAt',
    'votingOpensAt','votingClosesAt','resultsExpectedAt','judgingMode','officialPlacementCount',
    'starterProjectId','starterRevisionId','constraints'
  )) then raise sqlstate '22023' using message='challenge_version_unknown_key'; end if;
  v_constraints := private.validate_challenge_constraints_v1(p_version->'constraints');
  if nullif(p_version->>'starterProjectId','') is not null then
    if nullif(p_version->>'starterRevisionId','') is null then raise sqlstate '22023' using message='challenge_starter_invalid'; end if;
    select * into v_starter_project from public.projects p where p.id=(p_version->>'starterProjectId')::uuid;
    select * into v_starter_revision from public.project_revisions r
      where r.project_id=v_starter_project.id and r.id=(p_version->>'starterRevisionId')::uuid;
    if not found or v_starter_project.visibility<>'public' or v_starter_project.status<>'active'
      or v_starter_project.deleted_at is not null or v_starter_project.moderation_state<>'visible'
      or v_starter_project.license_code<>'cc-by-4.0'
    then raise sqlstate 'PT404' using message='challenge_starter_unavailable'; end if;
    select p.credit_name into v_starter_credit from public.profiles p where p.id=v_starter_project.owner_id
      and p.status='active' and p.profile_completed_at is not null and p.moderation_state='visible';
    if v_starter_credit is null then raise sqlstate 'PT404' using message='challenge_starter_unavailable'; end if;
  elsif nullif(p_version->>'starterRevisionId','') is not null then
    raise sqlstate '22023' using message='challenge_starter_invalid';
  end if;
  insert into public.challenge_versions(
    challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,
    presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
    judging_mode,official_placement_count,starter_project_id,starter_revision_id,starter_project_title,
    starter_creator_credit_name,starter_revision_number,starter_license_code,constraints,constraints_sha256
  ) values (
    p_challenge_id,p_version_number,p_actor,p_request_id,btrim(p_version->>'title'),btrim(p_version->>'prompt'),
    btrim(p_version->>'description'),btrim(p_version->>'eligibilityTerms'),p_version->>'presentationCode',
    (p_version->>'opensAt')::timestamptz,(p_version->>'submissionsCloseAt')::timestamptz,
    (p_version->>'votingOpensAt')::timestamptz,(p_version->>'votingClosesAt')::timestamptz,
    (p_version->>'resultsExpectedAt')::timestamptz,p_version->>'judgingMode',(p_version->>'officialPlacementCount')::integer,
    nullif(p_version->>'starterProjectId','')::uuid,nullif(p_version->>'starterRevisionId','')::uuid,
    v_starter_project.title,v_starter_credit,v_starter_revision.revision_number,v_starter_project.license_code,
    v_constraints,encode(extensions.digest(pg_catalog.convert_to(v_constraints::text,'UTF8'),'sha256'),'hex')
  ) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_judges) loop
    v_position := v_position+1;
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) key where key not in ('role','displayName','profileId')) then
      raise sqlstate '22023' using message='challenge_judge_invalid';
    end if;
    v_profile := null;
    if nullif(v_item->>'profileId','') is not null then
      select * into v_profile from public.profiles p where p.id=(v_item->>'profileId')::uuid
        and p.status='active' and p.profile_completed_at is not null and p.moderation_state='visible';
      if not found then raise sqlstate 'PT404' using message='challenge_judge_profile_unavailable'; end if;
    end if;
    insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,profile_id,credit_name)
    values(v_id,v_position,v_item->>'role',btrim(v_item->>'displayName'),v_profile.id,coalesce(v_profile.credit_name,btrim(v_item->>'displayName')));
  end loop;
  if not exists(select 1 from public.challenge_judge_credits where challenge_version_id=v_id and role='host') then
    raise sqlstate '22023' using message='challenge_host_required';
  end if;
  return v_id;
exception when invalid_text_representation or datetime_field_overflow or not_null_violation or check_violation then
  raise sqlstate '22023' using message='challenge_version_invalid';
end;
$$;

create or replace function public.create_challenge_draft(
  p_request_id uuid,
  p_slug text,
  p_version jsonb,
  p_judges jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin_actor();
  v_slug text := lower(btrim(p_slug));
  v_hash text;
  v_existing private.challenge_admin_actions%rowtype;
  v_challenge public.challenges%rowtype;
  v_version_id uuid;
begin
  if p_request_id is null or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then
    raise sqlstate '22023' using message='challenge_create_invalid';
  end if;
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('slug',v_slug,'version',p_version,'judges',p_judges)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'create' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_slug,0));
  -- A concurrent identical request may have completed while this call waited.
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'create' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  if exists(select 1 from public.challenges where slug=v_slug) then raise sqlstate 'PT409' using message='challenge_slug_taken'; end if;
  insert into public.challenges(slug,created_by) values(v_slug,v_actor) returning * into v_challenge;
  v_version_id:=private.insert_challenge_version(v_challenge.id,1,v_actor,p_request_id,p_version,p_judges);
  update public.challenges set current_version_id=v_version_id where id=v_challenge.id;
  insert into private.challenge_admin_actions(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,action,prior_lifecycle_version,new_lifecycle_version)
  values(v_actor,p_request_id,v_hash,v_challenge.id,v_version_id,'create',null,1);
  return jsonb_build_object('challengeId',v_challenge.id,'versionId',v_version_id,'lifecycleVersion',1);
end;
$$;

create or replace function public.revise_challenge_draft(
  p_challenge_id uuid,
  p_request_id uuid,
  p_expected_lifecycle_version integer,
  p_expected_current_version_id uuid,
  p_version jsonb,
  p_judges jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=private.assert_admin_actor();
  v_hash text;
  v_existing private.challenge_admin_actions%rowtype;
  v_challenge public.challenges%rowtype;
  v_version_id uuid;
  v_version_number integer;
begin
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('challengeId',p_challenge_id,'expectedLifecycleVersion',p_expected_lifecycle_version,'expectedCurrentVersionId',p_expected_current_version_id,'version',p_version,'judges',p_judges)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'revise' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
  -- Recheck after the challenge-row lock so concurrent retries converge.
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'revise' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  if v_challenge.state<>'draft' then raise sqlstate 'PT409' using message='challenge_not_revisable'; end if;
  if v_challenge.lifecycle_version<>p_expected_lifecycle_version or v_challenge.current_version_id<>p_expected_current_version_id then
    raise sqlstate 'PT409' using message='challenge_stale';
  end if;
  select version_number+1 into v_version_number from public.challenge_versions where id=v_challenge.current_version_id;
  v_version_id:=private.insert_challenge_version(v_challenge.id,v_version_number,v_actor,p_request_id,p_version,p_judges);
  update public.challenges set current_version_id=v_version_id,lifecycle_version=lifecycle_version+1,updated_at=statement_timestamp() where id=v_challenge.id;
  insert into private.challenge_admin_actions(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,action,prior_lifecycle_version,new_lifecycle_version)
  values(v_actor,p_request_id,v_hash,v_challenge.id,v_version_id,'revise',v_challenge.lifecycle_version,v_challenge.lifecycle_version+1);
  return jsonb_build_object('challengeId',v_challenge.id,'versionId',v_version_id,'lifecycleVersion',v_challenge.lifecycle_version+1);
end;
$$;

create or replace function public.publish_challenge(
  p_challenge_id uuid,
  p_request_id uuid,
  p_expected_lifecycle_version integer,
  p_expected_current_version_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=private.assert_admin_actor();
  v_hash text;
  v_existing private.challenge_admin_actions%rowtype;
  v_challenge public.challenges%rowtype;
  v_version public.challenge_versions%rowtype;
begin
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('challengeId',p_challenge_id,'expectedLifecycleVersion',p_expected_lifecycle_version,'expectedCurrentVersionId',p_expected_current_version_id)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'publish' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
  -- Recheck after the challenge-row lock so concurrent retries converge.
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'publish' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  if v_challenge.state<>'draft' then raise sqlstate 'PT409' using message='challenge_not_publishable'; end if;
  if v_challenge.lifecycle_version<>p_expected_lifecycle_version or v_challenge.current_version_id<>p_expected_current_version_id then raise sqlstate 'PT409' using message='challenge_stale'; end if;
  select * into v_version from public.challenge_versions where id=v_challenge.current_version_id;
  if private.validate_challenge_constraints_v1(v_version.constraints)<>v_version.constraints
    or encode(extensions.digest(pg_catalog.convert_to(v_version.constraints::text,'UTF8'),'sha256'),'hex')<>v_version.constraints_sha256
    or not exists(select 1 from public.challenge_judge_credits where challenge_version_id=v_version.id and role='host')
  then raise sqlstate 'PT409' using message='challenge_publish_validation_failed'; end if;
  if v_version.starter_project_id is not null and not exists(
    select 1 from public.projects p join public.project_revisions r on r.project_id=p.id and r.id=v_version.starter_revision_id
    where p.id=v_version.starter_project_id and p.visibility='public' and p.status='active' and p.deleted_at is null
      and p.moderation_state='visible' and p.license_code='cc-by-4.0' and p.rights_attestation_version='cc-by-4.0-reuse-attestation-v1'
  ) then raise sqlstate 'PT409' using message='challenge_starter_unavailable'; end if;
  update public.challenges set state='published',published_at=statement_timestamp(),lifecycle_version=lifecycle_version+1,updated_at=statement_timestamp() where id=v_challenge.id;
  insert into private.challenge_admin_actions(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,action,prior_lifecycle_version,new_lifecycle_version)
  values(v_actor,p_request_id,v_hash,v_challenge.id,v_version.id,'publish',v_challenge.lifecycle_version,v_challenge.lifecycle_version+1);
  return jsonb_build_object('challengeId',v_challenge.id,'versionId',v_version.id,'lifecycleVersion',v_challenge.lifecycle_version+1);
end;
$$;

create or replace function public.cancel_challenge(
  p_challenge_id uuid,
  p_request_id uuid,
  p_expected_lifecycle_version integer,
  p_expected_current_version_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=private.assert_admin_actor();
  v_reason text:=btrim(p_reason);
  v_hash text;
  v_existing private.challenge_admin_actions%rowtype;
  v_challenge public.challenges%rowtype;
begin
  if v_reason is null or char_length(v_reason) not between 1 and 500 then raise sqlstate '22023' using message='challenge_cancel_reason_invalid'; end if;
  v_hash:=encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('challengeId',p_challenge_id,'expectedLifecycleVersion',p_expected_lifecycle_version,'expectedCurrentVersionId',p_expected_current_version_id,'reason',v_reason)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'cancel' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found then raise sqlstate 'PT404' using message='challenge_not_found'; end if;
  -- Recheck after the challenge-row lock so concurrent retries converge.
  select * into v_existing from private.challenge_admin_actions where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.action<>'cancel' or v_existing.request_payload_sha256<>v_hash then raise sqlstate 'PT409' using message='challenge_request_conflict'; end if;
    return jsonb_build_object('challengeId',v_existing.challenge_id,'versionId',v_existing.challenge_version_id,'lifecycleVersion',v_existing.new_lifecycle_version);
  end if;
  if v_challenge.state not in ('draft','published') then raise sqlstate 'PT409' using message='challenge_not_cancellable'; end if;
  if v_challenge.lifecycle_version<>p_expected_lifecycle_version or v_challenge.current_version_id<>p_expected_current_version_id then raise sqlstate 'PT409' using message='challenge_stale'; end if;
  update public.challenges set state='cancelled',cancelled_at=statement_timestamp(),cancelled_by=v_actor,cancellation_note=v_reason,lifecycle_version=lifecycle_version+1,updated_at=statement_timestamp() where id=v_challenge.id;
  insert into private.challenge_admin_actions(actor_id,request_id,request_payload_sha256,challenge_id,challenge_version_id,action,prior_lifecycle_version,new_lifecycle_version,reason)
  values(v_actor,p_request_id,v_hash,v_challenge.id,v_challenge.current_version_id,'cancel',v_challenge.lifecycle_version,v_challenge.lifecycle_version+1,v_reason);
  return jsonb_build_object('challengeId',v_challenge.id,'versionId',v_challenge.current_version_id,'lifecycleVersion',v_challenge.lifecycle_version+1);
end;
$$;

create or replace function private.challenge_projection(p_challenge_id uuid,p_public boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',c.id,'slug',c.slug,'state',c.state,
    'phase',private.challenge_public_phase(c.state,v.opens_at,v.submissions_close_at,statement_timestamp()),
    'lifecycleVersion',c.lifecycle_version,'currentVersionId',c.current_version_id,'versionNumber',v.version_number,
    'title',v.title,'prompt',v.prompt,'description',v.description,'eligibilityTerms',v.eligibility_terms,
    'presentationCode',v.presentation_code,'opensAt',v.opens_at,'submissionsCloseAt',v.submissions_close_at,
    'votingOpensAt',v.voting_opens_at,'votingClosesAt',v.voting_closes_at,'resultsExpectedAt',v.results_expected_at,
    'judgingMode',v.judging_mode,'officialPlacementCount',v.official_placement_count,
    'constraints',v.constraints,'constraintsSha256',v.constraints_sha256,
    'judges',coalesce((select jsonb_agg(jsonb_build_object('position',j.position,'role',j.role,'displayName',j.display_name,'profileId',j.profile_id,'creditName',j.credit_name) order by j.position) from public.challenge_judge_credits j where j.challenge_version_id=v.id),'[]'),
    'starter',case when v.starter_project_id is null then null else jsonb_build_object(
      'projectId',v.starter_project_id,'revisionId',v.starter_revision_id,'projectTitle',v.starter_project_title,
      'creatorCreditName',v.starter_creator_credit_name,'revisionNumber',v.starter_revision_number,'licenseCode',v.starter_license_code,
      'available',exists(select 1 from public.projects p where p.id=v.starter_project_id and p.visibility='public' and p.status='active' and p.deleted_at is null and p.moderation_state='visible' and p.license_code='cc-by-4.0')
    ) end,
    'publishedAt',c.published_at,'cancelledAt',c.cancelled_at,'cancellationNote',c.cancellation_note,
    'createdAt',c.created_at,'updatedAt',c.updated_at
  )
  from public.challenges c join public.challenge_versions v on v.id=c.current_version_id
  where c.id=p_challenge_id and (not p_public or c.state<>'draft') and (not p_public or c.state<>'cancelled' or c.published_at is not null)
$$;

create or replace function public.list_admin_challenges(
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();
  if (p_after_updated_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='challenge_cursor_invalid'; end if;
  return coalesce((select jsonb_agg(private.challenge_projection(c.id,false) order by c.updated_at desc,c.id desc)
    from (select id,updated_at from public.challenges
      where p_after_updated_at is null or (updated_at,id)<(p_after_updated_at,p_after_id)
      order by updated_at desc,id desc limit 25) c),'[]');
end;
$$;

create or replace function public.get_admin_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();
  return private.challenge_projection(p_challenge_id,false);
end;
$$;

create or replace function public.list_public_challenges(
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (p_after_updated_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='challenge_cursor_invalid'; end if;
  return coalesce((select jsonb_agg(private.challenge_projection(c.id,true) order by c.updated_at desc,c.id desc)
    from (select id,updated_at from public.challenges
      where state<>'draft' and (state<>'cancelled' or published_at is not null)
        and (p_after_updated_at is null or (updated_at,id)<(p_after_updated_at,p_after_id))
      order by updated_at desc,id desc limit 25) c),'[]');
end;
$$;

create or replace function public.get_public_challenge(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.challenge_projection(c.id,true) from public.challenges c where c.slug=p_slug
$$;

alter table public.challenges enable row level security;
alter table public.challenge_versions enable row level security;
alter table public.challenge_judge_credits enable row level security;
alter table private.challenge_admin_actions enable row level security;

revoke all on table public.challenges,public.challenge_versions,public.challenge_judge_credits from public,anon,authenticated;
revoke all on table private.challenge_admin_actions from public,anon,authenticated;
grant select,insert,update,delete on table public.challenges,public.challenge_versions,public.challenge_judge_credits to service_role;
grant select,insert,update,delete on table private.challenge_admin_actions to service_role;

revoke all on function private.challenge_constraint_range_v1(jsonb,text) from public,anon,authenticated;
revoke all on function private.validate_challenge_constraints_v1(jsonb) from public,anon,authenticated;
revoke all on function private.challenge_public_phase(text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function private.insert_challenge_version(uuid,integer,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.challenge_projection(uuid,boolean) from public,anon,authenticated;
revoke all on function public.create_challenge_draft(uuid,text,jsonb,jsonb) from public,anon;
revoke all on function public.revise_challenge_draft(uuid,uuid,integer,uuid,jsonb,jsonb) from public,anon;
revoke all on function public.publish_challenge(uuid,uuid,integer,uuid) from public,anon;
revoke all on function public.cancel_challenge(uuid,uuid,integer,uuid,text) from public,anon;
revoke all on function public.list_admin_challenges(timestamptz,uuid) from public,anon;
revoke all on function public.get_admin_challenge(uuid) from public,anon;
revoke all on function public.list_public_challenges(timestamptz,uuid) from public;
revoke all on function public.get_public_challenge(text) from public;
grant execute on function public.create_challenge_draft(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.revise_challenge_draft(uuid,uuid,integer,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.publish_challenge(uuid,uuid,integer,uuid) to authenticated;
grant execute on function public.cancel_challenge(uuid,uuid,integer,uuid,text) to authenticated;
grant execute on function public.list_admin_challenges(timestamptz,uuid) to authenticated;
grant execute on function public.get_admin_challenge(uuid) to authenticated;
grant execute on function public.list_public_challenges(timestamptz,uuid) to anon,authenticated;
grant execute on function public.get_public_challenge(text) to anon,authenticated;

comment on table public.challenges is 'Stable curated challenge identity and audited editorial lifecycle pointer.';
comment on table public.challenge_versions is 'Append-only immutable challenge presentation, schedule, starter, judging, and constraint-v1 snapshot.';
comment on table public.challenge_judge_credits is 'Immutable display-only host and judge credit snapshots; never authorization principals.';
comment on table private.challenge_admin_actions is 'Private append-only idempotency and administrator challenge lifecycle audit.';
