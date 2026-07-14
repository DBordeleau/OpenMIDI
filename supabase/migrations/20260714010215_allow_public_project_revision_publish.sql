-- Public discovery was introduced after the canonical revision publisher and
-- made active projects eligible to switch between private and public. Later
-- revisions must remain publishable in either visibility state.
create or replace function public.publish_project_revision(p_project_id uuid,p_request_id uuid,p_expected_current_revision_id uuid,p_message text,p_manifest jsonb)
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
 if v_project.status not in ('draft','active') or v_project.deleted_at is not null then raise sqlstate 'PT409' using message='publish_project_unavailable'; end if;
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

revoke all on function public.publish_project_revision(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.publish_project_revision(uuid,uuid,uuid,text,jsonb) to authenticated;
