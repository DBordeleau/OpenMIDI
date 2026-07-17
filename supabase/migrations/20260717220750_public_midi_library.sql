-- LIB-01: explicit, exact-version MIDI library publication and bounded search.
-- Musical bytes remain normalized Postgres rows; no Storage media is introduced.

create unique index midi_pattern_versions_id_pattern_idx
  on public.midi_pattern_versions(id, midi_pattern_id);

create table public.midi_library_categories (
  code text primary key,
  display_name text not null,
  sort_order smallint not null unique,
  active boolean not null default true,
  constraint midi_library_categories_code_check check (code ~ '^[a-z0-9-]{1,40}$'),
  constraint midi_library_categories_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 60
  )
);

create table public.midi_library_tags (
  code text primary key,
  display_name text not null,
  sort_order smallint not null unique,
  active boolean not null default true,
  constraint midi_library_tags_code_check check (code ~ '^[a-z0-9-]{1,40}$'),
  constraint midi_library_tags_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 60
  )
);

create table public.midi_library_presets (
  preset_id text not null,
  version integer not null,
  family_code text not null,
  display_name text not null,
  sort_order smallint not null unique,
  active boolean not null default true,
  primary key (preset_id, version),
  constraint midi_library_presets_family_check check (
    family_code = any(array[
      'drums-percussion','basses','keys','leads','pads-strings','plucks-bells-textures'
    ])
  ),
  constraint midi_library_presets_name_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 60
  ),
  constraint midi_library_presets_private_fk foreign key (preset_id, version)
    references private.midi_synth_presets(preset_id, version) on delete restrict
);

insert into public.midi_library_categories(code,display_name,sort_order) values
  ('melody','Melody',1),('harmony','Harmony',2),('bassline','Bassline',3),
  ('rhythm','Rhythm',4),('drums','Drums',5),('texture','Texture',6);

insert into public.midi_library_tags(code,display_name,sort_order) values
  ('melodic','Melodic',1),('rhythmic','Rhythmic',2),('harmonic','Harmonic',3),
  ('loop-friendly','Loop friendly',4),('minimal','Minimal',5),('dense','Dense',6),
  ('upbeat','Upbeat',7),('mellow','Mellow',8),('dark','Dark',9),
  ('cinematic','Cinematic',10),('syncopated','Syncopated',11),('arpeggiated','Arpeggiated',12);

insert into public.midi_library_presets(preset_id,version,family_code,display_name,sort_order)
select v.preset_id,v.version,v.family_code,v.display_name,v.sort_order
from (values
  ('drum-machine',1,'drums-percussion','Drum machine',1),
  ('electro-kit',1,'drums-percussion','Electro kit',2),
  ('lofi-kit',1,'drums-percussion','Lo-fi kit',3),
  ('percussion-rack',1,'drums-percussion','Percussion rack',4),
  ('sub-bass',1,'basses','Sub bass',5),('analog-bass',1,'basses','Analog bass',6),
  ('fm-bass',1,'basses','FM bass',7),('pluck-bass',1,'basses','Pluck bass',8),
  ('warm-keys',1,'keys','Warm keys',9),('electric-keys',1,'keys','Electric keys',10),
  ('organ',1,'keys','Organ',11),('glass-keys',1,'keys','Glass keys',12),
  ('saw-lead',1,'leads','Saw lead',13),('square-lead',1,'leads','Square lead',14),
  ('fm-lead',1,'leads','FM lead',15),('soft-lead',1,'leads','Soft lead',16),
  ('warm-pad',1,'pads-strings','Warm pad',17),('air-pad',1,'pads-strings','Air pad',18),
  ('string-pad',1,'pads-strings','String pad',19),('choir-pad',1,'pads-strings','Choir pad',20),
  ('muted-pluck',1,'plucks-bells-textures','Muted pluck',21),
  ('bright-pluck',1,'plucks-bells-textures','Bright pluck',22),
  ('bell',1,'plucks-bells-textures','Bell',23),('mallet',1,'plucks-bells-textures','Mallet',24)
) as v(preset_id,version,family_code,display_name,sort_order)
join private.midi_synth_presets p on p.preset_id=v.preset_id and p.version=v.version;

