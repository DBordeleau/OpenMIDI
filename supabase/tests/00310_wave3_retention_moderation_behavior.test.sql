begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000001','authenticated','authenticated','retention-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000002','authenticated','authenticated','retention-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000003','authenticated','authenticated','retention-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000004','authenticated','authenticated','retention-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000005','authenticated','authenticated','retention-account@example.test','','{}','{}',now(),now());
update public.profiles set username='RetentionOwner',username_normalized='retentionowner',display_name='Retention Owner',credit_name='Retention Owner',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000001';
update public.profiles set username='RetentionOther',username_normalized='retentionother',display_name='Retention Other',credit_name='Retention Other',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000002';
update public.profiles set username='RetentionAdmin',username_normalized='retentionadmin',display_name='Retention Admin',credit_name='Retention Admin',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000003';
update public.profiles set username='RetentionSuspended',username_normalized='retentionsuspended',display_name='Retention Suspended',credit_name='Retention Suspended',profile_completed_at=now(),status='suspended' where id='fb000000-0000-4000-8000-000000000004';
update public.profiles set username='RetentionAccount',username_normalized='retentionaccount',display_name='Retention Account',credit_name='Retention Account',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000005';
insert into private.app_admins(user_id,created_by) values
('fb000000-0000-4000-8000-000000000003','fb000000-0000-4000-8000-000000000003'),
('fb000000-0000-4000-8000-000000000004','fb000000-0000-4000-8000-000000000003');

select hasnt_function('public','get_admin_storage_summary',array[]::text[],'legacy Storage summary is retired');
select hasnt_table('public','assets','avatar-only assets are retired');
select hasnt_table('private','retention_cleanup_objects','retention has no Storage object queue');

set local role anon;
select throws_ok($$select public.get_admin_retention_summary()$$,'42501','permission denied for function get_admin_retention_summary','anonymous cannot inspect retention operations');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select throws_ok($$select public.get_admin_retention_summary()$$,'PT404','admin_not_found','ordinary user is not an administrator');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select throws_ok($$select public.get_admin_retention_summary()$$,'PT404','admin_not_found','suspended administrator is rejected');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select is(jsonb_typeof(public.get_admin_retention_summary()),'object','active administrator receives retention summary');
reset role;

set local role service_role;
select is(public.operator_retention_preview(100)->>'policyVersion','retention-v3','retention uses the metadata-only policy version');
select ok(public.operator_retention_preview(100)::text !~ 'avatar|asset|bucket|objectPath','retention preview exposes no avatar or Storage candidates');
reset role;

insert into public.projects(id,owner_id,create_request_id,title,license_code,compatibility) values
('fb200000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb210000-0000-4000-8000-000000000001','Expired project','all-rights-reserved','midi');
insert into public.project_members(project_id,user_id,role,created_by) values
('fb200000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','owner','fb000000-0000-4000-8000-000000000001');

