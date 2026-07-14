alter table public.global_storage_usage
  add column derived_bytes bigint not null default 0 check (derived_bytes >= 0),
  add column reserved_derived_bytes bigint not null default 0 check (reserved_derived_bytes >= 0);

alter table public.assets
  add constraint assets_id_owner_uq unique (id, owner_id);

create table public.waveform_peak_derivatives (
  id uuid primary key,
  source_asset_id uuid not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  status text not null default 'reserved' check (status in ('reserved', 'ready', 'failed')),
  bucket text not null default 'derived-assets' check (bucket = 'derived-assets'),
  object_path text not null,
  content_type text not null default 'application/vnd.jam-session.waveform-peaks' check (content_type = 'application/vnd.jam-session.waveform-peaks'),
  expected_byte_size bigint not null check (expected_byte_size between 40 and 524288),
  byte_size bigint,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  format_version smallint,
  algorithm_version text,
  channels smallint,
  duration_ms integer,
  sample_rate_hz integer,
  bin_count integer,
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  ready_at timestamptz,
  failed_at timestamptz,
  constraint waveform_peak_derivatives_owner_request_uq unique (owner_id, request_id),
  constraint waveform_peak_derivatives_source_owner_fk foreign key (source_asset_id, owner_id)
    references public.assets(id, owner_id) on delete cascade,
  constraint waveform_peak_derivatives_object_uq unique (bucket, object_path),
  constraint waveform_peak_derivatives_path_check check (
    object_path = owner_id::text || '/' || source_asset_id::text || '/' || id::text || '/peaks.v1.bin'
  ),
  constraint waveform_peak_derivatives_ready_check check (
    (
      status = 'ready'
      and byte_size = expected_byte_size
      and sha256 is not null
      and format_version = 1
      and algorithm_version = 'pcm-minmax-v1'
      and channels between 1 and 8
      and duration_ms between 1 and 600000
      and sample_rate_hz between 8000 and 192000
      and bin_count = 2048
      and byte_size = 40 + channels::bigint * bin_count::bigint * 4
      and ready_at is not null
      and failed_at is null
    )
    or (
      status <> 'ready'
      and byte_size is null
      and sha256 is null
      and format_version is null
      and algorithm_version is null
      and channels is null
      and duration_ms is null
      and sample_rate_hz is null
      and bin_count is null
      and ready_at is null
    )
  ),
  constraint waveform_peak_derivatives_failed_check check (
    (status = 'failed' and failed_at is not null)
    or (status <> 'failed' and failed_at is null)
  )
);

create index waveform_peak_derivatives_expiry_idx
  on public.waveform_peak_derivatives (expires_at)
  where status = 'reserved';

alter table public.waveform_peak_derivatives enable row level security;
revoke all on public.waveform_peak_derivatives from public, anon, authenticated;
grant select on public.waveform_peak_derivatives to authenticated;

create policy authorized_waveform_peak_derivatives_read
on public.waveform_peak_derivatives for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    status = 'ready'
    and (select private.can_read_source_asset(source_asset_id))
  )
);

