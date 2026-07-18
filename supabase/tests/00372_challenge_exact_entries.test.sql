begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(49);

select has_table('public','challenge_entries','exact challenge entries exist');
select has_table('private','challenge_entry_commands','private entry command audit exists');
select ok((select relrowsecurity from pg_class where oid='public.challenge_entries'::regclass),'entry table enables RLS');
select ok((select relrowsecurity from pg_class where oid='private.challenge_entry_commands'::regclass),'entry audit enables RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema in ('public','private') and table_name in ('challenge_entries','challenge_entry_commands') and grantee in ('anon','authenticated')),'application roles have no direct entry table grants');
select ok(has_function_privilege('authenticated','public.submit_challenge_entry(uuid,uuid,uuid,uuid,uuid,text)','execute'),'authenticated role can reach guarded submit command');
select ok(not has_function_privilege('anon','public.submit_challenge_entry(uuid,uuid,uuid,uuid,uuid,text)','execute'),'anonymous cannot invoke submit command');
select ok(has_function_privilege('anon','public.get_public_challenge_entry_preview(text,uuid)','execute'),'anonymous can reach phase-safe preview projection');

-- Shared evaluator parity fixture: four tracks includes a duplicate preset,
-- an empty muted track, three exact preset versions, decimal BPM, and all rules.
create temp table parity as select private.evaluate_challenge_constraints_v1(
  '{"schemaVersion":1,"trackCount":{"minimum":4,"maximum":4,"exact":null},"distinctInstrumentCount":{"exact":3},"instruments":{"allowedPresetVersions":[{"presetId":"warm-keys","version":1}],"requiredPresetVersions":[{"presetId":"warm-keys","version":1}],"allowedFamilies":["basses","pads-strings"],"requiredFamilies":["basses"]},"tempoBpm":{"minimum":99.125,"maximum":100,"exact":null},"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'::jsonb,
  '{"trackCount":4,"distinctInstrumentCount":3,"presetVersions":[{"presetId":"analog-bass","version":1},{"presetId":"warm-keys","version":1},{"presetId":"warm-pad","version":1}],"families":["basses","keys","pads-strings"],"tempoBpm":99.125,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'::jsonb
) evaluation;
select is((select evaluation->>'eligible' from parity),'true','SQL parity fixture is eligible at inclusive decimal bounds');
select is((select jsonb_array_length(evaluation->'rules') from parity),7,'SQL returns every configured rule');
select is((select evaluation#>>'{rules,0,rule}' from parity),'track_count','rule order starts with track count');
select is((select evaluation#>>'{rules,2,rule}' from parity),'allowed_instruments','combined allowed-instrument rule has stable order');
select is((select evaluation#>>'{rules,4,message}' from parity),'Observed 99.125 BPM; requirement: 99.125–100 BPM.','decimal BPM message matches TypeScript fixture');
select is(private.evaluate_challenge_constraints_v1(
  '{"schemaVersion":1,"musicalKey":"c-minor"}',
  '{"trackCount":0,"distinctInstrumentCount":0,"presetVersions":[],"families":[],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":null}'
)#>>'{rules,0,message}','Observed No key declared; declare the project key as C minor.','null key reports no declaration without guessing');
select is(private.evaluate_challenge_constraints_v1(
  '{"schemaVersion":1,"instruments":{"allowedPresetVersions":[{"presetId":"warm-keys","version":1}],"allowedFamilies":["basses"]}}',
  '{"trackCount":2,"distinctInstrumentCount":2,"presetVersions":[{"presetId":"sub-bass","version":1},{"presetId":"saw-lead","version":1}],"families":["basses","leads"],"tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"musicalKey":null}'
)#>>'{rules,0,message}','Change saw-lead v1 to an allowed preset version or family.','allowed preset and family lists form a per-track union');
select throws_ok($$select private.evaluate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":1}}','{"trackCount":1}')$$,'22023','challenge_facts_invalid','malformed normalized facts fail closed');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fe000000-0000-4000-8000-000000000001','authenticated','authenticated','entry-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fe000000-0000-4000-8000-000000000002','authenticated','authenticated','entry-member@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fe000000-0000-4000-8000-000000000003','authenticated','authenticated','entry-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='EntryOwner',username_normalized='entryowner',display_name='Entry Owner',credit_name='Entry Owner',profile_completed_at=now() where id='fe000000-0000-4000-8000-000000000001';
update public.profiles set username='EntryMember',username_normalized='entrymember',display_name='Entry Member',credit_name='Entry Member',profile_completed_at=now() where id='fe000000-0000-4000-8000-000000000002';
update public.profiles set username='EntrySuspended',username_normalized='entrysuspended',display_name='Entry Suspended',credit_name='Entry Suspended',profile_completed_at=now(),status='suspended' where id='fe000000-0000-4000-8000-000000000003';

insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'Private Four Track Entry','cc-by-4.0'),
('fe100000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'Ineligible Sketch','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001','owner','fe000000-0000-4000-8000-000000000001'),
('fe100000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001','owner','fe000000-0000-4000-8000-000000000001'),
('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000002','editor','fe000000-0000-4000-8000-000000000001');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values
('fe200000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('1',64),99.125,4,4,'c-minor',480,1920),
('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('2',64),99.125,4,4,'c-minor',480,1920),
('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('3',64),120,3,4,null,480,1920);
insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed) values
('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000001',0,'Keys','warm-keys',1,0,0,false,false),
('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000002',1,'Bass','analog-bass',1,0,0,false,false),
('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000003',2,'Pad','warm-pad',1,0,0,false,false),
('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001','fe300000-0000-4000-8000-000000000004',3,'Muted empty keys','warm-keys',1,0,0,true,false),
('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000002','fe300000-0000-4000-8000-000000000005',0,'Lead','saw-lead',1,0,0,false,false);
insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values
('fe400000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001',1,null,'fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('4',64),2000,'fe200000-0000-4000-8000-000000000001'),
('fe400000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000001',2,'fe400000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('5',64),2000,'fe200000-0000-4000-8000-000000000002'),
('fe400000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000002',1,null,'fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('6',64),2000,'fe200000-0000-4000-8000-000000000003');
update public.projects set status='active',visibility='private',current_revision_id='fe400000-0000-4000-8000-000000000002',published_at=now() where id='fe100000-0000-4000-8000-000000000001';
update public.projects set status='active',visibility='private',current_revision_id='fe400000-0000-4000-8000-000000000003',published_at=now() where id='fe100000-0000-4000-8000-000000000002';

insert into public.challenges(id,slug,created_by,state,published_at) values
('fe500000-0000-4000-8000-000000000001','exact-entry-test','fe000000-0000-4000-8000-000000000001','published',now());
insert into public.challenge_versions(id,challenge_id,version_number,created_by,create_request_id,title,prompt,description,eligibility_terms,presentation_code,opens_at,submissions_close_at,voting_opens_at,voting_closes_at,results_expected_at,judging_mode,official_placement_count,constraints,constraints_sha256) values
('fe600000-0000-4000-8000-000000000001','fe500000-0000-4000-8000-000000000001',1,'fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'Exact Entry Test','Meet every boundary.','A deterministic entry test.','Authorize challenge display only.','pulse',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days',now()+interval '4 days','community',0,
private.validate_challenge_constraints_v1('{"schemaVersion":1,"trackCount":{"exact":4},"distinctInstrumentCount":{"exact":3},"instruments":{"allowedPresetVersions":[{"presetId":"warm-keys","version":1}],"requiredPresetVersions":[{"presetId":"warm-keys","version":1}],"allowedFamilies":["basses","pads-strings"],"requiredFamilies":["basses"]},"tempoBpm":{"minimum":99.125,"maximum":100},"timeSignature":{"numerator":4,"denominator":4},"musicalKey":"c-minor"}'),repeat('a',64));
update public.challenges set current_version_id='fe600000-0000-4000-8000-000000000001' where id='fe500000-0000-4000-8000-000000000001';

set local role anon;
select is(jsonb_array_length(public.list_public_challenge_entries('exact-entry-test')),0,'pre-voting public list reveals no entry count or identity');
select throws_ok($$select * from private.challenge_entry_commands$$,'42501',null,'private entry command audit is never publicly readable');
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002')$$,'42501',null,'anonymous cannot preflight');
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002')$$,'PT404','challenge_revision_not_found','member who is not owner cannot preflight');
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000003';
select throws_ok($$select public.list_my_challenge_revision_options('fe500000-0000-4000-8000-000000000001')$$,'PT403','challenge_entry_actor_ineligible','suspended actor cannot enumerate options');
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select is(jsonb_array_length(public.list_my_challenge_revision_options('fe500000-0000-4000-8000-000000000001')),2,'active owner sees only current eligible-to-preflight project revisions');
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000001')$$,'PT404','challenge_revision_not_found','non-current revision cannot preflight');
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001',gen_random_uuid(),'fe400000-0000-4000-8000-000000000002')$$,'PT409','challenge_version_stale','stale challenge version cannot preflight');
select is(public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002')#>>'{evaluation,eligible}','true','owner preflight returns authoritative-shaped eligible evaluation');
select is(public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000003')#>>'{evaluation,eligible}','false','preflight returns every failure for an ineligible current revision');
reset role;
update public.projects set moderation_state='hidden' where id='fe100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002')$$,'PT404','challenge_revision_not_found','hidden project cannot preflight');
reset role;
update public.projects set moderation_state='visible',status='deleted',visibility='private',deleted_at=now() where id='fe100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select throws_ok($$select public.preflight_challenge_revision('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002')$$,'PT404','challenge_revision_not_found','deleted project cannot preflight');
reset role;
update public.projects set status='active',deleted_at=null where id='fe100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000003',gen_random_uuid(),null,'challenge-display-attestation-v1')$$,'PT422','challenge_revision_ineligible','database independently rejects ineligible submission');
select throws_ok($$select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002',gen_random_uuid(),null,null)$$,'PT400','challenge_entry_attestation_required','explicit challenge display attestation is required');
create temp table submitted as select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002','fe700000-0000-4000-8000-000000000001',null,'challenge-display-attestation-v1') result;
reset role;
select is((select count(*) from public.challenge_entries where challenge_id='fe500000-0000-4000-8000-000000000001'),1::bigint,'first submission creates one immutable entry');
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select is(public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002','fe700000-0000-4000-8000-000000000001',null,'challenge-display-attestation-v1'),(select result from submitted),'identical submission replays idempotently');
select throws_ok($$select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000002','fe700000-0000-4000-8000-000000000001',gen_random_uuid(),'challenge-display-attestation-v1')$$,'PT409','challenge_entry_request_conflict','changed payload under one request ID conflicts');
reset role;
select throws_ok($$update public.challenge_entries set project_title_snapshot='Crafted'$$,'PT403','challenge_entry_immutable','immutable entry snapshot cannot be edited');
select throws_ok($$delete from public.challenge_entries$$,'PT403','challenge_entry_immutable','entry evidence cannot be deleted');

-- Publish a new exact current project revision, then replace explicitly.
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks)
select 'fe200000-0000-4000-8000-000000000004',project_id,created_by,gen_random_uuid(),manifest_version,engine,engine_version,manifest,repeat('7',64),tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks from public.arrangement_versions where id='fe200000-0000-4000-8000-000000000002';
insert into public.arrangement_tracks select 'fe200000-0000-4000-8000-000000000004',project_id,gen_random_uuid(),sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed from public.arrangement_tracks where arrangement_version_id='fe200000-0000-4000-8000-000000000002';
insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id)
values('fe400000-0000-4000-8000-000000000004','fe100000-0000-4000-8000-000000000001',3,'fe400000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001',gen_random_uuid(),'Final challenge mix','{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('8',64),2000,'fe200000-0000-4000-8000-000000000004');
update public.projects set current_revision_id='fe400000-0000-4000-8000-000000000004' where id='fe100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
create temp table replacement as select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004','fe700000-0000-4000-8000-000000000002',(select (result->>'entryId')::uuid from submitted),'challenge-display-attestation-v1') result;
reset role;
select is((select count(*) from public.challenge_entries where challenge_id='fe500000-0000-4000-8000-000000000001'),2::bigint,'replacement appends a second exact entry');
select is((select count(*) from public.challenge_entries where challenge_id='fe500000-0000-4000-8000-000000000001' and status='active'),1::bigint,'replacement atomically leaves one active entry');
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select is(public.get_my_challenge_entry('fe500000-0000-4000-8000-000000000001')->>'revisionNumber','3','owner My entry projection pins replacement revision');
select throws_ok($$select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004',gen_random_uuid(),(select (result->>'entryId')::uuid from submitted),'challenge-display-attestation-v1')$$,'PT409','challenge_entry_stale','stale replacement contention fails');
select is(jsonb_array_length(public.list_public_challenge_entries('exact-entry-test')),0,'entrant list remains completely hidden before voting opens');
select is(public.get_public_challenge_entry('exact-entry-test',(select (result->>'entryId')::uuid from replacement)),null,'entry detail remains hidden before voting');

reset role;
alter table public.challenge_versions disable trigger challenge_versions_immutable;
update public.challenge_versions set voting_opens_at=now()-interval '1 second',submissions_close_at=now()-interval '2 seconds' where id='fe600000-0000-4000-8000-000000000001';
alter table public.challenge_versions enable trigger challenge_versions_immutable;
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_challenge_entry('fe500000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','fe400000-0000-4000-8000-000000000004',gen_random_uuid(),(select (result->>'entryId')::uuid from replacement),'challenge-display-attestation-v1')$$,'PT409','challenge_submissions_closed','exact close boundary rejects late replacement');
select is(jsonb_array_length(public.list_public_challenge_entries('exact-entry-test')),1,'voting phase exposes only the one active visible entry');
select is(public.get_public_challenge_entry('exact-entry-test',(select (result->>'entryId')::uuid from replacement))->>'projectTitle','Private Four Track Entry','challenge projection exposes the exact private-project snapshot');
select is(public.get_public_challenge_entry_preview('exact-entry-test',(select (result->>'entryId')::uuid from replacement))->>'revisionId','fe400000-0000-4000-8000-000000000004','challenge preview returns only the pinned exact revision through its safe endpoint authority');
select is((select visibility::text from public.projects where id='fe100000-0000-4000-8000-000000000001'),'private','challenge submission never makes the project generally public');
reset role;
update public.projects set moderation_state='hidden' where id='fe100000-0000-4000-8000-000000000001';
select is(jsonb_array_length(public.list_public_challenge_entries('exact-entry-test')),0,'hidden source project immediately removes exact entry projection');
select is(public.get_public_challenge_entry_preview('exact-entry-test',(select (result->>'entryId')::uuid from replacement)),null,'hidden source project removes challenge preview data');
update public.projects set moderation_state='visible' where id='fe100000-0000-4000-8000-000000000001';
update public.challenges set state='completed',completed_at=now() where id='fe500000-0000-4000-8000-000000000001';
select is(jsonb_array_length(public.list_public_challenge_entries('exact-entry-test')),1,'completed phase retains only the active moderation-visible exact entry');

select * from finish();
rollback;
