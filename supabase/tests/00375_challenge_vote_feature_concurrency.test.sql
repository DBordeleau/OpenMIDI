begin;
reset role;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(11);

select extensions.dblink_connect('vote_a','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');
select extensions.dblink_connect('vote_b','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');

select extensions.dblink_exec('vote_a',$remote$
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000001','authenticated','authenticated','vote-admin@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000002','authenticated','authenticated','vote-entry-one@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000003','authenticated','authenticated','vote-entry-two@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000004','authenticated','authenticated','vote-replay@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000005','authenticated','authenticated','vote-budget@example.test','','{}','{}',now(),now());
  update public.profiles set username='VoteConcurrency'||right(id::text,1),username_normalized=lower('VoteConcurrency'||right(id::text,1)),
    display_name='Vote Concurrency',credit_name='Vote Concurrency',profile_completed_at=now()
    where id::text like 'fb000000-0000-4000-8000-%';
  insert into private.app_admins(user_id,created_by) values
    ('fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001');
  insert into public.projects(id,owner_id,create_request_id,title,license_code)
    values('fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001',gen_random_uuid(),
      'Vote concurrency source','cc-by-4.0');
  insert into public.project_members(project_id,user_id,role,created_by) values
    ('fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','owner','fb000000-0000-4000-8000-000000000001');
  insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
    manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
  values('fb200000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001',
    gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),120,4,4,'c-major',480,1920);
  insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,
    engine_version,manifest_sha256,duration_ms,arrangement_version_id)
  values('fb300000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001',1,'fb000000-0000-4000-8000-000000000001',
    gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('2',64),2000,'fb200000-0000-4000-8000-000000000001');
  update public.projects set current_revision_id='fb300000-0000-4000-8000-000000000001',status='active',
    visibility='private',published_at=now()
    where id='fb100000-0000-4000-8000-000000000001';
  insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version)
    values('fb400000-0000-4000-8000-000000000001','vote-feature-concurrency','fb000000-0000-4000-8000-000000000001','published',now(),2);
  insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,
    eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
    judging_mode,official_placement_count,constraints,constraints_sha256)
  values('fb500000-0000-4000-8000-000000000001','fb400000-0000-4000-8000-000000000001',1,'fb000000-0000-4000-8000-000000000001',
    gen_random_uuid(),'Vote concurrency','Hear every entry.','Contention fixture.','Original work.','pulse',now()-interval '4 days',
    now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days','community',0,
    private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('a',64));
  update public.challenges set current_version_id='fb500000-0000-4000-8000-000000000001'
    where id='fb400000-0000-4000-8000-000000000001';
  insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,
    project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,
    revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,
    facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
  values
  ('fb600000-0000-4000-8000-000000000001','fb400000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001',
    'fb000000-0000-4000-8000-000000000002','fb100000-0000-4000-8000-000000000001','fb300000-0000-4000-8000-000000000001',
    'First contention entry','VoteConcurrency2','Vote Concurrency','Vote Concurrency',1,'[{"kind":"publisher","creditName":"Vote Concurrency"}]',
    2000,'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('3',64),gen_random_uuid(),now()-interval '2 days'),
  ('fb600000-0000-4000-8000-000000000002','fb400000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001',
    'fb000000-0000-4000-8000-000000000003','fb100000-0000-4000-8000-000000000001','fb300000-0000-4000-8000-000000000001',
    'Second contention entry','VoteConcurrency3','Vote Concurrency','Vote Concurrency',1,'[{"kind":"publisher","creditName":"Vote Concurrency"}]',
    2000,'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('4',64),gen_random_uuid(),now()-interval '2 days');
  insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,requested_active,outcome,response)
  select 'fb000000-0000-4000-8000-000000000005',gen_random_uuid(),'fb600000-0000-4000-8000-000000000001',true,
    'rejected','{"errorCode":"PT403"}'::jsonb from generate_series(1,59);
$remote$);

create temp table vote_backend as select pid from extensions.dblink('vote_b','select pg_backend_pid()') as response(pid integer);
create temp table vote_results(test text,attempt text,response jsonb);

