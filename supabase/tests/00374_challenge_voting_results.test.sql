begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(57);

select has_table('public','challenge_votes','logical challenge votes exist');
select has_table('public','challenge_results','immutable result versions exist');
select has_table('public','challenge_result_entries','result entry totals are normalized');
select has_table('public','challenge_result_placements','official placements are normalized');
select has_table('public','challenge_result_community_favorites','Community Favorite ties are normalized');
select has_table('private','challenge_reports','challenge reports stay private');
select has_table('private','challenge_moderation_actions','challenge moderation audit stays private');
select ok((select relrowsecurity from pg_class where oid='public.challenge_votes'::regclass),'vote rows enable RLS');
select ok((select relrowsecurity from pg_class where oid='public.challenge_results'::regclass),'result rows enable RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema in ('public','private')
  and table_name in ('challenge_votes','challenge_results','challenge_result_entries','challenge_result_placements',
    'challenge_result_community_favorites','challenge_reports','challenge_moderation_actions')
  and grantee in ('anon','authenticated')),'application roles have no direct private/result table grants');
select ok(has_function_privilege('authenticated','public.set_challenge_vote(uuid,boolean,uuid)','execute'),'authenticated voters reach guarded vote command');
select ok(not has_function_privilege('anon','public.set_challenge_vote(uuid,boolean,uuid)','execute'),'anonymous voters cannot invoke vote command');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000001','authenticated','authenticated','challenge-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000002','authenticated','authenticated','challenge-entry-one@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000003','authenticated','authenticated','challenge-voter@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000004','authenticated','authenticated','challenge-entry-two@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc000000-0000-4000-8000-000000000005','authenticated','authenticated','challenge-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='challenge'||right(id::text,1),username_normalized='challenge'||right(id::text,1),
  display_name='Challenge '||right(id::text,1),credit_name='Challenge '||right(id::text,1),profile_completed_at=now()
where id::text like 'fc000000-0000-4000-8000-%';
update public.profiles set status='suspended' where id='fc000000-0000-4000-8000-000000000005';
insert into private.app_admins(user_id,created_by) values
('fc000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001');

insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001',gen_random_uuid(),'Challenge Result Source','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','owner','fc000000-0000-4000-8000-000000000001');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
  manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
values('fc200000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001',
  gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),120,4,4,'c-minor',480,1920);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,
  engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('fc300000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001',1,'fc000000-0000-4000-8000-000000000001',
  gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('2',64),2000,'fc200000-0000-4000-8000-000000000001');
update public.projects set status='active',visibility='private',published_at=now(),
  current_revision_id='fc300000-0000-4000-8000-000000000001'
where id='fc100000-0000-4000-8000-000000000001';

insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version) values
('fc400000-0000-4000-8000-000000000001','challenge-vote-result-test','fc000000-0000-4000-8000-000000000001','published',now(),2);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,
  eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
  judging_mode,official_placement_count,constraints,constraints_sha256)
values('fc500000-0000-4000-8000-000000000001','fc400000-0000-4000-8000-000000000001',1,'fc000000-0000-4000-8000-000000000001',
  gen_random_uuid(),'Vote Result Test','Hear both exact entries.','Voting and immutable result fixture.','Original work only.','pulse',
  now()-interval '4 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',
  'hybrid',2,private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('a',64));
update public.challenges set current_version_id='fc500000-0000-4000-8000-000000000001' where id='fc400000-0000-4000-8000-000000000001';
insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,credit_name)
values('fc500000-0000-4000-8000-000000000001',1,'host','OpenMIDI','OpenMIDI');

insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,
  project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,
  revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,
  facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
