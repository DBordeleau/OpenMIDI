begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(22);

select hasnt_table('public','profile_avatar_versions','uploaded avatar versions are retired');
select hasnt_table('private','profile_image_processing_jobs','image processing jobs are retired');
select hasnt_table('private','profile_avatar_cleanup_jobs','avatar cleanup jobs are retired');
select hasnt_table('public','assets','avatar-only asset metadata is retired');
select has_function('public','get_viewer_dashboard',array[]::text[],'bounded dashboard command exists');
select has_function('public','touch_viewer_activity',array[]::text[],'activity command exists');
select has_function('public','list_public_profile_projects',array['uuid','bigint','timestamp with time zone','uuid'],'public profile projects page exists');
select has_index('public','projects','projects_owner_dashboard_idx','owned dashboard order is indexed');
select has_index('public','workspaces','workspaces_active_owner_updated_idx','active workspaces are indexed');
select has_column('public','public_profiles','avatar_config','safe profile exposes generated avatar config');
select hasnt_column('public','public_profiles','avatar_path','safe profile exposes no Storage path');

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
reset role;

set local role anon;
select ok((select avatar_config is null from public.public_profiles where id='e0000000-0000-4000-8000-000000000001'),'anonymous safe profile supports initials fallback');
reset role;
select is(jsonb_array_length(public.list_public_profile_projects('e0000000-0000-4000-8000-000000000001',(select version from public.discovery_state),null,null)),0,'public profile project page returns safe empty array');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.touch_viewer_activity()$$,'PT403','activity_forbidden','suspended caller cannot touch activity');

select * from finish();
rollback;
