begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(57);

select has_table('private', 'beta_feedback', 'private feedback authority exists');
select has_table('private', 'beta_feedback_deletion_audit', 'minimal deletion audit exists');
select has_function('public', 'submit_beta_feedback', array['uuid','text','text','text','text','text','text'], 'submission command exists');
select has_function('public', 'list_admin_beta_feedback', array['text','text','timestamp with time zone','uuid'], 'admin queue command exists');
select has_function('public', 'get_admin_beta_feedback', array['uuid'], 'admin detail command exists');
select has_function('public', 'mutate_admin_beta_feedback', array['uuid','uuid','text','integer','text','text','text'], 'admin mutation command exists');
select ok((select relrowsecurity from pg_class where oid='private.beta_feedback'::regclass), 'feedback RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='private.beta_feedback_deletion_audit'::regclass), 'audit RLS is enabled');
select ok(not has_table_privilege('authenticated', 'private.beta_feedback', 'select'), 'authenticated users cannot read feedback directly');
select ok(not has_table_privilege('authenticated', 'private.beta_feedback', 'insert'), 'authenticated users cannot insert feedback directly');
select ok(not has_table_privilege('authenticated', 'private.beta_feedback', 'update'), 'authenticated users cannot update feedback directly');
select ok(not has_table_privilege('authenticated', 'private.beta_feedback', 'delete'), 'authenticated users cannot delete feedback directly');
select ok(not has_table_privilege('authenticated', 'private.beta_feedback_deletion_audit', 'select'), 'authenticated users cannot read deletion audit directly');
select ok(not has_function_privilege('public', 'public.submit_beta_feedback(uuid,text,text,text,text,text,text)', 'execute'), 'PUBLIC cannot execute submission');
select ok(not has_function_privilege('anon', 'public.submit_beta_feedback(uuid,text,text,text,text,text,text)', 'execute'), 'anonymous cannot execute submission');
select ok(has_function_privilege('authenticated', 'public.submit_beta_feedback(uuid,text,text,text,text,text,text)', 'execute'), 'authenticated receives submission command only');
select ok(not has_function_privilege('anon', 'public.list_admin_beta_feedback(text,text,timestamp with time zone,uuid)', 'execute'), 'anonymous cannot execute admin queue');
select ok(has_function_privilege('authenticated', 'public.list_admin_beta_feedback(text,text,timestamp with time zone,uuid)', 'execute'), 'authenticated role can reach database admin guard');
select columns_are(
  'private', 'beta_feedback_deletion_audit',
  array['feedback_id','original_kind','deleted_by','deleted_at','deletion_reason'],
  'deletion audit retains only the accepted minimal fields'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000001','authenticated','authenticated','feedback-member@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000002','authenticated','authenticated','feedback-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000003','authenticated','authenticated','feedback-incomplete@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000004','authenticated','authenticated','feedback-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000005','authenticated','authenticated','feedback-deleted@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000006','authenticated','authenticated','feedback-admin@example.test','','{}','{}',now(),now());

update public.profiles set username='FeedbackMember',username_normalized='feedbackmember',display_name='Feedback Member',credit_name='Feedback Member',profile_completed_at=now(),status='active' where id='fc000000-0000-4000-8000-000000000001';
update public.profiles set username='FeedbackOther',username_normalized='feedbackother',display_name='Feedback Other',credit_name='Feedback Other',profile_completed_at=now(),status='active' where id='fc000000-0000-4000-8000-000000000002';
update public.profiles set username='FeedbackSuspended',username_normalized='feedbacksuspended',display_name='Feedback Suspended',credit_name='Feedback Suspended',profile_completed_at=now(),status='suspended' where id='fc000000-0000-4000-8000-000000000004';
update public.profiles set username='FeedbackDeleted',username_normalized='feedbackdeleted',display_name='Feedback Deleted',credit_name='Feedback Deleted',profile_completed_at=now(),status='deleted' where id='fc000000-0000-4000-8000-000000000005';
update public.profiles set username='FeedbackAdmin',username_normalized='feedbackadmin',display_name='Feedback Admin',credit_name='Feedback Admin',profile_completed_at=now(),status='active' where id='fc000000-0000-4000-8000-000000000006';
insert into private.app_admins(user_id,created_by) values ('fc000000-0000-4000-8000-000000000006','fc000000-0000-4000-8000-000000000006');

set local role anon;
select throws_ok(
  $$select * from public.submit_beta_feedback(gen_random_uuid(),'bug','Broken playback','Playback stops after the first measure.','/studio/test','test',null)$$,
  '42501', 'permission denied for function submit_beta_feedback',
  'anonymous submission is denied by the execute grant'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select * from public.submit_beta_feedback(gen_random_uuid(),'bug','Incomplete profile','This profile is not eligible to submit.','/feedback','test',null)$$,
  'PT403','feedback_actor_ineligible','incomplete actor is denied'
);
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select * from public.submit_beta_feedback(gen_random_uuid(),'bug','Suspended profile','This profile is not eligible to submit.','/feedback','test',null)$$,
  'PT403','feedback_actor_ineligible','suspended actor is denied'
);
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000005';
select throws_ok(
  $$select * from public.submit_beta_feedback(gen_random_uuid(),'bug','Deleted profile','This profile is not eligible to submit.','/feedback','test',null)$$,
  'PT403','feedback_actor_ineligible','deleted actor is denied'
);

set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select ok(
  (select reference_id from public.submit_beta_feedback(
    'fc100000-0000-4000-8000-000000000001','bug','  Playback loses the beat  ',
    '  Playback stops after the first full measure in Studio.  ','/studio/demo','sha-abc','Firefox on Linux'
  )) like 'FB-%',
  'eligible active actor receives a durable reference'
);
reset role;
select reference_id as target_reference_id
from private.beta_feedback
where request_id='fc100000-0000-4000-8000-000000000001' \gset
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select is(
  (select reference_id from public.submit_beta_feedback(
    'fc100000-0000-4000-8000-000000000001','bug','Playback loses the beat',
    'Playback stops after the first full measure in Studio.','/studio/demo','sha-abc','Firefox on Linux'
  )),
  :'target_reference_id',
  'identical retry returns the original reference'
);
select throws_ok(
  $$select * from public.submit_beta_feedback(
    'fc100000-0000-4000-8000-000000000001','suggestion','Playback loses the beat',
    'Playback stops after the first full measure in Studio.','/studio/demo','sha-abc','Firefox on Linux'
  )$$,
  'PT409','feedback_request_conflict','conflicting request ID reuse is denied'
);
select throws_ok(
  $$select * from public.submit_beta_feedback(
    gen_random_uuid(),'bug','External path denied','The source path must stay inside this application.','https://example.test/steal','test',null
  )$$,
  'PT400','feedback_invalid','external source path is rejected'
);
select throws_ok(
  $$select * from public.submit_beta_feedback(
    gen_random_uuid(),'bug','Query path denied','The source path must not retain query details.','/feedback?token=secret','test',null
  )$$,
  'PT400','feedback_invalid','query-bearing source path is rejected'
);
reset role;

select is((select summary from private.beta_feedback where request_id='fc100000-0000-4000-8000-000000000001'),'Playback loses the beat','submission text is normalized in SQL');
select is((select source_pathname from private.beta_feedback where request_id='fc100000-0000-4000-8000-000000000001'),'/studio/demo','only the disclosed pathname is stored');

-- Hourly boundary: four accepted rows already in the rolling window, then the fifth succeeds.
insert into private.beta_feedback(submitter_id,request_id,kind,summary,details,source_pathname,application_version,created_at)
select 'fc000000-0000-4000-8000-000000000001', gen_random_uuid(), 'bug',
  'Hourly fixture ' || value, 'A bounded hourly rate fixture detail ' || value || '.', '/feedback', 'test', now()-interval '10 minutes'
from generate_series(1,3) value;
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select * from public.submit_beta_feedback(
    'fc100000-0000-4000-8000-000000000005','suggestion','Fifth hourly submission','This submission is accepted at the hourly boundary.','/feedback','test',null
  )$$,
  'the fifth rolling-hour submission is accepted'
);
select throws_ok(
  $$select * from public.submit_beta_feedback(
    'fc100000-0000-4000-8000-000000000006','suggestion','Sixth hourly submission','This submission exceeds the rolling hourly boundary.','/feedback','test',null
  )$$,
  'PT429','feedback_hourly_limit','the sixth rolling-hour submission is denied'
);
reset role;

