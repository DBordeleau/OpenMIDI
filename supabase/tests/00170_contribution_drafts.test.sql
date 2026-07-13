begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c0000000-0000-4000-8000-000000000001','authenticated','authenticated','contribution-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c0000000-0000-4000-8000-000000000002','authenticated','authenticated','contribution-author@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c0000000-0000-4000-8000-000000000003','authenticated','authenticated','contribution-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c0000000-0000-4000-8000-000000000004','authenticated','authenticated','contribution-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='ContributionOwner',username_normalized='contributionowner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='c0000000-0000-4000-8000-000000000001';
update public.profiles set username='ContributionAuthor',username_normalized='contributionauthor',display_name='Author',credit_name='Author',profile_completed_at=now() where id='c0000000-0000-4000-8000-000000000002';
update public.profiles set username='ContributionOther',username_normalized='contributionother',display_name='Other',credit_name='Other',profile_completed_at=now() where id='c0000000-0000-4000-8000-000000000003';
update public.profiles set username='ContributionSuspended',username_normalized='contributionsuspended',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='c0000000-0000-4000-8000-000000000004';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
values('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000011','Contribution project',120,'cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','owner','c0000000-0000-4000-8000-000000000001'),
('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','viewer','c0000000-0000-4000-8000-000000000001');
set constraints all immediate;
set constraints all deferred;

insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
values('c2000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','ready','c0000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/source','base.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('c2000000-0000-4000-8000-000000000001',0,'c0000000-0000-4000-8000-000000000001','Owner','creator');

create temporary table contribution_manifest(value jsonb);
insert into contribution_manifest values (
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"c1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"c4000000-0000-4000-8000-000000000001","assetId":"c2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Base stem","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
);
grant select on contribution_manifest to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('c1000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',null,'Initial',(select value from contribution_manifest))$$,'owner publishes base revision');
select lives_ok($$select public.set_project_contributions_open('c1000000-0000-4000-8000-000000000001',2,true)$$,'owner opens submissions');
select is((select open_to_contributions from public.projects where id='c1000000-0000-4000-8000-000000000001'),true,'opening changes only collaboration state');
select throws_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001',gen_random_uuid(),(select current_revision_id from public.projects where id='c1000000-0000-4000-8000-000000000001'),'Owner proposal','')$$,'PT404','contribution_project_not_found','owner cannot self-contribute');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='c1000000-0000-4000-8000-000000000001'),'Author proposal','Private draft')$$,'member creates exact-base contribution workspace');
select lives_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='c1000000-0000-4000-8000-000000000001'),'Author proposal','Private draft')$$,'create retry is idempotent');
select throws_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='c1000000-0000-4000-8000-000000000001'),'Changed title','Private draft')$$,'PT409','contribution_request_conflict','create request collision conflicts');
select is((select count(*) from public.contributions),1::bigint,'one contribution created');
select is((select count(*) from public.workspaces where contribution_id is not null),1::bigint,'one linked workspace created');
select is((select count(*) from public.workspace_tracks),1::bigint,'base track projection is cloned');
reset role;

select is((select manifest from public.workspaces where contribution_id is not null),(select manifest from public.project_revisions where project_id='c1000000-0000-4000-8000-000000000001'),'workspace clones canonical base manifest');
select is((select count(*) from public.project_revisions where project_id='c1000000-0000-4000-8000-000000000001'),1::bigint,'creation does not advance project history');
create temporary table contribution_base as select base_revision_id from public.contributions;
grant select on contribution_base to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.contributions),0::bigint,'owner cannot read author draft');
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.contributions),1::bigint,'author reads own draft');
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.contributions),0::bigint,'unrelated actor cannot discover draft');
select throws_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001',gen_random_uuid(),(select base_revision_id from contribution_base),'Other proposal','')$$,'PT404','contribution_project_not_found','non-member cannot create');
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000004';
select throws_ok($$select public.create_contribution_workspace('c1000000-0000-4000-8000-000000000001',gen_random_uuid(),'c3000000-0000-4000-8000-000000000001','Suspended proposal','')$$,'PT403','contribution_actor_ineligible','suspended actor cannot create');
reset role;

insert into public.assets(id,owner_id,kind,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size,media_type,byte_size,sha256,verification_version,ready_at)
select 'c6000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','workspace_snapshot','ready','workspace-snapshots','c0000000-0000-4000-8000-000000000002/workspaces/'||w.id||'/snapshots/c6000000-0000-4000-8000-000000000001/manifest-v1.json','manifest-v1.json','application/json',100,'application/json',100,w.manifest_sha256,'test',now()
from public.workspaces w where w.contribution_id is not null;
update public.workspaces set snapshot_asset_id='c6000000-0000-4000-8000-000000000001',lock_version=2,updated_at=created_at+interval '1 second' where contribution_id is not null;

set local role authenticated;
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.submit_contribution((select id from public.contributions),'c7000000-0000-4000-8000-000000000001',2,(select base_revision_id from public.contributions),(select manifest_sha256 from public.workspaces where contribution_id is not null),'contributor-attestation-v1')$$,'author submits acknowledged workspace');
select lives_ok($$select public.submit_contribution((select id from public.contributions),'c7000000-0000-4000-8000-000000000001',2,(select base_revision_id from public.contributions),(select manifest_sha256 from public.workspaces where contribution_id is not null),'contributor-attestation-v1')$$,'submit retry returns immutable version');
select throws_ok($$select public.reserve_workspace_snapshot((select id from public.workspaces where contribution_id is not null),gen_random_uuid(),2,repeat('b',64),100)$$,'PT404','workspace_not_found','submitted workspace rejects further reservation');
reset role;

select is((select count(*) from public.contribution_versions),1::bigint,'submission creates one immutable version');
select is((select count(*) from public.contribution_version_tracks),1::bigint,'submission freezes normalized tracks');
select is((select added_by from public.contribution_version_tracks),'c0000000-0000-4000-8000-000000000001'::uuid,'inherited track preserves provenance');
select is((select count(*) from public.project_revisions where project_id='c1000000-0000-4000-8000-000000000001'),1::bigint,'submission does not advance project history');

set local role authenticated;
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.contributions),1::bigint,'owner reads submitted metadata');
select is((select count(*) from public.workspaces),0::bigint,'owner cannot read author workspace');
select throws_ok($$update public.contribution_versions set duration_ms=2$$,'42501','permission denied for table contribution_versions','direct immutable version mutation is denied');
set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.withdraw_contribution((select id from public.contributions),'submitted',(select current_version_id from public.contributions))$$,'author withdraws submitted contribution');
reset role;
select is((select status from public.workspaces where contribution_id is not null),'archived','withdrawal archives workspace');
select is((select count(*) from public.contribution_versions),1::bigint,'withdrawal retains immutable version');

select * from finish();
rollback;
