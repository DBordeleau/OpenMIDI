create type public.asset_kind as enum ('source_audio','workspace_snapshot','mix_preview','waveform_peaks','image');
create type public.asset_status as enum ('reserved','uploading','processing','ready','failed','deleted');
create type public.asset_credit_role as enum ('creator','performer','producer','engineer','other');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind public.asset_kind not null default 'source_audio',
  status public.asset_status not null default 'reserved',
  bucket text not null default 'source-audio', object_path text not null,
  original_filename text not null, declared_media_type text,
  reserved_byte_size bigint not null,
  media_type text, byte_size bigint, sha256 text, duration_ms integer, sample_rate_hz integer, channels smallint,
  verification_version text, failure_code text,
  created_at timestamptz not null default statement_timestamp(), upload_completed_at timestamptz,
  ready_at timestamptz, failed_at timestamptz, deleted_at timestamptz,
  constraint assets_object_path_uq unique(bucket,object_path),
  constraint assets_source_check check(kind='source_audio' and bucket='source-audio'),
  constraint assets_path_check check(object_path=owner_id::text||'/'||id::text||'/source'),
  constraint assets_filename_check check(original_filename=btrim(original_filename) and char_length(original_filename) between 1 and 255),
  constraint assets_reserved_size_check check(reserved_byte_size between 1 and 47185920),
  constraint assets_sha_check check(sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint assets_ready_check check((status='ready' and media_type in ('audio/wav','audio/flac','audio/mpeg') and byte_size between 1 and 47185920 and sha256 is not null and duration_ms between 1 and 600000 and sample_rate_hz between 8000 and 192000 and channels between 1 and 8 and verification_version is not null and ready_at is not null and failure_code is null and failed_at is null) or (status<>'ready' and ready_at is null)),
  constraint assets_failed_check check((status='failed' and failure_code is not null and failed_at is not null) or (status<>'failed' and failed_at is null))
);
create index assets_owner_status_created_idx on public.assets(owner_id,status,created_at desc);

create table public.asset_uploads (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null, expected_byte_size bigint not null check(expected_byte_size between 1 and 47185920),
  expected_sha256 text check(expected_sha256 is null or expected_sha256 ~ '^[0-9a-f]{64}$'),
  client_duration_ms integer check(client_duration_ms is null or client_duration_ms between 1 and 600000),
  client_filename text not null, client_media_type text, expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  unique(owner_id,request_id)
);
create index asset_uploads_expiry_idx on public.asset_uploads(expires_at);
create table public.asset_credits (
  asset_id uuid not null references public.assets(id) on delete restrict, position smallint not null check(position>=0),
  user_id uuid references public.profiles(id) on delete restrict, credit_name text not null check(credit_name=btrim(credit_name) and char_length(credit_name) between 1 and 120),
  role public.asset_credit_role not null, created_at timestamptz not null default statement_timestamp(), primary key(asset_id,position)
);
create unique index asset_credits_user_role_uq on public.asset_credits(asset_id,user_id,role) where user_id is not null;
create table public.user_storage_usage(user_id uuid primary key references public.profiles(id) on delete restrict,source_bytes bigint not null default 0 check(source_bytes>=0),reserved_source_bytes bigint not null default 0 check(reserved_source_bytes>=0),updated_at timestamptz not null default statement_timestamp());
create table public.global_storage_usage(singleton boolean primary key default true check(singleton),source_bytes bigint not null default 0 check(source_bytes>=0),reserved_source_bytes bigint not null default 0 check(reserved_source_bytes>=0),updated_at timestamptz not null default statement_timestamp());
insert into public.global_storage_usage(singleton) values(true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('source-audio','source-audio',false,47185920,array['audio/wav','audio/x-wav','audio/flac','audio/mpeg']),('workspace-snapshots','workspace-snapshots',false,null,null),('derived-assets','derived-assets',false,null,null)
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.assets enable row level security; alter table public.asset_uploads enable row level security; alter table public.asset_credits enable row level security; alter table public.user_storage_usage enable row level security; alter table public.global_storage_usage enable row level security;
revoke all on public.assets,public.asset_uploads,public.asset_credits,public.user_storage_usage,public.global_storage_usage from public,anon,authenticated;
grant select on public.assets,public.asset_credits to authenticated;
create policy owned_assets_read on public.assets for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_active_project_actor()));
create policy owned_credits_read on public.asset_credits for select to authenticated using(exists(select 1 from public.assets a where a.id=asset_id and a.owner_id=(select auth.uid())) and (select private.is_active_project_actor()));

