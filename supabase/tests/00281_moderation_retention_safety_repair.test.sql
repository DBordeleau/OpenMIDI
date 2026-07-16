begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(25);

select has_column('private','retention_cleanup_jobs','delete_authorized_at','cleanup jobs record delete authorization');
select has_function('public','list_admin_rejectable_uploads',array[]::text[],'administrator can list rejectable uploads');
select has_trigger('public','project_asset_references','project_asset_references_retention_barrier','project references honor the deletion barrier');
select has_trigger('public','revision_tracks','revision_tracks_retention_barrier','revision tracks honor the deletion barrier');
select has_trigger('public','workspace_tracks','workspace_tracks_retention_barrier','workspace tracks honor the deletion barrier');
select has_trigger('public','contribution_version_tracks','contribution_version_tracks_retention_barrier','contribution tracks honor the deletion barrier');
select has_trigger('public','profiles','profiles_deleted_account_authority','deleted accounts remain under the user recovery workflow');
select ok(not has_function_privilege('authenticated','private.asset_has_authorized_retention_job(uuid)','execute'),'application callers cannot inspect internal deletion authorization');
select ok(has_function_privilege('authenticated','public.list_admin_rejectable_uploads()','execute'),'authenticated callers may request an admin-verified upload list');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000001','authenticated','authenticated','repair-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000002','authenticated','authenticated','repair-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000003','authenticated','authenticated','purged-owner@example.test','','{}','{}',now(),now());
update public.profiles set username='RepairOwner',username_normalized='repairowner',display_name='Repair Owner',credit_name='Repair Owner',profile_completed_at=now() where id='fa000000-0000-4000-8000-000000000001';
update public.profiles set username='RepairAdmin',username_normalized='repairadmin',display_name='Repair Admin',credit_name='Repair Admin',profile_completed_at=now() where id='fa000000-0000-4000-8000-000000000002';
update public.profiles set username='PurgedOwner',username_normalized='purgedowner',display_name='Deleted musician',credit_name='Purged Owner',profile_completed_at=now(),status='deleted',purged_at=now()-interval '1 hour' where id='fa000000-0000-4000-8000-000000000003';
insert into private.app_admins(user_id,created_by) values('fa000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000002');

select throws_ok(
  $$update public.profiles set status='active' where id='fa000000-0000-4000-8000-000000000003'$$,
  'PT409',
  'account_deletion_user_controlled',
  'an operator cannot bypass the deleted account recovery workflow'
);

insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,failure_code,failed_at,created_at) values
('fa100000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','failed','fa000000-0000-4000-8000-000000000001/fa100000-0000-4000-8000-000000000001/source','first.wav',1024,'cancelled',now()-interval '25 hours',now()-interval '26 hours'),
('fa100000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001','reserved','fa000000-0000-4000-8000-000000000001/fa100000-0000-4000-8000-000000000002/source','second.wav',1024,null,null,now()-interval '1 hour');

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
select lives_ok($$select public.reject_admin_upload('fa100000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','failed','Confirmed invalid upload')$$,'administrator rejects an eligible upload');
select lives_ok($$select public.reject_admin_upload('fa100000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','failed','Confirmed invalid upload')$$,'exact upload rejection retry is idempotent');
select throws_ok($$select public.reject_admin_upload('fa100000-0000-4000-8000-000000000002','fa200000-0000-4000-8000-000000000001','reserved','Confirmed invalid upload')$$,'PT409','upload_rejection_request_conflict','request reuse with another upload is rejected before mutation');
reset role;
select is((select count(*) from private.moderation_actions where request_id='fa200000-0000-4000-8000-000000000001'),1::bigint,'upload rejection has one audit row');
select is((select status::text from public.assets where id='fa100000-0000-4000-8000-000000000002'),'reserved','conflicting request leaves the second upload unchanged');

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
select lives_ok($$select public.place_content_hold('fa200000-0000-4000-8000-000000000002','asset','fa100000-0000-4000-8000-000000000002','abuse','Preserve exact upload',null)$$,'administrator places an asset hold');
select lives_ok($$select public.place_content_hold('fa200000-0000-4000-8000-000000000002','asset','fa100000-0000-4000-8000-000000000002','abuse','Preserve exact upload',null)$$,'exact hold retry is idempotent');
select throws_ok($$select public.place_content_hold('fa200000-0000-4000-8000-000000000002','profile','fa000000-0000-4000-8000-000000000001','abuse','Preserve exact upload',null)$$,'PT409','hold_request_conflict','hold request reuse with another target is rejected');
reset role;
select is((select count(*) from private.content_holds where request_id='fa200000-0000-4000-8000-000000000002'),1::bigint,'hold retry creates one hold');

-- Claiming performs the locked blocker recheck and installs the barrier before
-- any Storage path is returned to the operator.
update private.content_holds set released_by='fa000000-0000-4000-8000-000000000002',released_at=now() where request_id='fa200000-0000-4000-8000-000000000002';
update public.assets set failed_at=now()-interval '25 hours' where id='fa100000-0000-4000-8000-000000000001';
set local role service_role;
create temp table repair_run as select public.operator_start_retention_run(100) id;
create temp table repair_claim as select public.operator_claim_retention_job((select id from repair_run)) claim;
select ok((select (claim->>'jobId') is not null from repair_claim),'claim returns an authorized cleanup job');
reset role;
select ok((select delete_authorized_at is not null from private.retention_cleanup_jobs where id=(select (claim->>'jobId')::uuid from repair_claim)),'claim records delete authorization before external work');
grant select on repair_claim to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
select throws_ok($$select public.place_content_hold(gen_random_uuid(),'asset',(select (claim->>'subjectId')::uuid from repair_claim),'legal','Too late for this deletion attempt',null)$$,'PT409','hold_retention_delete_authorized','new hold is rejected while deletion is authorized');
reset role;
set local role service_role;
select lives_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],array[(claim->'objects'->0->>'id')::uuid]) from repair_claim$$,'authorized missing object finalizes safely');
reset role;

-- A purged account's ready, unreferenced source becomes a named candidate.
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at,created_at)
values('fa100000-0000-4000-8000-000000000003','fa000000-0000-4000-8000-000000000003','ready','fa000000-0000-4000-8000-000000000003/fa100000-0000-4000-8000-000000000003/source','orphan.wav',2048,'audio/wav',2048,repeat('a',64),1000,48000,2,'fixture-v1',now()-interval '2 hours',now()-interval '2 hours');
insert into public.user_storage_usage(user_id,source_bytes) values('fa000000-0000-4000-8000-000000000003',2048) on conflict(user_id) do update set source_bytes=excluded.source_bytes;
update public.global_storage_usage set source_bytes=source_bytes+2048 where singleton;
set local role service_role;
select is((select (g->>'count')::integer from jsonb_array_elements(public.operator_retention_preview(100)->'groups') g where g->>'rule'='account_source_30d'),1,'preview includes a purged account source candidate');
create temp table account_run as select public.operator_start_retention_run(100) id;
reset role;
select is((select count(*) from private.retention_cleanup_jobs where run_id=(select id from account_run) and rule_code='account_source_30d'),1::bigint,'execution enqueues the named account-source rule');

select * from finish();
rollback;
