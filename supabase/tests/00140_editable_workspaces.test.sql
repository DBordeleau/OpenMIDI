begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','workspace-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','workspace-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000003','authenticated','authenticated','workspace-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='WorkspaceOwner',username_normalized='workspaceowner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000001';
update public.profiles set username='WorkspaceStranger',username_normalized='workspacestranger',display_name='Stranger',credit_name='Stranger',profile_completed_at=now() where id='a0000000-0000-4000-8000-000000000002';
update public.profiles set username='WorkspaceSuspended',username_normalized='workspacesuspended',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='a0000000-0000-4000-8000-000000000003';
insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code) values('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000011','Workspace project',120,'all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by) values('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','owner','a0000000-0000-4000-8000-000000000001');
select lives_ok($$set constraints all immediate$$,'project owner invariant executes for both trigger row shapes');
set constraints all deferred;
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values
('a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','ready','a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/source','one.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now()),
('a2000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','ready','a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/source','two.wav',2000,'audio/wav',2000,repeat('b',64),2000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values
('a2000000-0000-4000-8000-000000000001',0,'a0000000-0000-4000-8000-000000000001','Owner','creator'),
('a2000000-0000-4000-8000-000000000002',0,'a0000000-0000-4000-8000-000000000001','Owner','creator');

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',null,null,'{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"a1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"a4000000-0000-4000-8000-000000000001","assetId":"a2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"One","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb)$$,'publishes base revision');
select ok(public.revision_manifest_checksum_valid('a1000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='a1000000-0000-4000-8000-000000000001')),'revision checksum is verified without JSON numeric-scale loss');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_project_workspace('a1000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='a1000000-0000-4000-8000-000000000001'))$$,'owner creates workspace');
select lives_ok($$select public.create_project_workspace('a1000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='a1000000-0000-4000-8000-000000000001'))$$,'create retry is idempotent');
reset role;
select is((select count(*) from public.workspaces),1::bigint,'one active workspace');
select is((select count(*) from public.workspace_tracks),1::bigint,'base track projected');
select is((select manifest from public.workspaces),(select manifest from public.project_revisions),'base manifest cloned exactly');
select is((select lock_version from public.workspaces),1,'workspace starts at lock one');
select is((select base_revision_id from public.workspaces),(select current_revision_id from public.projects),'exact base revision stored');

create temporary table workspace_test_manifest(value jsonb,checksum text,byte_size integer);
insert into workspace_test_manifest(value,checksum,byte_size)
select value,encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex'),octet_length(convert_to(value::text,'UTF8'))
from (values ('{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"a1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"a4000000-0000-4000-8000-000000000001","assetId":"a2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"One renamed","positionMs":250,"trimStartMs":0,"durationMs":1000,"gainDb":-3,"pan":0.2,"muted":true,"soloed":false,"sortOrder":0},{"trackId":"a4000000-0000-4000-8000-000000000002","assetId":"a2000000-0000-4000-8000-000000000002","instrumentId":null,"name":"Two","positionMs":500,"trimStartMs":0,"durationMs":2000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":1}]}'::jsonb)) x(value);
grant select on workspace_test_manifest to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_workspace_snapshot((select id from public.workspaces),'a6000000-0000-4000-8000-000000000001',1,(select checksum from workspace_test_manifest),(select byte_size from workspace_test_manifest))$$,'reserves snapshot');
select lives_ok($$select public.reserve_workspace_snapshot((select id from public.workspaces),'a6000000-0000-4000-8000-000000000001',1,(select checksum from workspace_test_manifest),(select byte_size from workspace_test_manifest))$$,'reservation retry is idempotent');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select gen_random_uuid(),a.bucket,a.object_path,a.owner_id,jsonb_build_object('size',m.byte_size)
from public.assets a cross join workspace_test_manifest m where a.kind='workspace_snapshot';

select lives_ok($$select public.save_workspace((select id from public.workspaces),'a6000000-0000-4000-8000-000000000001',1,(select value from workspace_test_manifest),(select id from public.assets where kind='workspace_snapshot'))$$,'saves changed workspace');
select lives_ok($$select public.save_workspace((select id from public.workspaces),'a6000000-0000-4000-8000-000000000001',1,(select value from workspace_test_manifest),(select id from public.assets where kind='workspace_snapshot'))$$,'save retry is idempotent');
reset role;
select is((select lock_version from public.workspaces),2,'successful save increments once');
select is((select count(*) from public.workspace_tracks),2::bigint,'two changed tracks projected');
select is((select name from public.workspace_tracks where sort_order=0),'One renamed','changed label projected');
select is((select position_ms from public.workspace_tracks where sort_order=1),500,'position projected');
select is((select status::text from public.assets where kind='workspace_snapshot'),'ready','snapshot becomes ready');
select is((select kind::text from public.assets where kind='workspace_snapshot'),'workspace_snapshot','snapshot kind retained');
select is((select count(*) from public.project_revisions),1::bigint,'revision count unchanged');
select is((select count(*) from public.revision_tracks),1::bigint,'revision tracks unchanged');
select is((select count(*) from public.project_asset_references),1::bigint,'project references unchanged');

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select throws_ok($$select public.reserve_workspace_snapshot((select id from public.workspaces),gen_random_uuid(),1,repeat('c',64),100)$$,'PT409','workspace_save_conflict','stale tab conflicts');
select throws_ok($$update public.workspaces set lock_version=99$$,'42501','permission denied for table workspaces','direct workspace update denied');
reset role;
create temporary table workspace_test_ids as select w.id as workspace_id,a.id as snapshot_asset_id from public.workspaces w join public.assets a on a.id=w.snapshot_asset_id;
grant select on workspace_test_ids to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.workspaces),0::bigint,'unrelated actor sees no workspace');
select is((select count(*) from public.workspace_tracks),0::bigint,'unrelated actor sees no workspace tracks');
select throws_ok($$select public.save_workspace((select workspace_id from workspace_test_ids),'a6000000-0000-4000-8000-000000000001',1,(select value from workspace_test_manifest),(select snapshot_asset_id from workspace_test_ids))$$,'PT404','workspace_not_found','unrelated actor cannot replay a committed save');
select throws_ok($$select public.create_project_workspace('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),(select current_revision_id from public.projects where id='a1000000-0000-4000-8000-000000000001'))$$,'PT404','workspace_project_not_found','unrelated cannot create workspace');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.workspaces),0::bigint,'suspended actor sees no workspace');
reset role;
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='reserved_workspace_snapshot_insert' and cmd='INSERT'),'snapshot insert policy exists');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name in ('workspaces','workspace_tracks') and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),'workspace tables have no direct write grants');

select * from finish();
rollback;
