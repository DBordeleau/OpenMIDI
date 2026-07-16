begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(58);

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

set local role anon;
select throws_ok($$select public.get_admin_storage_summary()$$,'42501','permission denied for function get_admin_storage_summary','anonymous cannot inspect avatar operations');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select throws_ok($$select public.get_admin_storage_summary()$$,'PT404','admin_not_found','unrelated authenticated actor is not an administrator');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select throws_ok($$select public.get_admin_storage_summary()$$,'PT404','admin_not_found','suspended administrator is rejected by database authorization');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select is(jsonb_typeof(public.get_admin_storage_summary()),'object','active database administrator receives the operations document');
select is((public.get_admin_storage_summary()->'thresholds'->>'warningBytes')::bigint,104857600::bigint,'avatar-only warning threshold is 100 MiB');
select is((public.get_admin_storage_summary()->'thresholds'->>'stopBytes')::bigint,209715200::bigint,'avatar-only stop threshold is 200 MiB');
reset role;

insert into public.assets(id,owner_id,status,bucket,object_path,original_filename,declared_media_type,reserved_byte_size,
  media_type,byte_size,sha256,verification_version,image_width,image_height,frame_count,ready_at) values
('fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','ready','profile-images','fb000000-0000-4000-8000-000000000001/fb100000-0000-4000-8000-000000000001/original','current.png','image/png',1024,'image/png',1024,repeat('a',64),'profile-image-v1',512,512,1,now()),
('fb100000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','ready','profile-images','fb000000-0000-4000-8000-000000000001/fb100000-0000-4000-8000-000000000002/original','old.png','image/png',2048,'image/png',2048,repeat('b',64),'profile-image-v1',512,512,1,now()-interval '2 days');
insert into public.profile_avatar_versions(id,profile_id,source_asset_id,public_object_path,status,media_type,byte_size,sha256,width,height,installed_at,superseded_at) values
('fb110000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000001/avatar.webp','current','image/webp',512,repeat('c',64),512,512,now(),null),
('fb110000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000002/avatar.webp','superseded','image/webp',512,repeat('d',64),512,512,now()-interval '2 days',now()-interval '1 day');
update public.profiles set avatar_version_id='fb110000-0000-4000-8000-000000000001',
  avatar_path='fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000001/avatar.webp'
