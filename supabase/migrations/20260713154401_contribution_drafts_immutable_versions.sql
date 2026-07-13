create type public.contribution_status as enum (
  'draft',
  'submitted',
  'changes_requested',
  'accepted',
  'rejected',
  'withdrawn'
);

alter table public.projects drop constraint projects_revision_lifecycle_check;
alter table public.projects add constraint projects_revision_lifecycle_check check (
  visibility = 'private' and deleted_at is null and
  ((status = 'draft' and current_revision_id is null and published_at is null and not open_to_contributions) or
   (status = 'active' and current_revision_id is not null and published_at is not null))
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  base_revision_id uuid not null,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  description text check (description is null or (description = btrim(description) and char_length(description) between 1 and 5000)),
  status public.contribution_status not null default 'draft',
  current_version_id uuid,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_note text check (review_note is null or (review_note = btrim(review_note) and char_length(review_note) between 1 and 5000)),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (author_id, create_request_id),
  unique (project_id, id),
  unique (id, project_id, author_id, base_revision_id),
  constraint contributions_project_base_fk foreign key (project_id, base_revision_id) references public.project_revisions(project_id, id) on delete restrict,
  constraint contributions_status_shape check (
    (status = 'draft' and current_version_id is null and submitted_at is null and withdrawn_at is null and reviewed_at is null and reviewed_by is null and review_note is null) or
    (status in ('submitted', 'changes_requested') and current_version_id is not null and submitted_at is not null and withdrawn_at is null) or
    (status = 'withdrawn' and withdrawn_at is not null) or
    (status in ('accepted', 'rejected') and current_version_id is not null and submitted_at is not null and withdrawn_at is null and reviewed_at is not null and reviewed_by is not null)
  )
);
create unique index contributions_live_author_project_uq on public.contributions(project_id, author_id)
  where status in ('draft', 'submitted', 'changes_requested');
create index contributions_author_updated_idx on public.contributions(author_id, updated_at desc, id desc);
create index contributions_owner_queue_idx on public.contributions(project_id, submitted_at desc, id desc)
  where status <> 'draft';
create index contributions_base_revision_idx on public.contributions(base_revision_id);

