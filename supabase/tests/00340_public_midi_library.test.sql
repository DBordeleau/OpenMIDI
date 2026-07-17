begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000001','authenticated','authenticated','library-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000002','authenticated','authenticated','library-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000003','authenticated','authenticated','library-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa000000-0000-4000-8000-000000000004','authenticated','authenticated','library-admin@example.test','','{}','{}',now(),now());
update public.profiles set username='LibraryOwner',username_normalized='libraryowner',display_name='Library Owner',credit_name='Library Owner',profile_completed_at=now() where id='fa000000-0000-4000-8000-000000000001';
update public.profiles set username='LibraryStranger',username_normalized='librarystranger',display_name='Library Stranger',credit_name='Library Stranger',profile_completed_at=now() where id='fa000000-0000-4000-8000-000000000002';
update public.profiles set username='LibrarySuspended',username_normalized='librarysuspended',display_name='Library Suspended',credit_name='Library Suspended',profile_completed_at=now(),status='suspended' where id='fa000000-0000-4000-8000-000000000003';
update public.profiles set username='LibraryAdmin',username_normalized='libraryadmin',display_name='Library Admin',credit_name='Library Admin',profile_completed_at=now() where id='fa000000-0000-4000-8000-000000000004';
insert into private.app_admins(user_id,created_by) values('fa000000-0000-4000-8000-000000000004','fa000000-0000-4000-8000-000000000004');

select has_table('public','midi_library_listings','listing editions exist');
select has_table('public','midi_pattern_external_credits','external-credit snapshots exist');
select has_table('public','midi_library_listing_tags','normalized listing tags exist');
select ok((select relrowsecurity from pg_class where oid='public.midi_library_listings'::regclass),'listings have RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema='public'
  and table_name in ('midi_library_listings','midi_library_listing_tags','midi_pattern_external_credits')
  and grantee in ('anon','authenticated')),'base listing and evidence tables have no application table grants');
select function_privs_are('public','list_midi_library_pattern_version',
  array['uuid','uuid','text','text','text','text','text','text','text','text','text','integer','text[]','jsonb','uuid'],
  'anon',array[]::text[],'anonymous cannot list versions');
select ok(has_function_privilege('anon','public.search_public_midi_library(text,text,text,text,text,text[],numeric,numeric,integer,integer,smallint,smallint,text,text,timestamptz,text,uuid,integer)','execute'),
  'anonymous may call only the bounded search projection');
select is((select count(*) from public.midi_library_presets),24::bigint,'public preset projection matches bundled catalog');

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_pattern_v3('fa100000-0000-4000-8000-000000000001','Golden Chords')$$,'owner creates commercial pattern');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where create_request_id='fa100000-0000-4000-8000-000000000001'),
  'fa200000-0000-4000-8000-000000000001',1,480::smallint,1920,
  '[{"noteId":"fa300000-0000-4000-8000-000000000001","startTick":0,"durationTicks":960,"pitch":60,"velocity":100},{"noteId":"fa300000-0000-4000-8000-000000000002","startTick":0,"durationTicks":960,"pitch":64,"velocity":96}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'owner creates exact CC BY version');
select lives_ok($$select public.create_midi_pattern_v3('fa100000-0000-4000-8000-000000000002','Study Pulse')$$,'owner creates reference pattern');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where create_request_id='fa100000-0000-4000-8000-000000000002'),
  'fa200000-0000-4000-8000-000000000002',1,480::smallint,960,
  '[{"noteId":"fa300000-0000-4000-8000-000000000003","startTick":0,"durationTicks":240,"pitch":48,"velocity":90},{"noteId":"fa300000-0000-4000-8000-000000000004","startTick":480,"durationTicks":240,"pitch":50,"velocity":90}]'::jsonb,
  false,null)$$,'owner creates unlicensed exact version');
select is((select count(*) from public.search_public_midi_library(p_limit=>25)),0::bigint,'pattern publication never creates a library listing automatically');

