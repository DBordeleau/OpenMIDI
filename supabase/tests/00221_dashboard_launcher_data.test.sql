begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_function('public','get_viewer_dashboard',array[]::text[],'dashboard launcher query exists');
select ok(has_function_privilege('authenticated','public.get_viewer_dashboard()','execute'),'authenticated members can execute dashboard query');
select ok(not has_function_privilege('anon','public.get_viewer_dashboard()','execute'),'anonymous role cannot execute dashboard query');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','da000000-0000-4000-8000-000000000001','authenticated','authenticated','dash1-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','da000000-0000-4000-8000-000000000002','authenticated','authenticated','dash1-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','da000000-0000-4000-8000-000000000003','authenticated','authenticated','dash1-suspended@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','da000000-0000-4000-8000-000000000004','authenticated','authenticated','dash1-incomplete@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','da000000-0000-4000-8000-000000000005','authenticated','authenticated','dash1-empty@example.test','','{}','{}',now(),now());
update public.profiles set username='DashOneOwner',username_normalized='dashoneowner',display_name='Dashboard Owner',credit_name='Dashboard Owner',profile_completed_at=now() where id='da000000-0000-4000-8000-000000000001';
update public.profiles set username='DashOneOther',username_normalized='dashoneother',display_name='Dashboard Other',credit_name='Dashboard Other',profile_completed_at=now() where id='da000000-0000-4000-8000-000000000002';
update public.profiles set username='DashOneSuspended',username_normalized='dashonesuspended',display_name='Dashboard Suspended',credit_name='Dashboard Suspended',profile_completed_at=now(),status='suspended' where id='da000000-0000-4000-8000-000000000003';
update public.profiles set username='DashOneEmpty',username_normalized='dashoneempty',display_name='Dashboard Empty',credit_name='Dashboard Empty',profile_completed_at=now() where id='da000000-0000-4000-8000-000000000005';

set local role authenticated;
select throws_ok($$select public.get_viewer_dashboard()$$,'PT401','dashboard_unauthenticated','missing authenticated subject is rejected');
set local request.jwt.claim.sub='da000000-0000-4000-8000-000000000003';
select throws_ok($$select public.get_viewer_dashboard()$$,'PT403','dashboard_forbidden','suspended caller is rejected');
set local request.jwt.claim.sub='da000000-0000-4000-8000-000000000004';
select throws_ok($$select public.get_viewer_dashboard()$$,'PT403','dashboard_forbidden','incomplete caller is rejected');
reset role;

insert into public.projects(id,owner_id,create_request_id,title,license_code,musical_key,time_signature_numerator,time_signature_denominator) values
('da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Owner published project','all-rights-reserved','d-minor',4,4),
('da100000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000002',gen_random_uuid(),'Foreign project','all-rights-reserved','c-major',4,4),
('da100000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Deleted owner project','all-rights-reserved','c-major',4,4),
('da100000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Owner draft project','all-rights-reserved','c-major',4,4);

insert into public.arrangement_versions(id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks) values
('da200000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',gen_random_uuid(),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),118,4,4,'d-minor',480,7680);
insert into public.arrangement_tracks(arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed) values
('da200000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001',0,'Keys','warm-keys',1,0,0,false,false);

