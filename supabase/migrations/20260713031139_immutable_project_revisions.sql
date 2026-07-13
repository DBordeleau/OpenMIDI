create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  parent_revision_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  publish_request_id uuid not null,
  expected_base_revision_id uuid,
  message text check (message is null or (message = btrim(message) and char_length(message) between 1 and 500)),
  manifest jsonb not null,
  manifest_version smallint not null check (manifest_version = 1),
  engine text not null check (engine = 'waveform-playlist'),
  engine_version text not null check (engine_version = 'browser-15.3.4_playout-12.5.4_tone-15.1.22'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  duration_ms integer not null check (duration_ms >= 0),
  snapshot_asset_id uuid check (snapshot_asset_id is null),
  created_at timestamptz not null default statement_timestamp(),
  unique (project_id, revision_number), unique (project_id, publish_request_id), unique (project_id, id),
  constraint project_revisions_parent_project_fk foreign key (project_id,parent_revision_id) references public.project_revisions(project_id,id) on delete restrict,
  constraint project_revisions_expected_base_project_fk foreign key (project_id,expected_base_revision_id) references public.project_revisions(project_id,id) on delete restrict,
  constraint project_revisions_parent_shape check ((revision_number=1 and parent_revision_id is null) or (revision_number>1 and parent_revision_id is not null)),
  constraint project_revisions_parent_not_self check (parent_revision_id is null or parent_revision_id<>id)
);
create index project_revisions_parent_idx on public.project_revisions(parent_revision_id) where parent_revision_id is not null;
create index project_revisions_expected_base_idx on public.project_revisions(expected_base_revision_id) where expected_base_revision_id is not null;
create index project_revisions_created_by_idx on public.project_revisions(created_by);
create index project_revisions_project_created_idx on public.project_revisions(project_id,created_at desc,id desc);

alter table public.projects add column current_revision_id uuid;
alter table public.projects add constraint projects_project_id_id_uq unique(id,current_revision_id);
alter table public.projects add constraint projects_current_revision_fk foreign key(id,current_revision_id) references public.project_revisions(project_id,id) on delete restrict;
alter table public.projects drop constraint projects_pr06_lifecycle_check;
alter table public.projects add constraint projects_revision_lifecycle_check check (
  visibility='private' and not open_to_contributions and deleted_at is null and
  ((status='draft' and current_revision_id is null and published_at is null) or
   (status='active' and current_revision_id is not null and published_at is not null))
);

create table public.revision_tracks (
  revision_id uuid not null references public.project_revisions(id) on delete restrict,
  id uuid not null, asset_id uuid not null references public.assets(id) on delete restrict,
  instrument_id uuid references public.instruments(id) on delete restrict,
  name text not null check(name=btrim(name) and char_length(name) between 1 and 120),
  position_ms integer not null check(position_ms>=0), trim_start_ms integer not null check(trim_start_ms>=0), duration_ms integer not null check(duration_ms>0),
  gain_db numeric not null check(gain_db between -60 and 6), pan numeric not null check(pan between -1 and 1),
  muted boolean not null, soloed boolean not null, sort_order smallint not null check(sort_order between 0 and 11),
  added_by uuid not null references public.profiles(id) on delete restrict,
  primary key(revision_id,id), unique(revision_id,asset_id), unique(revision_id,sort_order)
);
create index revision_tracks_asset_idx on public.revision_tracks(asset_id);
create index revision_tracks_instrument_idx on public.revision_tracks(instrument_id) where instrument_id is not null;
create index revision_tracks_added_by_idx on public.revision_tracks(added_by);

