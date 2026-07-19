begin;
reset role;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public','badge_definitions','stable badge catalog exists');
select has_table('public','badge_definition_versions','badge presentations are versioned');
select has_table('public','profile_awards','exact profile award evidence exists');
select has_table('private','challenge_award_issuance','award issuance audit stays private');
select ok((select relrowsecurity from pg_class where oid='public.badge_definitions'::regclass),'badge definitions enable RLS');
select ok((select relrowsecurity from pg_class where oid='public.badge_definition_versions'::regclass),'badge versions enable RLS');
select ok((select relrowsecurity from pg_class where oid='public.profile_awards'::regclass),'profile awards enable RLS');
select ok((select relrowsecurity from pg_class where oid='private.challenge_award_issuance'::regclass),'issuance audit enables RLS');
select ok(not exists(
  select 1 from information_schema.role_table_grants
  where table_schema in ('public','private')
    and table_name in ('badge_definitions','badge_definition_versions','profile_awards','challenge_award_issuance')
    and grantee in ('anon','authenticated')
),'application roles receive no base award or audit table grants');
select ok(has_function_privilege('anon','public.list_public_profile_awards(uuid,timestamptz,uuid)','execute'),'anonymous profiles reach only the bounded award projection');
select ok(has_function_privilege('anon','public.get_public_challenge_award_target(text,uuid,uuid)','execute'),'anonymous award links reach only the exact safe target projection');
select ok(has_function_privilege('authenticated','public.reconcile_current_challenge_awards(uuid,uuid,uuid)','execute'),'authenticated role reaches the guarded reconciliation command');
select ok(not has_function_privilege('anon','public.reconcile_current_challenge_awards(uuid,uuid,uuid)','execute'),'anonymous role cannot reconcile awards');
select ok(not has_function_privilege('authenticated','private.issue_challenge_awards_for_result(uuid,uuid)','execute'),'authenticated callers cannot invoke private issuance');
select is((select count(*) from public.badge_definitions),3::bigint,'catalog seeds exactly three stable badge definitions');
select is((select jsonb_agg(jsonb_build_object('code',d.code,'version',v.version_number,'rule',v.qualification_kind) order by d.code)
  from public.badge_definitions d join public.badge_definition_versions v on v.id=d.current_version_id),
  '[{"code":"challenge-winner","version":1,"rule":"official_winner"},{"code":"community-favorite","version":1,"rule":"community_favorite"},{"code":"top-placement","version":1,"rule":"top_placement"}]'::jsonb,
  'catalog points at the immutable version-one presentations and fixed rules');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000001','authenticated','authenticated','badge-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000002','authenticated','authenticated','badge-entry-one@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000003','authenticated','authenticated','badge-entry-two@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000004','authenticated','authenticated','badge-outsider@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000005','authenticated','authenticated','badge-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='BadgeMaker'||right(id::text,1),username_normalized=lower('BadgeMaker'||right(id::text,1)),
  display_name='Badge Maker '||right(id::text,1),credit_name='Badge Maker '||right(id::text,1),profile_completed_at=now()
where id::text like 'fd000000-0000-4000-8000-%';
update public.profiles set status='suspended' where id='fd000000-0000-4000-8000-000000000005';
insert into private.app_admins(user_id,created_by) values
('fd000000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001');

insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('fd100000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001',gen_random_uuid(),'Badge source project','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('fd100000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001','owner','fd000000-0000-4000-8000-000000000001');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
  manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
values('fd200000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001',
  gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),120,4,4,'c-minor',480,1920);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,
  engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('fd300000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001',1,'fd000000-0000-4000-8000-000000000001',
  gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('2',64),2000,'fd200000-0000-4000-8000-000000000001');
update public.projects set status='active',visibility='private',published_at=now(),current_revision_id='fd300000-0000-4000-8000-000000000001'
where id='fd100000-0000-4000-8000-000000000001';

insert into public.challenges(id,slug,created_by,state,published_at,lifecycle_version) values
('fd400000-0000-4000-8000-000000000001','badge-result-test','fd000000-0000-4000-8000-000000000001','published',now(),2),
('fd400000-0000-4000-8000-000000000002','badge-community-only','fd000000-0000-4000-8000-000000000001','published',now(),2);
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,
  eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,
  judging_mode,official_placement_count,constraints,constraints_sha256)
values
('fd500000-0000-4000-8000-000000000001','fd400000-0000-4000-8000-000000000001',1,'fd000000-0000-4000-8000-000000000001',
  gen_random_uuid(),'Badge Result Test','Hear both exact entries.','Award fixture.','Original work only.','pulse',now()-interval '4 days',
  now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day','hybrid',2,
  private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('a',64)),