insert into public.midi_patterns(id,owner_id,create_request_id,name) values
('da500000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Recent owner pattern'),
('da500000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Foreign workspace only'),
('da500000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000002',gen_random_uuid(),'Foreign pattern'),
('da500000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Deleted owner pattern'),
('da500000-0000-4000-8000-000000000005','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Deleted project pattern');
update public.midi_patterns set deleted_at=now() where id='da500000-0000-4000-8000-000000000004';
insert into public.midi_pattern_versions(id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256) values
('da510000-0000-4000-8000-000000000001','da500000-0000-4000-8000-000000000001',3,gen_random_uuid(),'da000000-0000-4000-8000-000000000001','Dashboard Owner',480,1920,8,repeat('1',64)),
('da510000-0000-4000-8000-000000000002','da500000-0000-4000-8000-000000000002',1,gen_random_uuid(),'da000000-0000-4000-8000-000000000001','Dashboard Owner',480,960,2,repeat('2',64)),
('da510000-0000-4000-8000-000000000003','da500000-0000-4000-8000-000000000003',1,gen_random_uuid(),'da000000-0000-4000-8000-000000000002','Dashboard Other',480,960,2,repeat('3',64)),
('da510000-0000-4000-8000-000000000004','da500000-0000-4000-8000-000000000004',1,gen_random_uuid(),'da000000-0000-4000-8000-000000000001','Dashboard Owner',480,960,2,repeat('4',64)),
('da510000-0000-4000-8000-000000000005','da500000-0000-4000-8000-000000000005',1,gen_random_uuid(),'da000000-0000-4000-8000-000000000001','Dashboard Owner',480,960,2,repeat('5',64));
insert into public.arrangement_clips(arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop) values
('da200000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da300000-0000-4000-8000-000000000001','da310000-0000-4000-8000-000000000001','da510000-0000-4000-8000-000000000001',0,1920,0,false);
insert into public.project_revisions(id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id) values
('da400000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001',1,'da000000-0000-4000-8000-000000000001',gen_random_uuid(),'{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('b',64),8000,'da200000-0000-4000-8000-000000000001');
update public.projects set status='active',current_revision_id='da400000-0000-4000-8000-000000000001',published_at=now(),bpm=118 where id='da100000-0000-4000-8000-000000000001';

insert into public.contributions(id,project_id,author_id,create_request_id,base_revision_id,title) values
('da700000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000002',gen_random_uuid(),'da400000-0000-4000-8000-000000000001','Submitted idea'),
('da700000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',gen_random_uuid(),'da400000-0000-4000-8000-000000000001','Deleted draft idea');
insert into public.contribution_versions(id,contribution_id,version_number,submission_request_id,base_revision_id,workspace_lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,attestation_version,created_by,project_id,arrangement_version_id) values
('da710000-0000-4000-8000-000000000001','da700000-0000-4000-8000-000000000001',1,gen_random_uuid(),'da400000-0000-4000-8000-000000000001',1,'{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('c',64),8000,'contributor-attestation-v1','da000000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000001','da200000-0000-4000-8000-000000000001');
update public.contributions set status='submitted',current_version_id='da710000-0000-4000-8000-000000000001',submitted_at=now() where id='da700000-0000-4000-8000-000000000001';
update public.contributions set deleted_at=now() where id='da700000-0000-4000-8000-000000000002';

insert into public.workspaces(id,project_id,owner_id,create_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256,updated_at) values
('da600000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',gen_random_uuid(),jsonb_build_object(
  'manifestVersion',3,'engine','openmidi-midi','engineVersion','openmidi-midi-3_tone-15.1.22_presets-1','projectId','da100000-0000-4000-8000-000000000001','workspaceId','da600000-0000-4000-8000-000000000001','tempoBpm',118,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','d-minor','ppq',480,'durationTicks',7680,
  'tracks',jsonb_build_array(jsonb_build_object('trackId','da610000-0000-4000-8000-000000000001','sortOrder',0,'name','Keys','presetId','warm-keys','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,'clips',jsonb_build_array(
    jsonb_build_object('clipId','da620000-0000-4000-8000-000000000001','midiPatternVersionId','da510000-0000-4000-8000-000000000001','startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false),
    jsonb_build_object('clipId','da620000-0000-4000-8000-000000000003','midiPatternVersionId','da510000-0000-4000-8000-000000000003','startTick',1920,'durationTicks',960,'sourceStartTick',0,'loop',false),
    jsonb_build_object('clipId','da620000-0000-4000-8000-000000000004','midiPatternVersionId','da510000-0000-4000-8000-000000000004','startTick',2880,'durationTicks',960,'sourceStartTick',0,'loop',false)
  )))),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('d',64),now()-interval '24 days'),
('da600000-0000-4000-8000-000000000002','da100000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000002',gen_random_uuid(),jsonb_build_object('tempoBpm',120,'durationTicks',960,'tracks','[]'::jsonb),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('e',64),now()),
('da600000-0000-4000-8000-000000000003','da100000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000001',gen_random_uuid(),jsonb_build_object('tempoBpm',120,'durationTicks',960,'tracks','[]'::jsonb),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('f',64),now()),
('da600000-0000-4000-8000-000000000004','da100000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000001',gen_random_uuid(),jsonb_build_object('tempoBpm',120,'durationTicks',960,'tracks','[]'::jsonb),3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('0',64),now()-interval '25 days');
insert into public.workspace_tracks(workspace_id,track_id,name,gain_db,pan,muted,soloed,sort_order,preset_id,preset_version) values
('da600000-0000-4000-8000-000000000001','da610000-0000-4000-8000-000000000001','Keys',0,0,false,false,0,'warm-keys',1),
('da600000-0000-4000-8000-000000000002','da610000-0000-4000-8000-000000000002','Foreign',0,0,false,false,0,'warm-keys',1),
('da600000-0000-4000-8000-000000000003','da610000-0000-4000-8000-000000000003','Deleted project',0,0,false,false,0,'warm-keys',1),
('da600000-0000-4000-8000-000000000004','da610000-0000-4000-8000-000000000004','Older owner',0,0,false,false,0,'warm-keys',1);
insert into public.workspace_clips(workspace_id,track_id,clip_id,start_tick,duration_ticks,source_start_tick,loop,midi_pattern_version_id) values
('da600000-0000-4000-8000-000000000001','da610000-0000-4000-8000-000000000001','da620000-0000-4000-8000-000000000001',0,1920,0,false,'da510000-0000-4000-8000-000000000001'),
('da600000-0000-4000-8000-000000000001','da610000-0000-4000-8000-000000000001','da620000-0000-4000-8000-000000000003',1920,960,0,false,'da510000-0000-4000-8000-000000000003'),
('da600000-0000-4000-8000-000000000001','da610000-0000-4000-8000-000000000001','da620000-0000-4000-8000-000000000004',2880,960,0,false,'da510000-0000-4000-8000-000000000004'),
('da600000-0000-4000-8000-000000000002','da610000-0000-4000-8000-000000000002','da620000-0000-4000-8000-000000000002',0,960,0,false,'da510000-0000-4000-8000-000000000002'),
('da600000-0000-4000-8000-000000000003','da610000-0000-4000-8000-000000000003','da620000-0000-4000-8000-000000000005',0,960,0,false,'da510000-0000-4000-8000-000000000005'),
('da600000-0000-4000-8000-000000000004','da610000-0000-4000-8000-000000000004','da620000-0000-4000-8000-000000000006',0,1920,0,false,'da510000-0000-4000-8000-000000000001');
update public.projects set status='deleted',deleted_at=now() where id='da100000-0000-4000-8000-000000000003';

insert into public.midi_patterns(owner_id,create_request_id,name)
select 'da000000-0000-4000-8000-000000000001',gen_random_uuid(),'Bounded pattern '||n
from generate_series(1,100) n;

set local role authenticated;
set local request.jwt.claim.sub='da000000-0000-4000-8000-000000000001';
select is(public.get_viewer_dashboard()#>>'{resume,workspace_id}','da600000-0000-4000-8000-000000000001','resume selects newest eligible owner workspace');
select is((public.get_viewer_dashboard()#>>'{resume,tempo_bpm}')::numeric,118::numeric,'resume projects manifest tempo');
select is(public.get_viewer_dashboard()#>>'{resume,tracks,0,preset_id}','warm-keys','resume projects the track preset');
select is(public.get_viewer_dashboard()#>>'{resume,tracks,0,clips,0,clip_id}','da620000-0000-4000-8000-000000000001','resume projects editor clip identity');
select ok(not (public.get_viewer_dashboard()#>'{resume,tracks,0}' ? 'gainDb'),'resume omits unneeded track fields');
select is(public.get_viewer_dashboard()#>>'{resume,tracks,0,name}','Keys','resume labels the lane with its track name');
select is(public.get_viewer_dashboard()#>>'{resume,tracks,0,clips,0,pattern_name}','Recent owner pattern','resume labels each clip with the pattern it places');
select is(public.get_viewer_dashboard()#>>'{resume,tracks,0,clips,1,pattern_name}','Foreign pattern','a reused pattern placed in the caller workspace keeps the name the studio already shows');
select is((select (row->>'revision_number')::integer from jsonb_array_elements(public.get_viewer_dashboard()->'ownedProjects') row where row->>'project_id'='da100000-0000-4000-8000-000000000001'),1,'owned project includes current revision number');
select is((select (row->>'track_count')::integer from jsonb_array_elements(public.get_viewer_dashboard()->'ownedProjects') row where row->>'project_id'='da100000-0000-4000-8000-000000000001'),1,'owned project includes distinct arrangement track count');
select is((select (row->>'review_count')::integer from jsonb_array_elements(public.get_viewer_dashboard()->'ownedProjects') row where row->>'project_id'='da100000-0000-4000-8000-000000000001'),1,'owned project includes bounded submitted review count');
select is((public.get_viewer_dashboard()#>>'{review,count}')::integer,1,'existing review count remains available');
select is(jsonb_array_length(public.get_viewer_dashboard()->'recentClips'),1,'recent clips exclude foreign, deleted, and duplicate placements');
select is(public.get_viewer_dashboard()#>>'{recentClips,0,pattern_version_id}','da510000-0000-4000-8000-000000000001','recent clips keep caller-owned pattern version');
select is(public.get_viewer_dashboard()#>>'{recentClips,0,workspace_id}','da600000-0000-4000-8000-000000000001','recent clips prefer the most recently updated owned workspace');
select ok(not (public.get_viewer_dashboard()->'recentClips' @> '[{"pattern_id":"da500000-0000-4000-8000-000000000002"}]'),'caller pattern in foreign workspace is excluded');
select ok(not (public.get_viewer_dashboard()->'recentClips' @> '[{"pattern_id":"da500000-0000-4000-8000-000000000003"}]'),'foreign pattern in caller workspace is excluded');
select ok(not (public.get_viewer_dashboard()->'recentClips' @> '[{"pattern_id":"da500000-0000-4000-8000-000000000004"}]'),'deleted pattern is excluded');
select ok(not (public.get_viewer_dashboard()->'recentClips' @> '[{"pattern_id":"da500000-0000-4000-8000-000000000005"}]'),'clip in deleted project is excluded');
select is((public.get_viewer_dashboard()#>>'{counts,clips,count}')::integer,99,'large clip count is capped at 99');
select is((public.get_viewer_dashboard()#>>'{counts,clips,hasMore}')::boolean,true,'large clip count reports additional rows');
select is((public.get_viewer_dashboard()#>>'{counts,projects,count}')::integer,2,'project count excludes deleted projects');
select is((public.get_viewer_dashboard()#>>'{counts,archivingSoon,count}')::integer,2,'archive warning count uses the shared 23-day threshold');
select is(jsonb_array_length(public.get_viewer_dashboard()->'pendingContributions'),0,'pending list excludes soft-deleted contributions');
select is((public.get_viewer_dashboard()#>>'{counts,pendingContributions,count}')::integer,0,'pending count agrees with the soft-delete-aware list');

set local request.jwt.claim.sub='da000000-0000-4000-8000-000000000005';
select is(jsonb_array_length(public.get_viewer_dashboard()->'ownedProjects'),0,'unrelated caller sees none of owner projects');
select is(jsonb_array_length(public.get_viewer_dashboard()->'recentClips'),0,'unrelated caller sees none of owner recent clips');
select is(public.get_viewer_dashboard()->'resume','null'::jsonb,'unrelated caller with no eligible workspace gets null resume');
select is((public.get_viewer_dashboard()#>>'{counts,clips,count}')::integer,0,'unrelated caller sees none of owner clip count');

select * from finish();
rollback;