-- Daily boundary uses the second active actor and rows older than one hour.
insert into private.beta_feedback(submitter_id,request_id,kind,summary,details,source_pathname,application_version,created_at)
select 'fc000000-0000-4000-8000-000000000002', gen_random_uuid(), 'suggestion',
  'Daily fixture ' || value, 'A bounded daily rate fixture detail ' || value || '.', '/feedback', 'test', now()-interval '2 hours'
from generate_series(1,19) value;
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select * from public.submit_beta_feedback(
    'fc200000-0000-4000-8000-000000000020','suggestion','Twentieth daily submission','This submission is accepted at the daily boundary.','/feedback','test',null
  )$$,
  'the twentieth rolling-day submission is accepted'
);
select throws_ok(
  $$select * from public.submit_beta_feedback(
    'fc200000-0000-4000-8000-000000000021','suggestion','Twenty first daily submission','This submission exceeds the rolling daily boundary.','/feedback','test',null
  )$$,
  'PT429','feedback_daily_limit','the twenty-first rolling-day submission is denied'
);
reset role;

insert into private.beta_feedback(
  id,submitter_id,request_id,kind,summary,details,source_pathname,application_version,browser_context
) values (
  'fc400000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001',
  'fc410000-0000-4000-8000-000000000001','bug','Admin triage fixture',
  'A dedicated feedback row for administrator state transitions.','/feedback','test','Firefox test context'
);

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.list_admin_beta_feedback(null,null,null,null)$$,
  'PT404','admin_not_found','non-admin cannot list feedback'
);
select throws_ok(
  $$select public.get_admin_beta_feedback('fc400000-0000-4000-8000-000000000001'::uuid)$$,
  'PT404','admin_not_found','non-admin cannot inspect feedback detail'
);
select throws_ok(
  $$select public.mutate_admin_beta_feedback('fc400000-0000-4000-8000-000000000001'::uuid,gen_random_uuid(),'handle',1,null,null,null)$$,
  'PT404','admin_not_found','non-admin cannot mutate feedback'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000006';
select throws_ok(
  $$select public.list_admin_beta_feedback('invalid',null,null,null)$$,
  'PT400','feedback_filter_invalid','admin status filter is bounded'
);
select throws_ok(
  $$select public.list_admin_beta_feedback(null,null,now(),null)$$,
  'PT400','feedback_filter_invalid','partial keyset cursor is rejected'
);
select is(jsonb_array_length(public.list_admin_beta_feedback(null,null,null,null)),25,'admin queue page is bounded to 25 rows');
select ok(
  (select bool_and(item->>'kind'='bug') from jsonb_array_elements(public.list_admin_beta_feedback(null,'bug',null,null)) item),
  'kind filter returns only matching rows'
);
select is(
  public.get_admin_beta_feedback('fc400000-0000-4000-8000-000000000001'::uuid)->>'submitterUsername',
  'FeedbackMember', 'admin detail exposes username but not Auth email'
);
select ok(
  not (public.get_admin_beta_feedback('fc400000-0000-4000-8000-000000000001'::uuid) ? 'email'),
  'admin detail does not expose Auth email or provider metadata'
);

select is(
  public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000001','classify',1,'suggestion',null,null
  )->>'kind',
  'suggestion','administrator reclassifies feedback'
);
select is(
  public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000001','classify',1,'suggestion',null,null
  )->>'lockVersion',
  '2','identical administrator retry returns the original result'
);
select throws_ok(
  $$select public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000001','handle',2,null,null,null
  )$$,
  'PT409','feedback_admin_request_conflict','conflicting administrator request ID reuse is denied'
);
select throws_ok(
  $$select public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    gen_random_uuid(),'handle',1,null,null,null
  )$$,
  'PT409','feedback_stale','stale lock version is denied'
);
select is(
  public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000002','handle',2,null,'Reviewed for the next beta build.',null
  )->>'status',
  'handled','administrator marks feedback handled'
);
select is(
  public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000003','reopen',3,null,null,null
  )->>'status',
  'new','administrator reopens handled feedback'
);

