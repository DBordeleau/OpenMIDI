create or replace function private.assert_project_owner_invariant() returns trigger language plpgsql security definer set search_path='' as $$
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

alter table public.assets drop constraint assets_source_check;
alter table public.assets drop constraint assets_path_check;
alter table public.assets drop constraint assets_reserved_size_check;
alter table public.assets drop constraint assets_ready_check;

alter table public.assets add constraint assets_kind_storage_check check (
  (kind = 'source_audio' and bucket = 'source-audio') or
  (kind = 'workspace_snapshot' and bucket = 'workspace-snapshots')
);
alter table public.assets add constraint assets_path_check check (
  (kind = 'source_audio' and object_path = owner_id::text || '/' || id::text || '/source') or
  (kind = 'workspace_snapshot' and object_path ~ ('^' || owner_id::text || '/workspaces/[0-9a-f-]{36}/snapshots/' || id::text || '/manifest-v1[.]json$'))
);
alter table public.assets add constraint assets_reserved_size_check check (
  (kind = 'source_audio' and reserved_byte_size between 1 and 47185920) or
  (kind = 'workspace_snapshot' and reserved_byte_size between 1 and 65536)
);
alter table public.assets add constraint assets_ready_check check (
  (
    status = 'ready' and failure_code is null and failed_at is null and ready_at is not null and
    (
      (kind = 'source_audio' and media_type in ('audio/wav','audio/flac','audio/mpeg') and byte_size between 1 and 47185920 and sha256 is not null and duration_ms between 1 and 600000 and sample_rate_hz between 8000 and 192000 and channels between 1 and 8 and verification_version is not null) or
      (kind = 'workspace_snapshot' and media_type = 'application/json' and byte_size between 1 and 65536 and sha256 is not null and duration_ms is null and sample_rate_hz is null and channels is null and verification_version is not null)
    )
  ) or
  (status <> 'ready' and ready_at is null)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  create_request_id uuid not null,
  base_revision_id uuid references public.project_revisions(id) on delete restrict,
  snapshot_asset_id uuid references public.assets(id) on delete restrict,
  manifest jsonb not null,
  manifest_version smallint not null check (manifest_version = 1),
  engine text not null check (engine = 'waveform-playlist'),
  engine_version text not null check (engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','archived')),
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(owner_id,create_request_id)
);
create unique index workspaces_active_owner_project_uq on public.workspaces(project_id,owner_id) where status = 'active';
create index workspaces_owner_idx on public.workspaces(owner_id);
create index workspaces_base_revision_idx on public.workspaces(base_revision_id) where base_revision_id is not null;
create index workspaces_snapshot_asset_idx on public.workspaces(snapshot_asset_id) where snapshot_asset_id is not null;

create table public.workspace_tracks (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
  primary key(workspace_id,track_id),
  unique(workspace_id,asset_id),
  unique(workspace_id,sort_order)
);
create index workspace_tracks_asset_idx on public.workspace_tracks(asset_id);
create index workspace_tracks_instrument_idx on public.workspace_tracks(instrument_id) where instrument_id is not null;

create table private.workspace_snapshot_uploads (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  expected_lock_version integer not null check (expected_lock_version > 0),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 65536),
  expires_at timestamptz not null,
  committed_lock_version integer check (committed_lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  unique(workspace_id,request_id)
);
create index workspace_snapshot_uploads_expiry_idx on private.workspace_snapshot_uploads(expires_at) where committed_lock_version is null;

alter table public.workspaces enable row level security;
alter table public.workspace_tracks enable row level security;
revoke all on public.workspaces,public.workspace_tracks from public,anon,authenticated;
grant select on public.workspaces,public.workspace_tracks to authenticated;

create policy own_workspaces_read on public.workspaces for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active_project_actor()));
create policy own_workspace_tracks_read on public.workspace_tracks for select to authenticated
using ((select private.is_active_project_actor()) and exists (
  select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
));