create table public.contribution_versions (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  submission_request_id uuid not null,
  base_revision_id uuid not null references public.project_revisions(id) on delete restrict,
  snapshot_asset_id uuid not null references public.assets(id) on delete restrict,
  workspace_lock_version integer not null check (workspace_lock_version > 0),
  manifest jsonb not null,
  manifest_version smallint not null check (manifest_version = 1),
  engine text not null check (engine = 'waveform-playlist'),
  engine_version text not null check (engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  duration_ms integer not null check (duration_ms >= 0),
  attestation_version text not null check (attestation_version = 'contributor-attestation-v1'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (contribution_id, version_number),
  unique (contribution_id, submission_request_id),
  unique (contribution_id, id)
);
create index contribution_versions_base_revision_idx on public.contribution_versions(base_revision_id);
create index contribution_versions_snapshot_asset_idx on public.contribution_versions(snapshot_asset_id);
create index contribution_versions_created_by_idx on public.contribution_versions(created_by);
create index contribution_versions_created_idx on public.contribution_versions(created_at desc, id desc);

alter table public.contributions add constraint contributions_current_version_fk
  foreign key (id, current_version_id) references public.contribution_versions(contribution_id, id) on delete restrict;

create table public.contribution_version_tracks (
  contribution_version_id uuid not null references public.contribution_versions(id) on delete restrict,
  track_id uuid not null,
  asset_id uuid not null references public.assets(id) on delete restrict,
  instrument_id uuid references public.instruments(id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  position_ms integer not null check (position_ms >= 0),
  trim_start_ms integer not null check (trim_start_ms >= 0),
  duration_ms integer not null check (duration_ms > 0),
  gain_db numeric not null check (gain_db between -60 and 6),
  pan numeric not null check (pan between -1 and 1),
  muted boolean not null,
  soloed boolean not null,
  sort_order smallint not null check (sort_order between 0 and 11),
  added_by uuid not null references public.profiles(id) on delete restrict,
  primary key (contribution_version_id, track_id),
  unique (contribution_version_id, asset_id),
  unique (contribution_version_id, sort_order)
);
create index contribution_version_tracks_asset_idx on public.contribution_version_tracks(asset_id);
create index contribution_version_tracks_instrument_idx on public.contribution_version_tracks(instrument_id) where instrument_id is not null;
create index contribution_version_tracks_added_by_idx on public.contribution_version_tracks(added_by);

alter table public.workspaces add column contribution_id uuid;
create unique index workspaces_contribution_uq on public.workspaces(contribution_id) where contribution_id is not null;
create index workspaces_contribution_idx on public.workspaces(contribution_id) where contribution_id is not null;
alter table public.workspaces add constraint workspaces_contribution_identity_fk
  foreign key (contribution_id, project_id, owner_id, base_revision_id)
  references public.contributions(id, project_id, author_id, base_revision_id) on delete restrict;

create trigger contribution_versions_immutable before update or delete on public.contribution_versions
  for each row execute function private.reject_immutable_change();
create trigger contribution_version_tracks_immutable before update or delete on public.contribution_version_tracks
  for each row execute function private.reject_immutable_change();

alter table public.contributions enable row level security;
alter table public.contribution_versions enable row level security;
alter table public.contribution_version_tracks enable row level security;
revoke all on public.contributions, public.contribution_versions, public.contribution_version_tracks from public, anon, authenticated;
grant select on public.contributions, public.contribution_versions, public.contribution_version_tracks to authenticated;

create policy contribution_participants_read on public.contributions for select to authenticated using (
  (select private.is_active_project_actor()) and
  (author_id = (select auth.uid()) or
   (status <> 'draft' and exists (
     select 1 from public.projects p
     where p.id = contributions.project_id and p.owner_id = (select auth.uid())
   )))
);
create policy contribution_version_participants_read on public.contribution_versions for select to authenticated using (
  (select private.is_active_project_actor()) and exists (
    select 1 from public.contributions c
    where c.id = contribution_versions.contribution_id and
      (c.author_id = (select auth.uid()) or
       (c.status <> 'draft' and exists (
         select 1 from public.projects p where p.id = c.project_id and p.owner_id = (select auth.uid())
       )))
  )
);
create policy contribution_version_track_participants_read on public.contribution_version_tracks for select to authenticated using (
  (select private.is_active_project_actor()) and exists (
    select 1 from public.contribution_versions v
    join public.contributions c on c.id = v.contribution_id
    where v.id = contribution_version_tracks.contribution_version_id and
      (c.author_id = (select auth.uid()) or
       (c.status <> 'draft' and exists (
         select 1 from public.projects p where p.id = c.project_id and p.owner_id = (select auth.uid())
       )))
  )
);

create or replace function public.set_project_contributions_open(
  p_project_id uuid,
  p_expected_lock_version integer,
  p_open boolean
)
returns table(project_id uuid, open_to_contributions boolean, lock_version integer, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
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
  if v_project.status <> 'active' or v_project.visibility <> 'private' or v_project.deleted_at is not null or v_project.current_revision_id is null then
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

create function public.create_contribution_workspace(
  p_project_id uuid,
  p_request_id uuid,
  p_expected_current_revision_id uuid,
  p_title text,
  p_description text
)
returns table(contribution_id uuid, workspace_id uuid, base_revision_id uuid, lock_version integer, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_manifest jsonb;
  v_checksum text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'contribution_actor_ineligible'; end if;
  if p_project_id is null or p_request_id is null or p_expected_current_revision_id is null or v_title is null or char_length(v_title) not between 1 and 120 or (v_description is not null and char_length(v_description) > 5000) then
    raise sqlstate '22023' using message = 'contribution_invalid_input';
  end if;
  select * into v_contribution from public.contributions c where c.author_id = v_actor and c.create_request_id = p_request_id;
  if found then
    if v_contribution.project_id <> p_project_id or v_contribution.base_revision_id <> p_expected_current_revision_id or v_contribution.title <> v_title or v_contribution.description is distinct from v_description then
      raise sqlstate 'PT409' using message = 'contribution_request_conflict';
    end if;
    select * into v_workspace from public.workspaces w where w.contribution_id = v_contribution.id;
    return query select v_contribution.id, v_workspace.id, v_contribution.base_revision_id, v_workspace.lock_version, v_contribution.created_at;
    return;
  end if;
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or v_project.status <> 'active' or v_project.visibility <> 'private' or v_project.deleted_at is not null or not v_project.open_to_contributions then
    raise sqlstate 'PT404' using message = 'contribution_project_not_found';
  end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then raise sqlstate 'PT409' using message = 'contribution_base_changed'; end if;
  if v_project.owner_id = v_actor or not exists (
    select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = v_actor and m.role in ('editor', 'viewer')
  ) then raise sqlstate 'PT404' using message = 'contribution_project_not_found'; end if;
  if exists (select 1 from public.contributions c where c.project_id = p_project_id and c.author_id = v_actor and c.status in ('draft', 'submitted', 'changes_requested')) or
     exists (select 1 from public.workspaces w where w.project_id = p_project_id and w.owner_id = v_actor and w.status = 'active') then
    raise sqlstate 'PT409' using message = 'contribution_live_exists';
  end if;
  select * into v_revision from public.project_revisions r where r.project_id = p_project_id and r.id = p_expected_current_revision_id;
  if not found then raise sqlstate 'PT409' using message = 'contribution_base_changed'; end if;
  v_manifest := jsonb_set(v_revision.manifest, '{tempoBpm}', to_jsonb((v_revision.manifest->>'tempoBpm')::double precision));
  v_checksum := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.contributions(project_id, author_id, create_request_id, base_revision_id, title, description)
    values(p_project_id, v_actor, p_request_id, p_expected_current_revision_id, v_title, v_description)
    returning * into v_contribution;
  insert into public.workspaces(project_id, owner_id, create_request_id, base_revision_id, contribution_id, manifest, manifest_version, engine, engine_version, manifest_sha256)
    values(p_project_id, v_actor, p_request_id, p_expected_current_revision_id, v_contribution.id, v_manifest, v_revision.manifest_version, v_revision.engine, v_revision.engine_version, v_checksum)
    returning * into v_workspace;
  insert into public.workspace_tracks(workspace_id, track_id, asset_id, instrument_id, name, position_ms, trim_start_ms, duration_ms, gain_db, pan, muted, soloed, sort_order)
    select v_workspace.id, rt.id, rt.asset_id, rt.instrument_id, rt.name, rt.position_ms, rt.trim_start_ms, rt.duration_ms, rt.gain_db, rt.pan, rt.muted, rt.soloed, rt.sort_order
    from public.revision_tracks rt where rt.revision_id = v_revision.id order by rt.sort_order;
  return query select v_contribution.id, v_workspace.id, v_contribution.base_revision_id, v_workspace.lock_version, v_contribution.created_at;
exception when unique_violation then
  raise sqlstate 'PT409' using message = 'contribution_live_exists';
end $$;

create or replace function public.reserve_workspace_snapshot(p_workspace_id uuid, p_request_id uuid, p_expected_lock_version integer, p_manifest_sha256 text, p_byte_size integer)
returns table(asset_id uuid, bucket text, object_path text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace public.workspaces%rowtype;
  v_upload private.workspace_snapshot_uploads%rowtype;
  v_asset_id uuid;
  v_path text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'workspace_unauthenticated'; end if;
  if p_expected_lock_version is null or p_expected_lock_version < 1 or p_manifest_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 65536 then raise sqlstate '22023' using message = 'workspace_snapshot_invalid'; end if;
  select * into v_workspace from public.workspaces w where w.id = p_workspace_id and w.owner_id = v_actor and w.status = 'active';
  if not found or not (select private.is_active_project_actor()) or (v_workspace.contribution_id is not null and not exists (
    select 1 from public.contributions c where c.id = v_workspace.contribution_id and c.author_id = v_actor and c.status in ('draft', 'changes_requested')
  )) then raise sqlstate 'PT404' using message = 'workspace_not_found'; end if;
  select * into v_upload from private.workspace_snapshot_uploads u where u.workspace_id = p_workspace_id and u.request_id = p_request_id;
  if found then
    if v_upload.expected_lock_version <> p_expected_lock_version or v_upload.manifest_sha256 <> p_manifest_sha256 or v_upload.byte_size <> p_byte_size then raise sqlstate 'PT409' using message = 'workspace_request_conflict'; end if;
    return query select v_upload.asset_id, 'workspace-snapshots'::text, (select a.object_path from public.assets a where a.id = v_upload.asset_id), v_upload.expires_at;
    return;
  end if;
  if v_workspace.lock_version <> p_expected_lock_version then raise sqlstate 'PT409' using message = 'workspace_save_conflict'; end if;
  v_asset_id := gen_random_uuid();
  v_path := v_actor::text || '/workspaces/' || p_workspace_id::text || '/snapshots/' || v_asset_id::text || '/manifest-v1.json';
  insert into public.assets(id, owner_id, kind, status, bucket, object_path, original_filename, declared_media_type, reserved_byte_size)
    values(v_asset_id, v_actor, 'workspace_snapshot', 'reserved', 'workspace-snapshots', v_path, 'manifest-v1.json', 'application/json', p_byte_size);
  insert into private.workspace_snapshot_uploads(asset_id, workspace_id, owner_id, request_id, expected_lock_version, manifest_sha256, byte_size, expires_at)
    values(v_asset_id, p_workspace_id, v_actor, p_request_id, p_expected_lock_version, p_manifest_sha256, p_byte_size, statement_timestamp() + interval '24 hours') returning * into v_upload;
  return query select v_asset_id, 'workspace-snapshots'::text, v_path, v_upload.expires_at;
end $$;

create or replace function public.save_workspace(p_workspace_id uuid, p_request_id uuid, p_expected_lock_version integer, p_manifest jsonb, p_snapshot_asset_id uuid)
returns table(workspace_id uuid, lock_version integer, manifest_sha256 text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace public.workspaces%rowtype;
  v_upload private.workspace_snapshot_uploads%rowtype;
  v_project public.projects%rowtype;
  v_tracks private.manifest_track[];
  v_canonical jsonb;
  v_checksum text;
  v_count integer;
  v_object_size bigint;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'workspace_unauthenticated'; end if;
  select * into v_upload from private.workspace_snapshot_uploads u where u.workspace_id = p_workspace_id and u.request_id = p_request_id and u.asset_id = p_snapshot_asset_id and u.owner_id = v_actor;
  if found and v_upload.committed_lock_version is not null then
    select * into v_workspace from public.workspaces w where w.id = p_workspace_id and w.owner_id = v_actor;
    if not found or v_upload.manifest_sha256 <> v_workspace.manifest_sha256 then raise sqlstate 'PT409' using message = 'workspace_request_conflict'; end if;
    return query select v_workspace.id, v_upload.committed_lock_version, v_workspace.manifest_sha256, v_workspace.updated_at;
    return;
  end if;
  select * into v_workspace from public.workspaces w where w.id = p_workspace_id and w.owner_id = v_actor and w.status = 'active' for update;
  if not found or not (select private.is_active_project_actor()) or (v_workspace.contribution_id is not null and not exists (
    select 1 from public.contributions c where c.id = v_workspace.contribution_id and c.author_id = v_actor and c.status in ('draft', 'changes_requested')
  )) then raise sqlstate 'PT404' using message = 'workspace_not_found'; end if;
  if v_workspace.lock_version <> p_expected_lock_version then raise sqlstate 'PT409' using message = 'workspace_save_conflict'; end if;
  if v_upload.asset_id is null or v_upload.owner_id <> v_actor or v_upload.expected_lock_version <> p_expected_lock_version or v_upload.expires_at <= statement_timestamp() then raise sqlstate 'PT409' using message = 'workspace_snapshot_invalid'; end if;
  select * into v_project from public.projects p where p.id = v_workspace.project_id and p.deleted_at is null;
  if not found or (v_workspace.contribution_id is null and v_project.owner_id <> v_actor) then raise sqlstate 'PT404' using message = 'workspace_not_found'; end if;
  if jsonb_typeof(p_manifest) <> 'object' or not (p_manifest ?& array['manifestVersion','engine','engineVersion','workspaceId','tempoBpm','tracks']) or (select count(*) from jsonb_object_keys(p_manifest)) <> 6 or p_manifest->>'manifestVersion' <> '1' or p_manifest->>'engine' <> 'waveform-playlist' or p_manifest->>'engineVersion' <> 'browser-15.3.4_playout-12.5.4_tone-15.1.22' or p_manifest->>'workspaceId' <> v_workspace.project_id::text or jsonb_typeof(p_manifest->'tracks') <> 'array' then raise sqlstate '22023' using message = 'workspace_invalid_manifest'; end if;
  begin if (p_manifest->>'tempoBpm')::numeric <> v_project.bpm then raise sqlstate '22023' using message = 'workspace_bpm_mismatch'; end if; exception when invalid_text_representation then raise sqlstate '22023' using message = 'workspace_invalid_manifest'; end;
  v_count := jsonb_array_length(p_manifest->'tracks'); if v_count not between 1 and 12 then raise sqlstate '22023' using message = 'workspace_track_limit'; end if;
  select array_agg(row(x.*)::private.manifest_track) into v_tracks from jsonb_to_recordset(p_manifest->'tracks') as x("trackId" uuid,"assetId" uuid,"instrumentId" uuid,"name" text,"positionMs" integer,"trimStartMs" integer,"durationMs" integer,"gainDb" numeric,"pan" numeric,"muted" boolean,"soloed" boolean,"sortOrder" integer);
  if exists(select 1 from jsonb_array_elements(p_manifest->'tracks') t where jsonb_typeof(t) <> 'object' or not (t ?& array['trackId','assetId','instrumentId','name','positionMs','trimStartMs','durationMs','gainDb','pan','muted','soloed','sortOrder']) or (select count(*) from jsonb_object_keys(t)) <> 12) then raise sqlstate '22023' using message = 'workspace_invalid_manifest'; end if;
  if (select count(*) from unnest(v_tracks)) <> v_count or exists(select 1 from unnest(v_tracks) t where t."trackId" is null or t."assetId" is null or t."name" is null or t."name" <> btrim(t."name") or char_length(t."name") not between 1 and 120 or t."positionMs" < 0 or t."trimStartMs" < 0 or t."durationMs" <= 0 or t."gainDb" not between -60 and 6 or t."pan" not between -1 and 1 or t."muted" is null or t."soloed" is null or t."sortOrder" not between 0 and v_count - 1) or (select count(distinct "trackId") from unnest(v_tracks)) <> v_count or (select count(distinct "assetId") from unnest(v_tracks)) <> v_count or (select count(distinct "sortOrder") from unnest(v_tracks)) <> v_count then raise sqlstate '22023' using message = 'workspace_invalid_manifest'; end if;
  if exists(select 1 from unnest(v_tracks) t left join public.assets a on a.id = t."assetId" left join public.instruments i on i.id = t."instrumentId" where a.id is null or a.kind <> 'source_audio' or a.status <> 'ready' or a.deleted_at is not null or a.duration_ms <> t."durationMs" or t."trimStartMs" + t."durationMs" > a.duration_ms or (t."instrumentId" is not null and (i.id is null or not i.is_active)) or (a.owner_id <> v_actor and not exists(select 1 from public.revision_tracks rt where rt.revision_id = v_workspace.base_revision_id and rt.asset_id = a.id))) then raise sqlstate 'PT409' using message = 'workspace_asset_unavailable'; end if;
  select jsonb_build_object('manifestVersion',1,'engine','waveform-playlist','engineVersion','browser-15.3.4_playout-12.5.4_tone-15.1.22','workspaceId',v_workspace.project_id,'tempoBpm',v_project.bpm::double precision,'tracks',jsonb_agg(jsonb_build_object('trackId',"trackId",'assetId',"assetId",'instrumentId',"instrumentId",'name',"name",'positionMs',"positionMs",'trimStartMs',"trimStartMs",'durationMs',"durationMs",'gainDb',"gainDb",'pan',"pan",'muted',"muted",'soloed',"soloed",'sortOrder',"sortOrder") order by "sortOrder")) into v_canonical from unnest(v_tracks);
  if p_manifest <> v_canonical then raise sqlstate '22023' using message = 'workspace_manifest_not_canonical'; end if;
  v_checksum := encode(extensions.digest(convert_to(p_manifest::text,'UTF8'),'sha256'),'hex');
  if v_upload.manifest_sha256 <> v_checksum then raise sqlstate 'PT409' using message = 'workspace_snapshot_mismatch'; end if;
  select (o.metadata->>'size')::bigint into v_object_size from storage.objects o join public.assets a on a.bucket = o.bucket_id and a.object_path = o.name where a.id = p_snapshot_asset_id;
  if v_object_size is null then raise sqlstate 'PT409' using message = 'workspace_snapshot_missing'; end if;
  if v_object_size <> v_upload.byte_size then raise sqlstate 'PT409' using message = 'workspace_snapshot_size_mismatch'; end if;
  update public.assets set status = 'ready', media_type = 'application/json', byte_size = v_object_size, sha256 = v_checksum, verification_version = 'manifest-v1-client-copy', ready_at = statement_timestamp() where id = p_snapshot_asset_id and owner_id = v_actor and kind = 'workspace_snapshot' and status = 'reserved';
  if not found then raise sqlstate 'PT409' using message = 'workspace_snapshot_invalid'; end if;
  delete from public.workspace_tracks wt where wt.workspace_id = p_workspace_id;
  insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order)
    select p_workspace_id,t."trackId",t."assetId",t."instrumentId",t."name",t."positionMs",t."trimStartMs",t."durationMs",t."gainDb",t."pan",t."muted",t."soloed",t."sortOrder" from unnest(v_tracks) t;
  update public.workspaces w set manifest = v_canonical, manifest_sha256 = v_checksum, snapshot_asset_id = p_snapshot_asset_id, lock_version = w.lock_version + 1, updated_at = statement_timestamp() where w.id = p_workspace_id returning * into v_workspace;
  update private.workspace_snapshot_uploads set committed_lock_version = v_workspace.lock_version where asset_id = p_snapshot_asset_id;
  return query select v_workspace.id, v_workspace.lock_version, v_workspace.manifest_sha256, v_workspace.updated_at;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then raise sqlstate '22023' using message = 'workspace_invalid_manifest';
end $$;

create function public.submit_contribution(
  p_contribution_id uuid,
  p_request_id uuid,
  p_expected_workspace_lock_version integer,
  p_expected_base_revision_id uuid,
  p_expected_manifest_sha256 text,
  p_attestation_version text
)
returns table(contribution_id uuid, version_id uuid, version_number integer, status public.contribution_status, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_version public.contribution_versions%rowtype;
  v_duration integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'contribution_actor_ineligible'; end if;
  if p_contribution_id is null or p_request_id is null or p_expected_workspace_lock_version is null or p_expected_workspace_lock_version < 1 or p_expected_base_revision_id is null or p_expected_manifest_sha256 !~ '^[0-9a-f]{64}$' or p_attestation_version <> 'contributor-attestation-v1' then raise sqlstate '22023' using message = 'contribution_invalid_submission'; end if;
  select c.project_id into v_project.id from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor;
  if not found then raise sqlstate 'PT404' using message = 'contribution_not_found'; end if;
  select * into v_project from public.projects p where p.id = v_project.id for update;
  select * into v_contribution from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor for update;
  select * into v_version from public.contribution_versions v where v.contribution_id = p_contribution_id and v.submission_request_id = p_request_id;
  if found then
    if v_version.workspace_lock_version <> p_expected_workspace_lock_version or v_version.base_revision_id <> p_expected_base_revision_id or v_version.manifest_sha256 <> p_expected_manifest_sha256 or v_version.attestation_version <> p_attestation_version then raise sqlstate 'PT409' using message = 'contribution_request_conflict'; end if;
    return query select v_contribution.id, v_version.id, v_version.version_number, v_contribution.status, v_version.created_at;
    return;
  end if;
  select * into v_workspace from public.workspaces w where w.contribution_id = p_contribution_id and w.owner_id = v_actor for update;
  if v_contribution.status not in ('draft', 'changes_requested') or v_workspace.id is null or v_workspace.status <> 'active' then raise sqlstate 'PT409' using message = 'contribution_not_editable'; end if;
  if v_project.status <> 'active' or v_project.visibility <> 'private' or v_project.deleted_at is not null or not v_project.open_to_contributions then raise sqlstate 'PT409' using message = 'contribution_submissions_closed'; end if;
  if v_project.current_revision_id is distinct from p_expected_base_revision_id or v_contribution.base_revision_id <> p_expected_base_revision_id or v_workspace.base_revision_id <> p_expected_base_revision_id then raise sqlstate 'PT409' using message = 'contribution_base_changed'; end if;
  if not exists (select 1 from public.project_members m where m.project_id = v_project.id and m.user_id = v_actor) then raise sqlstate 'PT404' using message = 'contribution_not_found'; end if;
  if v_workspace.lock_version <> p_expected_workspace_lock_version or v_workspace.manifest_sha256 <> p_expected_manifest_sha256 or v_workspace.snapshot_asset_id is null or v_workspace.updated_at <= v_workspace.created_at then raise sqlstate 'PT409' using message = 'contribution_workspace_stale'; end if;
  if not exists (select 1 from public.assets a where a.id = v_workspace.snapshot_asset_id and a.owner_id = v_actor and a.kind = 'workspace_snapshot' and a.status = 'ready' and a.sha256 = v_workspace.manifest_sha256) then raise sqlstate 'PT409' using message = 'contribution_workspace_stale'; end if;
  if v_workspace.manifest_version <> 1 or v_workspace.engine <> 'waveform-playlist' or v_workspace.engine_version <> 'browser-15.3.4_playout-12.5.4_tone-15.1.22' or v_workspace.manifest->>'workspaceId' <> v_project.id::text or encode(extensions.digest(convert_to(v_workspace.manifest::text,'UTF8'),'sha256'),'hex') <> v_workspace.manifest_sha256 then raise sqlstate 'PT409' using message = 'contribution_workspace_invalid'; end if;
  if (select count(*) from public.workspace_tracks wt where wt.workspace_id = v_workspace.id) not between 1 and 12 or exists (
    select 1 from public.workspace_tracks wt left join public.assets a on a.id = wt.asset_id left join public.instruments i on i.id = wt.instrument_id
    where wt.workspace_id = v_workspace.id and (a.id is null or a.kind <> 'source_audio' or a.status <> 'ready' or a.deleted_at is not null or wt.trim_start_ms + wt.duration_ms > a.duration_ms or (wt.instrument_id is not null and (i.id is null or not i.is_active)) or (a.owner_id <> v_actor and not exists (select 1 from public.revision_tracks rt where rt.revision_id = v_contribution.base_revision_id and rt.asset_id = a.id)))
  ) then raise sqlstate 'PT409' using message = 'contribution_workspace_invalid'; end if;
  select coalesce(max(wt.position_ms + wt.duration_ms), 0) into v_duration from public.workspace_tracks wt where wt.workspace_id = v_workspace.id;
  insert into public.contribution_versions(contribution_id, version_number, submission_request_id, base_revision_id, snapshot_asset_id, workspace_lock_version, manifest, manifest_version, engine, engine_version, manifest_sha256, duration_ms, attestation_version, created_by)
    values(v_contribution.id, coalesce((select max(v.version_number) + 1 from public.contribution_versions v where v.contribution_id = v_contribution.id), 1), p_request_id, v_contribution.base_revision_id, v_workspace.snapshot_asset_id, v_workspace.lock_version, v_workspace.manifest, v_workspace.manifest_version, v_workspace.engine, v_workspace.engine_version, v_workspace.manifest_sha256, v_duration, p_attestation_version, v_actor)
    returning * into v_version;
  insert into public.contribution_version_tracks(contribution_version_id, track_id, asset_id, instrument_id, name, position_ms, trim_start_ms, duration_ms, gain_db, pan, muted, soloed, sort_order, added_by)
    select v_version.id, wt.track_id, wt.asset_id, wt.instrument_id, wt.name, wt.position_ms, wt.trim_start_ms, wt.duration_ms, wt.gain_db, wt.pan, wt.muted, wt.soloed, wt.sort_order,
      coalesce((select rt.added_by from public.revision_tracks rt where rt.revision_id = v_contribution.base_revision_id and rt.id = wt.track_id and rt.asset_id = wt.asset_id), v_actor)
    from public.workspace_tracks wt where wt.workspace_id = v_workspace.id order by wt.sort_order;
  update public.contributions c set current_version_id = v_version.id, status = 'submitted', submitted_at = coalesce(c.submitted_at, statement_timestamp()), updated_at = statement_timestamp() where c.id = v_contribution.id returning * into v_contribution;
  return query select v_contribution.id, v_version.id, v_version.version_number, v_contribution.status, v_version.created_at;
end $$;

create function public.withdraw_contribution(
  p_contribution_id uuid,
  p_expected_status public.contribution_status,
  p_expected_current_version_id uuid
)
returns table(contribution_id uuid, status public.contribution_status, current_version_id uuid, withdrawn_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project_id uuid;
  v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'contribution_actor_ineligible'; end if;
  select c.project_id into v_project_id from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor;
  if not found then raise sqlstate 'PT404' using message = 'contribution_not_found'; end if;
  perform 1 from public.projects p where p.id = v_project_id for update;
  select * into v_contribution from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor for update;
  select * into v_workspace from public.workspaces w where w.contribution_id = p_contribution_id for update;
  if v_contribution.status = 'withdrawn' then
    if p_expected_status <> 'withdrawn' or v_contribution.current_version_id is distinct from p_expected_current_version_id then raise sqlstate 'PT409' using message = 'contribution_withdraw_conflict'; end if;
    return query select v_contribution.id, v_contribution.status, v_contribution.current_version_id, v_contribution.withdrawn_at;
    return;
  end if;
  if v_contribution.status not in ('draft', 'submitted', 'changes_requested') or v_contribution.status <> p_expected_status or v_contribution.current_version_id is distinct from p_expected_current_version_id then raise sqlstate 'PT409' using message = 'contribution_withdraw_conflict'; end if;
  update public.contributions c set status = 'withdrawn', withdrawn_at = statement_timestamp(), updated_at = statement_timestamp() where c.id = p_contribution_id returning * into v_contribution;
  update public.workspaces w set status = 'archived', updated_at = statement_timestamp() where w.id = v_workspace.id and w.status = 'active';
  return query select v_contribution.id, v_contribution.status, v_contribution.current_version_id, v_contribution.withdrawn_at;
end $$;

revoke execute on function public.set_project_contributions_open(uuid,integer,boolean), public.create_contribution_workspace(uuid,uuid,uuid,text,text), public.submit_contribution(uuid,uuid,integer,uuid,text,text), public.withdraw_contribution(uuid,public.contribution_status,uuid) from public, anon;
grant execute on function public.set_project_contributions_open(uuid,integer,boolean), public.create_contribution_workspace(uuid,uuid,uuid,text,text), public.submit_contribution(uuid,uuid,integer,uuid,text,text), public.withdraw_contribution(uuid,public.contribution_status,uuid) to authenticated;

comment on table public.contributions is 'Private contribution lifecycle rooted at an exact immutable project revision.';
comment on table public.contribution_versions is 'Immutable submitted snapshots of acknowledged contribution workspaces.';
comment on column public.contribution_versions.attestation_version is 'Versioned rights attestation accepted for this immutable submission.';
comment on column public.workspaces.contribution_id is 'Null for owner project workspaces; set for author-owned contribution workspaces.';
