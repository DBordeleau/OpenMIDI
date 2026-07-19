begin;
reset role;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(7);

select extensions.dblink_connect('award_a','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');
select extensions.dblink_connect('award_b','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');

select extensions.dblink_exec('award_a',$remote$
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','fe000000-0000-4000-8000-000000000001','authenticated','authenticated','award-concurrency-admin@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','fe000000-0000-4000-8000-000000000002','authenticated','authenticated','award-concurrency-entry@example.test','','{}','{}',now(),now());
  update public.profiles set username='AwardConcurrency'||right(id::text,1),username_normalized=lower('AwardConcurrency'||right(id::text,1)),
    display_name='Award Concurrency',credit_name='Award Concurrency',profile_completed_at=now()
    where id::text like 'fe000000-0000-4000-8000-%';
  insert into private.app_admins(user_id,created_by) values
    ('fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001');
  insert into public.projects(id,owner_id,create_request_id,title,license_code)
    values('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),
      'Award concurrency source','cc-by-4.0');
  insert into public.project_members(project_id,user_id,role,created_by) values
    ('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001','owner','fe000000-0000-4000-8000-000000000001');
  insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
    manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
  values('fe200000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',
    gen_random_uuid(),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),120,4,4,'c-major',480,1920);
  insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,
    engine_version,manifest_sha256,duration_ms,arrangement_version_id)
  values('fe300000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001',1,'fe000000-0000-4000-8000-000000000001',
    gen_random_uuid(),'{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('2',64),2000,'fe200000-0000-4000-8000-000000000001');
  update public.projects set current_revision_id='fe300000-0000-4000-8000-000000000001',status='active',visibility='private',published_at=now()
    where id='fe100000-0000-4000-8000-000000000001';
  insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version)
    values('fe400000-0000-4000-8000-000000000001','award-concurrency-test','fe000000-0000-4000-8000-000000000001','published',now(),2);
  insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,
    eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
    judging_mode,official_placement_count,constraints,constraints_sha256)
  values('fe500000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000001',1,'fe000000-0000-4000-8000-000000000001',
    gen_random_uuid(),'Award concurrency','Hear the exact entry.','Reconciliation contention fixture.','Original work.','pulse',
    now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day','hybrid',1,
    private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('a',64));
  update public.challenges set current_version_id='fe500000-0000-4000-8000-000000000001'
    where id='fe400000-0000-4000-8000-000000000001';
  insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,
    project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,
    revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,
    facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
  values('fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000001','fe500000-0000-4000-8000-000000000001',
    'fe000000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000001',
    'Exact contention entry','AwardConcurrency2','Award Concurrency','Award Concurrency',1,
    '[{"kind":"publisher","creditName":"Award Concurrency"}]',2000,'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',
    repeat('3',64),gen_random_uuid(),now()-interval '3 days');
  insert into public.challenge_results(id,challenge_id,challenge_version_id,result_version,finalized_by,request_id,public_note)
  values('fe700000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000001','fe500000-0000-4000-8000-000000000001',
    1,'fe000000-0000-4000-8000-000000000001','fe800000-0000-4000-8000-000000000001','Exact frozen result.');
  insert into public.challenge_result_entries(challenge_result_id,challenge_entry_id,final_vote_total)
  values('fe700000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001',4);
  insert into public.challenge_result_placements(challenge_result_id,place,challenge_entry_id,placement_label)
  values('fe700000-0000-4000-8000-000000000001',1,'fe600000-0000-4000-8000-000000000001','Winner');
  insert into public.challenge_result_community_favorites(challenge_result_id,challenge_entry_id,final_vote_total)
  values('fe700000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001',4);
  update public.challenges set state='completed',completed_at=now(),current_result_id='fe700000-0000-4000-8000-000000000001',
    lifecycle_version=3 where id='fe400000-0000-4000-8000-000000000001';
$remote$);

create temp table award_backend as select pid from extensions.dblink('award_b','select pg_backend_pid()') as response(pid integer);
create temp table award_results(attempt text,response jsonb);

select extensions.dblink_exec('award_a','begin');
select extensions.dblink_exec('award_a',$remote$do $$ begin perform pg_advisory_xact_lock(hashtextextended(
  'fe000000-0000-4000-8000-000000000001:fe900000-0000-4000-8000-000000000001',0)); end $$;$remote$);
