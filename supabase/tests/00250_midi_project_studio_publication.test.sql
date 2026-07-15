begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aa000000-0000-4000-8000-000000000001','authenticated','authenticated','midi-project-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aa000000-0000-4000-8000-000000000002','authenticated','authenticated','midi-project-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aa000000-0000-4000-8000-000000000003','authenticated','authenticated','midi-project-blocked@example.test','','{}','{}',now(),now());
update public.profiles set username='MidiProjectOwner',username_normalized='midiprojectowner',display_name='MIDI Project Owner',credit_name='MIDI Project Owner',profile_completed_at=now() where id='aa000000-0000-4000-8000-000000000001';
update public.profiles set username='MidiProjectOther',username_normalized='midiprojectother',display_name='MIDI Project Other',credit_name='MIDI Project Other',profile_completed_at=now() where id='aa000000-0000-4000-8000-000000000002';
update public.profiles set username='MidiProjectBlocked',username_normalized='midiprojectblocked',display_name='MIDI Project Blocked',credit_name='MIDI Project Blocked',profile_completed_at=now(),status='suspended' where id='aa000000-0000-4000-8000-000000000003';

select has_column('public','projects','compatibility','project compatibility is persisted');
select has_table('public','workspace_clips','normalized workspace clips exist');
select has_table('public','revision_clips','normalized immutable revision clips exist');
select has_table('public','revision_midi_track_credits','MIDI revision credit snapshots exist');
select has_function('public','create_midi_project_workspace',array['uuid','text','text','numeric','text','smallint','smallint','text','uuid[]','uuid','uuid[]'],'atomic MIDI project creation exists');
select has_function('public','save_midi_workspace',array['uuid','uuid','integer','jsonb'],'v2 workspace save exists');
select has_function('public','publish_midi_workspace_revision',array['uuid','uuid','integer','uuid','text'],'v2 publication exists');
select function_privs_are('public','save_midi_workspace',array['uuid','uuid','integer','jsonb'],'anon',array[]::text[],'anonymous cannot save MIDI workspaces');

set local role authenticated;
set local request.jwt.claim.sub='aa000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_stem_draft('ab000000-0000-4000-8000-000000000001','Studio phrase','blank')$$,'owner creates a reusable stem');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts where owner_id='aa000000-0000-4000-8000-000000000001'),
  'ab000000-0000-4000-8000-000000000002',1,
  '{"name":"Studio phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"ab000000-0000-4000-8000-000000000003","pitch":60,"velocity":100,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'owner saves canonical stem notes');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts where owner_id='aa000000-0000-4000-8000-000000000001'),
  'ab000000-0000-4000-8000-000000000004',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='aa000000-0000-4000-8000-000000000001')
)$$,'owner freezes the exact stem version');