create table public.project_asset_references (
 project_id uuid not null references public.projects(id) on delete restrict, asset_id uuid not null references public.assets(id) on delete restrict,
 first_revision_id uuid not null, added_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default statement_timestamp(),
 primary key(project_id,asset_id), foreign key(project_id,first_revision_id) references public.project_revisions(project_id,id) on delete restrict
);
create index project_asset_references_asset_idx on public.project_asset_references(asset_id);
create index project_asset_references_first_revision_idx on public.project_asset_references(first_revision_id);
create index project_asset_references_added_by_idx on public.project_asset_references(added_by);
create table public.project_storage_usage(project_id uuid primary key references public.projects(id) on delete restrict, source_bytes bigint not null default 0 check(source_bytes>=0), unique_source_count integer not null default 0 check(unique_source_count>=0), updated_at timestamptz not null default statement_timestamp());
create table public.activity_events(id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id) on delete restrict, project_id uuid not null references public.projects(id) on delete restrict, subject_id uuid not null, event_type text not null check(event_type='project_revision_published'), payload jsonb not null check(jsonb_typeof(payload)='object' and payload ? 'revisionNumber' and payload-'revisionNumber'='{}'::jsonb and jsonb_typeof(payload->'revisionNumber')='number'), created_at timestamptz not null default statement_timestamp(), foreign key(project_id,subject_id) references public.project_revisions(project_id,id) on delete restrict);
create index activity_events_project_created_idx on public.activity_events(project_id,created_at desc);
create index activity_events_actor_idx on public.activity_events(actor_id);
create index activity_events_subject_idx on public.activity_events(subject_id);

create function private.reject_immutable_change() returns trigger language plpgsql set search_path='' as $$ begin raise exception using errcode='55000',message='immutable_revision_history'; end $$;
create trigger project_revisions_immutable before update or delete on public.project_revisions for each row execute function private.reject_immutable_change();
create trigger revision_tracks_immutable before update or delete on public.revision_tracks for each row execute function private.reject_immutable_change();
create trigger project_asset_references_immutable before update or delete on public.project_asset_references for each row execute function private.reject_immutable_change();
create trigger activity_events_immutable before update or delete on public.activity_events for each row execute function private.reject_immutable_change();

alter table public.project_revisions enable row level security; alter table public.revision_tracks enable row level security; alter table public.project_asset_references enable row level security; alter table public.project_storage_usage enable row level security; alter table public.activity_events enable row level security;
revoke all on public.project_revisions,public.revision_tracks,public.project_asset_references,public.project_storage_usage,public.activity_events from public,anon,authenticated;
grant select on public.project_revisions,public.revision_tracks,public.project_asset_references,public.project_storage_usage,public.activity_events to authenticated;
create policy member_revisions_read on public.project_revisions for select to authenticated using((select private.is_active_project_actor()) and exists(select 1 from public.project_members m where m.project_id=project_revisions.project_id and m.user_id=(select auth.uid())));
create policy member_revision_tracks_read on public.revision_tracks for select to authenticated using((select private.is_active_project_actor()) and exists(select 1 from public.project_revisions r join public.project_members m on m.project_id=r.project_id where r.id=revision_tracks.revision_id and m.user_id=(select auth.uid())));
create policy member_project_assets_read on public.project_asset_references for select to authenticated using((select private.is_active_project_actor()) and exists(select 1 from public.project_members m where m.project_id=project_asset_references.project_id and m.user_id=(select auth.uid())));
create policy member_project_usage_read on public.project_storage_usage for select to authenticated using((select private.is_active_project_actor()) and exists(select 1 from public.project_members m where m.project_id=project_storage_usage.project_id and m.user_id=(select auth.uid())));
create policy member_activity_read on public.activity_events for select to authenticated using((select private.is_active_project_actor()) and exists(select 1 from public.project_members m where m.project_id=activity_events.project_id and m.user_id=(select auth.uid())));

