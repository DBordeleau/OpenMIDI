begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(50);

select has_table('private','moderation_reports','private reports exist');
select has_table('private','moderation_actions','append-only actions exist');
select has_table('private','content_holds','content holds exist');
select has_table('private','deletion_requests','recoverable deletion intents exist');
select has_table('private','retention_cleanup_jobs','retention jobs exist');
select has_function('public','submit_moderation_report',array['uuid','text','uuid','text','text'],'report command exists');
select has_function('public','operator_retention_preview',array['integer'],'preview command exists');
select has_function('private','retention_blockers',array['uuid'],'central blocker graph exists');
select has_column('public','profiles','moderation_state','profiles have moderation projection');
select has_column('public','projects','moderation_state','projects have moderation projection');
select has_column('public','contributions','deleted_at','contributions have deletion projection');
select has_trigger('public','projects','projects_hidden_mutation','hidden projects reject application mutations');
select has_trigger('public','contributions','contributions_hidden_mutation','hidden contributions reject application mutations');
select ok(not has_table_privilege('authenticated','private.moderation_reports','select'),'application roles cannot read report rows');
select ok(not has_function_privilege('authenticated','public.operator_retention_preview(integer)','execute'),'application roles cannot preview retention');
select ok(has_function_privilege('service_role','public.operator_retention_preview(integer)','execute'),'service role owns retention preview');
select ok(has_function_privilege('authenticated','public.assert_viewer_admin()','execute'),'authenticated callers may request a database admin assertion');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f8000000-0000-4000-8000-000000000001','authenticated','authenticated','reporter@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f8000000-0000-4000-8000-000000000002','authenticated','authenticated','target@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f8000000-0000-4000-8000-000000000003','authenticated','authenticated','admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f8000000-0000-4000-8000-000000000004','authenticated','authenticated','suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f8000000-0000-4000-8000-000000000005','authenticated','authenticated','deleted@example.test','','{}','{}',now(),now());
update public.profiles set username='Reporter',username_normalized='reporter',display_name='Reporter',credit_name='Reporter',profile_completed_at=now() where id='f8000000-0000-4000-8000-000000000001';
update public.profiles set username='Target',username_normalized='target',display_name='Target',credit_name='Target',profile_completed_at=now() where id='f8000000-0000-4000-8000-000000000002';
update public.profiles set username='AdminUser',username_normalized='adminuser',display_name='Admin User',credit_name='Admin User',profile_completed_at=now() where id='f8000000-0000-4000-8000-000000000003';
update public.profiles set username='SuspendedUser',username_normalized='suspendeduser',display_name='Suspended',credit_name='Suspended',profile_completed_at=now(),status='suspended' where id='f8000000-0000-4000-8000-000000000004';
update public.profiles set username='DeletedUser',username_normalized='deleteduser',display_name='Deleted',credit_name='Deleted',profile_completed_at=now(),status='deleted' where id='f8000000-0000-4000-8000-000000000005';
insert into private.app_admins(user_id,created_by) values('f8000000-0000-4000-8000-000000000003','f8000000-0000-4000-8000-000000000003');

