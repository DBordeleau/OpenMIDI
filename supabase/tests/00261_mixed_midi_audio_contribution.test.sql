begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c6000000-0000-4000-8000-000000000001','authenticated','authenticated','mixed-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c6000000-0000-4000-8000-000000000002','authenticated','authenticated','mixed-contributor@example.test','','{}','{}',now(),now());
update public.profiles set username='MixedOwner',username_normalized='mixedowner',display_name='Mixed Owner',credit_name='Mixed Owner',profile_completed_at=now() where id='c6000000-0000-4000-8000-000000000001';
update public.profiles set username='MixedContributor',username_normalized='mixedcontributor',display_name='Mixed Contributor',credit_name='Mixed Contributor',profile_completed_at=now() where id='c6000000-0000-4000-8000-000000000002';

insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,
  media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,
  ready_at)
values('c6100000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
  'ready','c6000000-0000-4000-8000-000000000001/c6100000-0000-4000-8000-000000000001/source',
  'legacy.wav',1000,'audio/wav',1000,repeat('c',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('c6100000-0000-4000-8000-000000000001',0,'c6000000-0000-4000-8000-000000000001','Mixed Owner','creator');
set local role authenticated;
set local request.jwt.claim.sub='c6000000-0000-4000-8000-000000000001';
select public.confirm_source_asset_credits(
  'c6100000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000002',
  '[{"kind":"self","role":"creator"}]'::jsonb
);
reset role;
insert into public.midi_stems(id,owner_id,create_request_id,name)
values('c6200000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c6200000-0000-4000-8000-000000000002','Legacy harmony');
insert into public.midi_stem_versions(id,stem_id,owner_id,version,name,default_preset_id,
  default_preset_version,ppq,duration_ticks,notes,note_count,content_sha256,creator_credit_name)
values('c6200000-0000-4000-8000-000000000003','c6200000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000001',1,'Legacy harmony','warm-poly',1,480,1920,
  '[{"noteId":"c6200000-0000-4000-8000-000000000004","pitch":67,"velocity":96,"startTick":0,"durationTicks":480}]'::jsonb,
  1,repeat('d',64),'Mixed Owner');
insert into public.projects(id,owner_id,create_request_id,title,description,bpm,license_code,compatibility)
values('c6300000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
  'c6300000-0000-4000-8000-000000000002','Mixed legacy project','Existing audio plus MIDI',120,
  'cc-by-4.0','legacy_hybrid');
insert into public.project_members(project_id,user_id,role,created_by) values
('c6300000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','owner','c6000000-0000-4000-8000-000000000001'),
('c6300000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','viewer','c6000000-0000-4000-8000-000000000001');

with manifest(value) as (values(jsonb_build_object(
  'manifestVersion',2,'engine','jam-session-composite','engineVersion','jam-session-composite-2_tone-15.1.22',
  'projectId','c6300000-0000-4000-8000-000000000001','tempoBpm',120.0,
  'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'durationTicks',3840,
  'tracks',jsonb_build_array(
    jsonb_build_object('kind','audio','trackId','c6400000-0000-4000-8000-000000000001',
      'name','Legacy audio','instrumentId',null,'assetId','c6100000-0000-4000-8000-000000000001',
      'gainDb',0,'pan',0,'muted',false,'soloed',false,'sortOrder',0,
      'clips',jsonb_build_array(jsonb_build_object('clipId','c6400000-0000-4000-8000-000000000002',
        'positionMs',0,'trimStartMs',0,'durationMs',1000))),
    jsonb_build_object('kind','midi','trackId','c6400000-0000-4000-8000-000000000003',
      'name','MIDI harmony','instrumentId',null,'presetId','warm-poly','presetVersion',1,
      'gainDb',0,'pan',0,'muted',false,'soloed',false,'sortOrder',1,
      'clips',jsonb_build_array(jsonb_build_object('clipId','c6400000-0000-4000-8000-000000000004',
        'midiStemVersionId','c6200000-0000-4000-8000-000000000003','startTick',0,
        'durationTicks',1920,'sourceStartTick',0,'loop',false)))
  )
)))
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,
  manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms)
select 'c6500000-0000-4000-8000-000000000001','c6300000-0000-4000-8000-000000000001',1,
  'c6000000-0000-4000-8000-000000000001','c6500000-0000-4000-8000-000000000002',
  value,2,'jam-session-composite','jam-session-composite-2_tone-15.1.22',
  encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex'),4000 from manifest;
insert into public.revision_tracks(revision_id,id,asset_id,instrument_id,name,position_ms,
  trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by,kind,preset_id,preset_version) values
('c6500000-0000-4000-8000-000000000001','c6400000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001',null,'Legacy audio',0,0,1000,0,0,false,false,0,'c6000000-0000-4000-8000-000000000001','audio',null,null),
('c6500000-0000-4000-8000-000000000001','c6400000-0000-4000-8000-000000000003',null,null,'MIDI harmony',0,0,2000,0,0,false,false,1,'c6000000-0000-4000-8000-000000000001','midi','warm-poly',1);
insert into public.revision_clips(revision_id,track_id,clip_id,kind,position_ms,trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop) values
('c6500000-0000-4000-8000-000000000001','c6400000-0000-4000-8000-000000000001','c6400000-0000-4000-8000-000000000002','audio',0,0,1000,null,null,null,null,null),
('c6500000-0000-4000-8000-000000000001','c6400000-0000-4000-8000-000000000003','c6400000-0000-4000-8000-000000000004','midi',null,null,null,'c6200000-0000-4000-8000-000000000003',0,1920,0,false);
insert into public.project_asset_references(project_id,asset_id,first_revision_id,added_by)
values('c6300000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001','c6500000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001');
insert into public.project_storage_usage(project_id,source_bytes,unique_source_count)
values('c6300000-0000-4000-8000-000000000001',1000,1);
update public.projects set current_revision_id='c6500000-0000-4000-8000-000000000001',
  status='active',published_at=now(),open_to_contributions=true,lock_version=2
where id='c6300000-0000-4000-8000-000000000001';

select is((select count(*) from public.assets where kind='source_audio'),1::bigint,'mixed fixture begins with one admitted source asset');
set local role authenticated;
set local request.jwt.claim.sub='c6000000-0000-4000-8000-000000000002';
select lives_ok($$select public.create_contribution_workspace(
  'c6300000-0000-4000-8000-000000000001','c6600000-0000-4000-8000-000000000001',
  'c6500000-0000-4000-8000-000000000001','Mixed arrangement update','Reuse both exact sources.'
)$$,'contributor branches a mixed v2 revision');
select lives_ok($$select public.save_midi_workspace(
  (select id from public.workspaces where owner_id='c6000000-0000-4000-8000-000000000002'),
  'c6600000-0000-4000-8000-000000000002',1,
  (select manifest from public.workspaces where owner_id='c6000000-0000-4000-8000-000000000002')
)$$,'mixed contribution saves without admitting an asset');
select lives_ok($$select public.submit_contribution(
  (select id from public.contributions where author_id='c6000000-0000-4000-8000-000000000002'),
  'c6600000-0000-4000-8000-000000000003',2,'c6500000-0000-4000-8000-000000000001',
  (select manifest_sha256 from public.workspaces where owner_id='c6000000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1'
)$$,'mixed contribution freezes audio and MIDI clip projections');
select is((select count(*) from public.contribution_version_tracks where kind='audio'),1::bigint,'submission preserves the audio track');
select is((select count(*) from public.contribution_version_tracks where kind='midi'),1::bigint,'submission preserves the MIDI track');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='c6000000-0000-4000-8000-000000000001';
select lives_ok($$select public.review_contribution(
  (select id from public.contributions where author_id='c6000000-0000-4000-8000-000000000002'),
  'c6700000-0000-4000-8000-000000000001','accept','submitted',
  (select current_version_id from public.contributions where author_id='c6000000-0000-4000-8000-000000000002'),
  'c6500000-0000-4000-8000-000000000001',null
)$$,'owner accepts the exact mixed contribution');
select is((select count(distinct kind) from public.revision_tracks rt join public.projects p on p.current_revision_id=rt.revision_id where p.id='c6300000-0000-4000-8000-000000000001'),2::bigint,'accepted revision contains both track kinds');
select is((select count(*) from public.assets where kind='source_audio'),1::bigint,'contribution and acceptance create no source asset');
select is((select source_bytes from public.project_storage_usage where project_id='c6300000-0000-4000-8000-000000000001'),1000::bigint,'mixed acceptance keeps unique source-byte usage stable');

select * from finish();
rollback;
