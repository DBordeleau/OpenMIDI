begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000001','authenticated','authenticated','publish-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000002','authenticated','authenticated','publish-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000003','authenticated','authenticated','publish-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='PublishOwner',username_normalized='publishowner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='b0000000-0000-4000-8000-000000000001';
update public.profiles set username='PublishStranger',username_normalized='publishstranger',display_name='Stranger',credit_name='Stranger',profile_completed_at=now() where id='b0000000-0000-4000-8000-000000000002';
update public.profiles set username='PublishSuspended',username_normalized='publishsuspended',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='b0000000-0000-4000-8000-000000000003';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
values('b1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000011','Publish project',120,'all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by)
values('b1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','owner','b0000000-0000-4000-8000-000000000001');
set constraints all immediate;
set constraints all deferred;

insert into public.assets(
  id,owner_id,status,object_path,original_filename,reserved_byte_size,
  media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,
  verification_version,ready_at
) values (
  'b2000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001','ready',
  'b0000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001/source',
  'stem.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now()
);
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('b2000000-0000-4000-8000-000000000001',0,'b0000000-0000-4000-8000-000000000001','Owner','creator');

create temporary table publish_manifest(value jsonb);
insert into publish_manifest values (
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"b1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"b4000000-0000-4000-8000-000000000001","assetId":"b2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Stem","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
);
grant select on publish_manifest to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('b1000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',null,'Initial',(select value from publish_manifest))$$,'publishes initial revision');
select lives_ok($$select public.create_project_workspace('b1000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'))$$,'creates owner workspace');
reset role;

create temporary table publish_ids as
select w.id workspace_id,w.base_revision_id base_revision_id,w.lock_version
from public.workspaces w where w.project_id='b1000000-0000-4000-8000-000000000001';
grant select on publish_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),'b6000000-0000-4000-8000-000000000001',1,(select base_revision_id from publish_ids),'Workspace checkpoint')$$,'publishes saved workspace');
reset role;
select is((select count(*) from public.project_revisions where project_id='b1000000-0000-4000-8000-000000000001'),2::bigint,'one later revision created');
select is((select revision_number from public.project_revisions where project_id='b1000000-0000-4000-8000-000000000001' order by revision_number desc limit 1),2,'later revision ordered');
select is((select parent_revision_id from public.project_revisions where revision_number=2),(select id from public.project_revisions where revision_number=1),'later revision points to prior immutable revision');
select is((select message from public.project_revisions where revision_number=1),'Initial','prior revision is unchanged');
select is((select base_revision_id from public.workspaces where status='active'),(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'),'workspace advances to published revision');
select is((select lock_version from public.workspaces where status='active'),2,'workspace lock advances once');

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),'b6000000-0000-4000-8000-000000000001',1,(select base_revision_id from publish_ids),'Workspace checkpoint')$$,'publish retry returns original result');
select throws_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),gen_random_uuid(),1,(select base_revision_id from publish_ids),null)$$,'PT409','workspace_publish_unsaved','stale workspace lock cannot publish');
select lives_ok($$select public.publish_project_revision('b1000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000003',(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'),'Parallel publish',(select value from publish_manifest))$$,'parallel canonical publish makes workspace stale');
select throws_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),gen_random_uuid(),2,(select base_revision_id from public.workspaces where status='active'),null)$$,'PT409','workspace_publish_stale_base','stale base cannot overwrite current history');
select lives_ok($$select public.restart_project_workspace((select workspace_id from publish_ids),'b7000000-0000-4000-8000-000000000001',2,(select base_revision_id from public.workspaces where status='active'),(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'))$$,'owner restarts stale workspace');
select lives_ok($$select public.restart_project_workspace((select workspace_id from publish_ids),'b7000000-0000-4000-8000-000000000001',2,(select base_revision_id from public.workspaces where status='archived'),(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'))$$,'restart retry is idempotent');
reset role;
select is((select count(*) from public.workspaces where status='active'),1::bigint,'restart leaves one active workspace');
select is((select count(*) from public.workspaces where status='archived'),1::bigint,'restart preserves archived workspace');
select is((select base_revision_id from public.workspaces where status='active'),(select current_revision_id from public.projects where id='b1000000-0000-4000-8000-000000000001'),'replacement clones current revision');

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
select throws_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),gen_random_uuid(),2,(select base_revision_id from publish_ids),null)$$,'PT404','workspace_publish_not_found','unrelated actor cannot publish workspace');
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),gen_random_uuid(),2,(select base_revision_id from publish_ids),null)$$,'PT403','workspace_publish_actor_ineligible','suspended actor cannot publish workspace');
reset role;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.publish_workspace_revision((select workspace_id from publish_ids),gen_random_uuid(),2,(select base_revision_id from publish_ids),null)$$,'PT401','workspace_publish_unauthenticated','anonymous actor cannot publish workspace');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select throws_ok($$update public.workspaces set lock_version=99$$,'42501','permission denied for table workspaces','direct workspace mutation remains denied');
reset role;

select * from finish();
rollback;
