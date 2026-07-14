-- MIDI-02: owner-scoped reusable MIDI stem identities and conflict-safe drafts.

create table private.midi_synth_presets (
  preset_id text not null,
  version integer not null check (version > 0),
  min_note smallint not null check (min_note between 0 and 127),
  max_note smallint not null check (max_note between 0 and 127 and max_note >= min_note),
  primary key (preset_id, version),
  check (preset_id ~ '^[a-z0-9-]{1,64}$')
);

insert into private.midi_synth_presets (preset_id, version, min_note, max_note) values
  ('warm-poly', 1, 36, 96),
  ('glass-keys', 1, 36, 108),
  ('round-bass', 1, 24, 60),
  ('soft-pad', 1, 36, 96),
  ('bright-lead', 1, 48, 108),
  ('air-pluck', 1, 36, 108),
  ('studio-drums', 1, 36, 48);

create function private.canonical_midi_notes(
  p_notes jsonb,
  p_duration_ticks integer,
  p_min_note smallint,
  p_max_note smallint
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_count integer;
  v_canonical jsonb;
begin
  if jsonb_typeof(p_notes) <> 'array'
    or p_duration_ticks is null
    or p_duration_ticks not between 1 and 86400000 then
    raise exception using errcode = '22023', message = 'midi_stem_invalid_notes';
  end if;

  v_count := jsonb_array_length(p_notes);
  if v_count > 2048
    or exists (
      select 1
      from jsonb_array_elements(p_notes) as item
      where jsonb_typeof(item) <> 'object'
        or not (item ?& array['noteId','pitch','velocity','startTick','durationTicks'])
        or (select count(*) from jsonb_object_keys(item)) <> 5
    ) then
    raise exception using errcode = '22023', message = 'midi_stem_invalid_notes';
  end if;

  with parsed as (
    select *
    from jsonb_to_recordset(p_notes) as note(
      "noteId" uuid,
      pitch integer,
      velocity integer,
      "startTick" integer,
      "durationTicks" integer
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'noteId', "noteId",
        'pitch', pitch,
        'velocity', velocity,
        'startTick', "startTick",
        'durationTicks', "durationTicks"
      ) order by "startTick", pitch, "noteId"::text
    ),
    '[]'::jsonb
  )
  into v_canonical
  from parsed
  having count(*) = v_count
    and count(distinct "noteId") = v_count
    and coalesce(bool_and(
      "noteId" is not null
      and pitch between p_min_note and p_max_note
      and velocity between 1 and 127
      and "startTick" >= 0
      and "durationTicks" > 0
      and "startTick" + "durationTicks" <= p_duration_ticks
    ), true);

  if v_canonical is null then
    raise exception using errcode = '22023', message = 'midi_stem_invalid_notes';
  end if;
  return v_canonical;
exception
  when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
    raise exception using errcode = '22023', message = 'midi_stem_invalid_notes';
end;
$$;

revoke all on function private.canonical_midi_notes(jsonb, integer, smallint, smallint)
from public, anon, authenticated;

create function private.is_active_midi_actor() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and status = 'active'
        and profile_completed_at is not null
    ),
    false
  );
$$;

revoke all on function private.is_active_midi_actor() from public, anon;
grant execute on function private.is_active_midi_actor() to authenticated;

create table public.midi_stems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (owner_id, create_request_id),
  unique (id, owner_id)
);
create index midi_stems_owner_updated_idx on public.midi_stems(owner_id, updated_at desc, id desc);

