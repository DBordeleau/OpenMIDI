alter table public.midi_pattern_versions
  add column silhouette_v1 text,
  add column silhouette_min_pitch smallint,
  add column silhouette_max_pitch smallint,
  add constraint midi_pattern_versions_silhouette_shape_check check (
    (silhouette_v1 is null and silhouette_min_pitch is null and silhouette_max_pitch is null)
    or (
      silhouette_v1 is not null
      and silhouette_v1 ~ '^[A-Za-z0-9+/]{86}==$'
      and silhouette_min_pitch is not null
      and silhouette_max_pitch is not null
    )
  ),
  add constraint midi_pattern_versions_silhouette_pitch_check check (
    silhouette_min_pitch is null
    or (
      silhouette_min_pitch between 0 and 127
      and silhouette_max_pitch between 0 and 127
      and silhouette_min_pitch <= silhouette_max_pitch
    )
  );

comment on column public.midi_pattern_versions.silhouette_v1 is
  'Canonical base64 encoding of the immutable pattern''s 64-column by 8-band occupancy silhouette.';

create function private.protect_midi_pattern_version_silhouette()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'immutable_revision_history';
  end if;

  if (
    to_jsonb(new) - array['silhouette_v1', 'silhouette_min_pitch', 'silhouette_max_pitch']
  ) is distinct from (
    to_jsonb(old) - array['silhouette_v1', 'silhouette_min_pitch', 'silhouette_max_pitch']
  ) then
    raise exception using errcode = '55000', message = 'immutable_revision_history';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_midi_pattern_version_silhouette() from public, anon, authenticated;
comment on function private.protect_midi_pattern_version_silhouette() is
  'Preserves immutable MIDI pattern-version content while allowing only its derived silhouette projection to refresh.';

drop trigger midi_pattern_versions_immutable on public.midi_pattern_versions;
create trigger midi_pattern_versions_immutable
  before update or delete on public.midi_pattern_versions
  for each row execute function private.protect_midi_pattern_version_silhouette();