select lives_ok($$select public.create_midi_project_workspace(
  'ac000000-0000-4000-8000-000000000001','MIDI Studio project','',120::numeric,null::text,4::smallint,4::smallint,
  'all-rights-reserved','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'project, owner membership, and empty workspace are created atomically');
select is((select compatibility from public.projects where owner_id='aa000000-0000-4000-8000-000000000001'),'midi','new project is MIDI compatible');
select is((select count(*) from public.project_members where user_id='aa000000-0000-4000-8000-000000000001' and role='owner'),1::bigint,'atomic creation records one owner membership');
select is((select manifest_version from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),2::smallint,'atomic creation records a v2 workspace');
select is((select jsonb_array_length(manifest->'tracks') from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),0,'empty MIDI workspace starts without fake tracks');
select lives_ok($$select public.create_midi_project_workspace(
  'ac000000-0000-4000-8000-000000000001','MIDI Studio project','',120::numeric,null::text,4::smallint,4::smallint,
  'all-rights-reserved','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'exact atomic creation retry is idempotent');
select is((select count(*) from public.projects where owner_id='aa000000-0000-4000-8000-000000000001'),1::bigint,'creation retry leaves one project');
select throws_ok($$select public.create_midi_project_workspace(
  'ac000000-0000-4000-8000-000000000001','Different title','',120::numeric,null::text,4::smallint,4::smallint,
  'all-rights-reserved','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'PT409','project_request_conflict','conflicting creation retry is rejected');
select throws_ok($$select public.create_midi_project_workspace(
  'ac000000-0000-4000-8000-000000000001','MIDI Studio project','Changed description',120::numeric,null::text,4::smallint,4::smallint,
  'all-rights-reserved','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'PT409','project_request_conflict','creation retry rejects changed non-title metadata');

select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),
  'ad000000-0000-4000-8000-000000000001',1,
  jsonb_build_object(
    'manifestVersion',2,'engine','jam-session-composite','engineVersion','jam-session-composite-2_tone-15.1.22',
    'projectId',(select id from public.projects where owner_id='aa000000-0000-4000-8000-000000000001'),
    'tempoBpm',120.0,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'durationTicks',7680,
    'tracks',jsonb_build_array(jsonb_build_object(
      'kind','midi','trackId','ad000000-0000-4000-8000-000000000002','name','Studio phrase','instrumentId',null,
      'presetId','warm-poly','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,'sortOrder',0,
      'clips',jsonb_build_array(jsonb_build_object(
        'clipId','ad000000-0000-4000-8000-000000000003','midiStemVersionId',(select id from public.midi_stem_versions where owner_id='aa000000-0000-4000-8000-000000000001'),
        'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false
      ))
    ))
  )
)$$,'owner imports one exact immutable version into the v2 workspace');
select is((select count(*) from public.workspace_tracks where kind='midi'),1::bigint,'save projects one MIDI track');
select is((select count(*) from public.workspace_clips where midi_stem_version_id is not null),1::bigint,'save projects one exact MIDI clip reference');
select ok((select asset_id is null from public.workspace_tracks where kind='midi'),'MIDI projection cannot smuggle an asset ID');
select throws_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),gen_random_uuid(),1,
  (select manifest from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001')
)$$,'PT409','workspace_save_conflict','stale workspace replacement is rejected');

select lives_ok($$select public.publish_midi_workspace_revision(
  (select id from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),
  'ae000000-0000-4000-8000-000000000001',2,null,'First MIDI arrangement'
)$$,'saved v2 workspace publishes atomically');
select is((select count(*) from public.project_revisions where manifest_version=2),1::bigint,'publication appends one immutable v2 revision');
select is((select count(*) from public.revision_clips where kind='midi'),1::bigint,'publication freezes the normalized clip reference');
select is((select creator_credit_name from public.revision_midi_track_credits limit 1),'MIDI Project Owner','publication snapshots stem creator credit');
select lives_ok($$select public.publish_midi_workspace_revision(
  (select id from public.workspaces where owner_id='aa000000-0000-4000-8000-000000000001'),
  'ae000000-0000-4000-8000-000000000001',2,null,'First MIDI arrangement'
)$$,'exact publication retry is idempotent');
select is((select count(*) from public.project_revisions where manifest_version=2),1::bigint,'publication retry creates no duplicate revision');
reset role;
select throws_ok($$update public.revision_clips set start_tick=1$$,'55000','immutable_revision_history','published clip projections are immutable');

set local role authenticated;
set local request.jwt.claim.sub='aa000000-0000-4000-8000-000000000001';
select lives_ok($$select public.set_project_visibility(
  (select id from public.projects where owner_id='aa000000-0000-4000-8000-000000000001'),2,'public'
)$$,'owner makes the published MIDI project public');
reset role;
set local role anon;
select is((select tracks->0->>'kind' from public.public_project_catalog
  where title='MIDI Studio project'),'midi','public catalog identifies the MIDI track');
select is((select tracks->0->'preset'->>'id' from public.public_project_catalog
  where title='MIDI Studio project'),'warm-poly','public catalog exposes the synth preset without source bytes');
select is((select public.get_project_revision_preview(
  (select project_id from public.public_project_catalog where title='MIDI Studio project'),
  (select current_revision_id from public.public_project_catalog where title='MIDI Studio project')
)->'sources'),'[]'::jsonb,'anonymous MIDI preview exposes no Storage source descriptors');
select is((select jsonb_array_length(public.get_project_revision_preview(
  (select project_id from public.public_project_catalog where title='MIDI Studio project'),
  (select current_revision_id from public.public_project_catalog where title='MIDI Studio project')
)->'stems')),1,'anonymous preview exposes only the one referenced immutable stem payload');

select * from finish();
rollback;