create table public.midi_library_listings (
  id uuid primary key default gen_random_uuid(),
  midi_pattern_id uuid not null,
  midi_pattern_version_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  request_payload_sha256 text not null,
  rights_payload_sha256 text not null,
  title text not null,
  description text not null default '',
  creator_username text not null,
  creator_display_name text not null,
  creator_credit_name text not null,
  reuse_mode text not null,
  rights_basis text not null,
  attestation_version text not null,
  attested_by uuid not null references public.profiles(id) on delete restrict,
  attested_at timestamptz not null default statement_timestamp(),
  supporting_source_url text,
  supporting_source_terms text,
  public_domain_rationale text,
  category_code text not null references public.midi_library_categories(code) on delete restrict,
  suggested_preset_id text not null,
  suggested_preset_version integer not null,
  instrument_family_code text not null,
  duration_ticks integer not null,
  duration_beats numeric(12,3) not null,
  note_count integer not null,
  min_pitch smallint,
  max_pitch smallint,
  polyphony_kind text not null,
  search_vector tsvector not null default ''::tsvector,
  listed_at timestamptz not null default statement_timestamp(),
  unlisted_at timestamptz,
  unlisted_by uuid references public.profiles(id) on delete restrict,
  unlist_request_id uuid,
  moderation_hidden_at timestamptz,
  creator_version integer not null default 1,
  moderation_version integer not null default 1,
  constraint midi_library_listings_pattern_version_fk foreign key
    (midi_pattern_version_id, midi_pattern_id)
    references public.midi_pattern_versions(id, midi_pattern_id) on delete restrict,
  constraint midi_library_listings_preset_fk foreign key
    (suggested_preset_id, suggested_preset_version)
    references public.midi_library_presets(preset_id, version) on delete restrict,
  constraint midi_library_listings_request_unique unique(owner_id, request_id),
  constraint midi_library_listings_request_hash_check check (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint midi_library_listings_rights_hash_check check (rights_payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint midi_library_listings_title_check check (
    title = btrim(title) and char_length(title) between 1 and 120
  ),
  constraint midi_library_listings_description_check check (
    description = btrim(description) and char_length(description) <= 1000
  ),
  constraint midi_library_listings_creator_snapshot_check check (
    creator_username = btrim(creator_username) and char_length(creator_username) between 3 and 32
    and creator_display_name = btrim(creator_display_name) and char_length(creator_display_name) between 1 and 80
    and creator_credit_name = btrim(creator_credit_name) and char_length(creator_credit_name) between 1 and 120
  ),
  constraint midi_library_listings_reuse_mode_check check (
    reuse_mode = any(array['commercial_reuse','reference_only'])
  ),
  constraint midi_library_listings_rights_basis_check check (
    rights_basis = any(array['original','authorized_adaptation','public_domain'])
  ),
  constraint midi_library_listings_attestation_check check (
    (reuse_mode='commercial_reuse' and attestation_version='midi-library-commercial-attestation-v1')
    or (reuse_mode='reference_only' and attestation_version='midi-library-reference-display-attestation-v1')
  ),
  constraint midi_library_listings_basis_evidence_check check (
    (rights_basis='original' and supporting_source_url is null and supporting_source_terms is null and public_domain_rationale is null)
    or (rights_basis='authorized_adaptation' and supporting_source_url is not null and supporting_source_terms is not null and public_domain_rationale is null)
    or (rights_basis='public_domain' and supporting_source_url is not null and supporting_source_terms is null and public_domain_rationale is not null)
  ),
  constraint midi_library_listings_source_url_check check (
    supporting_source_url is null or (
      supporting_source_url = btrim(supporting_source_url)
      and char_length(supporting_source_url) between 9 and 500
      and supporting_source_url ~ '^https://[^[:space:]]+$'
    )
  ),
  constraint midi_library_listings_source_terms_check check (
    supporting_source_terms is null or (
      supporting_source_terms = btrim(supporting_source_terms)
      and char_length(supporting_source_terms) between 1 and 500
    )
  ),
  constraint midi_library_listings_public_domain_check check (
    public_domain_rationale is null or (
      public_domain_rationale = btrim(public_domain_rationale)
      and char_length(public_domain_rationale) between 1 and 500
    )
  ),
  constraint midi_library_listings_duration_check check (
    duration_ticks between 1 and 86400000 and duration_beats = duration_ticks::numeric / 480
  ),
  constraint midi_library_listings_notes_check check (
    note_count between 0 and 2048
    and ((note_count=0 and min_pitch is null and max_pitch is null)
      or (note_count>0 and min_pitch between 0 and 127 and max_pitch between min_pitch and 127))
  ),
  constraint midi_library_listings_polyphony_check check (
    polyphony_kind = any(array['monophonic','polyphonic'])
  ),
  constraint midi_library_listings_lifecycle_check check (
    (unlisted_at is null and unlisted_by is null and unlist_request_id is null)
    or (unlisted_at is not null and unlisted_by is not null and unlist_request_id is not null)
  ),
  constraint midi_library_listings_versions_check check (creator_version > 0 and moderation_version > 0)
);

create table public.midi_library_listing_tags (
  listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  tag_code text not null references public.midi_library_tags(code) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key(listing_id, tag_code)
);

create table public.midi_pattern_external_credits (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  position smallint not null,
  credited_name text not null,
  role text not null,
  work_title text,
  source_url text,
  source_terms text,
  attribution_note text,
  inherited_from_credit_id uuid references public.midi_pattern_external_credits(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(listing_id, position),
  constraint midi_pattern_external_credits_position_check check (position between 1 and 12),
  constraint midi_pattern_external_credits_name_check check (
    credited_name = btrim(credited_name) and char_length(credited_name) between 1 and 120
  ),
  constraint midi_pattern_external_credits_role_check check (
    role = btrim(role) and char_length(role) between 1 and 80
  ),
  constraint midi_pattern_external_credits_work_check check (
    work_title is null or (work_title=btrim(work_title) and char_length(work_title) between 1 and 160)
  ),
  constraint midi_pattern_external_credits_url_check check (
    source_url is null or (
      source_url=btrim(source_url) and char_length(source_url) between 9 and 500
      and source_url ~ '^https://[^[:space:]]+$'
    )
  ),
  constraint midi_pattern_external_credits_terms_check check (
    source_terms is null or (source_terms=btrim(source_terms) and char_length(source_terms) between 1 and 500)
  ),
  constraint midi_pattern_external_credits_note_check check (
    attribution_note is null or (attribution_note=btrim(attribution_note) and char_length(attribution_note) between 1 and 500)
  )
);

comment on table public.midi_library_listings is
  'Append-only exact pattern-version listing editions with immutable rights attestation snapshots.';
comment on table public.midi_pattern_external_credits is
  'Immutable external-credit snapshots; credit acknowledges a source but is not proof of permission.';

create unique index midi_library_one_active_pattern_idx
  on public.midi_library_listings(midi_pattern_id)
  where unlisted_at is null;
create unique index midi_library_unlist_request_idx
  on public.midi_library_listings(owner_id, unlist_request_id)
  where unlist_request_id is not null;
create index midi_library_version_idx on public.midi_library_listings(midi_pattern_version_id);
create index midi_library_owner_recent_idx on public.midi_library_listings(owner_id, listed_at desc, id desc);
create index midi_library_active_recent_idx on public.midi_library_listings(listed_at desc, id desc)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_name_idx on public.midi_library_listings(lower(title), id)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_rights_recent_idx on public.midi_library_listings(reuse_mode, listed_at desc, id desc)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_category_recent_idx on public.midi_library_listings(category_code, listed_at desc, id desc)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_preset_recent_idx on public.midi_library_listings(suggested_preset_id, listed_at desc, id desc)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_family_recent_idx on public.midi_library_listings(instrument_family_code, listed_at desc, id desc)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_active_facets_idx on public.midi_library_listings(polyphony_kind,note_count,duration_beats,min_pitch,max_pitch)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_search_idx on public.midi_library_listings using gin(search_vector)
  where unlisted_at is null and moderation_hidden_at is null;
create index midi_library_listing_tags_tag_idx on public.midi_library_listing_tags(tag_code,listing_id);
create index midi_pattern_external_credits_version_idx on public.midi_pattern_external_credits(midi_pattern_version_id);

-- Exact-version base reads remain project/member/owner scoped. Library exposure is
-- deliberately available only through the bounded search function below.
create or replace function private.can_read_pattern_version(p_pattern_version_id uuid)
returns boolean
language sql stable security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.midi_pattern_versions v
    join public.midi_patterns p on p.id=v.midi_pattern_id
    where v.id=p_pattern_version_id and p.deleted_at is null and (
      (p.owner_id=(select auth.uid()) and (select private.is_active_project_actor()))
      or exists(
        select 1 from public.arrangement_clips c
        where c.midi_pattern_version_id=v.id
          and (select private.can_read_arrangement(c.arrangement_version_id))
      )
    )
  );
$$;

drop policy midi_patterns_read on public.midi_patterns;
create policy midi_patterns_read on public.midi_patterns for select to authenticated,anon
using (
  deleted_at is null and (
    (owner_id=(select auth.uid()) and (select private.is_active_project_actor()))
    or exists(
      select 1 from public.midi_pattern_versions v
      join public.arrangement_clips c on c.midi_pattern_version_id=v.id
      where v.midi_pattern_id=midi_patterns.id
        and (select private.can_read_arrangement(c.arrangement_version_id))
    )
  )
);

create or replace function private.reject_external_credit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise sqlstate 'PT409' using message='midi_library_credit_immutable';
end;
$$;
create trigger reject_external_credit_update
  before update or delete on public.midi_pattern_external_credits
  for each row execute function private.reject_external_credit_mutation();

create or replace function public.list_midi_library_pattern_version(
  p_pattern_version_id uuid,
  p_request_id uuid,
  p_reuse_mode text,
  p_rights_basis text,
  p_attestation_version text,
  p_description text,
  p_supporting_source_url text,
  p_supporting_source_terms text,
  p_public_domain_rationale text,
  p_category_code text,
  p_suggested_preset_id text,
  p_suggested_preset_version integer,
  p_tags text[],
  p_external_credits jsonb,
  p_replace_listing_id uuid default null
)
returns table(listing_id uuid, creator_version integer, listed_at timestamptz)
language plpgsql security definer
set search_path=''
as $$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_pattern public.midi_patterns%rowtype;
  v_version public.midi_pattern_versions%rowtype;
  v_profile public.profiles%rowtype;
  v_preset public.midi_library_presets%rowtype;
  v_existing public.midi_library_listings%rowtype;
  v_active public.midi_library_listings%rowtype;
  v_prior_version_listing public.midi_library_listings%rowtype;
  v_listing public.midi_library_listings%rowtype;
  v_tags text[];
  v_credits jsonb;
  v_credit jsonb;
  v_payload_hash text;
  v_rights_hash text;
  v_min_pitch smallint;
  v_max_pitch smallint;
  v_polyphony text;
  v_credit_count integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='midi_library_actor_ineligible';
  end if;
  if p_request_id is null or p_pattern_version_id is null or p_description is null
    or p_reuse_mode is null or p_rights_basis is null or p_attestation_version is null
    or p_description<>btrim(p_description) or char_length(p_description)>1000
    or p_reuse_mode<>all(array['commercial_reuse','reference_only'])
    or p_rights_basis<>all(array['original','authorized_adaptation','public_domain'])
    or (p_reuse_mode='commercial_reuse' and p_attestation_version<>'midi-library-commercial-attestation-v1')
    or (p_reuse_mode='reference_only' and p_attestation_version<>'midi-library-reference-display-attestation-v1') then
    raise sqlstate '22023' using message='midi_library_listing_invalid';
  end if;

  select * into v_version from public.midi_pattern_versions where id=p_pattern_version_id;
  if not found then raise sqlstate 'PT404' using message='midi_library_pattern_version_not_found'; end if;
  select * into v_pattern from public.midi_patterns
    where id=v_version.midi_pattern_id and owner_id=v_actor and deleted_at is null for update;
  if not found or v_version.creator_id<>v_actor then
    raise sqlstate 'PT404' using message='midi_library_pattern_version_not_found';
  end if;
  if p_reuse_mode='commercial_reuse' and (
    v_version.reuse_license_code is distinct from 'CC-BY-4.0'
    or v_version.reuse_license_version is distinct from '4.0'
    or v_version.reuse_license_url is distinct from 'https://creativecommons.org/licenses/by/4.0/'
  ) then raise sqlstate 'PT409' using message='midi_library_commercial_license_required'; end if;
  if p_reuse_mode='reference_only' and (
    v_version.reuse_license_code is not null or v_version.reuse_license_version is not null
    or v_version.reuse_license_url is not null
  ) then raise sqlstate 'PT409' using message='midi_library_cc_downgrade_denied'; end if;

  if p_rights_basis='original' then
    if p_supporting_source_url is not null or p_supporting_source_terms is not null or p_public_domain_rationale is not null then
      raise sqlstate '22023' using message='midi_library_rights_evidence_invalid'; end if;
  elsif p_rights_basis='authorized_adaptation' then
    if p_supporting_source_url is null or p_supporting_source_terms is null or p_public_domain_rationale is not null then
      raise sqlstate '22023' using message='midi_library_rights_evidence_required'; end if;
  else
    if p_supporting_source_url is null or p_supporting_source_terms is not null or p_public_domain_rationale is null then
      raise sqlstate '22023' using message='midi_library_rights_evidence_required'; end if;
  end if;
  if p_supporting_source_url is not null and (
      p_supporting_source_url<>btrim(p_supporting_source_url)
      or char_length(p_supporting_source_url) not between 9 and 500
      or p_supporting_source_url !~ '^https://[^[:space:]]+$') then
    raise sqlstate '22023' using message='midi_library_source_url_invalid';
  end if;
  if p_supporting_source_terms is not null and (
      p_supporting_source_terms<>btrim(p_supporting_source_terms)
      or char_length(p_supporting_source_terms) not between 1 and 500) then
    raise sqlstate '22023' using message='midi_library_source_terms_invalid';
  end if;
  if p_public_domain_rationale is not null and (
      p_public_domain_rationale<>btrim(p_public_domain_rationale)
      or char_length(p_public_domain_rationale) not between 1 and 500) then
    raise sqlstate '22023' using message='midi_library_public_domain_invalid';
  end if;

  select * into v_profile from public.profiles where id=v_actor;
  if v_profile.username is null or v_profile.display_name is null or v_profile.credit_name is null then
    raise sqlstate 'PT403' using message='midi_library_actor_ineligible';
  end if;
  select * into v_preset from public.midi_library_presets
    where preset_id=p_suggested_preset_id and version=p_suggested_preset_version and active;
  if not found or not exists(select 1 from public.midi_library_categories where code=p_category_code and active) then
    raise sqlstate '22023' using message='midi_library_facet_invalid';
  end if;
  if exists(
    select 1 from public.midi_pattern_notes n
    join private.midi_synth_presets p on p.preset_id=v_preset.preset_id and p.version=v_preset.version
    where n.midi_pattern_version_id=v_version.id and n.pitch not between p.min_note and p.max_note
  ) then raise sqlstate '22023' using message='midi_library_preset_incompatible'; end if;

  select coalesce(array_agg(t order by t),'{}'::text[]) into v_tags
  from (select distinct btrim(value) t from unnest(coalesce(p_tags,'{}'::text[])) value) x;
  if cardinality(v_tags)>8 or exists(
    select 1 from unnest(v_tags) t
    where not exists(select 1 from public.midi_library_tags lt where lt.code=t and lt.active)
  ) then raise sqlstate '22023' using message='midi_library_tags_invalid'; end if;

  if p_external_credits is null or jsonb_typeof(p_external_credits)<>'array'
    or jsonb_array_length(p_external_credits)>12 then
    raise sqlstate '22023' using message='midi_library_credits_invalid';
  end if;
  v_credits := p_external_credits;
  v_credit_count := jsonb_array_length(v_credits);
  if p_rights_basis<>'original' and v_credit_count=0 then
    raise sqlstate '22023' using message='midi_library_credits_required';
  end if;
  for v_credit in select value from jsonb_array_elements(v_credits) loop
    if jsonb_typeof(v_credit)<>'object'
      or not jsonb_exists_all(v_credit,array['creditedName','role'])
      or exists(select 1 from jsonb_object_keys(v_credit) key
        where key<>all(array['creditedName','role','workTitle','sourceUrl','sourceTerms','attributionNote']))
      or v_credit->>'creditedName'<>btrim(v_credit->>'creditedName')
      or char_length(v_credit->>'creditedName') not between 1 and 120
      or v_credit->>'role'<>btrim(v_credit->>'role')
      or char_length(v_credit->>'role') not between 1 and 80
      or (jsonb_exists(v_credit,'workTitle') and (v_credit->>'workTitle'<>btrim(v_credit->>'workTitle') or char_length(v_credit->>'workTitle') not between 1 and 160))
      or (jsonb_exists(v_credit,'sourceUrl') and (v_credit->>'sourceUrl'<>btrim(v_credit->>'sourceUrl') or char_length(v_credit->>'sourceUrl') not between 9 and 500 or v_credit->>'sourceUrl' !~ '^https://[^[:space:]]+$'))
      or (jsonb_exists(v_credit,'sourceTerms') and (v_credit->>'sourceTerms'<>btrim(v_credit->>'sourceTerms') or char_length(v_credit->>'sourceTerms') not between 1 and 500))
      or (jsonb_exists(v_credit,'attributionNote') and (v_credit->>'attributionNote'<>btrim(v_credit->>'attributionNote') or char_length(v_credit->>'attributionNote') not between 1 and 500)) then
      raise sqlstate '22023' using message='midi_library_credits_invalid';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'creditedName',value->>'creditedName','role',value->>'role','workTitle',nullif(value->>'workTitle',''),
    'sourceUrl',nullif(value->>'sourceUrl',''),'sourceTerms',nullif(value->>'sourceTerms',''),
    'attributionNote',nullif(value->>'attributionNote','')
  )) order by ordinality),'[]'::jsonb) into v_credits
  from jsonb_array_elements(v_credits) with ordinality;

  v_rights_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'patternVersionId',p_pattern_version_id,'reuseMode',p_reuse_mode,'rightsBasis',p_rights_basis,
    'attestationVersion',p_attestation_version,'supportingSourceUrl',p_supporting_source_url,
    'supportingSourceTerms',p_supporting_source_terms,'publicDomainRationale',p_public_domain_rationale,
    'externalCredits',v_credits
  )::text,'UTF8'),'sha256'),'hex');
  select * into v_prior_version_listing from public.midi_library_listings
    where midi_pattern_version_id=v_version.id order by listed_at,id limit 1;
  if found and v_prior_version_listing.rights_payload_sha256<>v_rights_hash then
    raise sqlstate 'PT409' using message='midi_library_exact_version_rights_conflict';
  end if;

  v_payload_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'patternVersionId',p_pattern_version_id,'reuseMode',p_reuse_mode,'rightsBasis',p_rights_basis,
    'attestationVersion',p_attestation_version,'description',p_description,
    'supportingSourceUrl',p_supporting_source_url,'supportingSourceTerms',p_supporting_source_terms,
    'publicDomainRationale',p_public_domain_rationale,'categoryCode',p_category_code,
    'presetId',p_suggested_preset_id,'presetVersion',p_suggested_preset_version,
    'tags',to_jsonb(v_tags),'externalCredits',v_credits,'replaceListingId',p_replace_listing_id
  )::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from public.midi_library_listings where owner_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.request_payload_sha256<>v_payload_hash then
      raise sqlstate 'PT409' using message='midi_library_request_conflict'; end if;
    return query select v_existing.id,v_existing.creator_version,v_existing.listed_at; return;
  end if;

  select * into v_active from public.midi_library_listings
    where midi_pattern_id=v_pattern.id and unlisted_at is null for update;
  if found then
    if p_replace_listing_id is null or p_replace_listing_id<>v_active.id
      or v_active.owner_id<>v_actor or v_active.midi_pattern_version_id=v_version.id
      or (select version_number from public.midi_pattern_versions where id=v_active.midi_pattern_version_id)>=v_version.version_number then
      raise sqlstate 'PT409' using message='midi_library_active_listing_conflict';
    end if;
    update public.midi_library_listings set unlisted_at=statement_timestamp(),unlisted_by=v_actor,
      unlist_request_id=p_request_id,creator_version=creator_version+1 where id=v_active.id;
  elsif p_replace_listing_id is not null then
    raise sqlstate 'PT409' using message='midi_library_replace_conflict';
  end if;

  select min(pitch),max(pitch) into v_min_pitch,v_max_pitch
    from public.midi_pattern_notes where midi_pattern_version_id=v_version.id;
  select case when exists(
    select 1 from public.midi_pattern_notes a join public.midi_pattern_notes b
      on b.midi_pattern_version_id=a.midi_pattern_version_id and b.note_id>a.note_id
      and a.start_tick < b.start_tick+b.duration_ticks and b.start_tick < a.start_tick+a.duration_ticks
    where a.midi_pattern_version_id=v_version.id
  ) then 'polyphonic' else 'monophonic' end into v_polyphony;

  insert into public.midi_library_listings(
    midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,rights_payload_sha256,title,description,
    creator_username,creator_display_name,creator_credit_name,reuse_mode,rights_basis,attestation_version,
    attested_by,supporting_source_url,supporting_source_terms,public_domain_rationale,category_code,
    suggested_preset_id,suggested_preset_version,instrument_family_code,duration_ticks,duration_beats,
    note_count,min_pitch,max_pitch,polyphony_kind
  ) values(
    v_pattern.id,v_version.id,v_actor,p_request_id,v_payload_hash,v_rights_hash,v_pattern.name,p_description,
    v_profile.username,v_profile.display_name,v_version.creator_credit_name,p_reuse_mode,p_rights_basis,
    p_attestation_version,v_actor,p_supporting_source_url,p_supporting_source_terms,p_public_domain_rationale,
    p_category_code,v_preset.preset_id,v_preset.version,v_preset.family_code,v_version.duration_ticks,
    v_version.duration_ticks::numeric/480,v_version.note_count,v_min_pitch,v_max_pitch,v_polyphony
  ) returning * into v_listing;
  insert into public.midi_library_listing_tags(listing_id,tag_code)
    select v_listing.id,value from unnest(v_tags) value;
  insert into public.midi_pattern_external_credits(
    listing_id,midi_pattern_version_id,position,credited_name,role,work_title,source_url,source_terms,attribution_note
  ) select v_listing.id,v_version.id,ordinality,(value->>'creditedName'),(value->>'role'),
      nullif(value->>'workTitle',''),nullif(value->>'sourceUrl',''),nullif(value->>'sourceTerms',''),
      nullif(value->>'attributionNote','')
    from jsonb_array_elements(v_credits) with ordinality;
  update public.midi_library_listings l set search_vector=to_tsvector('simple',concat_ws(' ',
    l.title,l.creator_username,l.creator_display_name,l.creator_credit_name,
    (select string_agg(t.display_name,' ') from public.midi_library_listing_tags j
      join public.midi_library_tags t on t.code=j.tag_code where j.listing_id=l.id)
  )) where l.id=v_listing.id returning * into v_listing;
  return query select v_listing.id,v_listing.creator_version,v_listing.listed_at;
