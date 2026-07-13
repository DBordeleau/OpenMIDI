begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(18);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000001','authenticated','authenticated','publisher@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000002','authenticated','authenticated','stranger@example.test','','{}','{}',now(),now());
update public.profiles set username='Publisher',username_normalized='publisher',display_name='Publisher',credit_name='Publisher',profile_completed_at=now() where id='80000000-0000-4000-8000-000000000001';
update public.profiles set username='Stranger',username_normalized='stranger',display_name='Stranger',credit_name='Stranger',profile_completed_at=now() where id='80000000-0000-4000-8000-000000000002';
insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000011','Publish me',120,'all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by) values('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','owner','80000000-0000-4000-8000-000000000001');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values
('82000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','ready','80000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000001/source','one.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now()),
('82000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001','ready','80000000-0000-4000-8000-000000000001/82000000-0000-4000-8000-000000000002/source','two.wav',2000,'audio/wav',2000,repeat('b',64),2000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values('82000000-0000-4000-8000-000000000001',0,'80000000-0000-4000-8000-000000000001','Publisher','creator'),('82000000-0000-4000-8000-000000000002',0,'80000000-0000-4000-8000-000000000001','Publisher','creator');
update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where status='ready';
set local role authenticated; set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',null,'First publish','{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"81000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"84000000-0000-4000-8000-000000000001","assetId":"82000000-0000-4000-8000-000000000001","instrumentId":null,"name":"One","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0},{"trackId":"84000000-0000-4000-8000-000000000002","assetId":"82000000-0000-4000-8000-000000000002","instrumentId":null,"name":"Two","positionMs":0,"trimStartMs":0,"durationMs":2000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":1}]}'::jsonb)$$,'publishes two stems');
reset role;
select is((select count(*) from public.project_revisions),1::bigint,'one revision');
select is((select revision_number from public.project_revisions),1,'first number');
select is((select parent_revision_id from public.project_revisions),null::uuid,'first parent null');
select is((select count(*) from public.revision_tracks),2::bigint,'two projected tracks');
select is((select count(*) from public.project_asset_references),2::bigint,'two references');
select is((select source_bytes from public.project_storage_usage),3000::bigint,'unique bytes counted');
select is((select unique_source_count from public.project_storage_usage),2,'unique assets counted');
select is((select count(*) from public.activity_events),1::bigint,'one event');
select is((select status::text from public.projects),'active','project active');
select isnt((select current_revision_id from public.projects),null::uuid,'pointer set');
select is((select duration_ms from public.project_revisions),2000,'duration projected');
select ok((select char_length(manifest_sha256)=64 from public.project_revisions),'checksum stored');
set local role authenticated; set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',null,'First publish','{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"81000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"84000000-0000-4000-8000-000000000001","assetId":"82000000-0000-4000-8000-000000000001","instrumentId":null,"name":"One","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0},{"trackId":"84000000-0000-4000-8000-000000000002","assetId":"82000000-0000-4000-8000-000000000002","instrumentId":null,"name":"Two","positionMs":0,"trimStartMs":0,"durationMs":2000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":1}]}'::jsonb)$$,'retry succeeds');
reset role; select is((select count(*) from public.project_revisions),1::bigint,'retry no duplicate');
set local role authenticated; set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000002';
select is((select count(*) from public.project_revisions),0::bigint,'unrelated cannot read');
select throws_ok($$select public.publish_project_revision('81000000-0000-4000-8000-000000000001',gen_random_uuid(),null,null,'{}')$$,'PT404','publish_project_not_found','unrelated gets not found');
reset role;
select throws_ok($$update public.project_revisions set message='changed'$$,'55000','immutable_revision_history','revision immutable');
select * from finish(); rollback;