set session_replication_role = replica;
insert into public.contributions(id,project_id,author_id,create_request_id,base_revision_id,title)
values('fb300000-0000-4000-8000-000000000001','fb200000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000002','fb310000-0000-4000-8000-000000000001','fb320000-0000-4000-8000-000000000001','Held contribution');
set session_replication_role = origin;

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000001','profile','fb000000-0000-4000-8000-000000000001','abuse','Preserve profile evidence',null)$$,'administrator places profile hold');
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000002','project','fb200000-0000-4000-8000-000000000001','legal','Preserve project evidence',null)$$,'administrator places project hold');
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000003','contribution','fb300000-0000-4000-8000-000000000001','abuse','Preserve contribution evidence',null)$$,'administrator places contribution hold');
select throws_ok($$select public.place_content_hold(gen_random_uuid(),'asset',gen_random_uuid(),'legal','No asset targets',null)$$,'22023','hold_invalid','asset holds are retired');
reset role;
create temp table hold_ids as select request_id,id from private.content_holds;
grant select on hold_ids to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from hold_ids where request_id='fb230000-0000-4000-8000-000000000001'),'fb230000-0000-4000-8000-000000000011','Profile evidence released')$$,'profile hold releases');
select lives_ok($$select public.release_content_hold((select id from hold_ids where request_id='fb230000-0000-4000-8000-000000000003'),'fb230000-0000-4000-8000-000000000013','Contribution evidence released')$$,'contribution hold releases');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.submit_moderation_report(gen_random_uuid(),'profile','fb000000-0000-4000-8000-000000000001','harassment','Review this profile')$$,'profile moderation report remains available');
reset role;
select is((select count(*) from private.moderation_reports where target_profile_id='fb000000-0000-4000-8000-000000000001'),1::bigint,'moderation report is recorded privately');
create temp table moderation_report_id as select id from private.moderation_reports where target_profile_id='fb000000-0000-4000-8000-000000000001';
grant select on moderation_report_id to authenticated;

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.apply_moderation_action((select id from moderation_report_id),gen_random_uuid(),'resolve','Reviewed','submitted',1)$$,'administrator resolves profile report');
reset role;
select is((select status from private.moderation_reports where target_profile_id='fb000000-0000-4000-8000-000000000001'),'resolved','moderation resolution remains intact');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select lives_ok($$select public.delete_project('fb200000-0000-4000-8000-000000000001','fb220000-0000-4000-8000-000000000001',1)$$,'owner starts project deletion');
reset role;
update private.deletion_requests
set requested_at=statement_timestamp()-interval '31 days',restore_until=statement_timestamp()-interval '1 day'
where target_project_id='fb200000-0000-4000-8000-000000000001';

set local role service_role;
select is((select (g->>'count')::integer from jsonb_array_elements(public.operator_retention_preview(100)->'groups') g where g->>'rule'='deletion_expired_30d'),1,'preview finds expired deletion');
create temp table retention_run as select public.operator_start_retention_run(100) id;
create temp table held_claim as select public.operator_claim_retention_job((select id from retention_run)) claim;
select is((select claim from held_claim),null::jsonb,'project hold blocks retention lease');
reset role;
select is((select status from private.retention_cleanup_jobs where subject_kind='deletion'),'blocked','held deletion is recorded as blocked');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from hold_ids where request_id='fb230000-0000-4000-8000-000000000002'),'fb230000-0000-4000-8000-000000000012','Project evidence released')$$,'project hold releases');
reset role;
update private.retention_cleanup_jobs set status='retry',next_attempt_at=statement_timestamp()-interval '1 minute' where subject_kind='deletion';
set local role service_role;
create temp table deletion_claim as select public.operator_claim_retention_job((select id from retention_run)) claim;
select ok((select claim->>'jobId' is not null from deletion_claim),'released deletion receives lease');
select throws_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,gen_random_uuid(),'{}'::uuid[],'{}'::uuid[]) from deletion_claim$$,'PT409','retention_lease_invalid','wrong token cannot finalize');
select lives_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],'{}'::uuid[]) from deletion_claim$$,'valid metadata-only lease finalizes');
select is((select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],'{}'::uuid[]) from deletion_claim),'complete','retention finalization is idempotent');
reset role;
select is((select status from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000001'),'purged','expired deletion is purged');

create temp table avatar_options(value jsonb);
insert into avatar_options values ('{"eyebrowsVariant":"variant01","eyesVariant":"variant01","glassesVariant":"variant01","glassesProbability":0,"mouthVariant":"variant01","backgroundColor":"f2d3b1","scale":1,"rotate":0}'::jsonb);
grant select on avatar_options to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select lives_ok($$select * from public.save_own_avatar_config((select value from avatar_options),0)$$,'account saves generated avatar before deletion');
select lives_ok($$select public.request_account_deletion('fb240000-0000-4000-8000-000000000001','RetentionAccount')$$,'active user starts account deletion');
reset role;
select is((select avatar_config from public.profiles where id='fb000000-0000-4000-8000-000000000005'),null::jsonb,'account deletion clears generated config');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select is(public.get_own_account_recovery()->>'canRestore','true','deleted account can inspect recovery state');
select lives_ok($$select public.restore_own_account()$$,'recovery command remains possible before retention authorization');
reset role;
select is((select status::text from public.profiles where id='fb000000-0000-4000-8000-000000000005'),'active','account recovery restores active state');

select * from finish();
rollback;