end;
$$;

create or replace function public.unlist_midi_library_listing(
  p_listing_id uuid,p_request_id uuid,p_expected_creator_version integer
)
returns table(listing_id uuid,creator_version integer,unlisted_at timestamptz)
language plpgsql security definer set search_path=''
as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_listing public.midi_library_listings%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_library_actor_ineligible'; end if;
  if p_request_id is null or p_expected_creator_version is null then
    raise sqlstate '22023' using message='midi_library_unlist_invalid'; end if;
  select * into v_listing from public.midi_library_listings where id=p_listing_id and owner_id=v_actor for update;
  if not found then raise sqlstate 'PT404' using message='midi_library_listing_not_found'; end if;
  if v_listing.unlist_request_id=p_request_id then
    return query select v_listing.id,v_listing.creator_version,v_listing.unlisted_at; return;
  end if;
  if v_listing.unlisted_at is not null or v_listing.creator_version<>p_expected_creator_version then
    raise sqlstate 'PT409' using message='midi_library_unlist_conflict'; end if;
  update public.midi_library_listings set unlisted_at=statement_timestamp(),unlisted_by=v_actor,
    unlist_request_id=p_request_id,creator_version=creator_version+1
    where id=v_listing.id returning * into v_listing;
  return query select v_listing.id,v_listing.creator_version,v_listing.unlisted_at;