values
('fc600000-0000-4000-8000-000000000001','fc400000-0000-4000-8000-000000000001','fc500000-0000-4000-8000-000000000001',
 'fc000000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000001',
 'First Exact Entry','challenge2','Challenge 2','Challenge 2',1,'[{"kind":"publisher","creditName":"Challenge 2"}]',2000,
 'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('3',64),gen_random_uuid(),now()-interval '2 days'),
('fc600000-0000-4000-8000-000000000002','fc400000-0000-4000-8000-000000000001','fc500000-0000-4000-8000-000000000001',
 'fc000000-0000-4000-8000-000000000004','fc100000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000001',
 'Second Exact Entry','challenge4','Challenge 4','Challenge 4',1,'[{"kind":"publisher","creditName":"Challenge 4"}]',2000,
 'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('4',64),gen_random_uuid(),now()-interval '2 days');

set local role anon;
select throws_ok($$select * from public.challenge_votes$$,'42501',null,'anonymous cannot enumerate vote rows');
select is((public.list_public_challenge_entries('challenge-vote-result-test')->'entries'->0->>'voteTotal'),null,'pre-close entry projection exposes no total');
select is(public.get_public_challenge('challenge-vote-result-test')->'result','null'::jsonb,'pre-close challenge projection exposes no result');
reset role;

create temp table rotation_now as select public.list_public_challenge_entries('challenge-vote-result-test') page;
select is(public.list_public_challenge_entries('challenge-vote-result-test'),(select page from rotation_now),'rotation and pagination envelope are stable inside one bucket');
select isnt(
  public.list_public_challenge_entries('challenge-vote-result-test',date_trunc('hour',now(),'UTC')-interval '1 hour')#>>'{entries,0,rotationKey}',
  (select page#>>'{entries,0,rotationKey}' from rotation_now),
  'rotation keys change across UTC buckets without vote totals');

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',true,gen_random_uuid())->>'errorCode',
  'PT403','self-voting is rejected');
reset role;
select is((select count(*) from private.challenge_vote_commands where actor_id='fc000000-0000-4000-8000-000000000002'),1::bigint,
  'a rejected self-vote consumes one private attempt');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000005';
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',true,gen_random_uuid())->>'errorCode',
  'PT403','suspended actor cannot vote');
reset role;
select is((select count(*) from private.challenge_vote_commands where actor_id='fc000000-0000-4000-8000-000000000005'),1::bigint,
  'an ineligible attempt consumes the shared actor budget');
insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,requested_active,outcome,response)
select 'fc000000-0000-4000-8000-000000000005',gen_random_uuid(),'fc600000-0000-4000-8000-000000000001',true,
  'rejected','{"errorCode":"PT403"}'::jsonb from generate_series(1,59);
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000005';
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000002',true,gen_random_uuid())->>'errorCode',
  'PT429','the shared actor budget rejects the next cross-entry attempt');
reset role;
select is((select count(*) from private.challenge_vote_commands where actor_id='fc000000-0000-4000-8000-000000000005'),60::bigint,
  'the bounded private budget audit stops at sixty attempts');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000003';
create temp table voter_add as select public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',true,'fc700000-0000-4000-8000-000000000001') response;
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',true,'fc700000-0000-4000-8000-000000000001'),
  (select response from voter_add),'identical add request replays idempotently');
select is(jsonb_array_length(public.list_my_active_challenge_vote_ids('fc400000-0000-4000-8000-000000000001')),1,'voter sees only own active vote IDs before close');
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',false,'fc700000-0000-4000-8000-000000000002')->>'active','false','vote remove changes desired state');
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',false,'fc700000-0000-4000-8000-000000000003')->>'voteVersion','2','idempotent remove does not increment the logical vote again');
select public.set_challenge_vote('fc600000-0000-4000-8000-000000000001',true,'fc700000-0000-4000-8000-000000000004');
select is(public.report_challenge_content(gen_random_uuid(),'entry','fc400000-0000-4000-8000-000000000001',
  'fc600000-0000-4000-8000-000000000001','vote_manipulation','Bounded private evidence') is not null,true,'active actor can report an entry privately');
reset role;
select is((select moderation_state from public.challenge_entries where id='fc600000-0000-4000-8000-000000000001'),'visible','reporting alone never hides the target');

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select is(public.get_admin_challenge_results('fc400000-0000-4000-8000-000000000001')#>>'{reports,0,details}',
  'Bounded private evidence','administrators receive report target, reason, bounded details, and timestamp evidence');
select public.set_challenge_vote('fc600000-0000-4000-8000-000000000002',true,'fc700000-0000-4000-8000-000000000005');
select is(public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',
  'fc600000-0000-4000-8000-000000000001',null,'entry_hide',1,'Review report')->>'version','2','administrator hides an entry optimistically');
select throws_ok($$select public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',
  'fc600000-0000-4000-8000-000000000001',null,'entry_restore',1,'Stale restore')$$,'PT409','challenge_moderation_stale','stale moderation authority is rejected');
