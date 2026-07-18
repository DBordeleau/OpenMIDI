begin;
reset role;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(10);

select extensions.dblink_connect('challenge_a','host=host.docker.internal port=54322 dbname=' || current_database() || ' user=postgres password=postgres');
select extensions.dblink_connect('challenge_b','host=host.docker.internal port=54322 dbname=' || current_database() || ' user=postgres password=postgres');

-- Make reruns safe even if an interrupted prior run did not reach cleanup.
select extensions.dblink_exec('challenge_a',$remote$
  alter table private.challenge_admin_actions disable trigger challenge_admin_actions_immutable;
  alter table public.challenge_judge_credits disable trigger challenge_judge_credits_immutable;
  alter table public.challenge_versions disable trigger challenge_versions_immutable;
  delete from private.challenge_admin_actions where actor_id='fd000000-0000-4000-8000-000000000010';
  update public.challenges set current_version_id=null where created_by='fd000000-0000-4000-8000-000000000010';
  delete from public.challenge_judge_credits where challenge_version_id in (
    select id from public.challenge_versions where challenge_id in (
      select id from public.challenges where created_by='fd000000-0000-4000-8000-000000000010'
    )
  );
  delete from public.challenge_versions where challenge_id in (
    select id from public.challenges where created_by='fd000000-0000-4000-8000-000000000010'
  );
  delete from public.challenges where created_by='fd000000-0000-4000-8000-000000000010';
  alter table private.challenge_admin_actions enable trigger challenge_admin_actions_immutable;
  alter table public.challenge_judge_credits enable trigger challenge_judge_credits_immutable;
  alter table public.challenge_versions enable trigger challenge_versions_immutable;
  delete from private.app_admins where user_id='fd000000-0000-4000-8000-000000000010';
  delete from public.profiles where id='fd000000-0000-4000-8000-000000000010';
  delete from auth.users where id='fd000000-0000-4000-8000-000000000010';
$remote$);
select extensions.dblink_exec('challenge_a',$remote$
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000010','authenticated','authenticated','challenge-concurrency@example.test','','{}','{}',now(),now());
  update public.profiles set username='ChallengeConcurrency',username_normalized='challengeconcurrency',display_name='Challenge Concurrency',credit_name='Challenge Concurrency',profile_completed_at=now()
  where id='fd000000-0000-4000-8000-000000000010';
  insert into private.app_admins(user_id,created_by) values('fd000000-0000-4000-8000-000000000010','fd000000-0000-4000-8000-000000000010');
$remote$);

create temp table challenge_concurrency_backend as
select pid from extensions.dblink('challenge_b','select pg_backend_pid()') as result(pid integer);
create temp table challenge_concurrency_results(
  action text not null,
  attempt text not null,
  result jsonb not null
);