select extensions.dblink_exec('award_a','set local role authenticated');
select extensions.dblink_exec('award_a',$remote$set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_exec('award_b','begin');
select extensions.dblink_exec('award_b','set local role authenticated');
select extensions.dblink_exec('award_b',$remote$set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_send_query('award_b',$remote$select public.reconcile_current_challenge_awards(
  'fe400000-0000-4000-8000-000000000001','fe900000-0000-4000-8000-000000000001','fe700000-0000-4000-8000-000000000001')$remote$);
do $$ declare i integer; begin
  for i in 1..100 loop
    exit when exists(select 1 from pg_stat_activity where pid=(select pid from award_backend) and wait_event_type='Lock');
    perform pg_sleep(0.01);
  end loop;
  if not exists(select 1 from pg_stat_activity where pid=(select pid from award_backend) and wait_event_type='Lock')
  then raise exception 'award reconciliation did not reach request lock'; end if;
end $$;
insert into award_results select 'first',response from extensions.dblink('award_a',$remote$select public.reconcile_current_challenge_awards(
  'fe400000-0000-4000-8000-000000000001','fe900000-0000-4000-8000-000000000001','fe700000-0000-4000-8000-000000000001')$remote$)
  as result(response jsonb);
select extensions.dblink_exec('award_a','commit');
insert into award_results select 'waiter',response from extensions.dblink_get_result('award_b') as result(response jsonb);
select count(*) from extensions.dblink_get_result('award_b') as result(response jsonb);
select extensions.dblink_exec('award_b','commit');

select is((select response from award_results where attempt='waiter'),(select response from award_results where attempt='first'),
  'concurrent identical reconciliation requests replay one deterministic response');
select is((select response->>'totalAwardsInserted' from award_results where attempt='first'),'2',
  'the serialized winner and favorite reconciliation inserts the complete award set once');
select is((select count(*) from public.profile_awards where challenge_result_id='fe700000-0000-4000-8000-000000000001'),2::bigint,
  'concurrent reconciliation retains one award per result, entry, and badge kind');
select is((select count(*) from private.challenge_award_issuance where source_kind='reconciliation'
    and request_id='fe900000-0000-4000-8000-000000000001'),1::bigint,
  'concurrent replay retains one reconciliation audit row');
select is((select count(*) from private.challenge_award_issuance where source_kind='result_finalization'
    and challenge_result_id='fe700000-0000-4000-8000-000000000001'),1::bigint,
  'issuance retains one exact-result derivation audit row');

select extensions.dblink_exec('award_a','begin');
select extensions.dblink_exec('award_a','set local role authenticated');
select extensions.dblink_exec('award_a',$remote$set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001'$remote$);
create temp table later_reconciliation as select response from extensions.dblink('award_a',$remote$select public.reconcile_current_challenge_awards(
  'fe400000-0000-4000-8000-000000000001','fe900000-0000-4000-8000-000000000002','fe700000-0000-4000-8000-000000000001')$remote$)
  as result(response jsonb);
select extensions.dblink_exec('award_a','commit');
select is((select response->>'totalAwardsInserted' from later_reconciliation),'0',
  'a later reconciliation request remains idempotent against existing immutable awards');
select extensions.dblink_exec('award_a',$remote$create or replace function pg_temp.try_stale_award_reconcile()
  returns text language plpgsql as $$ begin
    perform public.reconcile_current_challenge_awards(
      'fe400000-0000-4000-8000-000000000001',gen_random_uuid(),'fe700000-0000-4000-8000-000000000002');
    return 'ok';
  exception when others then return sqlstate||':'||sqlerrm; end $$;$remote$);
select extensions.dblink_exec('award_a','begin');
select extensions.dblink_exec('award_a','set local role authenticated');
select extensions.dblink_exec('award_a',$remote$set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001'$remote$);
create temp table stale_reconciliation as select response from extensions.dblink('award_a','select pg_temp.try_stale_award_reconcile()')
  as result(response text);
select extensions.dblink_exec('award_a','commit');
select is((select response from stale_reconciliation),'PT409:challenge_award_result_not_current',
  'noncurrent expected result authority is rejected under the same row lock');

select extensions.dblink_exec('award_a',$remote$
  set session_replication_role=replica;
  delete from private.challenge_award_issuance where challenge_id='fe400000-0000-4000-8000-000000000001';
  delete from public.profile_awards where challenge_id='fe400000-0000-4000-8000-000000000001';
  update public.challenges set current_result_id=null where id='fe400000-0000-4000-8000-000000000001';
  delete from public.challenge_result_community_favorites where challenge_result_id='fe700000-0000-4000-8000-000000000001';
  delete from public.challenge_result_placements where challenge_result_id='fe700000-0000-4000-8000-000000000001';
  delete from public.challenge_result_entries where challenge_result_id='fe700000-0000-4000-8000-000000000001';
  delete from public.challenge_results where id='fe700000-0000-4000-8000-000000000001';
  delete from public.challenge_entries where challenge_id='fe400000-0000-4000-8000-000000000001';
  delete from public.challenge_versions where challenge_id='fe400000-0000-4000-8000-000000000001';
  delete from public.challenges where id='fe400000-0000-4000-8000-000000000001';
  delete from public.revision_attributions where revision_id='fe300000-0000-4000-8000-000000000001';
  delete from public.project_revisions where project_id='fe100000-0000-4000-8000-000000000001';
  delete from public.arrangement_versions where project_id='fe100000-0000-4000-8000-000000000001';
  delete from public.project_members where project_id='fe100000-0000-4000-8000-000000000001';
  delete from public.projects where id='fe100000-0000-4000-8000-000000000001';
  delete from private.app_admins where user_id='fe000000-0000-4000-8000-000000000001';
  delete from public.profiles where id::text like 'fe000000-0000-4000-8000-%';
  delete from auth.users where id::text like 'fe000000-0000-4000-8000-%';
  set session_replication_role=origin;
$remote$);
select extensions.dblink_disconnect('award_a');
select extensions.dblink_disconnect('award_b');
select * from finish();
rollback;