select public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',
  'fc600000-0000-4000-8000-000000000001',null,'entry_restore',2,'Review complete');
reset role;
select is((select count(*) from private.challenge_moderation_actions where challenge_id='fc400000-0000-4000-8000-000000000001'),2::bigint,'successful moderation commands retain audit evidence');
create temp table reviewed_vote as select id from public.challenge_votes where challenge_entry_id='fc600000-0000-4000-8000-000000000001';
grant select on reviewed_vote to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',null,
  (select id from reviewed_vote),
  'vote_exclude',3,'Suspicious pattern');
reset role;
select is((select state from public.challenge_votes where challenge_entry_id='fc600000-0000-4000-8000-000000000001'),'excluded','administrator can exclude a suspicious vote');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',null,
  (select id from reviewed_vote),
  'vote_restore',4,'Vote verified');
reset role;
select is((select state from public.challenge_votes where challenge_entry_id='fc600000-0000-4000-8000-000000000001'),'active','administrator can restore an excluded vote');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select throws_ok($$select public.finalize_challenge_result('fc400000-0000-4000-8000-000000000001',gen_random_uuid(),2,
  'fc500000-0000-4000-8000-000000000001',null,'Too early','[]',null)$$,
  'PT409','challenge_result_voting_open','result finalization is rejected before voting closes');
reset role;

alter table public.challenge_versions disable trigger challenge_versions_immutable;
update public.challenge_versions set voting_closes_at=now()-interval '1 second',results_expected_at=now()+interval '1 day'
where id='fc500000-0000-4000-8000-000000000001';
alter table public.challenge_versions enable trigger challenge_versions_immutable;
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000003';
select is(public.set_challenge_vote('fc600000-0000-4000-8000-000000000002',true,gen_random_uuid())->>'errorCode',
  'PT409','late votes are rejected at database authority');
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select throws_ok($$select public.finalize_challenge_result('fc400000-0000-4000-8000-000000000001',gen_random_uuid(),2,
  'fc500000-0000-4000-8000-000000000001',null,'Duplicate result',
  '[{"entryId":"fc600000-0000-4000-8000-000000000001","place":1,"label":"Winner"},{"entryId":"fc600000-0000-4000-8000-000000000002","place":1,"label":"Runner-up"}]',null)$$,
  'PT422','challenge_result_placement_duplicate','duplicate places are rejected');
create temp table finalized as select public.finalize_challenge_result('fc400000-0000-4000-8000-000000000001',
  'fc800000-0000-4000-8000-000000000001',2,'fc500000-0000-4000-8000-000000000001',null,'Both entries found their audience.',
  '[{"entryId":"fc600000-0000-4000-8000-000000000001","place":1,"label":"Winner"},{"entryId":"fc600000-0000-4000-8000-000000000002","place":2,"label":"Runner-up"}]',null) response;
reset role;
select is((select state from public.challenges where id='fc400000-0000-4000-8000-000000000001'),'completed','finalization explicitly completes the challenge');
select is((select count(*) from public.challenge_result_community_favorites where challenge_result_id=(select (response->>'resultId')::uuid from finalized)),2::bigint,'Postgres records every tied Community Favorite');
select is((select count(*) from public.challenge_result_entries where challenge_result_id=(select (response->>'resultId')::uuid from finalized) and final_vote_total=1),2::bigint,'result freezes recomputed eligible vote totals');
select throws_ok($$update public.challenge_results set public_note='rewrite'$$,'55000','immutable_revision_history','finalized results are immutable');
update public.projects set status='deleted',deleted_at=now() where id='fc100000-0000-4000-8000-000000000001';
set local role anon;
select is(jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,entries}'),0,
  'a deleted source project suppresses every frozen result identity and attribution');
reset role;
update public.projects set status='active',deleted_at=null,moderation_state='hidden' where id='fc100000-0000-4000-8000-000000000001';
set local role anon;
select is(jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,placements}'),0,
  'a moderation-hidden source project suppresses frozen placements');
reset role;
update public.projects set moderation_state='visible' where id='fc100000-0000-4000-8000-000000000001';
update public.profiles set moderation_state='hidden' where id='fc000000-0000-4000-8000-000000000002';
set local role anon;
select is(jsonb_build_array(
    jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,entries}'),
    jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,placements}'),
    jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,communityFavorites}')
  ),'[1,1,1]'::jsonb,'a hidden entrant profile suppresses its frozen identity across every result projection');