-- CREATE: hold the slug advisory lock so the second request passes its first
-- audit lookup and waits until the first request commits its audit record.
select extensions.dblink_exec('challenge_a','begin');
select extensions.dblink_exec('challenge_a',$remote$do $$ begin perform pg_advisory_xact_lock(hashtextextended('concurrent-challenge',0)); end $$;$remote$);
select extensions.dblink_exec('challenge_a','set local role authenticated');
select extensions.dblink_exec('challenge_a',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_exec('challenge_b','begin');
select extensions.dblink_exec('challenge_b','set local role authenticated');
select extensions.dblink_exec('challenge_b',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_send_query('challenge_b',$remote$
  select public.create_challenge_draft(
    'fd100000-0000-4000-8000-000000000010','concurrent-challenge',
    jsonb_build_object('title','Concurrent Challenge','prompt','Converge identical requests.','description','Contention must replay one result.','eligibilityTerms','Original work only.','presentationCode','pulse','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb
  )
$remote$);
do $$
declare v_attempt integer;
begin
  for v_attempt in 1..100 loop
    exit when exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock');
    perform pg_sleep(0.01);
  end loop;
  if not exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock') then
    raise exception 'create request did not reach lock contention';
  end if;
end;
$$;
insert into challenge_concurrency_results
select 'create','first',result from extensions.dblink('challenge_a',$remote$
  select public.create_challenge_draft(
    'fd100000-0000-4000-8000-000000000010','concurrent-challenge',
    jsonb_build_object('title','Concurrent Challenge','prompt','Converge identical requests.','description','Contention must replay one result.','eligibilityTerms','Original work only.','presentationCode','pulse','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb
  )
$remote$) as response(result jsonb);
select extensions.dblink_exec('challenge_a','commit');
insert into challenge_concurrency_results select 'create','waiter',result from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select extensions.dblink_exec('challenge_b','commit');
select is((select result from challenge_concurrency_results where action='create' and attempt='waiter'),(select result from challenge_concurrency_results where action='create' and attempt='first'),'concurrent create replays the successful result');
select is((select count(*) from private.challenge_admin_actions where request_id='fd100000-0000-4000-8000-000000000010'),1::bigint,'concurrent create records one audit row');

create temp table challenge_concurrency_fixture as
select (result->>'challengeId')::uuid challenge_id,(result->>'versionId')::uuid version_id
from challenge_concurrency_results where action='create' and attempt='first';

-- REVISE: serialize on the stable challenge row and require the waiter to
-- replay after the first append advances both optimistic pointers.
select extensions.dblink_exec('challenge_a','begin');
select extensions.dblink_exec('challenge_a',format($remote$do $$ begin perform 1 from public.challenges where id=%L::uuid for update; end $$;$remote$,(select challenge_id from challenge_concurrency_fixture)));
select extensions.dblink_exec('challenge_a','set local role authenticated');
select extensions.dblink_exec('challenge_a',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_exec('challenge_b','begin');
select extensions.dblink_exec('challenge_b','set local role authenticated');
select extensions.dblink_exec('challenge_b',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_send_query('challenge_b',format($remote$
  select public.revise_challenge_draft(%L::uuid,'fd100000-0000-4000-8000-000000000011',1,%L::uuid,
    jsonb_build_object('title','Concurrent Challenge','prompt','Converge identical revisions.','description','One immutable revision survives contention.','eligibilityTerms','Original work only.','presentationCode','nocturne','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb)
$remote$,(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture)));
do $$ declare v_attempt integer; begin for v_attempt in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock') then raise exception 'revise request did not reach lock contention'; end if; end $$;
insert into challenge_concurrency_results
select 'revise','first',result from extensions.dblink('challenge_a',format($remote$
  select public.revise_challenge_draft(%L::uuid,'fd100000-0000-4000-8000-000000000011',1,%L::uuid,
    jsonb_build_object('title','Concurrent Challenge','prompt','Converge identical revisions.','description','One immutable revision survives contention.','eligibilityTerms','Original work only.','presentationCode','nocturne','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb)
$remote$,(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture))) as response(result jsonb);
select extensions.dblink_exec('challenge_a','commit');
insert into challenge_concurrency_results select 'revise','waiter',result from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select extensions.dblink_exec('challenge_b','commit');
select is((select result from challenge_concurrency_results where action='revise' and attempt='waiter'),(select result from challenge_concurrency_results where action='revise' and attempt='first'),'concurrent revise replays the successful result');
select is((select count(*) from public.challenge_versions where challenge_id=(select challenge_id from challenge_concurrency_fixture)),2::bigint,'concurrent revise appends one immutable version');
update challenge_concurrency_fixture set version_id=(select (result->>'versionId')::uuid from challenge_concurrency_results where action='revise' and attempt='first');

-- PUBLISH and CANCEL use the same row-lock contention path.
select extensions.dblink_exec('challenge_a','begin');
select extensions.dblink_exec('challenge_a',format($remote$do $$ begin perform 1 from public.challenges where id=%L::uuid for update; end $$;$remote$,(select challenge_id from challenge_concurrency_fixture)));
select extensions.dblink_exec('challenge_a','set local role authenticated');
select extensions.dblink_exec('challenge_a',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_exec('challenge_b','begin');
select extensions.dblink_exec('challenge_b','set local role authenticated');
select extensions.dblink_exec('challenge_b',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_send_query('challenge_b',format('select public.publish_challenge(%L::uuid,''fd100000-0000-4000-8000-000000000012'',2,%L::uuid)',(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture)));
do $$ declare v_attempt integer; begin for v_attempt in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock') then raise exception 'publish request did not reach lock contention'; end if; end $$;
insert into challenge_concurrency_results select 'publish','first',result from extensions.dblink('challenge_a',format('select public.publish_challenge(%L::uuid,''fd100000-0000-4000-8000-000000000012'',2,%L::uuid)',(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture))) as response(result jsonb);
select extensions.dblink_exec('challenge_a','commit');
insert into challenge_concurrency_results select 'publish','waiter',result from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select extensions.dblink_exec('challenge_b','commit');
select is((select result from challenge_concurrency_results where action='publish' and attempt='waiter'),(select result from challenge_concurrency_results where action='publish' and attempt='first'),'concurrent publish replays the successful result');
select is((select count(*) from private.challenge_admin_actions where request_id='fd100000-0000-4000-8000-000000000012'),1::bigint,'concurrent publish records one audit row');

select extensions.dblink_exec('challenge_a','begin');
select extensions.dblink_exec('challenge_a',format($remote$do $$ begin perform 1 from public.challenges where id=%L::uuid for update; end $$;$remote$,(select challenge_id from challenge_concurrency_fixture)));
select extensions.dblink_exec('challenge_a','set local role authenticated');
select extensions.dblink_exec('challenge_a',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_exec('challenge_b','begin');
select extensions.dblink_exec('challenge_b','set local role authenticated');
select extensions.dblink_exec('challenge_b',$remote$set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000010'$remote$);
select extensions.dblink_send_query('challenge_b',format('select public.cancel_challenge(%L::uuid,''fd100000-0000-4000-8000-000000000013'',3,%L::uuid,''Cancelled once under contention.'')',(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture)));
do $$ declare v_attempt integer; begin for v_attempt in 1..100 loop exit when exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock'); perform pg_sleep(0.01); end loop; if not exists(select 1 from pg_stat_activity where pid=(select pid from challenge_concurrency_backend) and wait_event_type='Lock') then raise exception 'cancel request did not reach lock contention'; end if; end $$;
insert into challenge_concurrency_results select 'cancel','first',result from extensions.dblink('challenge_a',format('select public.cancel_challenge(%L::uuid,''fd100000-0000-4000-8000-000000000013'',3,%L::uuid,''Cancelled once under contention.'')',(select challenge_id from challenge_concurrency_fixture),(select version_id from challenge_concurrency_fixture))) as response(result jsonb);
select extensions.dblink_exec('challenge_a','commit');
insert into challenge_concurrency_results select 'cancel','waiter',result from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select count(*) from extensions.dblink_get_result('challenge_b') as response(result jsonb);
select extensions.dblink_exec('challenge_b','commit');
select is((select result from challenge_concurrency_results where action='cancel' and attempt='waiter'),(select result from challenge_concurrency_results where action='cancel' and attempt='first'),'concurrent cancel replays the successful result');
select is((select count(*) from private.challenge_admin_actions where request_id='fd100000-0000-4000-8000-000000000013'),1::bigint,'concurrent cancel records one audit row');
select is((select state from public.challenges where id=(select challenge_id from challenge_concurrency_fixture)),'cancelled','contention sequence reaches one cancelled lifecycle state');
select is((select lifecycle_version from public.challenges where id=(select challenge_id from challenge_concurrency_fixture)),4,'each lifecycle mutation advances exactly once');

select extensions.dblink_exec('challenge_a',$remote$
  alter table private.challenge_admin_actions disable trigger challenge_admin_actions_immutable;
  alter table public.challenge_judge_credits disable trigger challenge_judge_credits_immutable;
  alter table public.challenge_versions disable trigger challenge_versions_immutable;
  delete from private.challenge_admin_actions where actor_id='fd000000-0000-4000-8000-000000000010';
  update public.challenges set current_version_id=null where created_by='fd000000-0000-4000-8000-000000000010';
  delete from public.challenge_judge_credits where challenge_version_id in (
    select id from public.challenge_versions where challenge_id in (
      select id from public.challenges where created_by='fd000000-0000-4000-8000-000000000010'
    )
  );
  delete from public.challenge_versions where challenge_id in (
    select id from public.challenges where created_by='fd000000-0000-4000-8000-000000000010'
  );
  delete from public.challenges where created_by='fd000000-0000-4000-8000-000000000010';
  alter table private.challenge_admin_actions enable trigger challenge_admin_actions_immutable;
  alter table public.challenge_judge_credits enable trigger challenge_judge_credits_immutable;
  alter table public.challenge_versions enable trigger challenge_versions_immutable;
  delete from private.app_admins where user_id='fd000000-0000-4000-8000-000000000010';
  delete from public.profiles where id='fd000000-0000-4000-8000-000000000010';
  delete from auth.users where id='fd000000-0000-4000-8000-000000000010';
$remote$);
select extensions.dblink_disconnect('challenge_a');
select extensions.dblink_disconnect('challenge_b');

select * from finish();
rollback;