create table public.midi_stem_versions (
  id uuid primary key default gen_random_uuid(),
  stem_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null check (version > 0),
  parent_stem_version_id uuid references public.midi_stem_versions(id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  default_preset_id text not null,
  default_preset_version integer not null,
  ppq smallint not null check (ppq = 480),
  duration_ticks integer not null check (duration_ticks between 1 and 86400000),
  notes jsonb not null,
  note_count integer not null check (note_count between 0 and 2048),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  creator_credit_name text not null check (creator_credit_name = btrim(creator_credit_name) and char_length(creator_credit_name) between 1 and 120),
  created_at timestamptz not null default statement_timestamp(),
  unique (stem_id, version),
  check (notes = private.canonical_midi_notes(notes, duration_ticks, 0::smallint, 127::smallint)),
  check (note_count = jsonb_array_length(notes)),
  foreign key (default_preset_id, default_preset_version)
    references private.midi_synth_presets(preset_id, version) on delete restrict,
  foreign key (stem_id, owner_id)
    references public.midi_stems(id, owner_id) on delete restrict
);
create index midi_stem_versions_owner_created_idx on public.midi_stem_versions(owner_id, created_at desc, id desc);
create index midi_stem_versions_parent_idx on public.midi_stem_versions(parent_stem_version_id) where parent_stem_version_id is not null;

create table public.midi_stem_drafts (
  id uuid primary key default gen_random_uuid(),
  stem_id uuid not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  entry_mode text not null check (entry_mode in ('blank', 'import', 'derive')),
  parent_stem_version_id uuid references public.midi_stem_versions(id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  default_preset_id text not null,
  default_preset_version integer not null,
  ppq smallint not null check (ppq = 480),
  duration_ticks integer not null check (duration_ticks between 1 and 86400000),
  notes jsonb not null default '[]'::jsonb,
  note_count integer not null default 0 check (note_count between 0 and 2048),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  lock_version integer not null default 1 check (lock_version > 0),
  last_save_request_id uuid,
  last_save_expected_lock_version integer check (last_save_expected_lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((entry_mode = 'derive') = (parent_stem_version_id is not null)),
  check ((last_save_request_id is null) = (last_save_expected_lock_version is null)),
  check (notes = private.canonical_midi_notes(notes, duration_ticks, 0::smallint, 127::smallint)),
  check (note_count = jsonb_array_length(notes)),
  foreign key (default_preset_id, default_preset_version)
    references private.midi_synth_presets(preset_id, version) on delete restrict,
  foreign key (stem_id, owner_id)
    references public.midi_stems(id, owner_id) on delete restrict
);
create index midi_stem_drafts_owner_updated_idx on public.midi_stem_drafts(owner_id, updated_at desc, id desc);
create index midi_stem_drafts_parent_idx on public.midi_stem_drafts(parent_stem_version_id) where parent_stem_version_id is not null;

create function private.reject_midi_stem_version_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'PT409', message = 'midi_stem_version_immutable';
end;
$$;
revoke all on function private.reject_midi_stem_version_change() from public;

create trigger midi_stem_versions_immutable
before update or delete on public.midi_stem_versions
for each row execute function private.reject_midi_stem_version_change();

alter table public.midi_stems enable row level security;
alter table public.midi_stem_drafts enable row level security;
alter table public.midi_stem_versions enable row level security;

revoke all on public.midi_stems, public.midi_stem_drafts, public.midi_stem_versions
from public, anon, authenticated;
grant select on public.midi_stems, public.midi_stem_drafts, public.midi_stem_versions
to authenticated;

create policy own_midi_stems_read on public.midi_stems
for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active_midi_actor()));

create policy own_midi_stem_drafts_read on public.midi_stem_drafts
for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active_midi_actor()));

create policy own_midi_stem_versions_read on public.midi_stem_versions
for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active_midi_actor()));