reset role;
update public.profiles set moderation_state='visible' where id='fc000000-0000-4000-8000-000000000002';
set local role anon;
select is(public.get_public_challenge('challenge-vote-result-test')#>>'{result,entries,0,voteTotal}','1','signed-out completed projection exposes frozen totals');
select is(jsonb_array_length(public.get_public_challenge('challenge-vote-result-test')#>'{result,communityFavorites}'),2,'signed-out completed projection exposes all favorite ties');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select throws_ok($$select public.finalize_challenge_result('fc400000-0000-4000-8000-000000000001',gen_random_uuid(),2,
  'fc500000-0000-4000-8000-000000000001',null,'Stale correction','[]','Correction reason')$$,
  'PT409','challenge_result_stale','stale result authority is rejected');
create temp table corrected as select public.finalize_challenge_result('fc400000-0000-4000-8000-000000000001',gen_random_uuid(),3,
  'fc500000-0000-4000-8000-000000000001',(select (response->>'resultId')::uuid from finalized),'Corrected public note.',
  '[{"entryId":"fc600000-0000-4000-8000-000000000002","place":1,"label":"Winner"},{"entryId":"fc600000-0000-4000-8000-000000000001","place":2,"label":"Runner-up"}]','Judging record correction') response;
reset role;
select is((select count(*) from public.challenge_results where challenge_id='fc400000-0000-4000-8000-000000000001'),2::bigint,'correction appends a complete immutable result version');
select is((select result_version from public.challenge_results where id=(select current_result_id from public.challenges where id='fc400000-0000-4000-8000-000000000001')),2,'public pointer advances only to the correction');

insert into public.challenges(id,slug,created_by,state,published_at) values
('fc400000-0000-4000-8000-000000000002','next-scheduled-test','fc000000-0000-4000-8000-000000000001','published',now()),
('fc400000-0000-4000-8000-000000000003','private-draft-test','fc000000-0000-4000-8000-000000000001','draft',null);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,
  opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256)
values
('fc500000-0000-4000-8000-000000000002','fc400000-0000-4000-8000-000000000002',1,'fc000000-0000-4000-8000-000000000001',gen_random_uuid(),
 'Next Scheduled','Compose next.','Safe fallback.','Original work.','sunrise',now()+interval '2 days',now()+interval '3 days',now()+interval '4 days',now()+interval '5 days',now()+interval '6 days','community',0,
 private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('b',64)),
('fc500000-0000-4000-8000-000000000003','fc400000-0000-4000-8000-000000000003',1,'fc000000-0000-4000-8000-000000000001',gen_random_uuid(),
 'Private Draft','Never leak.','Private.','Private.','nocturne',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days',now()+interval '4 days',now()+interval '5 days','community',0,
 private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('c',64));
update public.challenges set current_version_id='fc500000-0000-4000-8000-000000000002' where id='fc400000-0000-4000-8000-000000000002';
update public.challenges set current_version_id='fc500000-0000-4000-8000-000000000003' where id='fc400000-0000-4000-8000-000000000003';
select is(public.get_featured_challenge()->>'selectionKind','next_scheduled','featured fallback prefers the next scheduled visible challenge');
select isnt(public.get_featured_challenge()#>>'{challenge,title}','Private Draft','featured fallback never leaks draft authority');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select is(public.set_featured_challenge(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',0)->>'selectionVersion','1','administrator selects one canonical featured challenge optimistically');
select is(public.get_featured_challenge()->>'selectionKind','selected','available explicit selection wins over fallback');
select public.moderate_challenge_target(gen_random_uuid(),'fc400000-0000-4000-8000-000000000001',null,null,'challenge_hide',1,'Result under review');
select is(public.get_featured_challenge()->>'selectionKind','next_scheduled','hidden explicit selection safely falls back');
select is(public.get_admin_challenge('fc400000-0000-4000-8000-000000000001')->>'moderationState','hidden','hidden challenge remains inspectable to administrators');
reset role;
select is(public.get_public_challenge('challenge-vote-result-test'),null,'moderation-hidden challenge disappears publicly');

select * from finish();
rollback;
