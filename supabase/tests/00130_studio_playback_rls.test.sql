begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000001','authenticated','authenticated','studio-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000002','authenticated','authenticated','studio-member@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000003','authenticated','authenticated','studio-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000004','authenticated','authenticated','studio-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='StudioOwner',username_normalized='studioowner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='90000000-0000-4000-8000-000000000001';
update public.profiles set username='StudioMember',username_normalized='studiomember',display_name='Member',credit_name='Member',profile_completed_at=now() where id='90000000-0000-4000-8000-000000000002';
update public.profiles set username='StudioStranger',username_normalized='studiostranger',display_name='Stranger',credit_name='Stranger',profile_completed_at=now() where id='90000000-0000-4000-8000-000000000003';
update public.profiles set username='StudioSuspended',username_normalized='studiosuspended',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='90000000-0000-4000-8000-000000000004';
insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000011','Studio',120,'all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by) values
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','owner','90000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','viewer','90000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','viewer','90000000-0000-4000-8000-000000000001');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values
('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','ready','90000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000001/source','one.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now()),
('92000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','ready','90000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000002/source','unreferenced.wav',1000,'audio/wav',1000,repeat('b',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values
('92000000-0000-4000-8000-000000000001',0,'90000000-0000-4000-8000-000000000001','Owner','creator'),
('92000000-0000-4000-8000-000000000002',0,'90000000-0000-4000-8000-000000000001','Owner','creator');
update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where status='ready';
set local role authenticated; set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',null,null,'{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"91000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"94000000-0000-4000-8000-000000000001","assetId":"92000000-0000-4000-8000-000000000001","instrumentId":null,"name":"One","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb)$$,'owner publishes');
reset role;
insert into storage.objects(id,bucket_id,name,owner_id) values
(gen_random_uuid(),'source-audio','90000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000001/source','90000000-0000-4000-8000-000000000001'),
(gen_random_uuid(),'source-audio','90000000-0000-4000-8000-000000000001/92000000-0000-4000-8000-000000000002/source','90000000-0000-4000-8000-000000000001'),
(gen_random_uuid(),'source-audio','mismatched/path','90000000-0000-4000-8000-000000000001');

set local role authenticated; set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';
select is((select count(*) from public.assets where id='92000000-0000-4000-8000-000000000001'),1::bigint,'owner reads ready asset');
select is((select count(*) from storage.objects where name like '%92000000-0000-4000-8000-000000000001%'),1::bigint,'owner reads matching object');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000002';
select is((select count(*) from public.projects where id='91000000-0000-4000-8000-000000000001'),1::bigint,'member reads project');
select is((select count(*) from public.assets),1::bigint,'member reads only referenced asset');
select is((select count(*) from storage.objects),1::bigint,'member reads only referenced matching object');
select is((select count(*) from public.project_revisions),1::bigint,'member reads revision');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000003';
select is((select count(*) from public.assets),0::bigint,'unrelated actor reads no assets');
select is((select count(*) from storage.objects),0::bigint,'unrelated actor reads no objects');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000004';
select is((select count(*) from public.assets),0::bigint,'suspended member reads no assets');
reset role; set local role anon;
select throws_ok($$select count(*) from public.assets$$,'42501','permission denied for table assets','anonymous cannot read assets');
select is((select count(*) from storage.objects),0::bigint,'anonymous reads no objects');
reset role;
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='reserved_source_insert' and cmd='INSERT'),'upload insert policy remains');
select * from finish();
rollback;