create type private.manifest_track as ("trackId" uuid,"assetId" uuid,"instrumentId" uuid,"name" text,"positionMs" integer,"trimStartMs" integer,"durationMs" integer,"gainDb" numeric,"pan" numeric,"muted" boolean,"soloed" boolean,"sortOrder" integer);
create function public.publish_project_revision(p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid,p_message text,p_manifest jsonb)
returns table(revision_id uuid,revision_number integer,created_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_existing public.project_revisions%rowtype; v_revision public.project_revisions%rowtype; v_tracks private.manifest_track[]; v_canonical jsonb; v_checksum text; v_duration integer; v_count integer; v_added_bytes bigint; v_added_count integer; v_message text:=nullif(btrim(p_message),'');
begin
 if v_actor is null then raise sqlstate 'PT401' using message='publish_unauthenticated'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null) then raise sqlstate 'PT403' using message='publish_actor_ineligible'; end if;
 if p_project_id is null or p_request_id is null or (v_message is not null and char_length(v_message)>500) then raise sqlstate '22023' using message='publish_invalid_input'; end if;
 select * into v_project from public.projects p where p.id=p_project_id for update;
 if not found or v_project.owner_id<>v_actor or not exists(select 1 from public.project_members m where m.project_id=p_project_id and m.user_id=v_actor and m.role='owner') then raise sqlstate 'PT404' using message='publish_project_not_found'; end if;
 select * into v_existing from public.project_revisions r where r.project_id=p_project_id and r.publish_request_id=p_request_id;
 if found then
   if v_existing.expected_base_revision_id is not distinct from p_expected_current_revision_id and v_existing.message is not distinct from v_message and v_existing.manifest=p_manifest then return query select v_existing.id,v_existing.revision_number,v_existing.created_at; return; end if;
   raise sqlstate 'PT409' using message='publish_request_conflict';
 end if;
 if v_project.visibility<>'private' or v_project.status not in ('draft','active') or v_project.deleted_at is not null then raise sqlstate 'PT409' using message='publish_project_unavailable'; end if;
 if v_project.current_revision_id is distinct from p_expected_current_revision_id then raise sqlstate 'PT409' using message='publish_stale_revision'; end if;
 if v_project.bpm is null then raise sqlstate '22023' using message='publish_bpm_required'; end if;
 if jsonb_typeof(p_manifest)<>'object' or not (p_manifest ?& array['manifestVersion','engine','engineVersion','workspaceId','tempoBpm','tracks']) or (select count(*) from jsonb_object_keys(p_manifest))<>6 or p_manifest->>'manifestVersion'<>'1' or p_manifest->>'engine'<>'waveform-playlist' or p_manifest->>'engineVersion'<>'browser-15.3.4_playout-12.5.4_tone-15.1.22' or p_manifest->>'workspaceId'<>p_project_id::text or jsonb_typeof(p_manifest->'tracks')<>'array' then raise sqlstate '22023' using message='publish_invalid_manifest'; end if;
 begin if (p_manifest->>'tempoBpm')::numeric<>v_project.bpm then raise sqlstate '22023' using message='publish_bpm_mismatch'; end if; exception when invalid_text_representation then raise sqlstate '22023' using message='publish_invalid_manifest'; end;
 v_count:=jsonb_array_length(p_manifest->'tracks'); if v_count not between 1 and 12 then raise sqlstate '22023' using message='publish_track_limit'; end if;
 select array_agg(row(x.*)::private.manifest_track) into v_tracks from jsonb_to_recordset(p_manifest->'tracks') as x("trackId" uuid,"assetId" uuid,"instrumentId" uuid,"name" text,"positionMs" integer,"trimStartMs" integer,"durationMs" integer,"gainDb" numeric,"pan" numeric,"muted" boolean,"soloed" boolean,"sortOrder" integer);
 if exists(select 1 from jsonb_array_elements(p_manifest->'tracks') t where jsonb_typeof(t)<>'object' or not (t ?& array['trackId','assetId','instrumentId','name','positionMs','trimStartMs','durationMs','gainDb','pan','muted','soloed','sortOrder']) or (select count(*) from jsonb_object_keys(t))<>12) then raise sqlstate '22023' using message='publish_invalid_manifest'; end if;
 if (select count(*) from unnest(v_tracks))<>v_count or exists(select 1 from unnest(v_tracks) t where t."trackId" is null or t."assetId" is null or t."name" is null or t."name"<>btrim(t."name") or char_length(t."name") not between 1 and 120 or t."positionMs"<0 or t."trimStartMs"<0 or t."durationMs"<=0 or t."gainDb" not between -60 and 6 or t."pan" not between -1 and 1 or t."muted" is null or t."soloed" is null or t."sortOrder" not between 0 and v_count-1) or (select count(distinct "trackId") from unnest(v_tracks))<>v_count or (select count(distinct "assetId") from unnest(v_tracks))<>v_count or (select count(distinct "sortOrder") from unnest(v_tracks))<>v_count then raise sqlstate '22023' using message='publish_invalid_manifest'; end if;
 if exists(select 1 from unnest(v_tracks) t left join public.assets a on a.id=t."assetId" left join public.instruments i on i.id=t."instrumentId" where a.id is null or a.owner_id<>v_actor or a.kind<>'source_audio' or a.status<>'ready' or a.deleted_at is not null or a.duration_ms is null or t."trimStartMs"+t."durationMs">a.duration_ms or (t."instrumentId" is not null and (i.id is null or not i.is_active))) then raise sqlstate 'PT409' using message='publish_asset_unavailable'; end if;
 select coalesce(max("positionMs"+"durationMs"),0) into v_duration from unnest(v_tracks);
 select jsonb_build_object('manifestVersion',1,'engine','waveform-playlist','engineVersion','browser-15.3.4_playout-12.5.4_tone-15.1.22','workspaceId',p_project_id,'tempoBpm',v_project.bpm,'tracks',jsonb_agg(jsonb_build_object('trackId',"trackId",'assetId',"assetId",'instrumentId',"instrumentId",'name',"name",'positionMs',"positionMs",'trimStartMs',"trimStartMs",'durationMs',"durationMs",'gainDb',"gainDb",'pan',"pan",'muted',"muted",'soloed',"soloed",'sortOrder',"sortOrder") order by "sortOrder")) into v_canonical from unnest(v_tracks);
 if p_manifest<>v_canonical then raise sqlstate '22023' using message='publish_manifest_not_canonical'; end if;
 v_checksum:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
 insert into public.project_storage_usage(project_id) values(p_project_id) on conflict do nothing; perform 1 from public.project_storage_usage where project_id=p_project_id for update;
 select coalesce(sum(a.byte_size),0),count(*) into v_added_bytes,v_added_count from unnest(v_tracks) t join public.assets a on a.id=t."assetId" left join public.project_asset_references r on r.project_id=p_project_id and r.asset_id=a.id where r.asset_id is null;
 if (select source_bytes from public.project_storage_usage where project_id=p_project_id)+v_added_bytes>262144000 then raise sqlstate 'PT429' using message='publish_project_quota_exceeded'; end if;
 insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,publish_request_id,expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms) values(p_project_id,case when v_project.current_revision_id is null then 1 else (select r.revision_number+1 from public.project_revisions r where r.id=v_project.current_revision_id) end,v_project.current_revision_id,v_actor,p_request_id,p_expected_current_revision_id,v_message,v_canonical,1,'waveform-playlist','browser-15.3.4_playout-12.5.4_tone-15.1.22',v_checksum,v_duration) returning * into v_revision;
 insert into public.revision_tracks select v_revision.id,"trackId","assetId","instrumentId","name","positionMs","trimStartMs","durationMs","gainDb","pan","muted","soloed","sortOrder",v_actor from unnest(v_tracks);
 insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by) select p_project_id,"assetId",v_revision.id,v_actor from unnest(v_tracks) on conflict do nothing;
 update public.project_storage_usage set source_bytes=source_bytes+v_added_bytes,unique_source_count=unique_source_count+v_added_count,updated_at=statement_timestamp() where project_id=p_project_id;
 insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload) values(v_actor,p_project_id,v_revision.id,'project_revision_published',jsonb_build_object('revisionNumber',v_revision.revision_number));
 update public.projects set current_revision_id=v_revision.id,status='active',published_at=coalesce(published_at,statement_timestamp()),lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_project_id;
 return query select v_revision.id,v_revision.revision_number,v_revision.created_at;
