begin;
reset role;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(7);

select extensions.dblink_connect('entry_a','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');
select extensions.dblink_connect('entry_b','host=host.docker.internal port=54322 dbname='||current_database()||' user=postgres password=postgres');

select extensions.dblink_exec('entry_a',$remote$
  set session_replication_role=replica;
  delete from private.challenge_entry_commands where actor_id='ff000000-0000-4000-8000-000000000001';
  delete from public.challenge_entries where entrant_id='ff000000-0000-4000-8000-000000000001';
  delete from public.challenge_versions where challenge_id='ff500000-0000-4000-8000-000000000001';
  delete from public.challenges where id='ff500000-0000-4000-8000-000000000001';
  delete from public.revision_attributions where revision_id in ('ff400000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000002');
  delete from public.project_revisions where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.arrangement_versions where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.project_members where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.projects where id='ff100000-0000-4000-8000-000000000001';
  delete from public.profiles where id='ff000000-0000-4000-8000-000000000001';
  delete from auth.users where id='ff000000-0000-4000-8000-000000000001';
  set session_replication_role=origin;
$remote$);

select extensions.dblink_exec('entry_a',$remote$
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values('00000000-0000-0000-0000-000000000000','ff000000-0000-4000-8000-000000000001','authenticated','authenticated','entry-concurrency@example.test','','{}','{}',now(),now());
  update public.profiles set username='EntryConcurrency',username_normalized='entryconcurrency',display_name='Entry Concurrency',credit_name='Entry Concurrency',profile_completed_at=now()
    where id='ff000000-0000-4000-8000-000000000001';
  insert into public.projects(id,owner_id,create_request_id,title,license_code)
    values('ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001',gen_random_uuid(),'Concurrent Private Entry','cc-by-4.0');
  insert into public.project_members(project_id,user_id,role,created_by)
    values('ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001','owner','ff000000-0000-4000-8000-000000000001');
  insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
    values('ff200000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),120,4,4,null,480,960);
  insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
    values('ff400000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000001',1,'ff000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('2',64),1000,'ff200000-0000-4000-8000-000000000001');
  update public.projects set status='active',visibility='private',current_revision_id='ff400000-0000-4000-8000-000000000001',published_at=now() where id='ff100000-0000-4000-8000-000000000001';
  insert into public.challenges(id,slug,created_by,state,published_at) values('ff500000-0000-4000-8000-000000000001','entry-concurrency-test','ff000000-0000-4000-8000-000000000001','published',now());
  insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256)
    values('ff600000-0000-4000-8000-000000000001','ff500000-0000-4000-8000-000000000001',1,'ff000000-0000-4000-8000-000000000001',gen_random_uuid(),'Concurrency Test','Serialize entry commands.','Concurrent identical requests converge.','Challenge display only.','pulse',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days',now()+interval '4 days','community',0,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":0}}'),repeat('a',64));
  update public.challenges set current_version_id='ff600000-0000-4000-8000-000000000001' where id='ff500000-0000-4000-8000-000000000001';
$remote$);

create temp table entry_backend as select pid from extensions.dblink('entry_b','select pg_backend_pid()') as response(pid integer);
create temp table entry_results(attempt text primary key,result jsonb not null);

