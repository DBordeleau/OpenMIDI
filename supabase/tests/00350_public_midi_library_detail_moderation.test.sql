begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000001','authenticated','authenticated','lib2-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000002','authenticated','authenticated','lib2-reporter@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000003','authenticated','authenticated','lib2-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb000000-0000-4000-8000-000000000004','authenticated','authenticated','lib2-admin@example.test','','{}','{}',now(),now());
update public.profiles set username='LibTwoOwner',username_normalized='libtwoowner',display_name='LIB Two Owner',credit_name='LIB Two Owner',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000001';
update public.profiles set username='LibTwoReporter',username_normalized='libtworeporter',display_name='LIB Two Reporter',credit_name='LIB Two Reporter',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000002';
update public.profiles set username='LibTwoSuspended',username_normalized='libtwosuspended',display_name='LIB Two Suspended',credit_name='LIB Two Suspended',profile_completed_at=now(),status='suspended' where id='fb000000-0000-4000-8000-000000000003';
update public.profiles set username='LibTwoAdmin',username_normalized='libtwoadmin',display_name='LIB Two Admin',credit_name='LIB Two Admin',profile_completed_at=now() where id='fb000000-0000-4000-8000-000000000004';
insert into private.app_admins(user_id,created_by) values('fb000000-0000-4000-8000-000000000004','fb000000-0000-4000-8000-000000000004');

select has_table('private','midi_library_reports','private listing reports exist');
select has_table('private','midi_library_moderation_actions','private listing action audit exists');
select ok((select relrowsecurity from pg_class where oid='private.midi_library_reports'::regclass),'private reports have RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema='private'
  and table_name in ('midi_library_reports','midi_library_moderation_actions')
  and grantee in ('anon','authenticated')),'private report and audit tables have no application grants');
select ok(has_function_privilege('anon','public.get_public_midi_library_listing(uuid)','execute'),'anonymous can read bounded detail');
select ok(not has_function_privilege('anon','public.submit_midi_library_report(uuid,uuid,text,text,text,text)','execute'),'anonymous cannot submit listing reports');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_pattern_v3('fb100000-0000-4000-8000-000000000001','History melody')$$,'creator creates pattern');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where create_request_id='fb100000-0000-4000-8000-000000000001'),
  'fb200000-0000-4000-8000-000000000001',1,480::smallint,960,
  '[{"noteId":"fb300000-0000-4000-8000-000000000001","startTick":0,"durationTicks":240,"pitch":60,"velocity":90}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'creator creates listed version');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where create_request_id='fb100000-0000-4000-8000-000000000001'),
  'fb200000-0000-4000-8000-000000000002',2,480::smallint,960,
  '[{"noteId":"fb300000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":62,"velocity":96},{"noteId":"fb300000-0000-4000-8000-000000000002","startTick":480,"durationTicks":240,"pitch":67,"velocity":84}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'creator creates public-project history version');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where create_request_id='fb100000-0000-4000-8000-000000000001'),
  'fb200000-0000-4000-8000-000000000003',3,480::smallint,960,
  '[{"noteId":"fb300000-0000-4000-8000-000000000003","startTick":0,"durationTicks":240,"pitch":72,"velocity":80}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'creator creates private-only history version');
select lives_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000001'),
  'fb400000-0000-4000-8000-000000000001','commercial_reuse','authorized_adaptation','midi-library-commercial-attestation-v1',
  'Exact detail fixture','https://example.test/source','CC BY compatible source terms',null,
  'melody','soft-lead',1,array['melodic'],
  '[{"creditedName":"External Composer","role":"Composer","sourceUrl":"https://example.test/source","sourceTerms":"CC BY compatible"}]'::jsonb,null)$$,'creator lists exact version with external credit');
reset role;