select lives_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000001'),
  'fa400000-0000-4000-8000-000000000001','commercial_reuse','original','midi-library-commercial-attestation-v1',
  'Layered chords for late-night arrangements',null,null,null,'harmony','warm-keys',1,
  array['harmonic','loop-friendly'],'[]'::jsonb,null)$$,'owner explicitly lists a CC BY version');
select lives_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000001'),
  'fa400000-0000-4000-8000-000000000001','commercial_reuse','original','midi-library-commercial-attestation-v1',
  'Layered chords for late-night arrangements',null,null,null,'harmony','warm-keys',1,
  array['harmonic','loop-friendly'],'[]'::jsonb,null)$$,'identical listing request replays idempotently');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000001'),
  'fa400000-0000-4000-8000-000000000001','commercial_reuse','original','midi-library-commercial-attestation-v1',
  'Changed payload',null,null,null,'harmony','warm-keys',1,array['harmonic'],'[]'::jsonb,null)$$,
  'PT409','midi_library_request_conflict','changed listing payload conflicts on request replay');
select lives_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000002'),
  'fa400000-0000-4000-8000-000000000002','reference_only','authorized_adaptation','midi-library-reference-display-attestation-v1',
  'A reference study with permission to display','https://example.test/source','Display permission recorded',null,
  'bassline','sub-bass',1,array['rhythmic'],
  '[{"creditedName":"Example Composer","role":"Composer","workTitle":"Source study","sourceUrl":"https://example.test/source","sourceTerms":"Display permission"}]'::jsonb,null)$$,
  'owner explicitly lists an unlicensed reference-only version');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000001'),
  gen_random_uuid(),'reference_only','original','midi-library-reference-display-attestation-v1','',null,null,null,
  'harmony','warm-keys',1,'{}'::text[],'[]'::jsonb,null)$$,
  'PT409','midi_library_cc_downgrade_denied','CC BY version cannot be downgraded to reference-only');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000002'),
  gen_random_uuid(),'commercial_reuse','original','midi-library-commercial-attestation-v1','',null,null,null,
  'bassline','sub-bass',1,'{}'::text[],'[]'::jsonb,null)$$,
  'PT409','midi_library_commercial_license_required','unlicensed version cannot be commercially listed');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000002'),
  gen_random_uuid(),'reference_only','authorized_adaptation','midi-library-reference-display-attestation-v1','',
  'http://example.test/source','terms',null,'bassline','sub-bass',1,'{}'::text[],
  '[{"creditedName":"Composer","role":"Composer"}]'::jsonb,null)$$,
  '22023','midi_library_source_url_invalid','non-HTTPS evidence is rejected');
reset role;
select is((select duration_beats from public.midi_library_listings where reuse_mode='commercial_reuse'),4.000::numeric,'duration beats are derived at PPQ 480');
select is((select polyphony_kind from public.midi_library_listings where reuse_mode='commercial_reuse'),'polyphonic','note overlap derives polyphony');
select ok((select min_pitch=60 and max_pitch=64 and note_count=2 from public.midi_library_listings where reuse_mode='commercial_reuse'),'pitch and note facets are derived from normalized notes');
select is((select count(*) from public.midi_pattern_external_credits),1::bigint,'external credit is snapshotted once');
select throws_ok($$update public.midi_pattern_external_credits set credited_name='Changed'$$,
  'PT409','midi_library_credit_immutable','external credits are immutable');
create temp table library_version_fixture as
  select id,create_request_id from public.midi_pattern_versions;
grant select on library_version_fixture to authenticated;

set local role anon;
select is((select count(*) from public.search_public_midi_library(
  p_rights=>'all',p_limit=>25)),2::bigint,'anonymous bounded All search returns both rights modes');
select is((select count(*) from public.search_public_midi_library(
  p_query=>'golden chords',p_rights=>'commercial_reuse',p_tags=>array['harmonic'],p_polyphony=>'polyphonic',p_limit=>25)),1::bigint,
  'text, rights, tag, and derived facet filters combine');