end;
$$;

create or replace function public.list_owned_midi_library_versions(p_limit integer default 100)
returns table(
  pattern_id uuid,pattern_name text,pattern_version_id uuid,version_number integer,created_at timestamptz,
  reuse_license_code text,duration_ticks integer,note_count integer,
  active_listing_id uuid,active_listing_pattern_version_id uuid,active_reuse_mode text,active_creator_version integer
)
language sql stable security definer set search_path=''
as $$
  select p.id,p.name,v.id,v.version_number,v.created_at,v.reuse_license_code,v.duration_ticks,v.note_count,
    l.id,l.midi_pattern_version_id,l.reuse_mode,l.creator_version
  from public.midi_patterns p
  join public.midi_pattern_versions v on v.midi_pattern_id=p.id
  left join public.midi_library_listings l on l.midi_pattern_id=p.id and l.unlisted_at is null
  where (select auth.uid()) is not null and (select private.is_active_project_actor())
    and p.owner_id=(select auth.uid()) and p.deleted_at is null
  order by v.created_at desc,v.id desc
  limit least(greatest(coalesce(p_limit,100),1),100);
$$;

create or replace function public.search_public_midi_library(
  p_query text default null,p_rights text default 'all',p_category text default null,
  p_preset text default null,p_instrument_family text default null,p_tags text[] default '{}'::text[],
  p_duration_min numeric default null,p_duration_max numeric default null,
  p_notes_min integer default null,p_notes_max integer default null,
  p_pitch_min smallint default null,p_pitch_max smallint default null,
  p_polyphony text default null,p_sort text default 'recent',
  p_after_listed_at timestamptz default null,p_after_title text default null,
  p_after_listing_id uuid default null,p_limit integer default 25
)
returns table(
  listing_id uuid,midi_pattern_id uuid,midi_pattern_version_id uuid,title text,description text,
  owner_id uuid,creator_username text,creator_display_name text,creator_credit_name text,
  reuse_mode text,rights_basis text,supporting_source_url text,supporting_source_terms text,
  public_domain_rationale text,category_code text,category_name text,suggested_preset_id text,
  suggested_preset_version integer,suggested_preset_name text,instrument_family_code text,
  duration_ticks integer,duration_beats numeric,note_count integer,min_pitch smallint,max_pitch smallint,
  polyphony_kind text,listed_at timestamptz,tags jsonb,external_credits jsonb,notes jsonb
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if p_limit is null or p_limit not between 1 and 25 or p_rights is null or p_sort is null
    or p_rights<>all(array['all','commercial_reuse','reference_only'])
    or p_sort<>all(array['recent','name'])
    or (p_polyphony is not null and p_polyphony<>all(array['monophonic','polyphonic']))
    or (p_instrument_family is not null and not exists(
      select 1 from public.midi_library_presets where family_code=p_instrument_family and active
    ))
    or (p_query is not null and (p_query<>btrim(p_query) or char_length(p_query)>80))
    or cardinality(coalesce(p_tags,'{}'::text[]))>8
    or (p_after_listing_id is null)<>(p_after_listed_at is null and p_after_title is null)
    or (p_sort='recent' and p_after_listing_id is not null and (p_after_listed_at is null or p_after_title is not null))
    or (p_sort='name' and p_after_listing_id is not null and (p_after_title is null or p_after_listed_at is not null)) then
    raise sqlstate '22023' using message='midi_library_search_invalid';
  end if;
  return query
  select l.id,l.midi_pattern_id,l.midi_pattern_version_id,l.title,l.description,l.owner_id,
    l.creator_username,l.creator_display_name,l.creator_credit_name,l.reuse_mode,l.rights_basis,
    l.supporting_source_url,l.supporting_source_terms,l.public_domain_rationale,l.category_code,c.display_name,
    l.suggested_preset_id,l.suggested_preset_version,pr.display_name,l.instrument_family_code,
    l.duration_ticks,l.duration_beats,l.note_count,l.min_pitch,l.max_pitch,l.polyphony_kind,l.listed_at,
    coalesce((select jsonb_agg(jsonb_build_object('code',t.code,'name',t.display_name) order by t.sort_order)
      from public.midi_library_listing_tags j join public.midi_library_tags t on t.code=j.tag_code
      where j.listing_id=l.id),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,'sourceUrl',ec.source_url,
      'sourceTerms',ec.source_terms,'attributionNote',ec.attribution_note
    )) order by ec.position) from public.midi_pattern_external_credits ec where ec.listing_id=l.id),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,
      'pitch',n.pitch,'velocity',n.velocity
    ) order by n.start_tick,n.pitch,n.note_id) from public.midi_pattern_notes n
      where n.midi_pattern_version_id=l.midi_pattern_version_id),'[]'::jsonb)
  from public.midi_library_listings l
  join public.midi_library_categories c on c.code=l.category_code
  join public.midi_library_presets pr on pr.preset_id=l.suggested_preset_id and pr.version=l.suggested_preset_version
  join public.profiles owner on owner.id=l.owner_id
  where l.unlisted_at is null and l.moderation_hidden_at is null
    and owner.status='active' and owner.profile_completed_at is not null
    and owner.moderation_state='visible' and owner.purged_at is null
    and (p_rights='all' or l.reuse_mode=p_rights)
    and (p_category is null or l.category_code=p_category)
    and (p_preset is null or l.suggested_preset_id=p_preset)
    and (p_instrument_family is null or l.instrument_family_code=p_instrument_family)
    and (p_polyphony is null or l.polyphony_kind=p_polyphony)
    and (p_duration_min is null or l.duration_beats>=p_duration_min)
    and (p_duration_max is null or l.duration_beats<=p_duration_max)
    and (p_notes_min is null or l.note_count>=p_notes_min)
    and (p_notes_max is null or l.note_count<=p_notes_max)
    and (p_pitch_min is null or l.min_pitch>=p_pitch_min)
    and (p_pitch_max is null or l.max_pitch<=p_pitch_max)
    and (p_query is null or p_query='' or l.search_vector @@ websearch_to_tsquery('simple',p_query))
    and not exists(
      select 1 from unnest(coalesce(p_tags,'{}'::text[])) requested
      where not exists(select 1 from public.midi_library_listing_tags jt where jt.listing_id=l.id and jt.tag_code=requested)
    )
    and (p_after_listing_id is null or
      (p_sort='recent' and (l.listed_at,l.id)<(p_after_listed_at,p_after_listing_id)) or
      (p_sort='name' and (lower(l.title),l.id)>(lower(p_after_title),p_after_listing_id)))
  order by
    case when p_sort='name' then lower(l.title) end asc,
    case when p_sort='recent' then l.listed_at end desc,
    case when p_sort='recent' then l.id end desc,
    case when p_sort='name' then l.id end asc
  limit p_limit;
