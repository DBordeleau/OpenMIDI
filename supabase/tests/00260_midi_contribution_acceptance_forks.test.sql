begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_table('public','contribution_version_clips','submitted v2 clips are normalized');
select has_table('public','contribution_version_midi_track_credits','submitted MIDI credits are separate from asset credits');
select has_column('public','revision_midi_track_credits','credit_role','revision MIDI credits preserve derivation roles');
select function_privs_are('public','submit_contribution',array['uuid','uuid','integer','uuid','text','text'],'anon',array[]::text[],'anonymous cannot submit contributions');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000001','authenticated','authenticated','midi-collab-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000002','authenticated','authenticated','midi-collab-contributor@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000003','authenticated','authenticated','midi-collab-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000004','authenticated','authenticated','midi-collab-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='MidiCollabOwner',username_normalized='midicollabowner',display_name='MIDI Collab Owner',credit_name='MIDI Collab Owner',profile_completed_at=now() where id='b6000000-0000-4000-8000-000000000001';
update public.profiles set username='MidiCollabContributor',username_normalized='midicollabcontributor',display_name='MIDI Collab Contributor',credit_name='MIDI Collab Contributor',profile_completed_at=now() where id='b6000000-0000-4000-8000-000000000002';
update public.profiles set username='MidiCollabOther',username_normalized='midicollabother',display_name='MIDI Collab Other',credit_name='MIDI Collab Other',profile_completed_at=now() where id='b6000000-0000-4000-8000-000000000003';
update public.profiles set username='MidiCollabSuspended',username_normalized='midicollabsuspended',display_name='MIDI Collab Suspended',credit_name='MIDI Collab Suspended',profile_completed_at=now(),status='suspended' where id='b6000000-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_stem_draft(
  'b6100000-0000-4000-8000-000000000001','Owner phrase','blank'
)$$,'owner creates the source stem draft');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6100000-0000-4000-8000-000000000002',1,
  '{"name":"Owner phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"b6100000-0000-4000-8000-000000000003","pitch":60,"velocity":100,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'owner saves source notes');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6100000-0000-4000-8000-000000000004',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000001')
)$$,'owner freezes the source stem version');
select lives_ok($$select public.create_midi_project_workspace(
  'b6200000-0000-4000-8000-000000000001','MIDI collaboration','',120::numeric,
  null::text,4::smallint,4::smallint,'cc-by-4.0','{}'::uuid[],null::uuid,'{}'::uuid[]
)$$,'owner creates the MIDI project');
select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6200000-0000-4000-8000-000000000002',1,
  jsonb_build_object(
    'manifestVersion',2,'engine','jam-session-composite','engineVersion','jam-session-composite-2_tone-15.1.22',
    'projectId',(select id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
    'tempoBpm',120.0,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'durationTicks',3840,
    'tracks',jsonb_build_array(jsonb_build_object(
      'kind','midi','trackId','b6200000-0000-4000-8000-000000000003','name','Owner phrase','instrumentId',null,
      'presetId','warm-poly','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,'sortOrder',0,
      'clips',jsonb_build_array(jsonb_build_object(
        'clipId','b6200000-0000-4000-8000-000000000004',
        'midiStemVersionId',(select id from public.midi_stem_versions where owner_id='b6000000-0000-4000-8000-000000000001'),
        'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false
      ))
    ))
  )
)$$,'owner saves the exact source stem reference');
select lives_ok($$select public.publish_midi_workspace_revision(
  (select id from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6200000-0000-4000-8000-000000000005',2,null,'Base MIDI revision'
)$$,'owner publishes the base MIDI revision');
select lives_ok($$select public.set_project_contributions_open(
  (select id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),2,true
)$$,'owner opens exact-version contributions');
reset role;

insert into public.project_members(project_id,user_id,role,created_by)
select id,'b6000000-0000-4000-8000-000000000002','viewer','b6000000-0000-4000-8000-000000000001'
from public.projects where owner_id='b6000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000002';
select lives_ok($$select public.create_contribution_workspace(
  (select id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6300000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  'Add a harmony note','A derived exact stem version.'
)$$,'contributor branches a v2 workspace from the exact revision');
select is((select manifest_version from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002'),2::smallint,'contribution workspace preserves manifest v2');
select is((select count(*) from public.workspace_clips wc join public.workspaces w on w.id=wc.workspace_id where w.owner_id='b6000000-0000-4000-8000-000000000002'),1::bigint,'contribution workspace reuses the exact base clip');
select lives_ok($$select public.create_midi_stem_draft(
  'b6400000-0000-4000-8000-000000000001','Harmony phrase','derive',
  (select id from public.midi_stem_versions where owner_id='b6000000-0000-4000-8000-000000000001')
)$$,'contributor derives from the exact source version');
select lives_ok($$select public.save_midi_stem_draft(
  (select id from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000002'),
  'b6400000-0000-4000-8000-000000000002',1,
  '{"name":"Harmony phrase","defaultPresetId":"warm-poly","defaultPresetVersion":1,"ppq":480,"durationTicks":1920,"notes":[{"noteId":"b6400000-0000-4000-8000-000000000003","pitch":60,"velocity":100,"startTick":0,"durationTicks":480},{"noteId":"b6400000-0000-4000-8000-000000000004","pitch":64,"velocity":92,"startTick":0,"durationTicks":480}]}'::jsonb
)$$,'contributor edits the derived notes');
select lives_ok($$select public.publish_midi_stem_version(
  (select id from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000002'),
  'b6400000-0000-4000-8000-000000000005',2,
  (select content_sha256 from public.midi_stem_drafts where owner_id='b6000000-0000-4000-8000-000000000002')
)$$,'contributor freezes the derived version');
select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002'),
  'b6500000-0000-4000-8000-000000000001',1,
  jsonb_set(
    jsonb_set((select manifest from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002'),
      '{tracks,0,name}',to_jsonb('Harmony phrase'::text)),
    '{tracks,0,clips,0,midiStemVersionId}',
    to_jsonb((select id::text from public.midi_stem_versions where owner_id='b6000000-0000-4000-8000-000000000002'))
  )
)$$,'contributor explicitly replaces the workspace stem version');
select lives_ok($$select public.submit_contribution(
  (select id from public.contributions where author_id='b6000000-0000-4000-8000-000000000002'),
  'b6500000-0000-4000-8000-000000000002',2,
  (select base_revision_id from public.contributions where author_id='b6000000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1'
)$$,'submission freezes the exact v2 projection');
select is((select count(*) from public.contribution_version_clips),1::bigint,'submission stores one immutable MIDI clip reference');
select is((select count(*) from public.contribution_version_midi_track_credits),2::bigint,'submission snapshots contributor and derivation-source credits');
select throws_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002'),gen_random_uuid(),2,
  (select manifest from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000002')
)$$,'PT404','workspace_not_found','submitted contribution workspace is read-only');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.review_contribution(
  (select id from public.contributions where author_id='b6000000-0000-4000-8000-000000000002'),
  'b6600000-0000-4000-8000-000000000001','accept','submitted',
  (select current_version_id from public.contributions where author_id='b6000000-0000-4000-8000-000000000002'),
  (select current_revision_id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),null
)$$,'owner atomically accepts the exact submitted MIDI version');
select is((select status from public.contributions where author_id='b6000000-0000-4000-8000-000000000002'),'accepted'::public.contribution_status,'accepted contribution reaches the terminal state');
select is((select count(*) from public.revision_midi_track_credits rmc join public.projects p on p.current_revision_id=rmc.revision_id where p.owner_id='b6000000-0000-4000-8000-000000000001'),2::bigint,'accepted revision preserves creator and derivation lineage');
select is((select source_bytes from public.project_storage_usage u join public.projects p on p.id=u.project_id where p.owner_id='b6000000-0000-4000-8000-000000000001'),0::bigint,'MIDI acceptance consumes zero Storage bytes');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000002';
select lives_ok($$select public.fork_project(
  (select id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  (select current_revision_id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6700000-0000-4000-8000-000000000001','cc-by-4.0','Harmony fork','Exact accepted MIDI history'
)$$,'contributor forks the accepted MIDI revision copy-on-write');
select is((select source_bytes from public.project_storage_usage u join public.projects p on p.id=u.project_id where p.create_request_id='b6700000-0000-4000-8000-000000000001'),0::bigint,'MIDI fork consumes zero Storage bytes');
select ok(not exists(
  (select track_id,clip_id,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop from public.revision_clips where revision_id=(select current_revision_id from public.projects where create_request_id='b6700000-0000-4000-8000-000000000001')
   except select track_id,clip_id,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop from public.revision_clips where revision_id=(select source_revision_id from public.projects where create_request_id='b6700000-0000-4000-8000-000000000001'))
),'fork reproduces the accepted exact MIDI clip references');
reset role;

insert into public.project_members(project_id,user_id,role,created_by)
select id,'b6000000-0000-4000-8000-000000000003','viewer','b6000000-0000-4000-8000-000000000001'
from public.projects where owner_id='b6000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000003';
select lives_ok($$select public.create_contribution_workspace(
  (select id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  'b6800000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where owner_id='b6000000-0000-4000-8000-000000000001'),
  'Stale MIDI proposal','Must not merge automatically.'
)$$,'another contributor branches the accepted MIDI revision');
select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000003'),
  'b6800000-0000-4000-8000-000000000002',1,
  (select manifest from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000003')
)$$,'stale candidate receives a server-acknowledged v2 save');
select lives_ok($$select public.submit_contribution(
  (select id from public.contributions where author_id='b6000000-0000-4000-8000-000000000003'),
  'b6800000-0000-4000-8000-000000000003',2,
  (select base_revision_id from public.contributions where author_id='b6000000-0000-4000-8000-000000000003'),
  (select manifest_sha256 from public.workspaces where owner_id='b6000000-0000-4000-8000-000000000003'),
  'contributor-attestation-v1'
)$$,'stale candidate freezes an exact v2 version');
reset role;

insert into public.project_revisions(id,project_id,revision_number,parent_revision_id,
  created_by,publish_request_id,expected_base_revision_id,message,manifest,
  manifest_version,engine,engine_version,manifest_sha256,duration_ms)
select 'b6900000-0000-4000-8000-000000000001',r.project_id,r.revision_number+1,r.id,
  'b6000000-0000-4000-8000-000000000001','b6900000-0000-4000-8000-000000000002',r.id,
  'Owner advanced independently',r.manifest,r.manifest_version,r.engine,r.engine_version,
  r.manifest_sha256,r.duration_ms
from public.project_revisions r join public.projects p on p.current_revision_id=r.id
where p.owner_id='b6000000-0000-4000-8000-000000000001';
insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,position_ms,
  trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,kind,preset_id,preset_version)
select 'b6900000-0000-4000-8000-000000000001',id,asset_id,instrument_id,name,
  position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,
  kind,preset_id,preset_version from public.revision_tracks
where revision_id=(select parent_revision_id from public.project_revisions where id='b6900000-0000-4000-8000-000000000001');
insert into public.revision_clips(revision_id,track_id,clip_id,kind,position_ms,trim_start_ms,
  duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop)
select 'b6900000-0000-4000-8000-000000000001',track_id,clip_id,kind,position_ms,
  trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop
from public.revision_clips where revision_id=(select parent_revision_id from public.project_revisions where id='b6900000-0000-4000-8000-000000000001');
update public.projects set current_revision_id='b6900000-0000-4000-8000-000000000001',
  lock_version=lock_version+1 where owner_id='b6000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='b6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.review_contribution(
  (select id from public.contributions where author_id='b6000000-0000-4000-8000-000000000003'),
  'b6900000-0000-4000-8000-000000000003','accept','submitted',
  (select current_version_id from public.contributions where author_id='b6000000-0000-4000-8000-000000000003'),
  'b6900000-0000-4000-8000-000000000001',null
)$$,'stale v2 acceptance becomes changes requested instead of merging');
select is((select status from public.contributions where author_id='b6000000-0000-4000-8000-000000000003'),
  'changes_requested'::public.contribution_status,'stale v2 contribution remains editable on its exact base');
select is((select count(*) from public.project_revisions p join public.projects project on project.id=p.project_id where project.owner_id='b6000000-0000-4000-8000-000000000001'),3::bigint,'stale acceptance appends no merged revision');

select * from finish();
rollback;