select is((select count(*) from public.search_public_midi_library(
  p_rights=>'reference_only',p_preset=>'sub-bass',p_instrument_family=>'basses',p_duration_max=>2,
  p_notes_max=>2,p_pitch_min=>48::smallint,p_pitch_max=>50::smallint,p_limit=>25)),1::bigint,
  'reference-only family, preset, duration, note, and pitch filters combine');
select is(jsonb_array_length((select notes from public.search_public_midi_library(p_query=>'Study Pulse',p_limit=>25))),2,
  'safe projection exposes only exact listed notes for preview');
select is((select external_credits->0->>'creditedName' from public.search_public_midi_library(p_query=>'Study Pulse',p_limit=>25)),'Example Composer',
  'safe projection exposes immutable external-credit display fields');
select throws_ok($$select * from public.midi_library_listings$$,'42501','permission denied for table midi_library_listings',
  'anonymous cannot enumerate attestation rows');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
select is((select count(*) from public.midi_pattern_versions),0::bigint,'listing does not broaden base pattern-version RLS');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from library_version_fixture where create_request_id='fa200000-0000-4000-8000-000000000001'),
  gen_random_uuid(),'commercial_reuse','original','midi-library-commercial-attestation-v1','',null,null,null,
  'harmony','warm-keys',1,'{}'::text[],'[]'::jsonb,null)$$,
  'PT404','midi_library_pattern_version_not_found','unrelated actor cannot list another creator exact version');
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000003';
select is((select count(*) from public.list_owned_midi_library_versions()),0::bigint,
  'suspended actor receives no owner catalog rows');
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000004';
select throws_ok($$select public.list_midi_library_pattern_version(
  'fa200000-0000-4000-8000-000000000001',gen_random_uuid(),'commercial_reuse','original',
  'midi-library-commercial-attestation-v1','',null,null,null,'harmony','warm-keys',1,'{}'::text[],'[]'::jsonb,null)$$,
  'PT404','midi_library_pattern_version_not_found','administrator status does not bypass exact ownership');
reset role;

create temp table commercial_listing_fixture as
  select id from public.midi_library_listings where reuse_mode='commercial_reuse';
grant select on commercial_listing_fixture to authenticated;
update public.midi_library_listings set moderation_hidden_at=statement_timestamp()
where reuse_mode='reference_only';
set local role anon;
select is((select count(*) from public.search_public_midi_library(p_rights=>'all',p_limit=>25)),1::bigint,
  'moderation-hidden listing is excluded from public search');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
select lives_ok($$select public.unlist_midi_library_listing(
  (select id from commercial_listing_fixture),
  'fa500000-0000-4000-8000-000000000001',1)$$,'owner unlists active edition');
select lives_ok($$select public.unlist_midi_library_listing(
  (select id from commercial_listing_fixture),
  'fa500000-0000-4000-8000-000000000001',1)$$,'identical unlist request replays idempotently');
select throws_ok($$select public.list_midi_library_pattern_version(
  (select id from public.midi_pattern_versions where create_request_id='fa200000-0000-4000-8000-000000000001'),
  gen_random_uuid(),'commercial_reuse','authorized_adaptation','midi-library-commercial-attestation-v1',
  'Attempted changed rights snapshot','https://example.test/changed-source','Changed permission',null,
  'harmony','warm-keys',1,array['harmonic'],
  '[{"creditedName":"Different Composer","role":"Composer","sourceUrl":"https://example.test/changed-source"}]'::jsonb,null)$$,
  'PT409','midi_library_exact_version_rights_conflict',
  'an exact version cannot be relisted with altered rights or external credits');
reset role;
set local role anon;
select is((select count(*) from public.search_public_midi_library(p_rights=>'all',p_limit=>25)),0::bigint,
  'unlisted and hidden editions disappear from public discovery');

select * from finish();
rollback;