create function public.create_project_workspace(p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid)
returns table(workspace_id uuid,base_revision_id uuid,lock_version integer,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_manifest jsonb;
  v_manifest_sha256 text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='workspace_actor_ineligible'; end if;
  select * into v_workspace from public.workspaces w where w.owner_id=v_actor and w.create_request_id=p_request_id;
  if found then
    if v_workspace.project_id<>p_project_id or v_workspace.base_revision_id is distinct from p_expected_current_revision_id then raise sqlstate 'PT409' using message='workspace_request_conflict'; end if;
    return query select v_workspace.id,v_workspace.base_revision_id,v_workspace.lock_version,v_workspace.created_at; return;
  end if;
  select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.deleted_at is null for update;
  if not found then raise sqlstate 'PT404' using message='workspace_project_not_found'; end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id or p_expected_current_revision_id is null then raise sqlstate 'PT409' using message='workspace_base_changed'; end if;
  select * into v_workspace from public.workspaces w where w.project_id=p_project_id and w.owner_id=v_actor and w.status='active';
  if found then
    if v_workspace.base_revision_id is distinct from p_expected_current_revision_id then raise sqlstate 'PT409' using message='workspace_active_base_mismatch'; end if;
    return query select v_workspace.id,v_workspace.base_revision_id,v_workspace.lock_version,v_workspace.created_at; return;
  end if;
  select * into v_revision from public.project_revisions r where r.id=p_expected_current_revision_id and r.project_id=p_project_id;
  if not found then raise sqlstate 'PT409' using message='workspace_base_changed'; end if;
  v_manifest:=jsonb_set(v_revision.manifest,'{tempoBpm}',to_jsonb((v_revision.manifest->>'tempoBpm')::double precision));
  v_manifest_sha256:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.workspaces(project_id,owner_id,create_request_id,base_revision_id,manifest,manifest_version,engine,engine_version,manifest_sha256)
  values(p_project_id,v_actor,p_request_id,v_revision.id,v_manifest,v_revision.manifest_version,v_revision.engine,v_revision.engine_version,v_manifest_sha256)
  returning * into v_workspace;
  insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order)
  select v_workspace.id,r.id,r.asset_id,r.instrument_id,r.name,r.position_ms,r.trim_start_ms,r.duration_ms,r.gain_db,r.pan,r.muted,r.soloed,r.sort_order
  from public.revision_tracks r where r.revision_id=v_revision.id order by r.sort_order;
  return query select v_workspace.id,v_workspace.base_revision_id,v_workspace.lock_version,v_workspace.created_at;
exception when unique_violation then
  select * into v_workspace from public.workspaces w where w.project_id=p_project_id and w.owner_id=v_actor and w.status='active';
  if found and v_workspace.base_revision_id is not distinct from p_expected_current_revision_id then return query select v_workspace.id,v_workspace.base_revision_id,v_workspace.lock_version,v_workspace.created_at; return; end if;
  raise;
end$$;