where id='fb000000-0000-4000-8000-000000000001';
insert into storage.objects(id,bucket_id,name,owner_id,metadata) values
(gen_random_uuid(),'profile-images','fb000000-0000-4000-8000-000000000001/fb100000-0000-4000-8000-000000000001/original','fb000000-0000-4000-8000-000000000001',jsonb_build_object('size',1024)),
(gen_random_uuid(),'public-avatars','fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000001/avatar.webp','fb000000-0000-4000-8000-000000000001',jsonb_build_object('size',512)),
(gen_random_uuid(),'public-avatars','untracked/avatar.webp','fb000000-0000-4000-8000-000000000001','{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select is((public.get_admin_storage_summary()->'total'->>'objectCount')::bigint,3::bigint,'summary counts only avatar bucket objects');
select is((public.get_admin_storage_summary()->'total'->>'bytes')::bigint,1536::bigint,'summary totals known avatar bytes');
select is((public.get_admin_storage_summary()->'total'->>'unknownSizeCount')::bigint,1::bigint,'summary reports unknown avatar object sizes');
select is(jsonb_array_length(public.get_admin_storage_summary()->'buckets'),2,'summary groups the two avatar buckets');
select is((public.get_admin_storage_summary()->>'untrackedObjectCount')::bigint,1::bigint,'summary detects untracked avatar objects only');
reset role;

insert into public.projects(id,owner_id,create_request_id,title,license_code,compatibility) values
('fb200000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb210000-0000-4000-8000-000000000001','Recoverable project','all-rights-reserved','midi'),
('fb200000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','fb210000-0000-4000-8000-000000000002','Expired project','all-rights-reserved','midi');
insert into public.project_members(project_id,user_id,role,created_by) values
('fb200000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','owner','fb000000-0000-4000-8000-000000000001'),
('fb200000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','owner','fb000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select throws_ok($$select public.delete_project('fb200000-0000-4000-8000-000000000001',gen_random_uuid(),1)$$,'PT404','project_delete_not_found','unrelated actor cannot delete another project');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select lives_ok($$select public.delete_project('fb200000-0000-4000-8000-000000000001','fb220000-0000-4000-8000-000000000001',1)$$,'owner starts recoverable project deletion');
reset role;
select is((select status::text from public.projects where id='fb200000-0000-4000-8000-000000000001'),'deleted','project hides immediately during recovery');
select is((select restore_until-requested_at from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000001'),interval '30 days','project deletion keeps the exact recovery window');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select lives_ok($$select public.restore_project('fb200000-0000-4000-8000-000000000001',gen_random_uuid())$$,'owner restores project inside the recovery window');
reset role;
select is((select status::text from public.projects where id='fb200000-0000-4000-8000-000000000001'),'draft','project restoration reinstates its prior state');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select lives_ok($$select public.delete_project('fb200000-0000-4000-8000-000000000002','fb220000-0000-4000-8000-000000000002',1)$$,'owner starts deletion for expiry coverage');
reset role;
update private.deletion_requests set requested_at=statement_timestamp()-interval '31 days',restore_until=statement_timestamp()-interval '1 day'
where target_project_id='fb200000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select throws_ok($$select public.restore_project('fb200000-0000-4000-8000-000000000002',gen_random_uuid())$$,'PT409','project_restore_unavailable','expired project cannot be restored');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000001','project','fb200000-0000-4000-8000-000000000002','legal','Preserve for legal review',null)$$,'administrator places a legal project hold');
reset role;
create temp table legal_project_hold as
select id from private.content_holds where request_id='fb230000-0000-4000-8000-000000000001';
grant select on legal_project_hold to authenticated;

set local role service_role;
select is(public.operator_retention_preview(100)->>'policyVersion','retention-v2','retention preview exposes the MIDI-only policy version');
select is((select (group_row->>'count')::integer from jsonb_array_elements(public.operator_retention_preview(100)->'groups') group_row where group_row->>'rule'='deletion_expired_30d'),1,'preview reports the expired project deletion');
reset role;
select is((select status from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002'),'recoverable','preview is read-only');
set local role service_role;
create temp table project_retention_run as select public.operator_start_retention_run(100) id;
reset role;
select is((select count(*) from private.retention_cleanup_jobs where subject_id=(select id from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002')),1::bigint,'start enqueues the expired deletion once');
set local role service_role;
select public.operator_start_retention_run(100);
reset role;
select is((select count(*) from private.retention_cleanup_jobs where subject_id=(select id from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002')),1::bigint,'repeated starts do not duplicate an existing retention subject');
set local role service_role;
create temp table held_project_claim as select public.operator_claim_retention_job((select id from project_retention_run)) claim;
select is((select claim from held_project_claim),null::jsonb,'legal hold prevents a deletion lease');
reset role;
select is((select status from private.retention_cleanup_jobs where subject_id=(select id from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002')),'blocked','held deletion is recorded as blocked');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from legal_project_hold),'fb230000-0000-4000-8000-000000000002','Legal review complete')$$,'administrator releases the legal hold');
reset role;
update private.retention_cleanup_jobs set status='retry',next_attempt_at=statement_timestamp()-interval '1 minute'
where subject_id=(select id from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002');
set local role service_role;
create temp table project_claim as select public.operator_claim_retention_job((select id from project_retention_run)) claim;
select ok((select claim->>'jobId' is not null from project_claim),'released deletion receives a lease');
reset role;
select ok((select delete_authorized_at is not null from private.retention_cleanup_jobs where id=(select (claim->>'jobId')::uuid from project_claim)),'claim records delete authorization before external work');
set local role service_role;
select is(public.operator_claim_retention_job((select id from project_retention_run)),null::jsonb,'leased job cannot be claimed twice');
select throws_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,gen_random_uuid(),'{}'::uuid[],'{}'::uuid[]) from project_claim$$,'PT409','retention_lease_invalid','wrong lease token cannot finalize deletion');
select lives_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],'{}'::uuid[]) from project_claim$$,'valid deletion lease finalizes');
select is((select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],'{}'::uuid[]) from project_claim),'complete','finalization replay is idempotent');
reset role;
select is((select status from private.deletion_requests where target_project_id='fb200000-0000-4000-8000-000000000002'),'purged','expired deletion is marked purged');
select ok((select purged_at is not null from public.projects where id='fb200000-0000-4000-8000-000000000002'),'expired project is irreversibly redacted after finalization');

insert into private.profile_avatar_cleanup_jobs(avatar_version_id,source_asset_id,profile_id,public_object_path,private_object_path,status,lease_token,lease_expires_at) values
('fb110000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000001/avatar.webp','fb000000-0000-4000-8000-000000000001/fb100000-0000-4000-8000-000000000001/original','leased','fb120000-0000-4000-8000-000000000001',statement_timestamp()+interval '2 minutes'),
('fb110000-0000-4000-8000-000000000002','fb100000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001/fb110000-0000-4000-8000-000000000002/avatar.webp','fb000000-0000-4000-8000-000000000001/fb100000-0000-4000-8000-000000000002/original','pending',null,null);
set local role service_role;
select throws_ok($$select public.operator_complete_profile_avatar_cleanup('fb110000-0000-4000-8000-000000000001','fb120000-0000-4000-8000-000000000001')$$,'PT409','avatar_cleanup_current','current avatar cannot be cleaned even with a valid operator lease');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000003','asset','fb100000-0000-4000-8000-000000000002','abuse','Preserve reported avatar',null)$$,'administrator places an abuse hold on a superseded avatar');
reset role;
create temp table avatar_abuse_hold as
select id from private.content_holds where request_id='fb230000-0000-4000-8000-000000000003';
grant select on avatar_abuse_hold to authenticated;
set local role service_role;
select is((select (group_row->>'count')::integer from jsonb_array_elements(public.operator_retention_preview(100)->'groups') group_row where group_row->>'rule'='avatar_superseded'),1,'preview finds one due superseded avatar');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select is((public.get_admin_storage_summary()->>'dueCleanupCount')::bigint,1::bigint,'administrator summary includes due avatar cleanup');
reset role;
set local role service_role;
create temp table avatar_run as select public.operator_start_retention_run(100) id;
create temp table held_avatar_claim as select public.operator_claim_retention_job((select id from avatar_run)) claim;
select is((select claim from held_avatar_claim),null::jsonb,'abuse hold prevents an avatar deletion lease');
reset role;
select is((select status from private.retention_cleanup_jobs where subject_id='fb110000-0000-4000-8000-000000000002'),'blocked','held avatar cleanup is recorded as blocked');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from avatar_abuse_hold),'fb230000-0000-4000-8000-000000000004','Abuse review complete')$$,'administrator releases the avatar hold');
reset role;
update private.retention_cleanup_jobs set status='retry',next_attempt_at=statement_timestamp()-interval '1 minute'
where subject_id='fb110000-0000-4000-8000-000000000002';
set local role service_role;
create temp table avatar_claim as select public.operator_claim_retention_job((select id from avatar_run)) claim;
select ok((select claim->>'jobId' is not null from avatar_claim),'released avatar cleanup receives a lease');
select throws_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,gen_random_uuid(),'{}'::uuid[],
  (select array_agg((object_row->>'id')::uuid) from jsonb_array_elements(claim->'objects') object_row)) from avatar_claim$$,
  'PT409','retention_lease_invalid','wrong lease token cannot finalize avatar cleanup');
select lives_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],
  (select array_agg((object_row->>'id')::uuid) from jsonb_array_elements(claim->'objects') object_row)) from avatar_claim$$,
  'valid avatar lease finalizes missing objects');