-- One public project uses version 2; one private project uses version 3. Only the public relationship is projected.
insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('fb500000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb510000-0000-4000-8000-000000000001','Public usage','cc-by-4.0'),
('fb500000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','fb510000-0000-4000-8000-000000000002','Private usage','all-rights-reserved');
insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values
('fb520000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001','fb530000-0000-4000-8000-000000000001',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-major',480,960),
('fb520000-0000-4000-8000-000000000002','fb500000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000001','fb530000-0000-4000-8000-000000000002',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1','{}',repeat('b',64),120,4,4,'c-major',480,960);
insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed) values
('fb520000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001','fb540000-0000-4000-8000-000000000001',0,'Lead','soft-lead',1,-6,0,false,false),
('fb520000-0000-4000-8000-000000000002','fb500000-0000-4000-8000-000000000002','fb540000-0000-4000-8000-000000000002',0,'Private lead','soft-lead',1,-6,0,false,false);
insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop) values
('fb520000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001','fb540000-0000-4000-8000-000000000001','fb550000-0000-4000-8000-000000000001',(select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000002'),0,960,0,false),
('fb520000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001','fb540000-0000-4000-8000-000000000001','fb550000-0000-4000-8000-000000000003',(select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000001'),0,960,0,false),
('fb520000-0000-4000-8000-000000000002','fb500000-0000-4000-8000-000000000002','fb540000-0000-4000-8000-000000000002','fb550000-0000-4000-8000-000000000002',(select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000003'),0,960,0,false);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values
('fb560000-0000-4000-8000-000000000001','fb500000-0000-4000-8000-000000000001',1,'fb000000-0000-4000-8000-000000000001','fb570000-0000-4000-8000-000000000001','{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('c',64),1000,'fb520000-0000-4000-8000-000000000001'),
('fb560000-0000-4000-8000-000000000002','fb500000-0000-4000-8000-000000000002',1,'fb000000-0000-4000-8000-000000000001','fb570000-0000-4000-8000-000000000002','{}',3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',repeat('d',64),1000,'fb520000-0000-4000-8000-000000000002');
update public.projects set visibility='public',status='active',current_revision_id='fb560000-0000-4000-8000-000000000001',published_at=now(),bpm=120,musical_key='c-major',rights_attestation_version='cc-by-4.0-reuse-attestation-v1' where id='fb500000-0000-4000-8000-000000000001';
update public.projects set status='active',current_revision_id='fb560000-0000-4000-8000-000000000002',published_at=now(),bpm=120,musical_key='c-major' where id='fb500000-0000-4000-8000-000000000002';

create temp table lib2_fixture as select id as listing_id,midi_pattern_id,midi_pattern_version_id from public.midi_library_listings;
grant select on lib2_fixture to anon,authenticated;
set local role anon;
select is((public.get_public_midi_library_listing((select listing_id from lib2_fixture))#>>'{listing,midiPatternVersionId}'),
  (select midi_pattern_version_id::text from lib2_fixture),'detail preserves exact listing/version identity');
select is(jsonb_array_length(public.get_public_midi_library_listing((select listing_id from lib2_fixture))->'history'),2,
  'history includes listed and public-project-authorized versions but excludes private-only version');
select is((public.get_public_midi_library_listing((select listing_id from lib2_fixture))#>>'{usage,publicProjectCount}')::integer,1,
  'only public project usage contributes to count');
select is(jsonb_array_length(public.get_public_midi_library_listing((select listing_id from lib2_fixture))#>'{usage,projects}'),1,
  'only public project usage contributes links');
select is(public.get_public_midi_library_listing((select listing_id from lib2_fixture))#>>'{listing,externalCredits,0,creditedName}',
  'External Composer','external credits are displayed separately in safe detail');
select lives_ok($$select public.get_public_midi_library_pattern_comparison(
  (select listing_id from lib2_fixture),
  (select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000001'),
  (select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000002'))$$,
  'same-pattern authorized pair can be compared');
select throws_ok($$select public.get_public_midi_library_pattern_comparison(
  (select listing_id from lib2_fixture),
  (select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000001'),
  (select id from public.midi_pattern_versions where create_request_id='fb200000-0000-4000-8000-000000000003'))$$,
  'PT403','midi_library_comparison_not_authorized','private-only version cannot enter comparison');
reset role;

-- Grow the authorized history beyond the application bound. The detail RPC must
-- cap before aggregating notes, retain the listed version, and leave explicit
-- authorized comparison access independent from the first history window.
create temp table lib2_extra_versions as
  select i as version_number,gen_random_uuid() as version_id
  from generate_series(4,102) i;
grant select on lib2_extra_versions to anon;
insert into public.midi_pattern_versions(
  id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,
  ppq,duration_ticks,note_count,content_sha256,reuse_license_code,
  reuse_license_version,reuse_license_url,created_at
)
select x.version_id,f.midi_pattern_id,x.version_number,gen_random_uuid(),
  'fb000000-0000-4000-8000-000000000001','LIB Two Owner',480,960,1,
  lpad(to_hex(x.version_number),64,'0'),'CC-BY-4.0','4.0',
  'https://creativecommons.org/licenses/by/4.0/',now()+make_interval(secs=>x.version_number)
from lib2_extra_versions x cross join lib2_fixture f;
insert into public.midi_pattern_notes(
  midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity
)
select version_id,gen_random_uuid(),0,240,60,90 from lib2_extra_versions;
insert into public.arrangement_clips(
  arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,
  start_tick,duration_ticks,source_start_tick,loop
)
select 'fb520000-0000-4000-8000-000000000001',
  'fb500000-0000-4000-8000-000000000001',
  'fb540000-0000-4000-8000-000000000001',gen_random_uuid(),version_id,
  0,960,0,false
from lib2_extra_versions;
set local role anon;
select is(jsonb_array_length(public.get_public_midi_library_listing(
  (select listing_id from lib2_fixture))->'history'),100,
  'detail history is bounded to 100 authorized versions before application mapping');
select ok(public.get_public_midi_library_listing((select listing_id from lib2_fixture))
  #>'{history}' @> jsonb_build_array(jsonb_build_object(
    'midiPatternVersionId',(select midi_pattern_version_id from lib2_fixture))),
  'bounded history always retains the exact listed version');
select ok(not (public.get_public_midi_library_listing((select listing_id from lib2_fixture))
  #>'{history}' @> jsonb_build_array(jsonb_build_object(
    'midiPatternVersionId',(select id from public.midi_pattern_versions
      where create_request_id='fb200000-0000-4000-8000-000000000002')))),
  'deterministic history window excludes an older non-listed version when over capacity');
select lives_ok($$select public.get_public_midi_library_pattern_comparison(
  (select listing_id from lib2_fixture),
  (select midi_pattern_version_id from lib2_fixture),
  (select id from public.midi_pattern_versions
    where create_request_id='fb200000-0000-4000-8000-000000000002'))$$,
  'explicit authorized comparison remains available outside the bounded history window');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
select throws_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000001',
  (select listing_id from lib2_fixture),'observer',null,null,'The creator cannot report their own exact listing.')$$,
  'PT409','midi_library_report_self_denied','creator cannot report own listing');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000003';
select throws_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000002',
  (select listing_id from lib2_fixture),'observer',null,null,'Suspended actors cannot submit private evidence.')$$,
  'PT403','midi_library_report_actor_ineligible','suspended actor cannot report');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select lives_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000003',
  (select listing_id from lib2_fixture),'rightsholder','Original melody','https://example.test/original',
  'This listing appears to reproduce the melody from the linked original work.')$$,'unrelated actor submits bounded private report');
select lives_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000003',
  (select listing_id from lib2_fixture),'rightsholder','Original melody','https://example.test/original',
  'This listing appears to reproduce the melody from the linked original work.')$$,'identical report request is idempotent');
select throws_ok($$select * from private.midi_library_reports$$,'42501','permission denied for table midi_library_reports',
  'reporter cannot enumerate private reports');
reset role;
create temp table lib2_report_fixture as select id as report_id from private.midi_library_reports;
grant select on lib2_report_fixture to authenticated;
select is((select moderation_hidden_at from public.midi_library_listings where id=(select listing_id from lib2_fixture)),null,
  'report submission does not automatically hide content');

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select throws_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),gen_random_uuid(),'hide','Unauthorized user attempt','submitted',1)$$,
  'PT404','admin_not_found','unrelated actor cannot moderate listing');
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select is(jsonb_array_length(public.list_admin_midi_library_reports()),1,'administrator can review private queue');
select lives_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),'fb610000-0000-4000-8000-000000000001',
  'hide','Temporarily hidden during rights review','submitted',1)$$,'administrator hides with expected version');