create function private.compute_pattern_silhouette_v1(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration_ticks integer;
  v_min_pitch smallint;
  v_max_pitch smallint;
  v_bytes bytea := decode(repeat('00', 64), 'hex');
  v_note record;
  v_start_column integer;
  v_end_column integer;
  v_band integer;
  v_encoded text;
begin
  select v.duration_ticks, min(n.pitch)::smallint, max(n.pitch)::smallint
  into v_duration_ticks, v_min_pitch, v_max_pitch
  from public.midi_pattern_versions v
  left join public.midi_pattern_notes n on n.midi_pattern_version_id = v.id
  where v.id = p_version_id
  group by v.duration_ticks;

  if not found then
    return;
  end if;

  if v_min_pitch is null then
    update public.midi_pattern_versions
    set silhouette_v1 = null,
      silhouette_min_pitch = null,
      silhouette_max_pitch = null
    where id = p_version_id;
    return;
  end if;

  for v_note in
    select n.start_tick, n.duration_ticks, n.pitch
    from public.midi_pattern_notes n
    where n.midi_pattern_version_id = p_version_id
    order by n.start_tick, n.pitch, n.note_id
  loop
    v_start_column := least(
      63,
      greatest(0, ((v_note.start_tick::bigint * 64) / v_duration_ticks)::integer)
    );
    v_end_column := least(
      63,
      greatest(
        v_start_column,
        (
          (
            ((v_note.start_tick::bigint + v_note.duration_ticks::bigint) * 64) - 1
          ) / v_duration_ticks
        )::integer
      )
    );
    v_band := case
      when v_min_pitch = v_max_pitch then 0
      else (
        ((v_note.pitch::integer - v_min_pitch::integer) * 7)
        / (v_max_pitch::integer - v_min_pitch::integer)
      )
    end;

    for v_column in v_start_column..v_end_column loop
      v_bytes := set_byte(
        v_bytes,
        v_column,
        get_byte(v_bytes, v_column) | (1 << v_band)
      );
    end loop;
  end loop;

  v_encoded := replace(replace(encode(v_bytes, 'base64'), E'\n', ''), E'\r', '');
  update public.midi_pattern_versions
  set silhouette_v1 = v_encoded,
    silhouette_min_pitch = v_min_pitch,
    silhouette_max_pitch = v_max_pitch
  where id = p_version_id;
end;
$$;

revoke all on function private.compute_pattern_silhouette_v1(uuid) from public, anon, authenticated;
comment on function private.compute_pattern_silhouette_v1(uuid) is
  'Computes one deterministic 64-column by 8-band silhouette from immutable normalized MIDI notes; application roles cannot execute it.';

create function private.refresh_pattern_silhouettes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  for v_version_id in
    select distinct i.midi_pattern_version_id from inserted i
  loop
    perform private.compute_pattern_silhouette_v1(v_version_id);
  end loop;
  return null;
end;
$$;

revoke all on function private.refresh_pattern_silhouettes() from public, anon, authenticated;
comment on function private.refresh_pattern_silhouettes() is
  'Refreshes each distinct immutable pattern version once after a statement bulk-inserts normalized MIDI notes.';

create trigger midi_pattern_notes_silhouette_after_insert
  after insert on public.midi_pattern_notes
  referencing new table as inserted
  for each statement
  execute function private.refresh_pattern_silhouettes();

do $$
declare
  v_id uuid;
begin
  for v_id in
    select v.id
    from public.midi_pattern_versions v
    where v.silhouette_v1 is null
    order by v.id
  loop
    perform private.compute_pattern_silhouette_v1(v_id);
  end loop;
end;
$$;

create function public.get_public_project_silhouettes(
  p_project_id uuid,
  p_revision_id uuid
)
returns table (
  midi_pattern_version_id uuid,
  silhouette text,
  min_pitch smallint,
  max_pitch smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_arrangement_version_id uuid;
  v_pattern_count integer;
begin
  select r.arrangement_version_id
  into v_arrangement_version_id
  from public.public_project_catalog catalog
  join public.projects project
    on project.id = catalog.project_id
    and project.owner_id = catalog.owner_id
  join public.profiles owner on owner.id = project.owner_id
  join public.project_revisions r
    on r.id = p_revision_id
    and r.project_id = project.id
    and r.arrangement_version_id is not null
  where catalog.project_id = p_project_id
    and project.id = p_project_id
    and project.visibility = 'public'
    and project.status = 'active'
    and project.moderation_state = 'visible'
    and project.deleted_at is null
    and project.purged_at is null
    and owner.status = 'active'
    and owner.profile_completed_at is not null
    and owner.moderation_state = 'visible'
    and owner.purged_at is null;

  if v_arrangement_version_id is null then
    return;
  end if;

  select count(distinct clip.midi_pattern_version_id)::integer
  into v_pattern_count
  from public.arrangement_clips clip
  where clip.arrangement_version_id = v_arrangement_version_id
    and clip.project_id = p_project_id;

  if v_pattern_count > 64 then
    raise sqlstate '22023' using message = 'project_silhouette_limit';
  end if;

  return query
  select distinct
    version.id,
    version.silhouette_v1,
    version.silhouette_min_pitch,
    version.silhouette_max_pitch
  from public.arrangement_clips clip
  join public.midi_pattern_versions version
    on version.id = clip.midi_pattern_version_id
  where clip.arrangement_version_id = v_arrangement_version_id
    and clip.project_id = p_project_id
  order by version.id;
end;
$$;

revoke all on function public.get_public_project_silhouettes(uuid, uuid) from public;
grant execute on function public.get_public_project_silhouettes(uuid, uuid) to anon, authenticated;
comment on function public.get_public_project_silhouettes(uuid, uuid) is
  'Returns at most 64 deduplicated immutable pattern silhouettes only for an exact revision of a currently catalog-authorized public project.';
