begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(39);

select has_table('public', 'waveform_peak_derivatives', 'peak derivative relation exists');
select ok((select relrowsecurity from pg_class where oid = 'public.waveform_peak_derivatives'::regclass), 'peak relation uses RLS');
select has_column('public', 'global_storage_usage', 'derived_bytes', 'global capacity records actual derived bytes');
select has_column('public', 'global_storage_usage', 'reserved_derived_bytes', 'global capacity records reserved derived bytes');
select has_function('public', 'reserve_waveform_peaks', array['uuid','uuid','bigint'], 'peak reservation command exists');
select has_function('public', 'finalize_waveform_peaks', array['uuid','bigint','text','smallint','text','smallint','integer','integer','integer'], 'peak finalization command exists');
select is((select count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public' and table_name='waveform_peak_derivatives' and privilege_type <> 'SELECT'), 0::bigint, 'application roles cannot mutate peak rows');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','peak-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','peak-fork@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000003','authenticated','authenticated','peak-reviewer@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000004','authenticated','authenticated','peak-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000005','authenticated','authenticated','peak-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='PeakOwner',username_normalized='peakowner',display_name='Peak Owner',credit_name='Peak Owner',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000001';
update public.profiles set username='PeakFork',username_normalized='peakfork',display_name='Peak Fork',credit_name='Peak Fork',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000002';
update public.profiles set username='PeakReviewer',username_normalized='peakreviewer',display_name='Peak Reviewer',credit_name='Peak Reviewer',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000003';
update public.profiles set username='PeakOther',username_normalized='peakother',display_name='Peak Other',credit_name='Peak Other',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000004';
update public.profiles set username='PeakSuspended',username_normalized='peaksuspended',display_name='Peak Suspended',credit_name='Peak Suspended',profile_completed_at=now(),status='suspended' where id='a0000000-0000-4000-8000-000000000005';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
values('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','Peak project',120,'cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','owner','a0000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','viewer','a0000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','viewer','a0000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','viewer','a0000000-0000-4000-8000-000000000001');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
values('a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','ready','a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/source','peaks.flac',1000,'audio/flac',1000,repeat('a',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('a2000000-0000-4000-8000-000000000001',0,'a0000000-0000-4000-8000-000000000001','Peak Owner','creator');
update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id='a2100000-0000-4000-8000-000000000001',credits_confirmation_sha256=repeat('b',64)
where id='a2000000-0000-4000-8000-000000000001';
insert into public.user_storage_usage(user_id) values('a0000000-0000-4000-8000-000000000001') on conflict do nothing;

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.publish_project_revision(
  'a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',null,'Peak revision',
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"a1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"a4000000-0000-4000-8000-000000000001","assetId":"a2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Peak stem","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
);
select lives_ok($$select public.reserve_waveform_peaks('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',16424)$$, 'owner reserves exact peak storage');
select is((select count(*) from public.waveform_peak_derivatives), 1::bigint, 'one derivative relation is created');
reset role;
select is((select reserved_derived_bytes from public.global_storage_usage where singleton), 16424::bigint, 'derived capacity is reserved globally');
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select ok((select object_path = owner_id::text||'/'||source_asset_id::text||'/'||id::text||'/peaks.v1.bin' from public.waveform_peak_derivatives), 'server path binds owner, source, and derivative');
select lives_ok($$select public.reserve_waveform_peaks('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',16424)$$, 'exact reservation retry is idempotent');
select throws_ok($$select public.reserve_waveform_peaks('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',16425)$$, '23505', 'waveform_peaks_request_conflict', 'conflicting reservation fails');
select throws_ok($$select public.reserve_waveform_peaks('a5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001',524289)$$, '22023', 'waveform_peaks_invalid_declaration', 'oversized peak reservation fails');
select ok((select private.can_upload_waveform_peak(bucket,object_path) from public.waveform_peak_derivatives), 'owner may upload only the exact reservation path');
select ok(not (select private.can_upload_waveform_peak('derived-assets','wrong/path') from public.waveform_peak_derivatives limit 1), 'wrong peak path is denied');

reset role;
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),bucket,object_path,owner_id::text,jsonb_build_object('size',expected_byte_size,'mimetype','application/octet-stream')
from public.waveform_peak_derivatives;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select throws_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('c',64),1::smallint,'pcm-minmax-v1',2::smallint,1000,48000,2048)$$, 'PT409', 'waveform_peaks_content_type_mismatch', 'wrong object content type fails');
reset role;
update storage.objects set metadata=jsonb_build_object('size',16424,'mimetype','application/vnd.jam-session.waveform-peaks') where bucket_id='derived-assets';
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select throws_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('c',64),2::smallint,'pcm-minmax-v1',2::smallint,1000,48000,2048)$$, '22023', 'waveform_peaks_invalid_payload', 'wrong binary version fails');
select throws_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('c',64),1::smallint,'pcm-minmax-v1',2::smallint,999,48000,2048)$$, '22023', 'waveform_peaks_source_mismatch', 'wrong source metadata fails');
select lives_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('c',64),1::smallint,'pcm-minmax-v1',2::smallint,1000,48000,2048)$$, 'matching object finalizes');
select is((select status from public.waveform_peak_derivatives), 'ready', 'peak becomes ready');
reset role;
select is((select derived_bytes from public.global_storage_usage where singleton), 16424::bigint, 'actual derived bytes count globally');
select is((select reserved_derived_bytes from public.global_storage_usage where singleton), 0::bigint, 'finalization releases derived reservation');
select is((select source_bytes from public.user_storage_usage where user_id='a0000000-0000-4000-8000-000000000001'), 0::bigint, 'derived bytes do not enter user source quota');
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select is((select status from public.assets where id='a2000000-0000-4000-8000-000000000001'), 'ready'::public.asset_status, 'peak finalization does not change source authority');
select lives_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('c',64),1::smallint,'pcm-minmax-v1',2::smallint,1000,48000,2048)$$, 'exact completion is idempotent');
select throws_ok($$select public.finalize_waveform_peaks((select id from public.waveform_peak_derivatives),16424::bigint,repeat('d',64),1::smallint,'pcm-minmax-v1',2::smallint,1000,48000,2048)$$, '23505', 'waveform_peaks_completion_conflict', 'conflicting completion fails');