select lives_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),'fb610000-0000-4000-8000-000000000001',
  'hide','Temporarily hidden during rights review','submitted',1)$$,'identical moderation action replays idempotently');
select throws_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),gen_random_uuid(),
  'restore','Stale restore attempt','reviewing',1)$$,
  'PT409','midi_library_moderation_target_conflict','stale moderation version is rejected');
reset role;
select is((select count(*) from private.midi_library_moderation_actions),1::bigint,'hide creates one idempotent audit record');
set local role anon;
select is((select count(*) from public.search_public_midi_library(p_limit=>25)),0::bigint,'hidden listing immediately leaves search');
select is(public.get_public_midi_library_listing((select listing_id from lib2_fixture)),null,'hidden listing immediately leaves detail projection');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select lives_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),'fb610000-0000-4000-8000-000000000002',
  'restore','Rights review permits restoration','reviewing',2)$$,'administrator restores with current version');
select lives_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_report_fixture),'fb610000-0000-4000-8000-000000000003',
  'resolve','Evidence reviewed and decision recorded','reviewing',3)$$,'administrator resolves report separately from visibility');
reset role;
set local role anon;
select isnt(public.get_public_midi_library_listing((select listing_id from lib2_fixture)),null,'restored listing returns to safe detail reads');
reset role;
insert into private.midi_library_reports(reporter_id,request_id,listing_id,midi_pattern_id,midi_pattern_version_id,
  target_label_snapshot,claimant_role,evidence,status,resolved_at,created_at,updated_at)
