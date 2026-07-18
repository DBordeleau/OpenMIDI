begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(50);

select has_table('public','challenges','stable challenge identities exist');
select has_table('public','challenge_versions','immutable challenge versions exist');
select has_table('public','challenge_judge_credits','judge snapshots exist');
select has_table('private','challenge_admin_actions','private challenge audit exists');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.challenges'::regclass,'public.challenge_versions'::regclass,'public.challenge_judge_credits'::regclass,'private.challenge_admin_actions'::regclass)),'all challenge tables enable RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema in ('public','private') and table_name in ('challenges','challenge_versions','challenge_judge_credits','challenge_admin_actions') and grantee in ('anon','authenticated')),'application roles receive no direct challenge table grants');
select ok(has_function_privilege('anon','public.list_public_challenges(timestamp with time zone,uuid)','execute'),'anonymous may call bounded public challenge index');
select ok(not has_function_privilege('anon','public.create_challenge_draft(uuid,text,jsonb,jsonb)','execute'),'anonymous cannot reach administrator create command');
select ok(has_function_privilege('authenticated','public.create_challenge_draft(uuid,text,jsonb,jsonb)','execute'),'authenticated role reaches the database administrator guard');

select throws_ok($$select private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":4},"surprise":true}'::jsonb)$$,'22023','challenge_constraint_unknown_key','SQL rejects unknown constraint keys');
select throws_ok($$select private.validate_challenge_constraints_v1('{"schemaVersion":1}'::jsonb)$$,'22023','challenge_constraints_empty','SQL rejects zero-rule documents');
select is(
  private.validate_challenge_constraints_v1('{"schemaVersion":1,"instruments":{"allowedPresetVersions":[{"presetId":"warm-keys","version":1},{"presetId":"analog-bass","version":1}],"allowedFamilies":["keys","basses"]}}'::jsonb)
    #>> '{instruments,allowedPresetVersions,0,presetId}',
  'analog-bass','SQL canonicalizes preset arrays like TypeScript'
);
select is(private.challenge_public_phase('published','2026-08-01T12:00:00Z','2026-08-08T12:00:00Z','2026-08-01T11:59:59Z'),'scheduled','phase before opening is scheduled');
select is(private.challenge_public_phase('published','2026-08-01T12:00:00Z','2026-08-08T12:00:00Z','2026-08-01T12:00:00Z'),'open','opening instant is open');
select is(private.challenge_public_phase('published','2026-08-01T12:00:00Z','2026-08-08T12:00:00Z','2026-08-08T12:00:00Z'),'voting','submission close instant enters voting phase');
select lives_ok($$select private.validate_challenge_constraints_v1('{"schemaVersion":1,"tempoBpm":{"exact":300}}')$$,'SQL accepts the manifest-v3 maximum tempo');
select throws_ok($$select private.validate_challenge_constraints_v1('{"schemaVersion":1,"tempoBpm":{"exact":300.001}}')$$,'22023','challenge_constraint_range_bounds','SQL rejects tempo above the manifest-v3 maximum');
update public.midi_library_presets set active=false where preset_id='warm-keys' and version=1;
select throws_ok($$select private.validate_challenge_constraints_v1('{"schemaVersion":1,"instruments":{"requiredPresetVersions":[{"presetId":"warm-keys","version":1}]}}')$$,'22023','challenge_constraint_preset_invalid','SQL rejects inactive preset versions');
update public.midi_library_presets set active=true where preset_id='warm-keys' and version=1;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000001','authenticated','authenticated','challenge-member@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000002','authenticated','authenticated','challenge-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000003','authenticated','authenticated','challenge-admin@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fd000000-0000-4000-8000-000000000004','authenticated','authenticated','challenge-starter@example.test','','{}','{}',now(),now());
update public.profiles set username='ChallengeMember',username_normalized='challengemember',display_name='Challenge Member',credit_name='Challenge Member',profile_completed_at=now() where id='fd000000-0000-4000-8000-000000000001';
update public.profiles set username='ChallengeSuspended',username_normalized='challengesuspended',display_name='Challenge Suspended',credit_name='Challenge Suspended',profile_completed_at=now(),status='suspended' where id='fd000000-0000-4000-8000-000000000002';
update public.profiles set username='ChallengeAdmin',username_normalized='challengeadmin',display_name='Challenge Admin',credit_name='Challenge Admin',profile_completed_at=now() where id='fd000000-0000-4000-8000-000000000003';
update public.profiles set username='StarterMaker',username_normalized='startermaker',display_name='Starter Maker',credit_name='Starter Maker',profile_completed_at=now() where id='fd000000-0000-4000-8000-000000000004';
insert into private.app_admins(user_id,created_by) values('fd000000-0000-4000-8000-000000000003','fd000000-0000-4000-8000-000000000003');

set local role anon;
select throws_ok($$select public.create_challenge_draft(gen_random_uuid(),'anon-challenge','{}','[]')$$,'42501',null,'anonymous create is denied by grants');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
select throws_ok($$select public.create_challenge_draft(gen_random_uuid(),'member-challenge','{}','[]')$$,'PT404','admin_not_found','unrelated active member fails closed');
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000002';
select throws_ok($$select public.create_challenge_draft(gen_random_uuid(),'suspended-challenge','{}','[]')$$,'PT404','admin_not_found','suspended actor fails closed');

set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select lives_ok($$
  select public.create_challenge_draft(
    'fd100000-0000-4000-8000-000000000001','four-track-sprint',
    jsonb_build_object('title','Four Track Sprint','prompt','Say more with four parts.','description','Build one focused arrangement with exactly four tracks.','eligibilityTerms','Original authorized work only.','presentationCode','pulse','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"minimum":null,"maximum":null,"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":"fd000000-0000-4000-8000-000000000003"}]'::jsonb
  )
$$,'administrator creates a complete challenge draft');
select lives_ok($$
  select public.create_challenge_draft(
    'fd100000-0000-4000-8000-000000000001','four-track-sprint',
    jsonb_build_object('title','Four Track Sprint','prompt','Say more with four parts.','description','Build one focused arrangement with exactly four tracks.','eligibilityTerms','Original authorized work only.','presentationCode','pulse','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"minimum":null,"maximum":null,"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":"fd000000-0000-4000-8000-000000000003"}]'::jsonb
  )
$$,'identical create request replays idempotently');
reset role;
select is((select count(*) from private.challenge_admin_actions where request_id='fd100000-0000-4000-8000-000000000001'),1::bigint,'create audit is recorded exactly once');
create temp table challenge_fixture as select id,current_version_id from public.challenges where slug='four-track-sprint';
grant select on challenge_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select is(jsonb_array_length(public.list_public_challenges()),0,'drafts never enter the public index');

select lives_ok($$
  select public.revise_challenge_draft(
    (select id from challenge_fixture),'fd100000-0000-4000-8000-000000000002',1,
    (select current_version_id from challenge_fixture),
    jsonb_build_object('title','Four Track Sprint','prompt','Say more with four parts.','description','A revised immutable description for exactly four tracks.','eligibilityTerms','Original authorized work only.','presentationCode','nocturne','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb
  )
$$,'draft revision appends a version');
select lives_ok($$
  select public.revise_challenge_draft(
    (select id from challenge_fixture),'fd100000-0000-4000-8000-000000000002',1,
    (select current_version_id from challenge_fixture),
    jsonb_build_object('title','Four Track Sprint','prompt','Say more with four parts.','description','A revised immutable description for exactly four tracks.','eligibilityTerms','Original authorized work only.','presentationCode','nocturne','opensAt','2030-08-01T12:00:00Z','submissionsCloseAt','2030-08-08T12:00:00Z','votingOpensAt','2030-08-09T12:00:00Z','votingClosesAt','2030-08-10T12:00:00Z','resultsExpectedAt','2030-08-11T12:00:00Z','judgingMode','community','officialPlacementCount',0,'starterProjectId',null,'starterRevisionId',null,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),
    '[{"role":"host","displayName":"OpenMIDI","profileId":null}]'::jsonb
  )
$$,'identical revise request replays before optimistic checks');
reset role;
select is((select count(*) from public.challenge_versions where challenge_id=(select id from challenge_fixture)),2::bigint,'revision preserves both immutable versions');
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select throws_ok($$
  select public.revise_challenge_draft((select id from challenge_fixture),gen_random_uuid(),1,(select current_version_id from challenge_fixture),'{}','[]')
$$,'PT409','challenge_stale','stale revision is rejected');
reset role;
select throws_ok($$update public.challenge_versions set title='Changed' where version_number=1$$,'55000','immutable_revision_history','version update is rejected');
select throws_ok($$delete from public.challenge_versions where version_number=1$$,'55000','immutable_revision_history','version delete is rejected');
select throws_ok($$update public.challenge_judge_credits set display_name='Changed'$$,'55000','immutable_revision_history','judge credit update is rejected');

set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select lives_ok($$select public.publish_challenge((select id from challenge_fixture),'fd100000-0000-4000-8000-000000000003',2,(public.get_admin_challenge((select id from challenge_fixture))->>'currentVersionId')::uuid)$$,'administrator publishes current immutable version');
select lives_ok($$select public.publish_challenge((select id from challenge_fixture),'fd100000-0000-4000-8000-000000000003',2,(public.get_admin_challenge((select id from challenge_fixture))->>'currentVersionId')::uuid)$$,'publish replay is idempotent');
select is(jsonb_array_length(public.list_public_challenges()),1,'published challenge enters bounded public index');
select is(public.get_public_challenge('four-track-sprint')->>'title','Four Track Sprint','canonical public detail returns safe presentation');
select throws_ok($$select * from private.challenge_admin_actions$$,'42501',null,'administrator cannot directly read private audit');
select throws_ok($$select * from public.challenge_versions$$,'42501',null,'administrator cannot bypass projections with direct reads');
select lives_ok($$select public.cancel_challenge((select id from challenge_fixture),'fd100000-0000-4000-8000-000000000004',3,(public.get_admin_challenge((select id from challenge_fixture))->>'currentVersionId')::uuid,'The event was withdrawn before entries opened.')$$,'administrator explicitly cancels published challenge');
select lives_ok($$select public.cancel_challenge((select id from challenge_fixture),'fd100000-0000-4000-8000-000000000004',3,(public.get_admin_challenge((select id from challenge_fixture))->>'currentVersionId')::uuid,'The event was withdrawn before entries opened.')$$,'cancel replay is idempotent');
select is(public.get_public_challenge('four-track-sprint')->>'phase','cancelled','published cancellation remains permanently addressable');
select throws_ok($$
  select public.create_challenge_draft(gen_random_uuid(),'unknown-rule',jsonb_build_object('title','Unknown','prompt','Unknown.','description','Unknown rule test.','eligibilityTerms','Terms.','presentationCode','pulse','opensAt',now()+interval '1 day','submissionsCloseAt',now()+interval '2 days','votingOpensAt',now()+interval '3 days','votingClosesAt',now()+interval '4 days','resultsExpectedAt',now()+interval '5 days','judgingMode','community','officialPlacementCount',0,'constraints','{"schemaVersion":1,"surprise":true}'::jsonb),'[{"role":"host","displayName":"Host","profileId":null}]')
$$,'22023','challenge_constraint_unknown_key','command rejects unknown constraint documents');
select throws_ok($$
  select public.create_challenge_draft(gen_random_uuid(),'bad-schedule',jsonb_build_object('title','Bad schedule','prompt','Bad schedule.','description','Schedule order test.','eligibilityTerms','Terms.','presentationCode','pulse','opensAt',now()+interval '2 days','submissionsCloseAt',now()+interval '1 day','votingOpensAt',now()+interval '3 days','votingClosesAt',now()+interval '4 days','resultsExpectedAt',now()+interval '5 days','judgingMode','community','officialPlacementCount',0,'constraints','{"schemaVersion":1,"trackCount":{"exact":4}}'::jsonb),'[{"role":"host","displayName":"Host","profileId":null}]')
$$,'22023','challenge_version_invalid','command rejects invalid frozen schedule');

reset role;
insert into public.projects(id,owner_id,create_request_id,title,license_code) values('fd200000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000004',gen_random_uuid(),'Reusable Starter','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values('fd200000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000004','owner','fd000000-0000-4000-8000-000000000004');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values('fd210000-0000-4000-8000-000000000001','fd200000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000004',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-major',480,960);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values('fd220000-0000-4000-8000-000000000001','fd200000-0000-4000-8000-000000000001',1,'fd000000-0000-4000-8000-000000000004',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('b',64),1000,'fd210000-0000-4000-8000-000000000001');
update public.projects set visibility='public',status='active',current_revision_id='fd220000-0000-4000-8000-000000000001',published_at=now(),rights_attestation_version='cc-by-4.0-reuse-attestation-v1' where id='fd200000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select lives_ok($$
  select public.create_challenge_draft('fd100000-0000-4000-8000-000000000005','starter-study',jsonb_build_object('title','Starter Study','prompt','Begin from one exact source.','description','A starter snapshot test.','eligibilityTerms','Keep attribution.','presentationCode','sunrise','opensAt',now()+interval '1 day','submissionsCloseAt',now()+interval '2 days','votingOpensAt',now()+interval '3 days','votingClosesAt',now()+interval '4 days','resultsExpectedAt',now()+interval '5 days','judgingMode','judged','officialPlacementCount',1,'starterProjectId','fd200000-0000-4000-8000-000000000001','starterRevisionId','fd220000-0000-4000-8000-000000000001','constraints','{"schemaVersion":1,"tempoBpm":{"minimum":90,"maximum":120,"exact":null}}'::jsonb),'[{"role":"host","displayName":"Challenge Admin","profileId":"fd000000-0000-4000-8000-000000000003"},{"role":"judge","displayName":"Starter Maker","profileId":"fd000000-0000-4000-8000-000000000004"}]')
$$,'eligible exact public reusable starter is snapshotted');
reset role;
create temp table starter_challenge_fixture as select id,current_version_id from public.challenges where slug='starter-study';
grant select on starter_challenge_fixture to authenticated;
update public.projects set moderation_state='hidden' where id='fd200000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select throws_ok($$select public.publish_challenge((select id from starter_challenge_fixture),gen_random_uuid(),1,(select current_version_id from starter_challenge_fixture))$$,'PT409','challenge_starter_unavailable','publication revalidates starter visibility');
reset role;
update public.projects set moderation_state='visible' where id='fd200000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select lives_ok($$select public.publish_challenge((select id from starter_challenge_fixture),'fd100000-0000-4000-8000-000000000006',1,(select current_version_id from starter_challenge_fixture))$$,'restored exact starter permits publication');
select is(public.get_public_challenge('starter-study')#>>'{starter,creatorCreditName}','Starter Maker','public detail retains immutable starter creator snapshot');
select is(public.get_public_challenge('starter-study')#>>'{judges,1,creditName}','Starter Maker','linked judge uses immutable profile credit snapshot');

select lives_ok($$
  select public.create_challenge_draft('fd100000-0000-4000-8000-000000000007','preset-publication-check',jsonb_build_object('title','Preset Publication Check','prompt','Use one active preset.','description','Publication revalidates preset activity.','eligibilityTerms','Original work only.','presentationCode','pulse','opensAt',now()+interval '1 day','submissionsCloseAt',now()+interval '2 days','votingOpensAt',now()+interval '3 days','votingClosesAt',now()+interval '4 days','resultsExpectedAt',now()+interval '5 days','judgingMode','community','officialPlacementCount',0,'constraints','{"schemaVersion":1,"instruments":{"requiredPresetVersions":[{"presetId":"warm-keys","version":1}]}}'::jsonb),'[{"role":"host","displayName":"Host","profileId":null}]')
$$,'active preset version may be frozen into a draft');
reset role;
create temp table preset_publication_fixture as select id,current_version_id from public.challenges where slug='preset-publication-check';
grant select on preset_publication_fixture to authenticated;
update public.midi_library_presets set active=false where preset_id='warm-keys' and version=1;
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000003';
select throws_ok($$select public.publish_challenge((select id from preset_publication_fixture),gen_random_uuid(),1,(select current_version_id from preset_publication_fixture))$$,'22023','challenge_constraint_preset_invalid','publication revalidates preset activity');
reset role;
update public.midi_library_presets set active=true where preset_id='warm-keys' and version=1;

select * from finish();
rollback;