set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.waveform_peak_derivatives), 1::bigint, 'authorized project reviewer reads peaks');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000004';
select is((select count(*) from public.waveform_peak_derivatives), 0::bigint, 'unrelated actor reads no peaks');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000005';
select is((select count(*) from public.waveform_peak_derivatives), 0::bigint, 'suspended member reads no peaks');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.waveform_peak_derivatives$$, '42501', 'permission denied for table waveform_peak_derivatives', 'anonymous cannot enumerate private peaks');

reset role;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.fork_project(
  'a1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where id='a1000000-0000-4000-8000-000000000001'),
  'a6000000-0000-4000-8000-000000000001','cc-by-4.0','Peak fork',null
)$$, 'authorized member creates copy-on-write fork');
reset role;
delete from public.project_members where project_id='a1000000-0000-4000-8000-000000000001' and user_id in ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.delete_project('a1000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',(select lock_version from public.projects where id='a1000000-0000-4000-8000-000000000001'));
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.waveform_peak_derivatives), 0::bigint, 'deleted project and removed membership hide peaks');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.waveform_peak_derivatives), 1::bigint, 'fork owner retains peak access through copied revision authority');

reset role;
select throws_ok($$insert into public.waveform_peak_derivatives(id,source_asset_id,owner_id,request_id,object_path,expected_byte_size,expires_at)
values('a8000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000001','wrong/path',16424,now()+interval '1 hour')$$, '23514', null, 'wrong-path derivative rows fail exact path constraints');
select lives_ok($$delete from public.waveform_peak_derivatives where id=(select id from public.waveform_peak_derivatives)$$, 'deleting a derivative relation is independent');
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_waveform_peaks('a5000000-0000-4000-8000-000000000099','a2000000-0000-4000-8000-000000000001',16424)$$, 'owner can reserve a replacement presentation derivative');
reset role;
update public.waveform_peak_derivatives set expires_at=now()-interval '1 second';
select is(private.expire_waveform_peak_uploads(), 1::bigint, 'expired peak reservations release capacity without source mutation');
select is((select count(*) from public.assets where id='a2000000-0000-4000-8000-000000000001'), 1::bigint, 'deleting a derivative never deletes canonical source');

select * from finish();
rollback;