exception when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then raise sqlstate '22023' using message='publish_invalid_manifest';
end $$;

create function private.project_storage_usage_drift() returns table(project_id uuid,expected_bytes bigint,recorded_bytes bigint,expected_count bigint,recorded_count integer) language sql security definer set search_path='' as $$ select u.project_id,coalesce(sum(a.byte_size),0),u.source_bytes,count(r.asset_id),u.unique_source_count from public.project_storage_usage u left join public.project_asset_references r on r.project_id=u.project_id left join public.assets a on a.id=r.asset_id group by u.project_id,u.source_bytes,u.unique_source_count having coalesce(sum(a.byte_size),0)<>u.source_bytes or count(r.asset_id)<>u.unique_source_count $$;
revoke all on function private.reject_immutable_change(),private.project_storage_usage_drift() from public,anon,authenticated;
revoke all on function public.publish_project_revision(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.publish_project_revision(uuid,uuid,uuid,text,jsonb) to authenticated;

comment on table public.project_revisions is 'Immutable canonical Jam Session project revisions.';

-- Published private projects retain the PR 06 metadata command; history remains immutable.
create or replace function public.update_project_metadata(p_project_id uuid,p_expected_lock_version integer,p_title text,p_description text,p_bpm numeric,p_musical_key text,p_time_signature_numerator smallint,p_time_signature_denominator smallint,p_license_code text,p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[])
returns table(id uuid,title text,lock_version integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_description text:=nullif(btrim(p_description),''); v_changed boolean;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
 if not exists(select 1 from public.profiles where profiles.id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
 select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.status in ('draft','active') and p.deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='project_not_found'; end if;
 if v_project.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='project_edit_conflict'; end if;
 if p_title is null or p_title<>btrim(p_title) or char_length(p_title) not between 1 and 120 or (p_description is not null and (p_description<>btrim(p_description) or char_length(p_description)>5000)) or (p_bpm is not null and (p_bpm not between 20 and 400 or scale(p_bpm)>3)) or p_time_signature_numerator not between 1 and 32 or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
 if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10 or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x) or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x) or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}'))) then raise sqlstate 'PT400' using message='project_taxonomy_invalid'; end if;
 if not exists(select 1 from public.licenses where code=p_license_code and is_active) or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g on g.id=x and g.is_active where g.id is null) or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t on t.id=x and t.is_active where t.id is null) then raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
 v_changed := v_project.title<>p_title or v_project.description is distinct from v_description or v_project.bpm is distinct from p_bpm or v_project.musical_key is distinct from p_musical_key or v_project.time_signature_numerator<>p_time_signature_numerator or v_project.time_signature_denominator<>p_time_signature_denominator or v_project.license_code<>p_license_code or (select coalesce(array_agg(genre_id order by genre_id),'{}'::uuid[]) from public.project_genres where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_genre_ids,'{}')) x) or (select coalesce(array_agg(tag_id order by tag_id),'{}'::uuid[]) from public.project_tags where project_id=p_project_id)<>(select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(coalesce(p_tag_ids,'{}')) x) or (select genre_id from public.project_genres where project_id=p_project_id and is_primary) is distinct from p_primary_genre_id;
 if v_changed then delete from public.project_genres where project_id=p_project_id; delete from public.project_tags where project_id=p_project_id; insert into public.project_genres(project_id,genre_id,is_primary) select p_project_id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x; insert into public.project_tags(project_id,tag_id) select p_project_id,x from unnest(coalesce(p_tag_ids,'{}')) x; update public.projects p set title=p_title,description=v_description,bpm=p_bpm,musical_key=p_musical_key,time_signature_numerator=p_time_signature_numerator,time_signature_denominator=p_time_signature_denominator,license_code=p_license_code,lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id; end if;
 return query select p.id,p.title,p.lock_version from public.projects p where p.id=p_project_id;
end $$;
