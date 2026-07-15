begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','d6000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','upgrade-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d6000000-0000-4000-8000-000000000002',
  'authenticated','authenticated','upgrade-stranger@example.test','','{}','{}',now(),now());
update public.profiles set username='UpgradeOwner',username_normalized='upgradeowner',
  display_name='Upgrade Owner',credit_name='Upgrade Owner',profile_completed_at=now()
where id='d6000000-0000-4000-8000-000000000001';
update public.profiles set username='UpgradeStranger',username_normalized='upgradestranger',
  display_name='Upgrade Stranger',credit_name='Upgrade Stranger',profile_completed_at=now()
where id='d6000000-0000-4000-8000-000000000002';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code,compatibility)
values('d6100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',
  'd6100000-0000-4000-8000-000000000002','Legacy upgrade',120,
  'all-rights-reserved','legacy_hybrid');
insert into public.project_members(project_id,user_id,role,created_by) values
('d6100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',
  'owner','d6000000-0000-4000-8000-000000000001');
insert into public.assets(id,owner_id,status,object_path,original_filename,
  reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,
  channels,verification_version,ready_at) values
('d6200000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',
  'ready','d6000000-0000-4000-8000-000000000001/d6200000-0000-4000-8000-000000000001/source',
  'legacy.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role) values
('d6200000-0000-4000-8000-000000000001',0,'d6000000-0000-4000-8000-000000000001',
  'Upgrade Owner','creator');
update public.assets set credits_confirmed_at=now(),
  credits_confirmation_request_id='d6200000-0000-4000-8000-000000000002',
  credits_confirmation_sha256=repeat('b',64)
where id='d6200000-0000-4000-8000-000000000001';
insert into public.midi_stems(id,owner_id,create_request_id,name) values
('d6300000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',
  'd6300000-0000-4000-8000-000000000002','Saved keys');
insert into public.midi_stem_versions(id,stem_id,owner_id,version,name,
  default_preset_id,default_preset_version,ppq,duration_ticks,notes,note_count,
  content_sha256,creator_credit_name) values
('d6300000-0000-4000-8000-000000000003','d6300000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',1,'Saved keys','warm-poly',1,480,1920,
  '[{"noteId":"d6300000-0000-4000-8000-000000000004","pitch":60,"velocity":96,"startTick":0,"durationTicks":480}]'::jsonb,
  1,repeat('c',64),'Upgrade Owner');

set local role authenticated;
set local request.jwt.claim.sub='d6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.publish_project_revision(
  'd6100000-0000-4000-8000-000000000001','d6400000-0000-4000-8000-000000000001',
  null,null,
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"d6100000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"d6500000-0000-4000-8000-000000000001","assetId":"d6200000-0000-4000-8000-000000000001","instrumentId":null,"name":"Legacy audio","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
)$$,'legacy project publishes before the upgrade');
select lives_ok($$select public.create_project_workspace(
  'd6100000-0000-4000-8000-000000000001','d6400000-0000-4000-8000-000000000002',
  (select current_revision_id from public.projects
    where id='d6100000-0000-4000-8000-000000000001')
)$$,'owner opens the legacy workspace');
select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001'),
  'd6400000-0000-4000-8000-000000000003',1,
  '{"manifestVersion":2,"engine":"jam-session-composite","engineVersion":"jam-session-composite-2_tone-15.1.22","projectId":"d6100000-0000-4000-8000-000000000001","tempoBpm":120,"timeSignature":{"numerator":4,"denominator":4},"durationTicks":1920,"tracks":[{"kind":"audio","trackId":"d6500000-0000-4000-8000-000000000001","name":"Legacy audio","instrumentId":null,"assetId":"d6200000-0000-4000-8000-000000000001","gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0,"clips":[{"clipId":"d6500000-0000-4000-8000-000000000001","positionMs":0,"trimStartMs":0,"durationMs":1000}]},{"kind":"midi","trackId":"d6500000-0000-4000-8000-000000000002","name":"Saved keys","instrumentId":null,"presetId":"warm-poly","presetVersion":1,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":1,"clips":[{"clipId":"d6500000-0000-4000-8000-000000000003","midiStemVersionId":"d6300000-0000-4000-8000-000000000003","startTick":0,"durationTicks":1920,"sourceStartTick":0,"loop":false}]}]}'::jsonb
)$$,'owner imports the first MIDI stem into a legacy workspace');
reset role;

select is((select manifest_version from public.workspaces
  where project_id='d6100000-0000-4000-8000-000000000001'),2::smallint,
  'workspace is promoted to manifest v2');
select is((select engine from public.workspaces
  where project_id='d6100000-0000-4000-8000-000000000001'),'jam-session-composite',
  'workspace records the composite engine');
select is((select lock_version from public.workspaces
  where project_id='d6100000-0000-4000-8000-000000000001'),2,
  'upgrade increments the workspace lock once');
select is((select count(*) from public.workspace_tracks
  where workspace_id=(select id from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001')),2::bigint,
  'upgrade projects both audio and MIDI tracks');
select is((select asset_id from public.workspace_tracks
  where workspace_id=(select id from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001') and kind='audio'),
  'd6200000-0000-4000-8000-000000000001'::uuid,
  'upgrade preserves the exact legacy source asset');
select is((select clip_id from public.workspace_clips
  where workspace_id=(select id from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001') and kind='audio'),
  'd6500000-0000-4000-8000-000000000001'::uuid,
  'legacy track id becomes its deterministic audio clip id');
select is((select midi_stem_version_id from public.workspace_clips
  where workspace_id=(select id from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001') and kind='midi'),
  'd6300000-0000-4000-8000-000000000003'::uuid,
  'upgrade projects the exact immutable MIDI stem version');
select is((select manifest_version from public.project_revisions
  where project_id='d6100000-0000-4000-8000-000000000001'),1::smallint,
  'upgrade does not mutate the published legacy revision');

create temporary table upgraded_workspace_id as
select id from public.workspaces
where project_id='d6100000-0000-4000-8000-000000000001';
grant select on upgraded_workspace_id to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='d6000000-0000-4000-8000-000000000002';
select throws_ok($$select public.save_midi_workspace(
  (select id from upgraded_workspace_id),gen_random_uuid(),2,
  (select manifest from public.workspaces
    where project_id='d6100000-0000-4000-8000-000000000001')
)$$,'PT404','workspace_not_found','unrelated actor cannot use the legacy upgrade save boundary');
reset role;

select * from finish();
rollback;
