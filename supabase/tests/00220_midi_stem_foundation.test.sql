begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated','midi-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000002','authenticated','authenticated','midi-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000003','authenticated','authenticated','midi-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='MidiOwner',username_normalized='midiowner',display_name='MIDI Owner',credit_name='MIDI Owner',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000001';
update public.profiles set username='MidiStranger',username_normalized='midistranger',display_name='MIDI Stranger',credit_name='MIDI Stranger',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000002';
update public.profiles set username='MidiSuspended',username_normalized='midisuspended',display_name='MIDI Suspended',credit_name='MIDI Suspended',profile_completed_at=now(),status='suspended' where id='e0000000-0000-4000-8000-000000000003';

select ok((select relrowsecurity from pg_class where oid='public.midi_stems'::regclass),'midi stems has RLS');
select ok((select relrowsecurity from pg_class where oid='public.midi_stem_drafts'::regclass),'midi drafts has RLS');
select ok((select relrowsecurity from pg_class where oid='public.midi_stem_versions'::regclass),'midi versions has RLS');
select ok(not exists(
  select 1 from information_schema.role_table_grants
  where table_schema='public' and table_name in ('midi_stems','midi_stem_drafts','midi_stem_versions')
    and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')
),'MIDI tables have no direct authenticated writes');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_stem_draft('e1000000-0000-4000-8000-000000000001','Night chords','blank',null,'warm-poly',1)$$,'owner creates blank draft');
select lives_ok($$select public.create_midi_stem_draft('e1000000-0000-4000-8000-000000000001','Night chords','blank',null,'warm-poly',1)$$,'create retry is idempotent');
select is((select count(*) from public.midi_stems),1::bigint,'one stem identity created');
select is((select count(*) from public.midi_stem_drafts),1::bigint,'one mutable draft created');
select is((select entry_mode from public.midi_stem_drafts),'blank','blank origin is retained');
select is((select lock_version from public.midi_stem_drafts),1,'new draft starts at lock one');

select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),
  'e2000000-0000-4000-8000-000000000001',
  1,
  '{"name":"Night chords","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[{"noteId":"e3000000-0000-4000-8000-000000000001","pitch":60,"velocity":96,"startTick":0,"durationTicks":480},{"noteId":"e3000000-0000-4000-8000-000000000002","pitch":64,"velocity":88,"startTick":480,"durationTicks":480}]}'::jsonb
)$$,'owner saves canonical notes');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),
  'e2000000-0000-4000-8000-000000000001',
  1,
  '{"name":"Night chords","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[{"noteId":"e3000000-0000-4000-8000-000000000001","pitch":60,"velocity":96,"startTick":0,"durationTicks":480},{"noteId":"e3000000-0000-4000-8000-000000000002","pitch":64,"velocity":88,"startTick":480,"durationTicks":480}]}'::jsonb
)$$,'save retry is idempotent');
select is((select lock_version from public.midi_stem_drafts),2,'save increments the lock once');
select is((select note_count from public.midi_stem_drafts),2,'note count is projected');
select is((select notes->0->>'pitch' from public.midi_stem_drafts),'60','canonical notes reload exactly');
select ok((select content_sha256 = encode(extensions.digest(convert_to(jsonb_build_object(
  'name',name,'defaultPresetId',default_preset_id,'defaultPresetVersion',default_preset_version,
  'ppq',ppq,'durationTicks',duration_ticks,'notes',notes
)::text,'UTF8'),'sha256'),'hex') from public.midi_stem_drafts),'content checksum matches canonical JSON');
select throws_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),gen_random_uuid(),1,
  '{"name":"Night chords","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[]}'::jsonb
)$$,'PT409','midi_stem_save_conflict','stale save conflicts');
select throws_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),gen_random_uuid(),2,
  '{"name":"Night chords","defaultPresetId":"unknown","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[]}'::jsonb
)$$,'22023','midi_stem_preset_invalid','unknown preset is rejected');
select throws_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),gen_random_uuid(),2,
  '{"name":"Night chords","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[{"noteId":"e3000000-0000-4000-8000-000000000002","pitch":64,"velocity":88,"startTick":480,"durationTicks":480},{"noteId":"e3000000-0000-4000-8000-000000000001","pitch":60,"velocity":96,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'22023','midi_stem_content_not_canonical','incidental note order is rejected');
select throws_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts),gen_random_uuid(),2,
  '{"name":"Night chords","defaultPresetId":"round-bass","defaultPresetVersion":1,"ppq":480,"durationTicks":7680,"notes":[{"noteId":"e3000000-0000-4000-8000-000000000003","pitch":90,"velocity":90,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'22023','midi_stem_invalid_notes','preset note range is enforced');
select throws_ok($$update public.midi_stem_drafts set name='Direct write'$$,'42501','permission denied for table midi_stem_drafts','direct draft update is denied');
reset role;

insert into public.midi_stem_versions(
  id,stem_id,owner_id,version,name,default_preset_id,default_preset_version,ppq,duration_ticks,
  notes,note_count,content_sha256,creator_credit_name
)
select 'e4000000-0000-4000-8000-000000000001',stem_id,owner_id,1,name,default_preset_id,default_preset_version,ppq,duration_ticks,
  notes,note_count,content_sha256,'MIDI Owner'
from public.midi_stem_drafts;
select throws_ok($$update public.midi_stem_versions set name='Rewritten'$$,'PT409','midi_stem_version_immutable','published version rows are immutable');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_stem_draft('e1000000-0000-4000-8000-000000000002','Derived chords','derive','e4000000-0000-4000-8000-000000000001')$$,'owner derives a draft from an exact version');
select is((select note_count from public.midi_stem_drafts where entry_mode='derive'),2,'derived draft copies exact note content');
select is((select parent_stem_version_id from public.midi_stem_drafts where entry_mode='derive'),'e4000000-0000-4000-8000-000000000001'::uuid,'derived draft records exact parent version');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.midi_stems),0::bigint,'unrelated actor sees no stem identities');
select is((select count(*) from public.midi_stem_drafts),0::bigint,'unrelated actor sees no drafts');
select is((select count(*) from public.midi_stem_versions),0::bigint,'unrelated actor sees no versions');
select throws_ok($$select public.save_midi_stem_draft('e4000000-0000-4000-8000-000000000001',gen_random_uuid(),1,'{}'::jsonb)$$,'22023','midi_stem_content_invalid','malformed saves fail before lookup');
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.midi_stem_drafts),0::bigint,'suspended actor sees no drafts');
select throws_ok($$select public.create_midi_stem_draft(gen_random_uuid(),'Blocked','blank')$$,'PT403','midi_stem_actor_inactive','suspended actor cannot create a draft');
reset role;

set local role anon;
select throws_ok($$select public.create_midi_stem_draft(gen_random_uuid(),'Anonymous','blank')$$,'42501',null,'anonymous role cannot execute draft commands');
reset role;

select ok(not exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name in ('workspace_tracks','revision_tracks','contribution_version_tracks')
    and column_name in ('midi_stem_id','midi_stem_draft_id','latest_midi_stem_version_id')
),'project projections cannot reference drafts or latest pointers');

select * from finish();
rollback;