create function public.reserve_workspace_snapshot(p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,p_manifest_sha256 text,p_byte_size integer)
returns table(asset_id uuid,bucket text,object_path text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace public.workspaces%rowtype;
  v_upload private.workspace_snapshot_uploads%rowtype;
  v_asset_id uuid;
  v_path text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_unauthenticated'; end if;
  if p_expected_lock_version is null or p_expected_lock_version<1 or p_manifest_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 65536 then raise sqlstate '22023' using message='workspace_snapshot_invalid'; end if;
  select * into v_workspace from public.workspaces w where w.id=p_workspace_id and w.owner_id=v_actor and w.status='active';
  if not found or not (select private.is_active_project_actor()) then raise sqlstate 'PT404' using message='workspace_not_found'; end if;
  select * into v_upload from private.workspace_snapshot_uploads u where u.workspace_id=p_workspace_id and u.request_id=p_request_id;
  if found then
    if v_upload.expected_lock_version<>p_expected_lock_version or v_upload.manifest_sha256<>p_manifest_sha256 or v_upload.byte_size<>p_byte_size then raise sqlstate 'PT409' using message='workspace_request_conflict'; end if;
    return query select v_upload.asset_id,'workspace-snapshots'::text,(select a.object_path from public.assets a where a.id=v_upload.asset_id),v_upload.expires_at; return;
  end if;
  if v_workspace.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='workspace_save_conflict'; end if;
  v_asset_id:=gen_random_uuid();
  v_path:=v_actor::text||'/workspaces/'||p_workspace_id::text||'/snapshots/'||v_asset_id::text||'/manifest-v1.json';
  insert into public.assets(id,owner_id,kind,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size)
  values(v_asset_id,v_actor,'workspace_snapshot','reserved','workspace-snapshots',v_path,'manifest-v1.json','application/json',p_byte_size);
  insert into private.workspace_snapshot_uploads(asset_id,workspace_id,owner_id,request_id,expected_lock_version,manifest_sha256,byte_size,expires_at)
  values(v_asset_id,p_workspace_id,v_actor,p_request_id,p_expected_lock_version,p_manifest_sha256,p_byte_size,statement_timestamp()+interval '24 hours') returning * into v_upload;
  return query select v_asset_id,'workspace-snapshots'::text,v_path,v_upload.expires_at;
end$$;

create function public.save_workspace(p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,p_manifest jsonb,p_snapshot_asset_id uuid)
returns table(workspace_id uuid,lock_version integer,manifest_sha256 text,updated_at timestamptz)
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
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_unauthenticated'; end if;
  select * into v_upload from private.workspace_snapshot_uploads u where u.workspace_id=p_workspace_id and u.request_id=p_request_id and u.asset_id=p_snapshot_asset_id and u.owner_id=v_actor;
  if found and v_upload.committed_lock_version is not null then
    select * into v_workspace from public.workspaces w where w.id=p_workspace_id and w.owner_id=v_actor;
    if not found then raise sqlstate 'PT404' using message='workspace_not_found'; end if;
    if v_upload.manifest_sha256<>v_workspace.manifest_sha256 then raise sqlstate 'PT409' using message='workspace_request_conflict'; end if;
    return query select v_workspace.id,v_upload.committed_lock_version,v_workspace.manifest_sha256,v_workspace.updated_at; return;
  end if;
  select * into v_workspace from public.workspaces w where w.id=p_workspace_id and w.owner_id=v_actor and w.status='active' for update;
  if not found or not (select private.is_active_project_actor()) then raise sqlstate 'PT404' using message='workspace_not_found'; end if;
  if v_workspace.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='workspace_save_conflict'; end if;
  if v_upload.asset_id is null or v_upload.owner_id<>v_actor or v_upload.expected_lock_version<>p_expected_lock_version or v_upload.expires_at<=statement_timestamp() then raise sqlstate 'PT409' using message='workspace_snapshot_invalid'; end if;
  select * into v_project from public.projects p where p.id=v_workspace.project_id and p.owner_id=v_actor and p.deleted_at is null;
  if not found then raise sqlstate 'PT404' using message='workspace_not_found'; end if;
  if jsonb_typeof(p_manifest)<>'object' or not (p_manifest ?& array['manifestVersion','engine','engineVersion','workspaceId','tempoBpm','tracks']) or (select count(*) from jsonb_object_keys(p_manifest))<>6 or p_manifest->>'manifestVersion'<>'1' or p_manifest->>'engine'<>'waveform-playlist' or p_manifest->>'engineVersion'<>'browser-15.3.4_playout-12.5.4_tone-15.1.22' or p_manifest->>'workspaceId'<>v_workspace.project_id::text or jsonb_typeof(p_manifest->'tracks')<>'array' then raise sqlstate '22023' using message='workspace_invalid_manifest'; end if;
  begin if (p_manifest->>'tempoBpm')::numeric<>v_project.bpm then raise sqlstate '22023' using message='workspace_bpm_mismatch'; end if; exception when invalid_text_representation then raise sqlstate '22023' using message='workspace_invalid_manifest'; end;
  v_count:=jsonb_array_length(p_manifest->'tracks'); if v_count not between 1 and 12 then raise sqlstate '22023' using message='workspace_track_limit'; end if;
  select array_agg(row(x.*)::private.manifest_track) into v_tracks from jsonb_to_recordset(p_manifest->'tracks') as x("trackId" uuid,"assetId" uuid,"instrumentId" uuid,"name" text,"positionMs" integer,"trimStartMs" integer,"durationMs" integer,"gainDb" numeric,"pan" numeric,"muted" boolean,"soloed" boolean,"sortOrder" integer);
  if exists(select 1 from jsonb_array_elements(p_manifest->'tracks') t where jsonb_typeof(t)<>'object' or not (t ?& array['trackId','assetId','instrumentId','name','positionMs','trimStartMs','durationMs','gainDb','pan','muted','soloed','sortOrder']) or (select count(*) from jsonb_object_keys(t))<>12) then raise sqlstate '22023' using message='workspace_invalid_manifest'; end if;
  if (select count(*) from unnest(v_tracks))<>v_count or exists(select 1 from unnest(v_tracks) t where t."trackId" is null or t."assetId" is null or t."name" is null or t."name"<>btrim(t."name") or char_length(t."name") not between 1 and 120 or t."positionMs"<0 or t."trimStartMs"<0 or t."durationMs"<=0 or t."gainDb" not between -60 and 6 or t."pan" not between -1 and 1 or t."muted" is null or t."soloed" is null or t."sortOrder" not between 0 and v_count-1) or (select count(distinct "trackId") from unnest(v_tracks))<>v_count or (select count(distinct "assetId") from unnest(v_tracks))<>v_count or (select count(distinct "sortOrder") from unnest(v_tracks))<>v_count then raise sqlstate '22023' using message='workspace_invalid_manifest'; end if;
  if exists(select 1 from unnest(v_tracks) t left join public.assets a on a.id=t."assetId" left join public.instruments i on i.id=t."instrumentId" where a.id is null or a.kind<>'source_audio' or a.status<>'ready' or a.deleted_at is not null or a.duration_ms<>t."durationMs" or (t."instrumentId" is not null and (i.id is null or not i.is_active)) or (a.owner_id<>v_actor and not exists(select 1 from public.revision_tracks rt where rt.revision_id=v_workspace.base_revision_id and rt.asset_id=a.id))) then raise sqlstate 'PT409' using message='workspace_asset_unavailable'; end if;
  select jsonb_build_object('manifestVersion',1,'engine','waveform-playlist','engineVersion','browser-15.3.4_playout-12.5.4_tone-15.1.22','workspaceId',v_workspace.project_id,'tempoBpm',v_project.bpm::double precision,'tracks',jsonb_agg(jsonb_build_object('trackId',"trackId",'assetId',"assetId",'instrumentId',"instrumentId",'name',"name",'positionMs',"positionMs",'trimStartMs',"trimStartMs",'durationMs',"durationMs",'gainDb',"gainDb",'pan',"pan",'muted',"muted",'soloed',"soloed",'sortOrder',"sortOrder") order by "sortOrder")) into v_canonical from unnest(v_tracks);
  if p_manifest<>v_canonical then raise sqlstate '22023' using message='workspace_manifest_not_canonical'; end if;
  v_checksum:=encode(extensions.digest(convert_to(p_manifest::text,'UTF8'),'sha256'),'hex');
  if v_upload.manifest_sha256<>v_checksum then raise sqlstate 'PT409' using message='workspace_snapshot_mismatch'; end if;
  select (o.metadata->>'size')::bigint into v_object_size from storage.objects o join public.assets a on a.bucket=o.bucket_id and a.object_path=o.name where a.id=p_snapshot_asset_id;
  if v_object_size is null then raise sqlstate 'PT409' using message='workspace_snapshot_missing'; end if;
  if v_object_size<>v_upload.byte_size then raise sqlstate 'PT409' using message='workspace_snapshot_size_mismatch'; end if;
  update public.assets set status='ready',media_type='application/json',byte_size=v_object_size,sha256=v_checksum,verification_version='manifest-v1-client-copy',ready_at=statement_timestamp() where id=p_snapshot_asset_id and owner_id=v_actor and kind='workspace_snapshot' and status='reserved';
  if not found then raise sqlstate 'PT409' using message='workspace_snapshot_invalid'; end if;
  delete from public.workspace_tracks wt where wt.workspace_id=p_workspace_id;
  insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order)
  select p_workspace_id,t."trackId",t."assetId",t."instrumentId",t."name",t."positionMs",t."trimStartMs",t."durationMs",t."gainDb",t."pan",t."muted",t."soloed",t."sortOrder" from unnest(v_tracks) t;
  update public.workspaces w set manifest=v_canonical,manifest_sha256=v_checksum,snapshot_asset_id=p_snapshot_asset_id,lock_version=w.lock_version+1,updated_at=statement_timestamp() where w.id=p_workspace_id returning * into v_workspace;
  update private.workspace_snapshot_uploads set committed_lock_version=v_workspace.lock_version where asset_id=p_snapshot_asset_id;
  return query select v_workspace.id,v_workspace.lock_version,v_workspace.manifest_sha256,v_workspace.updated_at;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then raise sqlstate '22023' using message='workspace_invalid_manifest';