select 'fb000000-0000-4000-8000-000000000002',
  ('fb620000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  f.listing_id,f.midi_pattern_id,f.midi_pattern_version_id,'Historical evidence','observer',
  'Bounded historical evidence retained for rate-limit coverage.','resolved',now(),now(),now()
from generate_series(1,9) i cross join lib2_fixture f;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select throws_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000004',
  (select listing_id from lib2_fixture),'observer',null,null,
  'Another report should be stopped by the bounded daily rate limit.')$$,
  'PT429','midi_library_report_rate_limited','library reports are rate limited across recent submissions');
reset role;
update private.midi_library_reports set created_at=now()-interval '2 days',updated_at=now()-interval '2 days'
  where request_id::text like 'fb620000-0000-4000-8000-%';
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
select lives_ok($$select public.submit_midi_library_report('fb600000-0000-4000-8000-000000000005',
  (select listing_id from lib2_fixture),'observer',null,null,
  'A fresh private report remains possible after the rate window passes.')$$,
  'reporter can submit again after prior report resolution and rate window');
reset role;
create temp table lib2_dismiss_fixture as
  select id as report_id from private.midi_library_reports
  where request_id='fb600000-0000-4000-8000-000000000005';
grant select on lib2_dismiss_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000004';
select lives_ok($$select public.apply_midi_library_moderation_action(
  (select report_id from lib2_dismiss_fixture),
  'fb610000-0000-4000-8000-000000000004','dismiss','No actionable rights conflict found','submitted',3)$$,
  'administrator may dismiss without changing restored visibility');
reset role;
select is((select count(*) from private.midi_library_moderation_actions),4::bigint,'hide restore resolve and dismiss each retain an audit record');

select * from finish();
rollback;