select is(
  public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000004','delete',4,null,null,'Irrelevant duplicate from a test run.'
  )->>'deleted',
  'true','administrator deletes irrelevant feedback atomically'
);
reset role;
select is((select count(*) from private.beta_feedback where id='fc400000-0000-4000-8000-000000000001'),0::bigint,'deleted feedback content and actor relationship are removed');
select is((select count(*) from private.beta_feedback_admin_requests where feedback_id not in (select id from private.beta_feedback)),0::bigint,'deleted feedback leaves no mutation payload or private note history');
select is((select original_kind from private.beta_feedback_deletion_audit limit 1),'suggestion','minimal audit retains original classification');
select is((select deletion_reason from private.beta_feedback_deletion_audit limit 1),'Irrelevant duplicate from a test run.','minimal audit retains bounded deletion reason');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000006';
select lives_ok(
  $$select public.mutate_admin_beta_feedback(
    'fc400000-0000-4000-8000-000000000001'::uuid,
    'fc300000-0000-4000-8000-000000000004','delete',4,null,null,'Irrelevant duplicate from a test run.'
  )$$,
  'identical delete retry is an idempotent success without retaining request payload'
);
reset role;

select throws_ok(
  $$update private.beta_feedback_deletion_audit set deletion_reason='Changed after deletion'$$,
  'PT403','append_only_record','deletion audit cannot be updated'
);
select throws_ok(
  $$delete from private.beta_feedback_deletion_audit$$,
  'PT403','append_only_record','deletion audit cannot be deleted'
);

select * from finish();
rollback;