('fd500000-0000-4000-8000-000000000002','fd400000-0000-4000-8000-000000000002',1,'fd000000-0000-4000-8000-000000000001',
  gen_random_uuid(),'Community Only','Hear one exact entry.','Favorite-only fixture.','Original work only.','sunrise',now()-interval '4 days',
  now()-interval '3 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day','community',0,
  private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}'),repeat('b',64));
update public.challenges set current_version_id='fd500000-0000-4000-8000-000000000001' where id='fd400000-0000-4000-8000-000000000001';
update public.challenges set current_version_id='fd500000-0000-4000-8000-000000000002' where id='fd400000-0000-4000-8000-000000000002';
insert into public.challenge_judge_credits(challenge_version_id,position,role,display_name,profile_id,credit_name) values
('fd500000-0000-4000-8000-000000000001',1,'host','Named host','fd000000-0000-4000-8000-000000000004','Named host'),
('fd500000-0000-4000-8000-000000000002',1,'host','Named host','fd000000-0000-4000-8000-000000000004','Named host');

insert into public.challenge_entries(id,challenge_id,challenge_version_id,entrant_id,project_id,project_revision_id,
  project_title_snapshot,entrant_username_snapshot,entrant_display_name_snapshot,entrant_credit_name_snapshot,
  revision_number_snapshot,attribution_snapshot,duration_ms_snapshot,display_attestation_version,display_attested_at,
  facts,evaluation,evaluation_sha256,submit_request_id,submitted_at)