select extensions.dblink_exec('entry_a','begin');
select extensions.dblink_exec('entry_a',$remote$do $$ begin perform 1 from public.profiles where id='ff000000-0000-4000-8000-000000000001' for update; end $$;$remote$);
select extensions.dblink_exec('entry_a','set local role authenticated');
select extensions.dblink_exec('entry_a',$remote$set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_exec('entry_b','begin');
select extensions.dblink_exec('entry_b','set local role authenticated');
select extensions.dblink_exec('entry_b',$remote$set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_send_query('entry_b',$remote$
  select public.submit_challenge_entry('ff500000-0000-4000-8000-000000000001','ff600000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000001','ff700000-0000-4000-8000-000000000001',null,'challenge-display-attestation-v1')
$remote$);
do $$ declare i integer; begin for i in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from entry_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from entry_backend) and wait_event_type='Lock') then raise exception 'identical submission did not contend'; end if; end $$;
insert into entry_results select 'first',result from extensions.dblink('entry_a',$remote$
  select public.submit_challenge_entry('ff500000-0000-4000-8000-000000000001','ff600000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000001','ff700000-0000-4000-8000-000000000001',null,'challenge-display-attestation-v1')
$remote$) as response(result jsonb);
select extensions.dblink_exec('entry_a','commit');
insert into entry_results select 'waiter',result from extensions.dblink_get_result('entry_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('entry_b') as response(result jsonb);
select extensions.dblink_exec('entry_b','commit');
select is((select result from entry_results where attempt='waiter'),(select result from entry_results where attempt='first'),'concurrent identical submission replays one result');
select is((select count(*) from private.challenge_entry_commands where actor_id='ff000000-0000-4000-8000-000000000001'),1::bigint,'concurrent identical submission records one command');
select is((select count(*) from public.challenge_entries where entrant_id='ff000000-0000-4000-8000-000000000001'),1::bigint,'concurrent identical submission creates one entry');

select extensions.dblink_exec('entry_a',$remote$
  insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
    values('ff200000-0000-4000-8000-000000000002','ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('3',64),120,4,4,null,480,960);
  insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
    values('ff400000-0000-4000-8000-000000000002','ff100000-0000-4000-8000-000000000001',2,'ff400000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('4',64),1000,'ff200000-0000-4000-8000-000000000002');
  update public.projects set current_revision_id='ff400000-0000-4000-8000-000000000002' where id='ff100000-0000-4000-8000-000000000001';
$remote$);
select extensions.dblink_exec('entry_b',$remote$
  create or replace function pg_temp.try_replace() returns jsonb language plpgsql security definer set search_path='' as $$
  declare prior uuid; response jsonb;
  begin
    select id into prior from public.challenge_entries where challenge_id='ff500000-0000-4000-8000-000000000001' and entrant_id='ff000000-0000-4000-8000-000000000001' and status='active';
    response := public.submit_challenge_entry('ff500000-0000-4000-8000-000000000001','ff600000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000002','ff700000-0000-4000-8000-000000000003',prior,'challenge-display-attestation-v1');
    if response ? 'errorCode' then return jsonb_build_object('ok',false,'state',response->>'errorCode'); end if;
    return jsonb_build_object('ok',true,'result',response);
  exception when others then return jsonb_build_object('ok',false,'state',sqlstate,'message',sqlerrm); end $$;
$remote$);
create temp table prior_entry as select (result->>'entryId')::uuid id from entry_results where attempt='first';
select extensions.dblink_exec('entry_a','begin');
select extensions.dblink_exec('entry_a',$remote$do $$ begin perform 1 from public.profiles where id='ff000000-0000-4000-8000-000000000001' for update; end $$;$remote$);
select extensions.dblink_exec('entry_a','set local role authenticated');
select extensions.dblink_exec('entry_a',$remote$set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_exec('entry_b','begin');
select extensions.dblink_exec('entry_b','set local role authenticated');
select extensions.dblink_exec('entry_b',$remote$set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001'$remote$);
select extensions.dblink_send_query('entry_b','select pg_temp.try_replace()');
do $$ declare i integer; begin for i in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from entry_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from entry_backend) and wait_event_type='Lock') then raise exception 'replacement did not contend'; end if; end $$;
insert into entry_results select 'replacement-first',result from extensions.dblink('entry_a',format($remote$
  select public.submit_challenge_entry('ff500000-0000-4000-8000-000000000001','ff600000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000002','ff700000-0000-4000-8000-000000000002',%L::uuid,'challenge-display-attestation-v1')
$remote$,(select id from prior_entry))) as response(result jsonb);
select extensions.dblink_exec('entry_a','commit');
insert into entry_results select 'replacement-waiter',result from extensions.dblink_get_result('entry_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('entry_b') as response(result jsonb);
select extensions.dblink_exec('entry_b','commit');
select is((select result->>'status' from entry_results where attempt='replacement-first'),'active','one contending replacement succeeds');
select is((select result->>'state' from entry_results where attempt='replacement-waiter'),'PT409','losing replacement observes stale expected entry');
select is((select count(*) from public.challenge_entries where entrant_id='ff000000-0000-4000-8000-000000000001'),2::bigint,'replacement contention appends exactly one row');
select is((select count(*) from public.challenge_entries where entrant_id='ff000000-0000-4000-8000-000000000001' and status='active'),1::bigint,'replacement contention preserves one active entry');

select extensions.dblink_exec('entry_a',$remote$
  set session_replication_role=replica;
  delete from private.challenge_entry_commands where actor_id='ff000000-0000-4000-8000-000000000001';
  delete from public.challenge_entries where entrant_id='ff000000-0000-4000-8000-000000000001';
  delete from public.challenge_versions where challenge_id='ff500000-0000-4000-8000-000000000001';
  delete from public.challenges where id='ff500000-0000-4000-8000-000000000001';
  delete from public.revision_attributions where revision_id in ('ff400000-0000-4000-8000-000000000001','ff400000-0000-4000-8000-000000000002');
  delete from public.project_revisions where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.arrangement_versions where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.project_members where project_id='ff100000-0000-4000-8000-000000000001';
  delete from public.projects where id='ff100000-0000-4000-8000-000000000001';
  delete from public.profiles where id='ff000000-0000-4000-8000-000000000001';
  delete from auth.users where id='ff000000-0000-4000-8000-000000000001';
  set session_replication_role=origin;
$remote$);
select extensions.dblink_disconnect('entry_a');
select extensions.dblink_disconnect('entry_b');
select * from finish();
rollback;