create function public.create_midi_stem_draft(
  p_request_id uuid,
  p_name text,
  p_entry_mode text default 'blank',
  p_parent_stem_version_id uuid default null,
  p_default_preset_id text default 'warm-poly',
  p_default_preset_version integer default 1
) returns table(stem_id uuid, draft_id uuid, lock_version integer, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_stem public.midi_stems%rowtype;
  v_draft public.midi_stem_drafts%rowtype;
  v_parent public.midi_stem_versions%rowtype;
  v_notes jsonb := '[]'::jsonb;
  v_duration integer := 7680;
  v_preset_id text := p_default_preset_id;
  v_preset_version integer := p_default_preset_version;
  v_checksum text;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'midi_stem_unauthenticated';
  end if;
  if not (select private.is_active_midi_actor()) then
    raise sqlstate 'PT403' using message = 'midi_stem_actor_inactive';
  end if;
  if p_request_id is null or p_name is null or p_name <> v_name
    or char_length(v_name) not between 1 and 120
    or p_entry_mode not in ('blank', 'import', 'derive')
    or ((p_entry_mode = 'derive') <> (p_parent_stem_version_id is not null)) then
    raise sqlstate '22023' using message = 'midi_stem_create_invalid';
  end if;

  select * into v_stem
  from public.midi_stems
  where owner_id = v_actor and create_request_id = p_request_id;
  if found then
    if v_stem.name <> v_name then
      raise sqlstate 'PT409' using message = 'midi_stem_request_conflict';
    end if;
    select * into strict v_draft from public.midi_stem_drafts d where d.stem_id = v_stem.id;
    if v_draft.entry_mode <> p_entry_mode
      or v_draft.parent_stem_version_id is distinct from p_parent_stem_version_id
      or (p_entry_mode <> 'derive' and (
        v_draft.default_preset_id <> p_default_preset_id
        or v_draft.default_preset_version <> p_default_preset_version
      )) then
      raise sqlstate 'PT409' using message = 'midi_stem_request_conflict';
    end if;
    return query select v_stem.id, v_draft.id, v_draft.lock_version, v_draft.created_at;
    return;
  end if;

  if (select count(*) from public.midi_stems where owner_id = v_actor) >= 100 then
    raise sqlstate 'PT409' using message = 'midi_stem_limit_reached';
  end if;

  if p_entry_mode = 'derive' then
    select * into v_parent
    from public.midi_stem_versions
    where id = p_parent_stem_version_id and owner_id = v_actor;
    if not found then
      raise sqlstate 'PT404' using message = 'midi_stem_parent_not_found';
    end if;
    v_notes := v_parent.notes;
    v_duration := v_parent.duration_ticks;
    v_preset_id := v_parent.default_preset_id;
    v_preset_version := v_parent.default_preset_version;
  elsif not exists (
    select 1 from private.midi_synth_presets
    where preset_id = v_preset_id and version = v_preset_version
  ) then
    raise sqlstate '22023' using message = 'midi_stem_preset_invalid';
  end if;

  v_checksum := encode(extensions.digest(convert_to(jsonb_build_object(
    'name', v_name,
    'defaultPresetId', v_preset_id,
    'defaultPresetVersion', v_preset_version,
    'ppq', 480,
    'durationTicks', v_duration,
    'notes', v_notes
  )::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.midi_stems(owner_id, create_request_id, name)
  values(v_actor, p_request_id, v_name)
  returning * into v_stem;

  insert into public.midi_stem_drafts(
    stem_id, owner_id, entry_mode, parent_stem_version_id, name,
    default_preset_id, default_preset_version, ppq, duration_ticks,
    notes, note_count, content_sha256
  ) values (
    v_stem.id, v_actor, p_entry_mode, p_parent_stem_version_id, v_name,
    v_preset_id, v_preset_version, 480, v_duration,
    v_notes, jsonb_array_length(v_notes), v_checksum
  ) returning * into v_draft;

  return query select v_stem.id, v_draft.id, v_draft.lock_version, v_draft.created_at;
end;
$$;

create function public.save_midi_stem_draft(
  p_draft_id uuid,
  p_request_id uuid,
  p_expected_lock_version integer,
  p_content jsonb
) returns table(draft_id uuid, lock_version integer, content_sha256 text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_draft public.midi_stem_drafts%rowtype;
  v_name text;
  v_preset private.midi_synth_presets%rowtype;
  v_preset_id text;
  v_preset_version integer;
  v_ppq integer;
  v_duration integer;
  v_notes jsonb;
  v_canonical_notes jsonb;
  v_canonical_content jsonb;
  v_checksum text;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'midi_stem_unauthenticated';
  end if;
  if not (select private.is_active_midi_actor()) then
    raise sqlstate 'PT403' using message = 'midi_stem_actor_inactive';
  end if;
  if p_draft_id is null or p_request_id is null or p_expected_lock_version is null
    or jsonb_typeof(p_content) <> 'object'
    or not (p_content ?& array['name','defaultPresetId','defaultPresetVersion','ppq','durationTicks','notes'])
    or (select count(*) from jsonb_object_keys(p_content)) <> 6 then
    raise sqlstate '22023' using message = 'midi_stem_content_invalid';
  end if;

  select * into v_draft
  from public.midi_stem_drafts
  where id = p_draft_id and owner_id = v_actor
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'midi_stem_draft_not_found';
  end if;

  begin
    v_name := btrim(p_content->>'name');
    v_preset_id := p_content->>'defaultPresetId';
    v_preset_version := (p_content->>'defaultPresetVersion')::integer;
    v_ppq := (p_content->>'ppq')::integer;
    v_duration := (p_content->>'durationTicks')::integer;
    v_notes := p_content->'notes';
  exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
    raise sqlstate '22023' using message = 'midi_stem_content_invalid';
  end;

  if v_name is null or v_name <> p_content->>'name'
    or char_length(v_name) not between 1 and 120 or v_ppq <> 480 then
    raise sqlstate '22023' using message = 'midi_stem_content_invalid';
  end if;
  select * into v_preset from private.midi_synth_presets
  where preset_id = v_preset_id and version = v_preset_version;
  if not found then
    raise sqlstate '22023' using message = 'midi_stem_preset_invalid';
  end if;

  v_canonical_notes := private.canonical_midi_notes(v_notes, v_duration, v_preset.min_note, v_preset.max_note);
  v_canonical_content := jsonb_build_object(
    'name', v_name,
    'defaultPresetId', v_preset_id,
    'defaultPresetVersion', v_preset_version,
    'ppq', 480,
    'durationTicks', v_duration,
    'notes', v_canonical_notes
  );
  if p_content <> v_canonical_content then
    raise sqlstate '22023' using message = 'midi_stem_content_not_canonical';
  end if;
  v_checksum := encode(extensions.digest(convert_to(v_canonical_content::text, 'UTF8'), 'sha256'), 'hex');

  if v_draft.last_save_request_id = p_request_id then
    if v_draft.last_save_expected_lock_version <> p_expected_lock_version
      or v_draft.content_sha256 <> v_checksum then
      raise sqlstate 'PT409' using message = 'midi_stem_request_conflict';
    end if;
    return query select v_draft.id, v_draft.lock_version, v_draft.content_sha256, v_draft.updated_at;
    return;
  end if;
  if v_draft.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'midi_stem_save_conflict';
  end if;

  update public.midi_stem_drafts set
    name = v_name,
    default_preset_id = v_preset_id,
    default_preset_version = v_preset_version,
    duration_ticks = v_duration,
    notes = v_canonical_notes,
    note_count = jsonb_array_length(v_canonical_notes),
    content_sha256 = v_checksum,
    lock_version = public.midi_stem_drafts.lock_version + 1,
    last_save_request_id = p_request_id,
    last_save_expected_lock_version = p_expected_lock_version,
    updated_at = statement_timestamp()
  where id = p_draft_id
  returning * into v_draft;

  update public.midi_stems set name = v_name, updated_at = v_draft.updated_at
  where id = v_draft.stem_id and owner_id = v_actor;

  return query select v_draft.id, v_draft.lock_version, v_draft.content_sha256, v_draft.updated_at;
end;
$$;

revoke execute on function public.create_midi_stem_draft(uuid, text, text, uuid, text, integer),
  public.save_midi_stem_draft(uuid, uuid, integer, jsonb)
from public, anon;
grant execute on function public.create_midi_stem_draft(uuid, text, text, uuid, text, integer),
  public.save_midi_stem_draft(uuid, uuid, integer, jsonb)
to authenticated;

revoke all on private.midi_synth_presets from public, anon, authenticated;