values
('fd600000-0000-4000-8000-000000000001','fd400000-0000-4000-8000-000000000001','fd500000-0000-4000-8000-000000000001',
 'fd000000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000001',
 'Winner exact entry','BadgeMaker2','Badge Maker 2','Badge Maker 2',1,'[{"kind":"publisher","creditName":"Badge Maker 2"}]',2000,
 'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('3',64),gen_random_uuid(),now()-interval '3 days'),
('fd600000-0000-4000-8000-000000000002','fd400000-0000-4000-8000-000000000001','fd500000-0000-4000-8000-000000000001',
 'fd000000-0000-4000-8000-000000000003','fd100000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000001',
 'Placed exact entry','BadgeMaker3','Badge Maker 3','Badge Maker 3',1,'[{"kind":"publisher","creditName":"Badge Maker 3"}]',2000,
 'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('4',64),gen_random_uuid(),now()-interval '3 days'),
('fd600000-0000-4000-8000-000000000003','fd400000-0000-4000-8000-000000000002','fd500000-0000-4000-8000-000000000002',
 'fd000000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000001',
 'Community exact entry','BadgeMaker2','Badge Maker 2','Badge Maker 2',1,'[{"kind":"publisher","creditName":"Badge Maker 2"}]',2000,
 'challenge-display-attestation-v1',now(),'{}','{"eligible":true}',repeat('5',64),gen_random_uuid(),now()-interval '3 days');
insert into public.challenge_votes(challenge_id,challenge_entry_id,voter_id,state) values
('fd400000-0000-4000-8000-000000000001','fd600000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000004','active'),
('fd400000-0000-4000-8000-000000000001','fd600000-0000-4000-8000-000000000002','fd000000-0000-4000-8000-000000000004','active'),
('fd400000-0000-4000-8000-000000000002','fd600000-0000-4000-8000-000000000003','fd000000-0000-4000-8000-000000000004','active');

set local role anon;
select throws_ok($$select * from public.profile_awards$$,'42501',null,'anonymous callers cannot enumerate award evidence');
select throws_ok($$select * from public.badge_definitions$$,'42501',null,'anonymous callers cannot enumerate the base catalog');
select throws_ok($$select private.issue_challenge_awards_for_result(gen_random_uuid(),gen_random_uuid())$$,'42501',null,'anonymous callers cannot invoke private issuance');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000004';
select throws_ok($$select public.reconcile_current_challenge_awards('fd400000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid())$$,
  'PT404','admin_not_found','named host credits grant no award issuance authority');
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000005';
select throws_ok($$select public.reconcile_current_challenge_awards('fd400000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid())$$,
  'PT404','admin_not_found','suspended unrelated actors gain no award issuance authority');
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
select throws_ok($$select public.reconcile_current_challenge_awards('fd400000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid())$$,
  'PT409','challenge_award_result_not_current','administrator cannot reconcile a stale or foreign result ID');

create temp table first_result as select public.finalize_challenge_result(
  'fd400000-0000-4000-8000-000000000001','fd800000-0000-4000-8000-000000000001',2,
  'fd500000-0000-4000-8000-000000000001',null,'Both entries found their audience.',
  '[{"entryId":"fd600000-0000-4000-8000-000000000001","place":1,"label":"Winner"},{"entryId":"fd600000-0000-4000-8000-000000000002","place":2,"label":"Runner-up"}]',null
) response;
create temp table community_result as select public.finalize_challenge_result(
  'fd400000-0000-4000-8000-000000000002','fd800000-0000-4000-8000-000000000002',2,
  'fd500000-0000-4000-8000-000000000002',null,'Listeners chose their favorite.','[]',null
) response;
reset role;

select is((select count(*) from public.profile_awards where challenge_result_id=(select (response->>'resultId')::uuid from first_result)),
  4::bigint,'initial finalization atomically issues Winner, Top Placement, and every favorite tie');
select is((select jsonb_agg(badge_code_snapshot order by badge_code_snapshot) from public.profile_awards
  where challenge_result_id=(select (response->>'resultId')::uuid from first_result) and challenge_entry_id='fd600000-0000-4000-8000-000000000001'),
  '["challenge-winner","community-favorite"]'::jsonb,'one exact entry independently earns Winner and Community Favorite');
select is((select jsonb_agg(badge_code_snapshot order by badge_code_snapshot) from public.profile_awards
  where challenge_result_id=(select (response->>'resultId')::uuid from first_result) and challenge_entry_id='fd600000-0000-4000-8000-000000000002'),
  '["community-favorite","top-placement"]'::jsonb,'the other exact entry independently earns Top Placement and the tied favorite');
select is((select count(*) from public.profile_awards where challenge_result_id=(select (response->>'resultId')::uuid from community_result)),
  1::bigint,'community-only finalization issues only Community Favorite');
select is((select badge_code_snapshot from public.profile_awards where challenge_result_id=(select (response->>'resultId')::uuid from community_result)),
  'community-favorite','community-only issuance never invents an official placement');
select is((select total_awards_inserted from private.challenge_award_issuance where request_id='fd800000-0000-4000-8000-000000000001'),
  4,'initial finalization records complete private issuance counts');
select is((select count(*) from public.profile_awards where recipient_id='fd000000-0000-4000-8000-000000000002'),3::bigint,
  'awards derive recipients from exact authoritative entry rows');

set local role anon;
create temp table first_public_awards as select public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002') awards;
select is(jsonb_array_length((select awards from first_public_awards)),3,'signed-out profile projection shows current visible awards');
select ok((select awards::text from first_public_awards) not like '%projectId%' and (select awards::text from first_public_awards) not like '%finalVoteTotal%'
  and (select awards::text from first_public_awards) not like '%correction%' and (select awards::text from first_public_awards) not like '%admin%',
  'public projection leaks no private project, voter, correction, or administrator evidence');
select ok((select bool_and(value->>'challengeHref' like '/challenges/%?result=%&entry=%#entry-%') from first_public_awards,jsonb_array_elements(awards)),
  'every public award links to exact canonical challenge result and entry context');
reset role;
grant select on first_result,community_result to anon;
set local role anon;
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000001')->>'projectTitle',
  'Winner exact entry','the exact current result and qualifying entry resolve independently of entry-list paging');
select ok((public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000001'))::text
    not like '%projectId%' and
    (public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000001'))::text
    not like '%entrantId%',
  'exact award target exposes no private project or identity identifiers');
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from community_result),'fd600000-0000-4000-8000-000000000001'),null::jsonb,
  'a result from another challenge is rejected');
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000003'),null::jsonb,
  'an entry outside the requested result is rejected');
reset role;

update public.challenge_entries set moderation_state='hidden',moderation_version=moderation_version+1 where id='fd600000-0000-4000-8000-000000000001';
set local role anon;
select is(jsonb_array_length(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')),1,'entry hiding removes its awards from public presentation');
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000001'),null::jsonb,
  'a hidden exact award entry fails closed without returning snapshot identity or project data');
reset role;
update public.challenge_entries set moderation_state='visible',moderation_version=moderation_version+1 where id='fd600000-0000-4000-8000-000000000001';
update public.challenges set moderation_state='hidden',moderation_version=moderation_version+1 where id='fd400000-0000-4000-8000-000000000001';
set local role anon;
select is(jsonb_array_length(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')),1,'challenge hiding removes affected public awards without deleting evidence');
reset role;
select is((select count(*) from public.profile_awards where recipient_id='fd000000-0000-4000-8000-000000000002'),3::bigint,'moderation preserves immutable award rows');
update public.challenges set moderation_state='visible',moderation_version=moderation_version+1 where id='fd400000-0000-4000-8000-000000000001';

update public.profiles set username='RenamedMaker',username_normalized='renamedmaker',display_name='Renamed Maker',credit_name='Renamed Credit'
where id='fd000000-0000-4000-8000-000000000002';
select is((select min(recipient_username_snapshot) from public.profile_awards where recipient_id='fd000000-0000-4000-8000-000000000002'),
  'BadgeMaker2','profile rename never rewrites immutable recipient snapshots');
update public.profiles set status='deleted',purged_at=now() where id='fd000000-0000-4000-8000-000000000002';
select is((select min(recipient_display_name_snapshot) from public.profile_awards where recipient_id='fd000000-0000-4000-8000-000000000002'),
  'Badge Maker 2','profile deletion never rewrites immutable award snapshots');
set local role anon;
select is(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002'),'[]'::jsonb,'deleted recipient awards are not publicly projected');
reset role;
set local session_replication_role=replica;
update public.profiles set status='active',purged_at=null where id='fd000000-0000-4000-8000-000000000002';
set local session_replication_role=origin;

set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
create temp table corrected_result as select public.finalize_challenge_result(
  'fd400000-0000-4000-8000-000000000001','fd800000-0000-4000-8000-000000000003',3,
  'fd500000-0000-4000-8000-000000000001',(select (response->>'resultId')::uuid from first_result),'Corrected official order.',
  '[{"entryId":"fd600000-0000-4000-8000-000000000002","place":1,"label":"Winner"},{"entryId":"fd600000-0000-4000-8000-000000000001","place":2,"label":"Runner-up"}]','Judging record correction'
) response;
reset role;
select is((select count(*) from public.profile_awards where challenge_id='fd400000-0000-4000-8000-000000000001'),8::bigint,
  'correction appends a complete award set while preserving superseded evidence');
select is((select count(distinct challenge_result_id) from public.profile_awards where challenge_id='fd400000-0000-4000-8000-000000000001'),2::bigint,
  'old and corrected exact result evidence remain independently addressable');
grant select on corrected_result to anon;
set local role anon;
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from first_result),'fd600000-0000-4000-8000-000000000001'),null::jsonb,
  'a superseded result ID cannot silently resolve against the corrected current result');
select is(public.get_public_challenge_award_target('badge-result-test',
    (select (response->>'resultId')::uuid from corrected_result),'fd600000-0000-4000-8000-000000000001')->>'resultId',
  (select response->>'resultId' from corrected_result),'the exact corrected current result ID is honored');
select is(jsonb_array_length(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')),3,
  'public projection exposes only corrected current-result awards plus the other current challenge');
select is((select count(*) from jsonb_array_elements(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')) item
    where item->>'challengeSlug'='badge-result-test' and item->>'challengeResultId'=(select response->>'resultId' from corrected_result)),
  2::bigint,'every projected award for the corrected challenge uses only its exact current result');
select ok(jsonb_array_length(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002'))<=24,
  'public projection remains bounded to at most twenty-four rows');
select is(public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002',
    (public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')->2->>'awardedAt')::timestamptz,
    (public.list_public_profile_awards('fd000000-0000-4000-8000-000000000002')->2->>'id')::uuid),
  '[]'::jsonb,'keyset cursor excludes the last emitted award without a clock boundary');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
create temp table reconciled as select public.reconcile_current_challenge_awards(
  'fd400000-0000-4000-8000-000000000001','fd800000-0000-4000-8000-000000000004',(select (response->>'resultId')::uuid from corrected_result)
) response;
select is((select response->>'totalAwardsInserted' from reconciled),'0','reconciliation inserts no duplicate current-result awards');
select is(public.reconcile_current_challenge_awards(
  'fd400000-0000-4000-8000-000000000001','fd800000-0000-4000-8000-000000000004',(select (response->>'resultId')::uuid from corrected_result)),
  (select response from reconciled),'identical reconciliation request replays deterministically');
select throws_ok($$select public.reconcile_current_challenge_awards(
  'fd400000-0000-4000-8000-000000000002','fd800000-0000-4000-8000-000000000004',(select (response->>'resultId')::uuid from community_result))$$,
  '22023','challenge_award_reconcile_request_mismatch','a request ID cannot be replayed against another challenge or result');
reset role;
select is((select count(*) from private.challenge_award_issuance where source_kind='reconciliation' and request_id='fd800000-0000-4000-8000-000000000004'),
  1::bigint,'reconciliation replay retains one private idempotency record');
select is((select count(*) from public.profile_awards where challenge_id='fd400000-0000-4000-8000-000000000001'),8::bigint,
  'reconciliation uniqueness leaves immutable awards unchanged');

select throws_ok($$update public.badge_definition_versions set name='Rewritten'$$,'PT403','append_only_record','badge versions reject updates');
select throws_ok($$delete from public.profile_awards where challenge_id='fd400000-0000-4000-8000-000000000001'$$,'PT403','append_only_record','awards reject deletes');
select throws_ok($$update private.challenge_award_issuance set total_awards_inserted=99$$,'PT403','append_only_record','issuance audit rejects updates');

select * from finish();
rollback;