end;
$$;

alter table public.midi_library_categories enable row level security;
alter table public.midi_library_tags enable row level security;
alter table public.midi_library_presets enable row level security;
alter table public.midi_library_listings enable row level security;
alter table public.midi_library_listing_tags enable row level security;
alter table public.midi_pattern_external_credits enable row level security;

create policy midi_library_categories_public_read on public.midi_library_categories
  for select to anon,authenticated using (active);
create policy midi_library_tags_public_read on public.midi_library_tags
  for select to anon,authenticated using (active);
create policy midi_library_presets_public_read on public.midi_library_presets
  for select to anon,authenticated using (active);

revoke all on public.midi_library_categories,public.midi_library_tags,public.midi_library_presets,
  public.midi_library_listings,public.midi_library_listing_tags,public.midi_pattern_external_credits
  from anon,authenticated;
grant select on public.midi_library_categories,public.midi_library_tags,public.midi_library_presets to anon,authenticated;

revoke all on function private.reject_external_credit_mutation() from public;
revoke all on function public.list_midi_library_pattern_version(uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid) from public,anon;
grant execute on function public.list_midi_library_pattern_version(uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid) to authenticated;
revoke all on function public.unlist_midi_library_listing(uuid,uuid,integer) from public,anon;
grant execute on function public.unlist_midi_library_listing(uuid,uuid,integer) to authenticated;
revoke all on function public.list_owned_midi_library_versions(integer) from public,anon;
grant execute on function public.list_owned_midi_library_versions(integer) to authenticated;
revoke all on function public.search_public_midi_library(text,text,text,text,text,text[],numeric,numeric,integer,integer,smallint,smallint,text,text,timestamptz,text,uuid,integer) from public;
grant execute on function public.search_public_midi_library(text,text,text,text,text,text[],numeric,numeric,integer,integer,smallint,smallint,text,text,timestamptz,text,uuid,integer) to anon,authenticated;

-- The owner-only source-copy command remains commercial-only. The new library
-- projection does not broaden private.can_read_pattern_version or authorize copies.