create function public.reserve_waveform_peaks(
  p_request_id uuid,
  p_source_asset_id uuid,
  p_expected_byte_size bigint
)
returns table (
  derivative_id uuid,
  source_asset_id uuid,
  bucket text,
  object_path text,
  content_type text,
  expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_derivative public.waveform_peak_derivatives%rowtype;
  v_global public.global_storage_usage%rowtype;
  v_id uuid;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'waveform_peaks_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'waveform_peaks_actor_ineligible'; end if;
  if p_request_id is null or p_source_asset_id is null or p_expected_byte_size not between 40 and 524288 then
    raise sqlstate '22023' using message = 'waveform_peaks_invalid_declaration';
  end if;

  select * into v_derivative
  from public.waveform_peak_derivatives d
  where d.owner_id = v_actor and d.request_id = p_request_id;
  if found then
    if v_derivative.source_asset_id <> p_source_asset_id or v_derivative.expected_byte_size <> p_expected_byte_size then
      raise sqlstate '23505' using message = 'waveform_peaks_request_conflict';
    end if;
    return query select v_derivative.id, v_derivative.source_asset_id, v_derivative.bucket,
      v_derivative.object_path, v_derivative.content_type, v_derivative.expires_at;
    return;
  end if;

  perform 1
  from public.assets a
  where a.id = p_source_asset_id
    and a.owner_id = v_actor
    and a.kind = 'source_audio'
    and a.status in ('reserved', 'uploading', 'processing', 'ready')
    and a.deleted_at is null
  for update;
  if not found then raise sqlstate 'PT404' using message = 'waveform_peaks_source_not_found'; end if;
  if exists (select 1 from public.waveform_peak_derivatives d where d.source_asset_id = p_source_asset_id) then
    raise sqlstate 'PT409' using message = 'waveform_peaks_already_reserved';
  end if;

  select * into v_global from public.global_storage_usage where singleton for update;
  if v_global.source_bytes + v_global.reserved_source_bytes + v_global.derived_bytes + v_global.reserved_derived_bytes + p_expected_byte_size > 891289600 then
    raise sqlstate 'PT429' using message = 'asset_global_quota_exceeded';
  end if;

  v_id := gen_random_uuid();
  insert into public.waveform_peak_derivatives (
    id, source_asset_id, owner_id, request_id, object_path, expected_byte_size, expires_at
  ) values (
    v_id, p_source_asset_id, v_actor, p_request_id,
    v_actor::text || '/' || p_source_asset_id::text || '/' || v_id::text || '/peaks.v1.bin',
    p_expected_byte_size, statement_timestamp() + interval '24 hours'
  ) returning * into v_derivative;

  update public.global_storage_usage
  set reserved_derived_bytes = reserved_derived_bytes + p_expected_byte_size,
      updated_at = statement_timestamp()
  where singleton;

  return query select v_derivative.id, v_derivative.source_asset_id, v_derivative.bucket,
    v_derivative.object_path, v_derivative.content_type, v_derivative.expires_at;
end
$$;

create function public.finalize_waveform_peaks(
  p_derivative_id uuid,
  p_byte_size bigint,
  p_sha256 text,
  p_format_version smallint,
  p_algorithm_version text,
  p_channels smallint,
  p_duration_ms integer,
  p_sample_rate_hz integer,
  p_bin_count integer
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_derivative public.waveform_peak_derivatives%rowtype;
  v_source public.assets%rowtype;
  v_client_duration integer;
  v_object_size bigint;
  v_object_type text;
begin
  select * into v_derivative
  from public.waveform_peak_derivatives d
  where d.id = p_derivative_id and d.owner_id = v_actor
  for update;
  if not found then raise sqlstate 'PT404' using message = 'waveform_peaks_not_found'; end if;

  if v_derivative.status = 'ready' then
    if v_derivative.byte_size = p_byte_size
      and v_derivative.sha256 = p_sha256
      and v_derivative.format_version = p_format_version
      and v_derivative.algorithm_version = p_algorithm_version
      and v_derivative.channels = p_channels
      and v_derivative.duration_ms = p_duration_ms
      and v_derivative.sample_rate_hz = p_sample_rate_hz
      and v_derivative.bin_count = p_bin_count then
      return 'ready';
    end if;
    raise sqlstate '23505' using message = 'waveform_peaks_completion_conflict';
  end if;
  if v_derivative.status <> 'reserved' then raise sqlstate 'PT409' using message = 'waveform_peaks_not_finalizable'; end if;
  if v_derivative.expires_at <= statement_timestamp() then raise sqlstate 'PT409' using message = 'waveform_peaks_expired'; end if;
  if p_byte_size is null or p_byte_size <> v_derivative.expected_byte_size
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_format_version is null or p_format_version <> 1
    or p_algorithm_version is null or p_algorithm_version <> 'pcm-minmax-v1'
    or p_channels is null or p_channels not between 1 and 8
    or p_duration_ms is null or p_duration_ms not between 1 and 600000
    or p_sample_rate_hz is null or p_sample_rate_hz not between 8000 and 192000
    or p_bin_count is null or p_bin_count <> 2048
    or p_byte_size <> 40 + p_channels::bigint * p_bin_count::bigint * 4 then
    raise sqlstate '22023' using message = 'waveform_peaks_invalid_payload';
  end if;

  select * into v_source
  from public.assets a
  where a.id = v_derivative.source_asset_id
    and a.owner_id = v_actor
    and a.kind = 'source_audio'
    and a.status in ('reserved', 'uploading', 'processing', 'ready')
    and a.deleted_at is null;
  if not found then raise sqlstate 'PT404' using message = 'waveform_peaks_source_not_found'; end if;

  if v_source.status = 'ready' then
    if v_source.channels <> p_channels or v_source.duration_ms <> p_duration_ms or v_source.sample_rate_hz <> p_sample_rate_hz then
      raise sqlstate '22023' using message = 'waveform_peaks_source_mismatch';
    end if;
  else
    select u.client_duration_ms into v_client_duration
    from public.asset_uploads u
    where u.asset_id = v_source.id and u.owner_id = v_actor;
    if v_client_duration is not null and v_client_duration <> p_duration_ms then
      raise sqlstate '22023' using message = 'waveform_peaks_source_mismatch';
    end if;
  end if;

  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype'
  into v_object_size, v_object_type
  from storage.objects o
  where o.bucket_id = v_derivative.bucket and o.name = v_derivative.object_path;
  if v_object_size is null then raise sqlstate 'PT409' using message = 'waveform_peaks_object_missing'; end if;
  if v_object_size <> p_byte_size then raise sqlstate 'PT409' using message = 'waveform_peaks_size_mismatch'; end if;
  if v_object_type is distinct from v_derivative.content_type then
    raise sqlstate 'PT409' using message = 'waveform_peaks_content_type_mismatch';
  end if;

  update public.global_storage_usage
  set reserved_derived_bytes = reserved_derived_bytes - v_derivative.expected_byte_size,
      derived_bytes = derived_bytes + p_byte_size,
      updated_at = statement_timestamp()
  where singleton;

  update public.waveform_peak_derivatives
  set status = 'ready', byte_size = p_byte_size, sha256 = p_sha256,
      format_version = p_format_version, algorithm_version = p_algorithm_version,
      channels = p_channels, duration_ms = p_duration_ms,
      sample_rate_hz = p_sample_rate_hz, bin_count = p_bin_count,
      ready_at = statement_timestamp()
  where id = p_derivative_id;
  return 'ready';
end
$$;

create function public.cancel_waveform_peaks(p_derivative_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_derivative public.waveform_peak_derivatives%rowtype;
begin
  select * into v_derivative from public.waveform_peak_derivatives d
  where d.id = p_derivative_id and d.owner_id = v_actor for update;
  if not found then raise sqlstate 'PT404' using message = 'waveform_peaks_not_found'; end if;
  if v_derivative.status = 'failed' then return 'failed'; end if;
  if v_derivative.status = 'ready' then raise sqlstate 'PT409' using message = 'waveform_peaks_not_cancellable'; end if;
  update public.global_storage_usage
  set reserved_derived_bytes = reserved_derived_bytes - v_derivative.expected_byte_size,
      updated_at = statement_timestamp()
  where singleton;
  update public.waveform_peak_derivatives
  set status = 'failed', failed_at = statement_timestamp()
  where id = p_derivative_id;
  return 'failed';
end
$$;

create function private.expire_waveform_peak_uploads()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_derivative public.waveform_peak_derivatives%rowtype;
  v_count bigint := 0;
begin
  for v_derivative in
    select * from public.waveform_peak_derivatives d
    where d.status = 'reserved' and d.expires_at <= statement_timestamp()
    for update
  loop
    update public.global_storage_usage
    set reserved_derived_bytes = reserved_derived_bytes - v_derivative.expected_byte_size,
        updated_at = statement_timestamp()
    where singleton;
    update public.waveform_peak_derivatives
    set status = 'failed', failed_at = statement_timestamp()
    where id = v_derivative.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

create function private.can_upload_waveform_peak(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'derived-assets' and (select private.is_active_project_actor()) and exists (
    select 1
    from public.waveform_peak_derivatives d
    join public.assets a on a.id = d.source_asset_id
    where d.bucket = p_bucket and d.object_path = p_name
      and d.owner_id = (select auth.uid())
      and d.status = 'reserved' and d.expires_at > statement_timestamp()
      and a.owner_id = (select auth.uid()) and a.kind = 'source_audio'
      and a.status in ('reserved', 'uploading', 'processing', 'ready') and a.deleted_at is null
  )
$$;

create function private.can_read_waveform_peak_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'derived-assets' and exists (
    select 1 from public.waveform_peak_derivatives d
    where d.bucket = p_bucket and d.object_path = p_name
      and (
        (d.owner_id = (select auth.uid()) and d.status = 'reserved')
        or (d.status = 'ready' and (select private.can_read_source_asset(d.source_asset_id)))
      )
  )
$$;

create function private.can_delete_unfinalized_waveform_peak(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'derived-assets' and exists (
    select 1 from public.waveform_peak_derivatives d
    where d.bucket = p_bucket and d.object_path = p_name
      and d.owner_id = (select auth.uid()) and d.status in ('reserved', 'failed')
  )
$$;

revoke all on function public.reserve_waveform_peaks(uuid, uuid, bigint),
  public.finalize_waveform_peaks(uuid, bigint, text, smallint, text, smallint, integer, integer, integer),
  public.cancel_waveform_peaks(uuid) from public, anon;
grant execute on function public.reserve_waveform_peaks(uuid, uuid, bigint),
  public.finalize_waveform_peaks(uuid, bigint, text, smallint, text, smallint, integer, integer, integer),
  public.cancel_waveform_peaks(uuid) to authenticated;
revoke all on function private.expire_waveform_peak_uploads(),
  private.can_upload_waveform_peak(text, text),
  private.can_read_waveform_peak_object(text, text),
  private.can_delete_unfinalized_waveform_peak(text, text) from public, anon;
grant execute on function private.can_upload_waveform_peak(text, text),
  private.can_read_waveform_peak_object(text, text),
  private.can_delete_unfinalized_waveform_peak(text, text) to authenticated;

create policy reserved_waveform_peak_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'derived-assets'
  and owner_id = (select auth.uid())::text
  and (select private.can_upload_waveform_peak(bucket_id, name))
);

create policy authorized_waveform_peak_read on storage.objects
for select to authenticated using (
  (select private.can_read_waveform_peak_object(bucket_id, name))
);

create policy unfinalized_waveform_peak_delete on storage.objects
for delete to authenticated using (
  (select private.can_delete_unfinalized_waveform_peak(bucket_id, name))
);

create or replace function public.reserve_source_asset(p_request_id uuid,p_expected_byte_size bigint,p_filename text,p_declared_media_type text default null,p_client_duration_ms integer default null,p_expected_sha256 text default null)
returns table(asset_id uuid,bucket text,object_path text,expires_at timestamptz,user_remaining_bytes bigint,global_remaining_bytes bigint,capacity_warning boolean)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.assets%rowtype; v_upload public.asset_uploads%rowtype; v_global public.global_storage_usage%rowtype; v_user public.user_storage_usage%rowtype; v_id uuid;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='asset_unauthenticated'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null) then raise sqlstate 'PT403' using message='asset_actor_ineligible'; end if;
 if p_expected_byte_size not between 1 and 47185920 or p_filename is null or btrim(p_filename)='' or char_length(btrim(p_filename))>255 or (p_client_duration_ms is not null and p_client_duration_ms not between 1 and 600000) or (p_expected_sha256 is not null and p_expected_sha256 !~ '^[0-9a-f]{64}$') then raise sqlstate '22023' using message='asset_invalid_declaration'; end if;
 select * into v_upload from public.asset_uploads u where u.owner_id=v_actor and u.request_id=p_request_id;
 if found then
  select * into v_asset from public.assets a where a.id=v_upload.asset_id;
  if v_upload.expected_byte_size<>p_expected_byte_size or v_upload.client_filename<>btrim(p_filename) or v_upload.client_media_type is distinct from nullif(p_declared_media_type,'') or v_upload.client_duration_ms is distinct from p_client_duration_ms or v_upload.expected_sha256 is distinct from p_expected_sha256 then raise sqlstate '23505' using message='asset_request_conflict'; end if;
  select * into v_global from public.global_storage_usage where singleton; select * into v_user from public.user_storage_usage where user_id=v_actor;
  return query select v_asset.id,v_asset.bucket,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes,891289600-v_global.source_bytes-v_global.reserved_source_bytes-v_global.derived_bytes-v_global.reserved_derived_bytes,(v_global.source_bytes+v_global.reserved_source_bytes+v_global.derived_bytes+v_global.reserved_derived_bytes)>=786432000; return;
 end if;
 select * into v_global from public.global_storage_usage where singleton for update;
 insert into public.user_storage_usage(user_id) values(v_actor) on conflict do nothing;
 select * into v_user from public.user_storage_usage where user_id=v_actor for update;
 if v_user.source_bytes+v_user.reserved_source_bytes+p_expected_byte_size>209715200 then raise sqlstate 'PT429' using message='asset_user_quota_exceeded'; end if;
 if v_global.source_bytes+v_global.reserved_source_bytes+v_global.derived_bytes+v_global.reserved_derived_bytes+p_expected_byte_size>891289600 then raise sqlstate 'PT429' using message='asset_global_quota_exceeded'; end if;
 v_id:=gen_random_uuid();
 insert into public.assets(id,owner_id,object_path,original_filename,declared_media_type,reserved_byte_size) values(v_id,v_actor,v_actor::text||'/'||v_id::text||'/source',btrim(p_filename),nullif(p_declared_media_type,''),p_expected_byte_size) returning * into v_asset;
 insert into public.asset_uploads(asset_id,owner_id,request_id,expected_byte_size,expected_sha256,client_duration_ms,client_filename,client_media_type,expires_at) values(v_id,v_actor,p_request_id,p_expected_byte_size,p_expected_sha256,p_client_duration_ms,btrim(p_filename),nullif(p_declared_media_type,''),statement_timestamp()+interval '24 hours') returning * into v_upload;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where singleton;
 update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where user_id=v_actor;
 return query select v_id,'source-audio'::text,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes-p_expected_byte_size,891289600-v_global.source_bytes-v_global.reserved_source_bytes-v_global.derived_bytes-v_global.reserved_derived_bytes-p_expected_byte_size,(v_global.source_bytes+v_global.reserved_source_bytes+v_global.derived_bytes+v_global.reserved_derived_bytes+p_expected_byte_size)>=786432000;
end$$;
