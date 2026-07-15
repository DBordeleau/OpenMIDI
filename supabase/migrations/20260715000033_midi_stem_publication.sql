-- MIDI-04: conflict-safe publication of immutable reusable MIDI stem versions.

alter table public.midi_stem_versions
  add column publication_request_id uuid,
  add column source_draft_id uuid,
  add column source_lock_version integer check (source_lock_version > 0);

alter table public.midi_stem_versions
  add constraint midi_stem_versions_publication_source_check check (
    (publication_request_id is null and source_draft_id is null and source_lock_version is null)
    or
    (publication_request_id is not null and source_draft_id is not null and source_lock_version is not null)
  );

create unique index midi_stem_versions_owner_publication_request_idx
on public.midi_stem_versions(owner_id, publication_request_id)
where publication_request_id is not null;

create function public.publish_midi_stem_version(
  p_draft_id uuid,
  p_request_id uuid,
  p_expected_lock_version integer,
  p_expected_content_sha256 text
) returns table(
  stem_version_id uuid,
  stem_id uuid,
  version integer,
  content_sha256 text,
  creator_credit_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_draft public.midi_stem_drafts%rowtype;
  v_existing public.midi_stem_versions%rowtype;
  v_published public.midi_stem_versions%rowtype;
  v_credit_name text;
  v_version integer;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'midi_stem_unauthenticated';
  end if;
  if not (select private.is_active_midi_actor()) then
    raise sqlstate 'PT403' using message = 'midi_stem_actor_inactive';
  end if;
  if p_draft_id is null or p_request_id is null
    or p_expected_lock_version is null or p_expected_lock_version <= 0
    or p_expected_content_sha256 is null
    or p_expected_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise sqlstate '22023' using message = 'midi_stem_publish_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('midi-stem-version-owner:' || v_actor::text, 0)
  );

  select * into v_existing
  from public.midi_stem_versions
  where owner_id = v_actor and publication_request_id = p_request_id;
  if found then
    if v_existing.source_draft_id <> p_draft_id
      or v_existing.source_lock_version <> p_expected_lock_version
      or v_existing.content_sha256 <> p_expected_content_sha256 then
      raise sqlstate 'PT409' using message = 'midi_stem_publish_request_conflict';
    end if;
    return query select
      v_existing.id,
      v_existing.stem_id,
      v_existing.version,
      v_existing.content_sha256,
      v_existing.creator_credit_name,
      v_existing.created_at;
    return;
  end if;

  select * into v_draft
  from public.midi_stem_drafts
  where id = p_draft_id and owner_id = v_actor
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'midi_stem_draft_not_found';
  end if;
  if v_draft.lock_version <> p_expected_lock_version
    or v_draft.content_sha256 <> p_expected_content_sha256 then
    raise sqlstate 'PT409' using message = 'midi_stem_publish_conflict';
  end if;

  perform 1 from public.midi_stems
  where id = v_draft.stem_id and owner_id = v_actor
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'midi_stem_draft_not_found';
  end if;
  if (select count(*) from public.midi_stem_versions where owner_id = v_actor) >= 500 then
    raise sqlstate 'PT409' using message = 'midi_stem_version_limit_reached';
  end if;

  select credit_name into v_credit_name
  from public.profiles
  where id = v_actor and status = 'active' and profile_completed_at is not null;
  if v_credit_name is null then
    raise sqlstate 'PT403' using message = 'midi_stem_actor_inactive';
  end if;

  select coalesce(max(existing.version), 0) + 1 into v_version
  from public.midi_stem_versions existing
  where existing.stem_id = v_draft.stem_id;

  insert into public.midi_stem_versions(
    stem_id,
    owner_id,
    version,
    parent_stem_version_id,
    name,
    default_preset_id,
    default_preset_version,
    ppq,
    duration_ticks,
    notes,
    note_count,
    content_sha256,
    creator_credit_name,
    publication_request_id,
    source_draft_id,
    source_lock_version
  ) values (
    v_draft.stem_id,
    v_actor,
    v_version,
    v_draft.parent_stem_version_id,
    v_draft.name,
    v_draft.default_preset_id,
    v_draft.default_preset_version,
    v_draft.ppq,
    v_draft.duration_ticks,
    v_draft.notes,
    v_draft.note_count,
    v_draft.content_sha256,
    v_credit_name,
    p_request_id,
    v_draft.id,
    v_draft.lock_version
  ) returning * into v_published;

  update public.midi_stems
  set updated_at = v_published.created_at
  where id = v_draft.stem_id and owner_id = v_actor;

  return query select
    v_published.id,
    v_published.stem_id,
    v_published.version,
    v_published.content_sha256,
    v_published.creator_credit_name,
    v_published.created_at;
end;
$$;

revoke execute on function public.publish_midi_stem_version(uuid, uuid, integer, text)
from public, anon;
grant execute on function public.publish_midi_stem_version(uuid, uuid, integer, text)
to authenticated;

create function public.create_imported_midi_stem_draft(
  p_request_id uuid,
  p_save_request_id uuid,
  p_content jsonb
) returns table(
  stem_id uuid,
  draft_id uuid,
  lock_version integer,
  content_sha256 text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_created record;
  v_draft public.midi_stem_drafts%rowtype;
  v_saved record;
  v_expected_lock integer;
begin
  if p_save_request_id is null or jsonb_typeof(p_content) <> 'object' then
    raise sqlstate '22023' using message = 'midi_stem_import_invalid';
  end if;

  select * into strict v_created
  from public.create_midi_stem_draft(
    p_request_id,
    p_content->>'name',
    'import',
    null,
    p_content->>'defaultPresetId',
    (p_content->>'defaultPresetVersion')::integer
  );

  select * into strict v_draft
  from public.midi_stem_drafts
  where id = v_created.draft_id and owner_id = v_actor
  for update;

  v_expected_lock := case
    when v_draft.last_save_request_id = p_save_request_id
      then v_draft.last_save_expected_lock_version
    else v_draft.lock_version
  end;

  select * into strict v_saved
  from public.save_midi_stem_draft(
    v_draft.id,
    p_save_request_id,
    v_expected_lock,
    p_content
  );

  return query select
    v_created.stem_id,
    v_draft.id,
    v_saved.lock_version,
    v_saved.content_sha256,
    v_created.created_at,
    v_saved.updated_at;
exception
  when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
    raise sqlstate '22023' using message = 'midi_stem_import_invalid';
end;
$$;

revoke execute on function public.create_imported_midi_stem_draft(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.create_imported_midi_stem_draft(uuid, uuid, jsonb)
to authenticated;
