begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000001','authenticated','authenticated','midi-publisher@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000002','authenticated','authenticated','midi-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000003','authenticated','authenticated','midi-blocked@example.test','','{}','{}',now(),now());
update public.profiles set username='MidiPublisher',username_normalized='midipublisher',display_name='MIDI Publisher',credit_name='MIDI Publisher',profile_completed_at=now() where id='f0000000-0000-4000-8000-000000000001';
update public.profiles set username='MidiOther',username_normalized='midiother',display_name='MIDI Other',credit_name='MIDI Other',profile_completed_at=now() where id='f0000000-0000-4000-8000-000000000002';
update public.profiles set username='MidiBlocked',username_normalized='midiblocked',display_name='MIDI Blocked',credit_name='MIDI Blocked',profile_completed_at=now(),status='suspended' where id='f0000000-0000-4000-8000-000000000003';

select has_function('public','publish_midi_stem_version',array['uuid','uuid','integer','text'],'publication RPC exists');
select function_privs_are('public','publish_midi_stem_version',array['uuid','uuid','integer','text'],'authenticated',array['EXECUTE'],'authenticated has exact publication execute grant');
select function_privs_are('public','publish_midi_stem_version',array['uuid','uuid','integer','text'],'anon',array[]::text[],'anonymous has no publication execute grant');

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_stem_draft('f1000000-0000-4000-8000-000000000001','Recorded hook','blank')$$,'owner creates publication draft');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),
  'f2000000-0000-4000-8000-000000000001',
  1,
  '{"name":"Recorded hook","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[{"noteId":"f3000000-0000-4000-8000-000000000001","pitch":60,"velocity":111,"startTick":120,"durationTicks":360}]}'::jsonb
)$$,'owner saves the exact recorded draft');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts),
  'f4000000-0000-4000-8000-000000000001',
  2,
  (select content_sha256 from public.midi_stem_drafts)
)$$,'owner publishes the saved draft');
select is((select count(*) from public.midi_stem_versions),1::bigint,'publication appends one version');
select is((select version from public.midi_stem_versions),1,'first publication is version one');
select ok((select content_sha256 = (select content_sha256 from public.midi_stem_drafts) from public.midi_stem_versions),'publication freezes the exact canonical checksum');
select is((select creator_credit_name from public.midi_stem_versions),'MIDI Publisher','publication snapshots creator credit');
select is((select source_lock_version from public.midi_stem_versions),2,'publication records the exact source lock');
select is((select source_draft_id from public.midi_stem_versions),(select id from public.midi_stem_drafts),'publication records its private source draft without exposing it publicly');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts),
  'f4000000-0000-4000-8000-000000000001',
  2,
  (select content_sha256 from public.midi_stem_drafts)
)$$,'exact publication retry is idempotent');
select is((select count(*) from public.midi_stem_versions),1::bigint,'idempotent retry creates no duplicate version');
select throws_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts),
  'f4000000-0000-4000-8000-000000000001',
  2,
  repeat('0',64)
)$$,'PT409','midi_stem_publish_request_conflict','conflicting request reuse is rejected');
select throws_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts),gen_random_uuid(),1,
  (select content_sha256 from public.midi_stem_drafts)
)$$,'PT409','midi_stem_publish_conflict','stale draft publication is rejected');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts),gen_random_uuid(),2,
  (select content_sha256 from public.midi_stem_drafts)
)$$,'a deliberate second freeze appends a new version');
select is((select max(version) from public.midi_stem_versions),2,'versions increment under the stem lock');
reset role;
select throws_ok($$update public.midi_stem_versions set notes='[]'::jsonb$$,'PT409','midi_stem_version_immutable','published note history is immutable');
set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select throws_ok($$delete from public.midi_stem_versions$$,'42501','permission denied for table midi_stem_versions','authenticated actors have no direct version delete grant');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.midi_stem_versions),0::bigint,'unrelated actor cannot read immutable versions');
select throws_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts limit 1),gen_random_uuid(),2,repeat('0',64)
)$$,'22023','midi_stem_publish_invalid','hidden draft identifiers cannot be inferred through RLS selects');
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.publish_midi_stem_version(
  'f5000000-0000-4000-8000-000000000001',gen_random_uuid(),1,repeat('0',64)
)$$,'PT403','midi_stem_actor_inactive','suspended actor cannot publish');
reset role;

set local role anon;
select throws_ok($$select public.publish_midi_stem_version(
  'f5000000-0000-4000-8000-000000000001',gen_random_uuid(),1,repeat('0',64)
)$$,'42501',null,'anonymous actor cannot execute publication');
reset role;

select lives_ok($$update public.profiles set credit_name='Later stage name' where id='f0000000-0000-4000-8000-000000000001'$$,'mutable profile credit can change independently');
select is((select min(creator_credit_name) from public.midi_stem_versions),'MIDI Publisher','published creator snapshot does not drift with profile edits');

select has_function('public','create_imported_midi_stem_draft',array['uuid','uuid','jsonb'],'atomic import RPC exists');
select function_privs_are('public','create_imported_midi_stem_draft',array['uuid','uuid','jsonb'],'authenticated',array['EXECUTE'],'authenticated has exact import execute grant');
select function_privs_are('public','create_imported_midi_stem_draft',array['uuid','uuid','jsonb'],'anon',array[]::text[],'anonymous has no import execute grant');
set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_imported_midi_stem_draft(
  'f6000000-0000-4000-8000-000000000001',
  'f7000000-0000-4000-8000-000000000001',
  '{"name":"Imported phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"f8000000-0000-4000-8000-000000000001","pitch":67,"velocity":101,"startTick":0,"durationTicks":240}]}'::jsonb
)$$,'browser-normalized import creates and saves atomically');
select lives_ok($$select public.create_imported_midi_stem_draft(
  'f6000000-0000-4000-8000-000000000001',
  'f7000000-0000-4000-8000-000000000001',
  '{"name":"Imported phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"f8000000-0000-4000-8000-000000000001","pitch":67,"velocity":101,"startTick":0,"durationTicks":240}]}'::jsonb
)$$,'exact import retry is idempotent');
select is((select count(*) from public.midi_stem_drafts where entry_mode='import'),1::bigint,'import retry leaves one new draft');
select is((select note_count from public.midi_stem_drafts where entry_mode='import'),1,'import persists the exact bounded note count');
select throws_ok($$select public.create_imported_midi_stem_draft(
  'f6000000-0000-4000-8000-000000000001',
  'f7000000-0000-4000-8000-000000000001',
  '{"name":"Imported phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[]}'::jsonb
)$$,'PT409','midi_stem_request_conflict','conflicting import retry rolls back');
reset role;
set local role anon;
select throws_ok($$select public.create_imported_midi_stem_draft(gen_random_uuid(),gen_random_uuid(),'{}'::jsonb)$$,'42501',null,'anonymous actor cannot execute import');
reset role;

select * from finish();
rollback;
