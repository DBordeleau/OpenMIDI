alter table public.projects
  add column source_project_id uuid,
  add column source_revision_id uuid,
  add constraint projects_fork_source_shape check (
    (source_project_id is null and source_revision_id is null)
    or
    (source_project_id is not null and source_revision_id is not null)
  ),
  add constraint projects_fork_not_self check (
    source_project_id is null or source_project_id <> id
  ),
  add constraint projects_fork_source_revision_fk
    foreign key(source_project_id, source_revision_id)
    references public.project_revisions(project_id, id) on delete restrict;

create index projects_source_children_idx
  on public.projects(source_project_id, created_at desc, id)
  where source_project_id is not null;

create function private.protect_project_fork_lineage()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source_project_id is distinct from old.source_project_id
    or new.source_revision_id is distinct from old.source_revision_id then
    raise sqlstate '55000' using message = 'immutable_project_fork_lineage';
  end if;
  return new;
end
$$;

create trigger projects_fork_lineage_immutable
  before update on public.projects for each row
  execute function private.protect_project_fork_lineage();

alter table public.activity_events
  drop constraint activity_events_event_type_check,
  add constraint activity_events_event_type_check check (
    event_type = any(array['project_revision_published', 'project_forked'])
  );

create function public.fork_project(
  p_source_project_id uuid,
  p_source_revision_id uuid,
  p_request_id uuid,
  p_expected_license_code text,
  p_title text,
  p_description text
)
returns table(
  project_id uuid,
  revision_id uuid,
  revision_number integer,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_source public.projects%rowtype;
  v_source_revision public.project_revisions%rowtype;
  v_existing public.projects%rowtype;
  v_target public.projects%rowtype;
  v_target_revision public.project_revisions%rowtype;
  v_target_id uuid := gen_random_uuid();
  v_target_revision_id uuid := gen_random_uuid();
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_manifest jsonb;
  v_manifest_sha256 text;
  v_source_bytes bigint;
  v_source_count integer;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'fork_unauthenticated';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.status = 'active'
      and p.profile_completed_at is not null
  ) then
    raise sqlstate 'PT403' using message = 'fork_actor_ineligible';
  end if;
  if p_source_project_id is null or p_source_revision_id is null
    or p_request_id is null or p_expected_license_code is null
    or p_expected_license_code <> btrim(p_expected_license_code)
    or char_length(p_expected_license_code) not between 1 and 40
    or p_title is null or p_title <> v_title
    or char_length(v_title) not between 1 and 120
    or (p_description is not null and (
      p_description <> btrim(p_description) or char_length(p_description) > 5000
    )) then
    raise sqlstate '22023' using message = 'fork_invalid_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || p_request_id::text, 0)
  );

  select * into v_existing
  from public.projects p
  where p.owner_id = v_actor and p.create_request_id = p_request_id;
  if found then
    if v_existing.source_project_id is distinct from p_source_project_id
      or v_existing.source_revision_id is distinct from p_source_revision_id
      or v_existing.license_code <> p_expected_license_code
      or v_existing.title <> v_title
      or v_existing.description is distinct from v_description
      or v_existing.current_revision_id is null
      or not exists (
        select 1 from public.project_revisions r
        where r.id = v_existing.current_revision_id
          and r.project_id = v_existing.id
          and r.revision_number = 1
          and r.publish_request_id = p_request_id
      ) then
      raise sqlstate 'PT409' using message = 'fork_request_conflict';
    end if;
    return query
      select v_existing.id, v_existing.current_revision_id, 1, v_existing.created_at;
    return;
  end if;

  select * into v_source
  from public.projects p
  where p.id = p_source_project_id
  for update;
  if not found or v_source.status <> 'active'
    or v_source.visibility <> 'private' or v_source.deleted_at is not null
    or v_source.current_revision_id is null
    or not exists (
      select 1 from public.project_members m
      where m.project_id = v_source.id and m.user_id = v_actor
    ) then
    raise sqlstate 'PT404' using message = 'fork_source_not_found';
  end if;
  if v_source.license_code <> p_expected_license_code
    or not exists (
      select 1 from public.licenses l
      where l.code = v_source.license_code and l.allows_derivatives
    ) then
    raise sqlstate 'PT409' using message = 'fork_license_unavailable';
  end if;

  select * into v_source_revision
  from public.project_revisions r
  where r.id = p_source_revision_id and r.project_id = v_source.id;
  if not found then
    raise sqlstate 'PT404' using message = 'fork_source_not_found';
  end if;
  if v_source_revision.manifest->>'workspaceId' <> v_source.id::text
    or encode(
      extensions.digest(convert_to(v_source_revision.manifest::text, 'UTF8'), 'sha256'),
      'hex'
    ) <> v_source_revision.manifest_sha256
    or (select count(*) from public.revision_tracks rt
        where rt.revision_id = v_source_revision.id) not between 1 and 12
    or exists (
      select 1
      from public.revision_tracks rt
      left join public.assets a on a.id = rt.asset_id
      left join public.project_asset_references par
        on par.project_id = v_source.id and par.asset_id = rt.asset_id
      where rt.revision_id = v_source_revision.id
        and (a.id is null or a.kind <> 'source_audio' or a.status <> 'ready'
          or a.deleted_at is not null or a.byte_size is null or par.asset_id is null)
    ) then
    raise sqlstate 'PT409' using message = 'fork_source_invalid';
  end if;

  v_manifest := jsonb_set(
    v_source_revision.manifest,
    '{workspaceId}',
    to_jsonb(v_target_id::text),
    false
  );
  v_manifest_sha256 := encode(
    extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.projects(
    id, owner_id, create_request_id, title, description, bpm, musical_key,
    time_signature_numerator, time_signature_denominator, license_code,
    source_project_id, source_revision_id
  ) values (
    v_target_id, v_actor, p_request_id, v_title, v_description,
    (v_manifest->>'tempoBpm')::numeric, v_source.musical_key,
    v_source.time_signature_numerator, v_source.time_signature_denominator,
    v_source.license_code, v_source.id, v_source_revision.id
  ) returning * into v_target;

  insert into public.project_members(project_id, user_id, role, created_by)
  values(v_target.id, v_actor, 'owner', v_actor);
  insert into public.project_genres(project_id, genre_id, is_primary)
    select v_target.id, pg.genre_id, pg.is_primary
    from public.project_genres pg where pg.project_id = v_source.id;
  insert into public.project_tags(project_id, tag_id)
    select v_target.id, pt.tag_id
    from public.project_tags pt where pt.project_id = v_source.id;

  insert into public.project_revisions(
    id, project_id, revision_number, parent_revision_id, created_by,
    publish_request_id, expected_base_revision_id, message, manifest,
    manifest_version, engine, engine_version, manifest_sha256, duration_ms
  ) values (
    v_target_revision_id, v_target.id, 1, null, v_actor,
    p_request_id, null, null, v_manifest,
    v_source_revision.manifest_version, v_source_revision.engine,
    v_source_revision.engine_version, v_manifest_sha256,
    v_source_revision.duration_ms
  ) returning * into v_target_revision;

  insert into public.revision_tracks(
    revision_id, id, asset_id, instrument_id, name, position_ms,
    trim_start_ms, duration_ms, gain_db, pan, muted, soloed, sort_order, added_by
  )
  select v_target_revision.id, rt.id, rt.asset_id, rt.instrument_id, rt.name,
    rt.position_ms, rt.trim_start_ms, rt.duration_ms, rt.gain_db, rt.pan,
    rt.muted, rt.soloed, rt.sort_order, rt.added_by
  from public.revision_tracks rt
  where rt.revision_id = v_source_revision.id
  order by rt.sort_order;

  if exists (
    (
      select rtc.track_id, rtc.asset_id, rtc.position, rtc.source_credit_position,
        rtc.user_id, rtc.credit_name, rtc.role
      from public.revision_track_credits rtc
      where rtc.revision_id = v_target_revision.id
      except
      select rtc.track_id, rtc.asset_id, rtc.position, rtc.source_credit_position,
        rtc.user_id, rtc.credit_name, rtc.role
      from public.revision_track_credits rtc
      where rtc.revision_id = v_source_revision.id
    ) union all (
      select rtc.track_id, rtc.asset_id, rtc.position, rtc.source_credit_position,
        rtc.user_id, rtc.credit_name, rtc.role
      from public.revision_track_credits rtc
      where rtc.revision_id = v_source_revision.id
      except
      select rtc.track_id, rtc.asset_id, rtc.position, rtc.source_credit_position,
        rtc.user_id, rtc.credit_name, rtc.role
      from public.revision_track_credits rtc
      where rtc.revision_id = v_target_revision.id
    )
  ) then
    raise sqlstate 'PT409' using message = 'fork_credit_snapshot_mismatch';
  end if;

  insert into public.project_asset_references(
    project_id, asset_id, first_revision_id, added_by
  )
  select v_target.id, rt.asset_id, v_target_revision.id, par.added_by
  from public.revision_tracks rt
  join public.project_asset_references par
    on par.project_id = v_source.id and par.asset_id = rt.asset_id
  where rt.revision_id = v_source_revision.id;

  select coalesce(sum(a.byte_size), 0), count(*)::integer
  into v_source_bytes, v_source_count
  from public.project_asset_references par
  join public.assets a on a.id = par.asset_id
  where par.project_id = v_target.id;
  if v_source_count not between 1 and 12 or v_source_bytes > 262144000 then
    raise sqlstate 'PT429' using message = 'fork_project_quota_exceeded';
  end if;
  insert into public.project_storage_usage(
    project_id, source_bytes, unique_source_count
  ) values (v_target.id, v_source_bytes, v_source_count);

  update public.projects p set
    current_revision_id = v_target_revision.id,
    status = 'active',
    published_at = statement_timestamp(),
    lock_version = p.lock_version + 1,
    updated_at = statement_timestamp()
  where p.id = v_target.id
  returning * into v_target;

  insert into public.activity_events(
    actor_id, project_id, subject_id, event_type, payload
  ) values (
    v_actor, v_target.id, v_target_revision.id, 'project_forked',
    jsonb_build_object('revisionNumber', 1)
  );

  return query
    select v_target.id, v_target_revision.id, 1, v_target.created_at;
exception
  when invalid_text_representation or numeric_value_out_of_range
    or not_null_violation then
    raise sqlstate '22023' using message = 'fork_invalid_input';
end
$$;

revoke all on function private.protect_project_fork_lineage()
  from public, anon, authenticated;
revoke all on function public.fork_project(uuid, uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.fork_project(uuid, uuid, uuid, text, text, text)
  to authenticated;

comment on column public.projects.source_project_id is
  'Immutable direct source project for a copy-on-write fork; null for original projects.';
comment on column public.projects.source_revision_id is
  'Exact immutable source revision used to create a copy-on-write fork.';
comment on function public.fork_project(uuid, uuid, uuid, text, text, text) is
  'Creates a separately owned private project and first revision by referencing an authorized derivative-permitted source revision without copying audio bytes.';
