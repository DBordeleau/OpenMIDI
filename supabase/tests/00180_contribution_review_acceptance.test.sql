begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('public', 'contribution_reviews', 'review history table exists');
select has_column('public', 'project_revisions', 'accepted_contribution_id', 'revision stores contribution lineage');
select has_function('public', 'review_contribution', array['uuid','uuid','contribution_review_decision','contribution_status','uuid','uuid','text'], 'review command exists');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000001','authenticated','authenticated','review-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000002','authenticated','authenticated','review-author@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-8000-000000000000','d0000000-0000-4000-8000-000000000003','authenticated','authenticated','review-other@example.test','','{}','{}',now(),now());
update public.profiles set username='ReviewOwner',username_normalized='reviewowner',display_name='Owner',credit_name='Owner',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000001';
update public.profiles set username='ReviewAuthor',username_normalized='reviewauthor',display_name='Author',credit_name='Author',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000002';
update public.profiles set username='ReviewOther',username_normalized='reviewother',display_name='Other',credit_name='Other',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000003';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
values('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000011','Review project',120,'cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','owner','d0000000-0000-4000-8000-000000000001'),
('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','viewer','d0000000-0000-4000-8000-000000000001');
set constraints all immediate;
set constraints all deferred;

insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at) values
('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','ready','d0000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000001/source','base.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now()),
('d2000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','ready','d0000000-0000-4000-8000-000000000002/d2000000-0000-4000-8000-000000000002/source','new.wav',2000,'audio/wav',2000,repeat('b',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values
('d2000000-0000-4000-8000-000000000001',0,'d0000000-0000-4000-8000-000000000001','Owner','creator'),
('d2000000-0000-4000-8000-000000000002',0,'d0000000-0000-4000-8000-000000000002','Author','creator');
update public.assets set credits_confirmed_at=ready_at,credits_confirmation_request_id=id,credits_confirmation_sha256=repeat('c',64) where status='ready';

create temporary table review_base_manifest(value jsonb);
insert into review_base_manifest values ('{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"d1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"d4000000-0000-4000-8000-000000000001","assetId":"d2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Base","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb);
grant select on review_base_manifest to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision('d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',null,'Initial',(select value from review_base_manifest))$$,'owner publishes base');
select lives_ok($$select public.set_project_contributions_open('d1000000-0000-4000-8000-000000000001',2,true)$$,'owner opens contributions');

set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.create_contribution_workspace('d1000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',(select current_revision_id from public.projects where id='d1000000-0000-4000-8000-000000000001'),'New stem','')$$,'author creates contribution');
reset role;

insert into public.workspace_tracks(workspace_id,track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order)
select id,'d4000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002',null,'New',0,0,1000,0,0,false,false,1 from public.workspaces where contribution_id is not null;
update public.workspaces set manifest='{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"d1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"d4000000-0000-4000-8000-000000000001","assetId":"d2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Base","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0},{"trackId":"d4000000-0000-4000-8000-000000000002","assetId":"d2000000-0000-4000-8000-000000000002","instrumentId":null,"name":"New","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":1}]}'::jsonb where contribution_id is not null;
update public.workspaces set manifest_sha256=encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex'),lock_version=2,updated_at=created_at+interval '1 second' where contribution_id is not null;
insert into public.assets(id,owner_id,kind,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size,media_type,byte_size,sha256,verification_version,ready_at)
select 'd6000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','workspace_snapshot','ready','workspace-snapshots','d0000000-0000-4000-8000-000000000002/workspaces/'||id||'/snapshots/d6000000-0000-4000-8000-000000000001/manifest-v1.json','manifest-v1.json','application/json',100,'application/json',100,manifest_sha256,'test',now() from public.workspaces where contribution_id is not null;
update public.workspaces set snapshot_asset_id='d6000000-0000-4000-8000-000000000001' where contribution_id is not null;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.submit_contribution((select id from public.contributions),'d7000000-0000-4000-8000-000000000001',2,(select base_revision_id from public.contributions),(select manifest_sha256 from public.workspaces where contribution_id is not null),'contributor-attestation-v1')$$,'author submits two-track version');
reset role;
create temporary table review_ids as
select c.id contribution_id,c.current_version_id version_id,c.base_revision_id revision_id
from public.contributions c;
grant select on review_ids to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.review_contribution((select contribution_id from review_ids),gen_random_uuid(),'accept','submitted',(select version_id from review_ids),(select revision_id from review_ids),null)$$,'PT404','contribution_review_not_found','unrelated actor cannot review');
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.assets where id='d2000000-0000-4000-8000-000000000002'),1::bigint,'owner reads submitted contributor asset');
select is((select credit_name from public.asset_credits where asset_id='d2000000-0000-4000-8000-000000000002'),'Author','owner reads credit for visible submitted asset');
select lives_ok($$select public.review_contribution((select id from public.contributions),'d8000000-0000-4000-8000-000000000001','accept','submitted',(select current_version_id from public.contributions),(select base_revision_id from public.contributions),'Sounds good')$$,'owner accepts exact version');
select lives_ok($$select public.review_contribution((select id from public.contributions),'d8000000-0000-4000-8000-000000000001','accept','submitted',(select current_version_id from public.contributions),(select expected_project_revision_id from public.contribution_reviews),'Sounds good')$$,'accept retry is idempotent');
reset role;

select is((select status from public.contributions),'accepted'::public.contribution_status,'contribution is accepted');
select is((select count(*) from public.project_revisions where project_id='d1000000-0000-4000-8000-000000000001'),2::bigint,'exactly one new revision exists');
select is((select accepted_contribution_version_id from public.project_revisions where accepted_contribution_id is not null),(select current_version_id from public.contributions),'revision records exact accepted version');
select is((select manifest from public.project_revisions where accepted_contribution_id is not null),(select manifest from public.contribution_versions),'accepted manifest is unchanged');
select is((select count(*) from public.revision_tracks where revision_id=(select id from public.project_revisions where accepted_contribution_id is not null)),2::bigint,'accepted projection has both tracks');
select is((select added_by from public.revision_tracks where asset_id='d2000000-0000-4000-8000-000000000002' and revision_id=(select id from public.project_revisions where accepted_contribution_id is not null)),'d0000000-0000-4000-8000-000000000002'::uuid,'contributor provenance survives');
select is((select source_bytes from public.project_storage_usage where project_id='d1000000-0000-4000-8000-000000000001'),3000::bigint,'project quota counts new bytes once');
select is((select status from public.workspaces where contribution_id is not null),'archived','accepted workspace is archived');
select is((select count(*) from public.contribution_reviews),1::bigint,'retry does not duplicate review');
select throws_ok($$update public.contribution_reviews set note='Changed'$$,'55000','immutable_revision_history','reviews are immutable');

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.contribution_reviews),1::bigint,'author reads review history');
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.contribution_reviews),0::bigint,'unrelated actor cannot read review history');
reset role;

select * from finish();
rollback;