end$$;

revoke execute on function public.create_project_workspace(uuid,uuid,uuid),public.reserve_workspace_snapshot(uuid,uuid,integer,text,integer),public.save_workspace(uuid,uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.create_project_workspace(uuid,uuid,uuid),public.reserve_workspace_snapshot(uuid,uuid,integer,text,integer),public.save_workspace(uuid,uuid,integer,jsonb,uuid) to authenticated;
revoke all on table private.workspace_snapshot_uploads from public,anon,authenticated;

create function public.revision_manifest_checksum_valid(p_project_id uuid,p_revision_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select encode(extensions.digest(convert_to(r.manifest::text,'UTF8'),'sha256'),'hex')=r.manifest_sha256 from public.project_revisions r where r.project_id=p_project_id and r.id=p_revision_id),false)
$$;
revoke execute on function public.revision_manifest_checksum_valid(uuid,uuid) from public,anon;
grant execute on function public.revision_manifest_checksum_valid(uuid,uuid) to authenticated;

create function private.can_upload_workspace_snapshot(p_bucket text,p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.is_active_project_actor()) and exists (
    select 1 from private.workspace_snapshot_uploads u join public.assets a on a.id=u.asset_id
    where u.owner_id=(select auth.uid()) and u.expires_at>statement_timestamp() and u.committed_lock_version is null and a.bucket=p_bucket and a.object_path=p_name and a.status='reserved'
  )