create function public.reserve_source_asset(p_request_id uuid,p_expected_byte_size bigint,p_filename text,p_declared_media_type text default null,p_client_duration_ms integer default null,p_expected_sha256 text default null)
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
  return query select v_asset.id,v_asset.bucket,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes,891289600-v_global.source_bytes-v_global.reserved_source_bytes,(v_global.source_bytes+v_global.reserved_source_bytes)>=786432000; return;
 end if;
 select * into v_global from public.global_storage_usage where singleton for update;
 insert into public.user_storage_usage(user_id) values(v_actor) on conflict do nothing;
 select * into v_user from public.user_storage_usage where user_id=v_actor for update;
 if v_user.source_bytes+v_user.reserved_source_bytes+p_expected_byte_size>209715200 then raise sqlstate 'PT429' using message='asset_user_quota_exceeded'; end if;
 if v_global.source_bytes+v_global.reserved_source_bytes+p_expected_byte_size>891289600 then raise sqlstate 'PT429' using message='asset_global_quota_exceeded'; end if;
 v_id:=gen_random_uuid();
 insert into public.assets(id,owner_id,object_path,original_filename,declared_media_type,reserved_byte_size) values(v_id,v_actor,v_actor::text||'/'||v_id::text||'/source',btrim(p_filename),nullif(p_declared_media_type,''),p_expected_byte_size) returning * into v_asset;
 insert into public.asset_uploads(asset_id,owner_id,request_id,expected_byte_size,expected_sha256,client_duration_ms,client_filename,client_media_type,expires_at) values(v_id,v_actor,p_request_id,p_expected_byte_size,p_expected_sha256,p_client_duration_ms,btrim(p_filename),nullif(p_declared_media_type,''),statement_timestamp()+interval '24 hours') returning * into v_upload;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where singleton;
 update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where user_id=v_actor;
 return query select v_id,'source-audio'::text,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes-p_expected_byte_size,891289600-v_global.source_bytes-v_global.reserved_source_bytes-p_expected_byte_size,(v_global.source_bytes+v_global.reserved_source_bytes+p_expected_byte_size)>=786432000;
end$$;

create function public.complete_source_upload(p_asset_id uuid) returns public.asset_status language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.assets%rowtype; v_size bigint;
begin
 select * into v_asset from public.assets a where a.id=p_asset_id and a.owner_id=v_actor for update; if not found then raise sqlstate 'PT404' using message='asset_not_found'; end if;
 if v_asset.status='processing' then return v_asset.status; end if; if v_asset.status not in ('reserved','uploading') then raise sqlstate 'PT409' using message='asset_not_completable'; end if;
 select (metadata->>'size')::bigint into v_size from storage.objects where bucket_id=v_asset.bucket and name=v_asset.object_path;
 if v_size is null then raise sqlstate 'PT409' using message='asset_object_missing'; end if; if v_size<>v_asset.reserved_byte_size then raise sqlstate 'PT409' using message='asset_size_mismatch'; end if;
 update public.assets set status='processing',upload_completed_at=statement_timestamp() where id=p_asset_id; return 'processing'::public.asset_status;
end$$;

create function public.cancel_source_upload(p_asset_id uuid) returns public.asset_status language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.assets%rowtype;
begin select * into v_asset from public.assets a where a.id=p_asset_id and a.owner_id=v_actor for update; if not found then raise sqlstate 'PT404' using message='asset_not_found'; end if; if v_asset.status='failed' then return v_asset.status; end if; if v_asset.status in ('ready','deleted') then raise sqlstate 'PT409' using message='asset_not_cancellable'; end if;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size,updated_at=statement_timestamp() where singleton; update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size,updated_at=statement_timestamp() where user_id=v_actor; update public.assets set status='failed',failure_code='cancelled',failed_at=statement_timestamp() where id=p_asset_id; return 'failed'::public.asset_status; end$$;

create function private.promote_source_asset(p_asset_id uuid,p_media_type text,p_byte_size bigint,p_sha256 text,p_duration_ms integer,p_sample_rate_hz integer,p_channels smallint,p_verification_version text) returns void language plpgsql security definer set search_path='' as $$
declare v_asset public.assets%rowtype; v_credit text;
begin select * into v_asset from public.assets where id=p_asset_id for update; if not found or v_asset.status<>'processing' then raise exception 'asset_not_processing'; end if; if p_byte_size<>v_asset.reserved_byte_size then raise exception 'asset_size_mismatch'; end if; select credit_name into v_credit from public.profiles where id=v_asset.owner_id;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size,source_bytes=source_bytes+p_byte_size,updated_at=statement_timestamp() where singleton; update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size,source_bytes=source_bytes+p_byte_size,updated_at=statement_timestamp() where user_id=v_asset.owner_id;
 update public.assets set status='ready',media_type=p_media_type,byte_size=p_byte_size,sha256=p_sha256,duration_ms=p_duration_ms,sample_rate_hz=p_sample_rate_hz,channels=p_channels,verification_version=p_verification_version,ready_at=statement_timestamp() where id=p_asset_id; insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values(p_asset_id,0,v_asset.owner_id,v_credit,'creator'); end$$;