select is((select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],'{}'::uuid[]) from avatar_claim),'complete','avatar finalization replay is idempotent');
reset role;
select is((select status::text from public.profile_avatar_versions where id='fb110000-0000-4000-8000-000000000002'),'cleaned','superseded avatar version is cleaned');
select is((select status::text from public.assets where id='fb100000-0000-4000-8000-000000000002'),'deleted','superseded private original is deleted after object results');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select lives_ok($$select public.request_account_deletion('fb240000-0000-4000-8000-000000000001','RetentionAccount')$$,'active user starts account deletion');
reset role;
select is((select status::text from public.profiles where id='fb000000-0000-4000-8000-000000000005'),'deleted','account hides during its recovery window');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select is(public.get_own_account_recovery()->>'canRestore','true','deleted account can inspect its recovery state');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.place_content_hold('fb230000-0000-4000-8000-000000000005','profile','fb000000-0000-4000-8000-000000000005','abuse','Preserve account evidence',null)$$,'administrator places an abuse hold on deleted account data');
reset role;
create temp table account_abuse_hold as
select id from private.content_holds where request_id='fb230000-0000-4000-8000-000000000005';
grant select on account_abuse_hold to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select throws_ok($$select public.restore_own_account()$$,'PT409','recovery_held','abuse hold blocks account restoration');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from account_abuse_hold),'fb230000-0000-4000-8000-000000000006','Evidence released')$$,'administrator releases account hold');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005';
select lives_ok($$select public.restore_own_account()$$,'user restores account after hold release');
reset role;
select is((select status::text from public.profiles where id='fb000000-0000-4000-8000-000000000005'),'active','account recovery restores active state');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select throws_ok($$select public.request_account_deletion(gen_random_uuid(),'RetentionSuspended')$$,'PT403','account_delete_confirmation_invalid','suspended actor cannot start account deletion');
reset role;

select * from finish();
rollback;
