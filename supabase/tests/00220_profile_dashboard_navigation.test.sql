begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(36);

select has_table('public','profile_avatar_versions','avatar versions exist');
select has_table('private','profile_image_processing_jobs','private processing jobs exist');
select has_table('private','profile_avatar_cleanup_jobs','private cleanup jobs exist');
select has_function('public','get_viewer_dashboard',array[]::text[],'bounded dashboard command exists');
select has_function('public','touch_viewer_activity',array[]::text[],'activity command exists');
select has_function('public','list_public_profile_projects',array['uuid','bigint','timestamp with time zone','uuid'],'public profile projects page exists');
select has_index('public','projects','projects_owner_dashboard_idx','owned dashboard order is indexed');
select has_index('public','workspaces','workspaces_active_owner_updated_idx','active workspaces are indexed');
select has_column('public','public_profiles','avatar_path','safe profile exposes derivative path');
select ok((select not public from storage.buckets where id='profile-images'),'profile originals are private');
select ok((select public from storage.buckets where id='public-avatars'),'sanitized derivatives are public');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated','dashboard-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000002','authenticated','authenticated','dashboard-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000003','authenticated','authenticated','dashboard-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='DashboardOwner',username_normalized='dashboardowner',display_name='Dashboard Owner',credit_name='Dashboard Owner',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000001';
update public.profiles set username='DashboardOther',username_normalized='dashboardother',display_name='Dashboard Other',credit_name='Dashboard Other',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000002';
update public.profiles set username='DashboardSuspended',username_normalized='dashboardsuspended',display_name='Dashboard Suspended',credit_name='Dashboard Suspended',profile_completed_at=now(),status='suspended' where id='e0000000-0000-4000-8000-000000000003';

set local role anon;
select throws_ok($$select public.get_viewer_dashboard()$$,'42501','permission denied for function get_viewer_dashboard','anonymous dashboard is denied');
select throws_ok($$select public.touch_viewer_activity()$$,'42501','permission denied for function touch_viewer_activity','anonymous activity touch is denied');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.touch_viewer_activity()$$,'active caller touches activity');
select ok((select last_active_at is not null from public.touch_viewer_activity()),'touch returns stored timestamp');
select is((select touched from public.touch_viewer_activity()),false,'repeat activity inside throttle does not write');
select is(jsonb_typeof(public.get_viewer_dashboard()),'object','dashboard returns a bounded object');
select is(jsonb_array_length(public.list_viewer_projects('all',false,null,null)),0,'empty project index is bounded');
select is(jsonb_array_length(public.list_viewer_contributions('active',null,null)),0,'empty contribution index is bounded');
select lives_ok($$select public.reserve_profile_image_upload('e1000000-0000-4000-8000-000000000001',1024,'avatar.png','image/png')$$,'owner reserves avatar');
select is((select count(*) from public.assets),1::bigint,'owner reads only their private avatar original metadata');

set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.assets),0::bigint,'unrelated actor cannot read avatar original metadata');
reset role;
set local role anon;
select throws_ok($$select * from public.assets$$,'42501','permission denied for table assets','anonymous cannot read avatar original metadata');

reset role;
create temp table avatar_upload as
select a.id asset_id,a.object_path,u.avatar_version_id from public.assets a join private.profile_image_uploads u on u.asset_id=a.id where a.owner_id='e0000000-0000-4000-8000-000000000001';
grant select on avatar_upload to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$insert into storage.objects(id,bucket_id,name,owner_id,metadata)
  select gen_random_uuid(),'profile-images',object_path,'e0000000-0000-4000-8000-000000000001',jsonb_build_object('size',1024) from avatar_upload$$,'exact reservation permits original upload');
select lives_ok($$select public.complete_profile_image_upload((select asset_id from avatar_upload))$$,'owner starts processing');
reset role;

select is((select count(*) from private.profile_image_processing_jobs),1::bigint,'completion creates one processing job');
create temp table avatar_claim as select * from public.operator_claim_profile_image((select asset_id from avatar_upload),null);
select is((select count(*) from avatar_claim),1::bigint,'operator claims eligible image once');
select ok(has_function_privilege('service_role','public.operator_complete_profile_image(uuid,uuid,text,bigint,text,integer,integer,smallint,integer,text)','EXECUTE'),'service role owns finalization');
select lives_ok($$select public.operator_complete_profile_image(asset_id,lease_token,'image/png',1024,repeat('a',64),512,512,1::smallint,1000,repeat('b',64)) from avatar_claim$$,'lease-bound finalization installs avatar');
select ok((select avatar_version_id is not null and avatar_path is not null from public.profiles where id='e0000000-0000-4000-8000-000000000001'),'profile points to current derivative');

set local role anon;
select ok((select avatar_path is not null from public.public_profiles where id='e0000000-0000-4000-8000-000000000001'),'anonymous safe profile sees derivative path');
select throws_ok($$select * from public.profile_avatar_versions$$,'42501','permission denied for table profile_avatar_versions','application cannot read operational versions');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.remove_own_avatar((select avatar_version_id from avatar_upload))$$,'owner removes expected avatar');
reset role;
select is((select count(*) from private.profile_avatar_cleanup_jobs),1::bigint,'removal queues durable cleanup');
select is(jsonb_array_length(public.list_public_profile_projects('e0000000-0000-4000-8000-000000000001',(select version from public.discovery_state),null,null)),0,'public profile project page returns safe empty array');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.touch_viewer_activity()$$,'PT403','activity_forbidden','suspended caller cannot touch activity');

select * from finish();
rollback;