$$;
revoke all on function private.can_upload_workspace_snapshot(text,text) from public,anon;
grant execute on function private.can_upload_workspace_snapshot(text,text) to authenticated;

create function private.can_upload_reserved_source(p_bucket text,p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.is_active_project_actor()) and exists (
    select 1 from public.assets a join public.asset_uploads u on u.asset_id=a.id
    where a.owner_id=(select auth.uid()) and a.bucket=p_bucket and a.object_path=p_name and a.status in ('reserved','uploading') and u.expires_at>statement_timestamp()
  )
$$;
revoke all on function private.can_upload_reserved_source(text,text) from public,anon;
grant execute on function private.can_upload_reserved_source(text,text) to authenticated;
drop policy reserved_source_insert on storage.objects;
create policy reserved_source_insert on storage.objects for insert to authenticated
with check (bucket_id='source-audio' and owner_id=(select auth.uid())::text and (select private.can_upload_reserved_source(bucket_id,name)));

create policy reserved_workspace_snapshot_insert on storage.objects for insert to authenticated
with check (bucket_id='workspace-snapshots' and owner_id=(select auth.uid())::text and (select private.can_upload_workspace_snapshot(bucket_id,name)));
create policy own_workspace_snapshot_read on storage.objects for select to authenticated
using (bucket_id='workspace-snapshots' and exists (
  select 1 from public.assets a where a.owner_id=(select auth.uid()) and a.bucket=bucket_id and a.object_path=name and a.kind='workspace_snapshot' and a.status in ('reserved','ready') and (select private.is_active_project_actor())
));