create function private.fail_source_asset(p_asset_id uuid,p_failure_code text) returns void language plpgsql security definer set search_path='' as $$ declare v_asset public.assets%rowtype; begin select * into v_asset from public.assets where id=p_asset_id for update; if not found then raise exception 'asset_not_found'; end if; if v_asset.status='failed' then return; end if; if v_asset.status='ready' then raise exception 'asset_ready'; end if; update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size where singleton; update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes-v_asset.reserved_byte_size where user_id=v_asset.owner_id; update public.assets set status='failed',failure_code=p_failure_code,failed_at=statement_timestamp() where id=p_asset_id; end$$;
create function public.operator_promote_source_asset(p_asset_id uuid,p_media_type text,p_byte_size bigint,p_sha256 text,p_duration_ms integer,p_sample_rate_hz integer,p_channels smallint,p_verification_version text) returns void language sql security definer set search_path='' as $$ select private.promote_source_asset(p_asset_id,p_media_type,p_byte_size,p_sha256,p_duration_ms,p_sample_rate_hz,p_channels,p_verification_version) $$;
create function public.operator_fail_source_asset(p_asset_id uuid,p_failure_code text) returns void language sql security definer set search_path='' as $$ select private.fail_source_asset(p_asset_id,p_failure_code) $$;
create function private.expire_source_assets() returns bigint language plpgsql security definer set search_path='' as $$ declare r record; n bigint:=0; begin for r in select a.id from public.assets a join public.asset_uploads u on u.asset_id=a.id where a.status in ('reserved','uploading') and u.expires_at<=statement_timestamp() for update of a loop perform private.fail_source_asset(r.id,'expired'); n:=n+1; end loop; return n; end$$;
create function private.asset_quota_drift() returns table(scope text,owner_id uuid,expected_ready bigint,expected_reserved bigint,recorded_ready bigint,recorded_reserved bigint) language sql security definer set search_path='' as $$ select 'global',null::uuid,coalesce(sum(coalesce(a.byte_size,0)) filter(where a.status='ready'),0),coalesce(sum(a.reserved_byte_size) filter(where a.status in ('reserved','uploading','processing')),0),g.source_bytes,g.reserved_source_bytes from public.global_storage_usage g left join public.assets a on true group by g.source_bytes,g.reserved_source_bytes union all select 'user',u.user_id,coalesce(sum(coalesce(a.byte_size,0)) filter(where a.status='ready'),0),coalesce(sum(a.reserved_byte_size) filter(where a.status in ('reserved','uploading','processing')),0),u.source_bytes,u.reserved_source_bytes from public.user_storage_usage u left join public.assets a on a.owner_id=u.user_id group by u.user_id,u.source_bytes,u.reserved_source_bytes $$;

revoke execute on function public.reserve_source_asset(uuid,bigint,text,text,integer,text),public.complete_source_upload(uuid),public.cancel_source_upload(uuid) from public,anon;
grant execute on function public.reserve_source_asset(uuid,bigint,text,text,integer,text),public.complete_source_upload(uuid),public.cancel_source_upload(uuid) to authenticated;
revoke all on function private.promote_source_asset(uuid,text,bigint,text,integer,integer,smallint,text),private.fail_source_asset(uuid,text),private.expire_source_assets(),private.asset_quota_drift() from public,anon,authenticated;
revoke all on function public.operator_promote_source_asset(uuid,text,bigint,text,integer,integer,smallint,text),public.operator_fail_source_asset(uuid,text) from public,anon,authenticated;
grant execute on function public.operator_promote_source_asset(uuid,text,bigint,text,integer,integer,smallint,text),public.operator_fail_source_asset(uuid,text) to service_role;
create policy reserved_source_insert on storage.objects for insert to authenticated with check(bucket_id='source-audio' and exists(select 1 from public.assets a join public.asset_uploads u on u.asset_id=a.id where a.owner_id=(select auth.uid()) and a.bucket=bucket_id and a.object_path=name and a.status in ('reserved','uploading') and u.expires_at>statement_timestamp()));
create policy owned_source_read on storage.objects for select to authenticated using(bucket_id='source-audio' and exists(select 1 from public.assets a where a.owner_id=(select auth.uid()) and a.bucket=bucket_id and a.object_path=name and a.status in ('processing','ready')));

create function private.protect_asset_immutability() returns trigger language plpgsql set search_path='' as $$ begin if old.owner_id<>new.owner_id or old.kind<>new.kind or old.bucket<>new.bucket or old.object_path<>new.object_path or (old.status='ready' and new is distinct from old) then raise exception 'immutable_asset'; end if; return new; end$$;
create trigger assets_immutable before update on public.assets for each row execute function private.protect_asset_immutability();
revoke all on function private.protect_asset_immutability() from public,anon,authenticated;