set local role anon;
select throws_ok($$select public.submit_moderation_report(gen_random_uuid(),'profile','f8000000-0000-4000-8000-000000000002','spam',null)$$,'42501','permission denied for function submit_moderation_report','anonymous report is denied by grant');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000004';
select throws_ok($$select public.submit_moderation_report(gen_random_uuid(),'profile','f8000000-0000-4000-8000-000000000002','spam',null)$$,'PT403','report_actor_ineligible','suspended reporter is denied');
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000005';
select throws_ok($$select public.submit_moderation_report(gen_random_uuid(),'profile','f8000000-0000-4000-8000-000000000002','spam',null)$$,'PT403','report_actor_ineligible','deleted reporter is denied');
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_moderation_report(gen_random_uuid(),'profile','f8000000-0000-4000-8000-000000000001','spam',null)$$,'PT404','report_target_not_found','self-report is denied');
select lives_ok($$select public.submit_moderation_report('f8100000-0000-4000-8000-000000000001','profile','f8000000-0000-4000-8000-000000000002','harassment','A bounded detail')$$,'active reporter submits a visible profile report');
select lives_ok($$select public.submit_moderation_report('f8100000-0000-4000-8000-000000000001','profile','f8000000-0000-4000-8000-000000000002','harassment','A bounded detail')$$,'exact report retry is idempotent');
reset role;
select is((select count(*) from private.moderation_reports),1::bigint,'retry creates one private report');
select is((select moderation_state from public.profiles where id='f8000000-0000-4000-8000-000000000002'),'visible','report submission does not auto-hide');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
select is(jsonb_array_length(public.list_viewer_reports(null,null)),1,'reporter receives one coarse status row');
select ok(not ((public.list_viewer_reports(null,null)->0) ? 'detail'),'reporter payload omits detail');
select is(public.assert_viewer_admin(),false,'non-admin display probe returns false without raising');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000003';
select ok(public.assert_viewer_admin(),'database-verified administrator is accepted');
select is(jsonb_array_length(public.list_admin_moderation_queue(null,null)),1,'admin sees bounded queue');
select lives_ok($$select public.apply_moderation_action((public.list_admin_moderation_queue(null,null)->0->>'id')::uuid,'f8200000-0000-4000-8000-000000000001','hide','Manual review confirmed','submitted',1)$$,'admin hides target with expected state');
reset role;
select is((select moderation_state from public.profiles where id='f8000000-0000-4000-8000-000000000002'),'hidden','hide changes only moderation projection');
set local role anon;
select is((select count(*) from public.public_profiles where id='f8000000-0000-4000-8000-000000000002'),0::bigint,'hidden profile leaves public projection');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000003';
select throws_ok($$select public.apply_moderation_action((select id from private.moderation_reports limit 1),gen_random_uuid(),'restore','stale','submitted',1)$$,'42501','permission denied for table moderation_reports','admin cannot bypass private table grants from caller SQL');
select lives_ok($$select public.place_content_hold('f8300000-0000-4000-8000-000000000001','profile','f8000000-0000-4000-8000-000000000002','abuse','Preserve during review',null)$$,'admin places explicit profile hold');
reset role;
select is((select count(*) from private.content_holds where released_at is null),1::bigint,'hold is active');
create temp table hold_fixture as select id from private.content_holds limit 1;
grant select on hold_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000003';
select lives_ok($$select public.release_content_hold((select id from hold_fixture),'f8300000-0000-4000-8000-000000000002','Review complete')$$,'admin releases hold explicitly');
reset role;

-- Owner project deletion keeps history and records a 30-day recovery intent.
insert into public.projects(id,owner_id,create_request_id,title,license_code)
values('f8400000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000002','Recoverable draft','all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by)
values('f8400000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000001','owner','f8000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
select lives_ok($$select public.delete_project('f8400000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000003',1)$$,'existing delete_project signature creates recoverable intent');
reset role;
select is((select status::text from public.projects where id='f8400000-0000-4000-8000-000000000001'),'deleted','project hides immediately');
select is((select restore_until-requested_at from private.deletion_requests where target_project_id='f8400000-0000-4000-8000-000000000001'),interval '30 days','recovery window is exactly 30 days');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
select lives_ok($$select public.restore_project('f8400000-0000-4000-8000-000000000001',gen_random_uuid())$$,'owner restores within the recovery window');
reset role;
select is((select status::text from public.projects where id='f8400000-0000-4000-8000-000000000001'),'draft','restore reinstates prior project state');

-- A failed unreferenced source object is previewed, leased, and finalized once.
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
select lives_ok($$select public.reserve_source_asset('f8500000-0000-4000-8000-000000000001',1024,'cleanup.wav','audio/wav',1000,null)$$,'owner reserves cleanup fixture');
select lives_ok($$select public.cancel_source_upload((select id from public.assets where original_filename='cleanup.wav'))$$,'owner cancels cleanup fixture');
reset role;
update public.assets set failed_at=statement_timestamp()-interval '25 hours' where original_filename='cleanup.wav';
set local role service_role;
select is((public.operator_retention_preview(100)->'groups'->0->>'count')::integer,1,'preview finds one eligible failed upload without mutation');
reset role;
select is((select status::text from public.assets where original_filename='cleanup.wav'),'failed','preview leaves domain state unchanged');
set local role service_role;
create temp table retention_run as select public.operator_start_retention_run(100) id;
create temp table retention_claim as select public.operator_claim_retention_job((select id from retention_run)) claim;
select is((select claim->>'rule' from retention_claim),'failed_upload_24h','operator claims named retention rule');
select lives_ok($$select public.operator_finalize_retention_job((claim->>'jobId')::uuid,(claim->>'leaseToken')::uuid,'{}'::uuid[],array[(claim->'objects'->0->>'id')::uuid]) from retention_claim$$,'missing Storage object finalizes idempotently');
reset role;
select is((select status::text from public.assets where original_filename='cleanup.wav'),'deleted','finalizer changes domain state only after object result');
select is((select count(*) from storage.objects),0::bigint,'SQL finalizer never inserts or deletes Storage metadata');

select * from finish();
rollback;