select extensions.dblink_exec('vote_a','begin');
select extensions.dblink_exec('vote_a',$remote$do $$ begin perform pg_advisory_xact_lock(hashtextextended('challenge-vote-actor:fb000000-0000-4000-8000-000000000004',0)); end $$;$remote$);
select extensions.dblink_exec('vote_a','set local role authenticated');
select extensions.dblink_exec('vote_a',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004'$remote$);
select extensions.dblink_exec('vote_b','begin');
select extensions.dblink_exec('vote_b','set local role authenticated');
select extensions.dblink_exec('vote_b',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004'$remote$);
select extensions.dblink_send_query('vote_b',$remote$select public.set_challenge_vote('fb600000-0000-4000-8000-000000000001',true,'fb700000-0000-4000-8000-000000000001')$remote$);
do $$ declare i integer; begin for i in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock') then raise exception 'identical vote did not reach actor lock'; end if; end $$;
insert into vote_results select 'replay','first',response from extensions.dblink('vote_a',$remote$select public.set_challenge_vote('fb600000-0000-4000-8000-000000000001',true,'fb700000-0000-4000-8000-000000000001')$remote$) as result(response jsonb);
select extensions.dblink_exec('vote_a','commit');
insert into vote_results select 'replay','waiter',response from extensions.dblink_get_result('vote_b') as result(response jsonb);
select count(*) from extensions.dblink_get_result('vote_b') as result(response jsonb);
select extensions.dblink_exec('vote_b','commit');
select is((select response from vote_results where test='replay' and attempt='waiter'),(select response from vote_results where test='replay' and attempt='first'),'concurrent identical vote requests replay one response');
select is((select count(*) from private.challenge_vote_commands where actor_id='fb000000-0000-4000-8000-000000000004'),1::bigint,'concurrent identical voting records one command');
select is((select count(*) from public.challenge_votes where voter_id='fb000000-0000-4000-8000-000000000004'),1::bigint,'concurrent identical voting creates one logical vote');

select extensions.dblink_exec('vote_a','begin');
select extensions.dblink_exec('vote_a',$remote$do $$ begin perform pg_advisory_xact_lock(hashtextextended('challenge-vote-actor:fb000000-0000-4000-8000-000000000005',0)); end $$;$remote$);
select extensions.dblink_exec('vote_a','set local role authenticated');
select extensions.dblink_exec('vote_a',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005'$remote$);
select extensions.dblink_exec('vote_b','begin');
select extensions.dblink_exec('vote_b','set local role authenticated');
select extensions.dblink_exec('vote_b',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000005'$remote$);
select extensions.dblink_send_query('vote_b',$remote$select public.set_challenge_vote('fb600000-0000-4000-8000-000000000002',true,'fb700000-0000-4000-8000-000000000003')$remote$);
do $$ declare i integer; begin for i in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock') then raise exception 'cross-entry vote did not reach actor lock'; end if; end $$;
insert into vote_results select 'budget','first',response from extensions.dblink('vote_a',$remote$select public.set_challenge_vote('fb600000-0000-4000-8000-000000000001',true,'fb700000-0000-4000-8000-000000000002')$remote$) as result(response jsonb);
select extensions.dblink_exec('vote_a','commit');
insert into vote_results select 'budget','waiter',response from extensions.dblink_get_result('vote_b') as result(response jsonb);
select count(*) from extensions.dblink_get_result('vote_b') as result(response jsonb);
select extensions.dblink_exec('vote_b','commit');
select is((select response->>'active' from vote_results where test='budget' and attempt='first'),'true','the sixtieth actor attempt is admitted');
select is((select response->>'errorCode' from vote_results where test='budget' and attempt='waiter'),'PT429','a concurrent vote for another entry cannot bypass the actor budget');
select is((select count(*) from private.challenge_vote_commands where actor_id='fb000000-0000-4000-8000-000000000005'),61::bigint,'both admitted and rejected attempts remain in the shared budget audit');
select is((select count(*) from public.challenge_votes where voter_id='fb000000-0000-4000-8000-000000000005'),1::bigint,'only the admitted cross-entry attempt creates a vote');

select extensions.dblink_exec('vote_a',$remote$create or replace function pg_temp.try_feature(p_request uuid) returns text language plpgsql as $$ begin perform public.set_featured_challenge(p_request,'fb400000-0000-4000-8000-000000000001',0); return 'ok'; exception when others then return sqlstate; end $$;$remote$);
select extensions.dblink_exec('vote_b',$remote$create or replace function pg_temp.try_feature(p_request uuid) returns text language plpgsql as $$ begin perform public.set_featured_challenge(p_request,'fb400000-0000-4000-8000-000000000001',0); return 'ok'; exception when others then return sqlstate; end $$;$remote$);
select extensions.dblink_exec('vote_a','begin');
select extensions.dblink_exec('vote_a',$remote$do $$ begin perform pg_advisory_xact_lock(hashtextextended('challenge-featured-selection',0)); end $$;$remote$);
select extensions.dblink_exec('vote_a','set local role authenticated');
select extensions.dblink_exec('vote_a',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_exec('vote_b','begin');
select extensions.dblink_exec('vote_b','set local role authenticated');
select extensions.dblink_exec('vote_b',$remote$set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_send_query('vote_b',$remote$select pg_temp.try_feature('fb800000-0000-4000-8000-000000000002')$remote$);
do $$ declare i integer; begin for i in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from vote_backend) and wait_event_type='Lock') then raise exception 'featured selection did not reach singleton lock'; end if; end $$;
create temp table feature_results(attempt text,response text);
insert into feature_results select 'first',response from extensions.dblink('vote_a',$remote$select pg_temp.try_feature('fb800000-0000-4000-8000-000000000001')$remote$) as result(response text);
select extensions.dblink_exec('vote_a','commit');
insert into feature_results select 'waiter',response from extensions.dblink_get_result('vote_b') as result(response text);
select count(*) from extensions.dblink_get_result('vote_b') as result(response text);
select extensions.dblink_exec('vote_b','commit');
select is((select response from feature_results where attempt='first'),'ok','one featured selection succeeds under contention');
select is((select response from feature_results where attempt='waiter'),'PT409','the stale concurrent featured selection is rejected');
select is((select selection_version from private.challenge_featured_selection where singleton),1,'featured selection advances exactly once');
select is((select count(*) from private.challenge_featured_actions),1::bigint,'featured contention records one successful action');

select extensions.dblink_exec('vote_a',$remote$
  set session_replication_role=replica;
  delete from private.challenge_featured_actions;
  delete from private.challenge_featured_selection;
  delete from private.challenge_vote_commands where actor_id::text like 'fb000000-0000-4000-8000-%';
  delete from public.challenge_votes where voter_id::text like 'fb000000-0000-4000-8000-%';
  delete from public.challenge_entries where challenge_id='fb400000-0000-4000-8000-000000000001';
  delete from public.challenge_versions where challenge_id='fb400000-0000-4000-8000-000000000001';
  delete from public.challenges where id='fb400000-0000-4000-8000-000000000001';
  delete from public.revision_attributions where revision_id='fb300000-0000-4000-8000-000000000001';
  delete from public.project_revisions where project_id='fb100000-0000-4000-8000-000000000001';
  delete from public.arrangement_versions where project_id='fb100000-0000-4000-8000-000000000001';
  delete from public.project_members where project_id='fb100000-0000-4000-8000-000000000001';
  delete from public.projects where id='fb100000-0000-4000-8000-000000000001';
  delete from private.app_admins where user_id='fb000000-0000-4000-8000-000000000001';
  delete from public.profiles where id::text like 'fb000000-0000-4000-8000-%';
  delete from auth.users where id::text like 'fb000000-0000-4000-8000-%';
  set session_replication_role=origin;
$remote$);
select extensions.dblink_disconnect('vote_a');
select extensions.dblink_disconnect('vote_b');
select * from finish();
rollback;
