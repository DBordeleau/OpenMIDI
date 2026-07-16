begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f3100000-0000-4000-8000-000000000001','authenticated','authenticated','v3-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f3100000-0000-4000-8000-000000000002','authenticated','authenticated','v3-contributor@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f3100000-0000-4000-8000-000000000003','authenticated','authenticated','v3-forker@example.test','','{}','{}',now(),now());
update public.profiles set username='V3Owner',username_normalized='v3owner',display_name='V3 Owner',credit_name='V3 Owner',profile_completed_at=now() where id='f3100000-0000-4000-8000-000000000001';
update public.profiles set username='V3Contributor',username_normalized='v3contributor',display_name='V3 Contributor',credit_name='V3 Contributor',profile_completed_at=now() where id='f3100000-0000-4000-8000-000000000002';
update public.profiles set username='V3Forker',username_normalized='v3forker',display_name='V3 Forker',credit_name='V3 Forker',profile_completed_at=now() where id='f3100000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_pattern_v3('f3110000-0000-4000-8000-000000000001','Shared pattern')$$,'owner creates shared pattern');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where owner_id='f3100000-0000-4000-8000-000000000001'),
  'f3120000-0000-4000-8000-000000000001',1,480::smallint,1920,
  '[{"noteId":"f3130000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":64,"velocity":96}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'owner freezes shared pattern version');
select lives_ok($$select public.create_midi_project_workspace_v3(
  'f3140000-0000-4000-8000-000000000001','Collaboration source','',120::numeric,'c-major',4::smallint,4::smallint,
  'cc-by-4.0','{}'::uuid[],null::uuid,'{}'::uuid[])$$,'owner creates source project');
select lives_ok($$select public.save_midi_workspace_v3(
  (select id from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000001'),
  'f3150000-0000-4000-8000-000000000001',1,
  jsonb_build_object('manifestVersion',3,'engine','jam-session-midi','engineVersion','jam-session-midi-3_tone-15.1.22_presets-1',
    'projectId',(select project_id from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000001'),
    'workspaceId',(select id from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000001'),
    'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',7680,
    'tracks',jsonb_build_array(jsonb_build_object('trackId','f3160000-0000-4000-8000-000000000001','sortOrder',0,'name','Keys',
      'presetId','warm-keys','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,
      'clips',jsonb_build_array(jsonb_build_object('clipId','f3170000-0000-4000-8000-000000000001',
        'midiPatternVersionId',(select id from public.midi_pattern_versions),'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false)))))
)$$,'owner saves source arrangement');
select lives_ok($$select public.publish_midi_workspace_revision_v3(
  (select id from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000001'),
  'f3180000-0000-4000-8000-000000000001',2,null,'Source revision')$$,'owner publishes source revision');
reset role;

update public.projects set open_to_contributions=true where owner_id='f3100000-0000-4000-8000-000000000001';
insert into public.project_members(project_id,user_id,role,created_by)
select id,'f3100000-0000-4000-8000-000000000002','editor','f3100000-0000-4000-8000-000000000001'
from public.projects where owner_id='f3100000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000002';
select lives_ok($$select public.create_contribution_workspace_v3(
  (select id from public.projects where owner_id='f3100000-0000-4000-8000-000000000001'),
  'f3190000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where owner_id='f3100000-0000-4000-8000-000000000001'),
  'Exact proposal','')$$,'member creates a v3 contribution workspace');
select ok((select manifest ? 'workspaceId' from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),'contribution workspace gets its own canonical workspace ID');
reset role;
update public.projects set open_to_contributions=false where owner_id='f3100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000002';
select throws_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31a0000-0000-4000-8000-000000000002',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1')$$,'PT409','contribution_submissions_closed',
  'submission rechecks the project contribution setting inside the command');
reset role;
update public.projects set open_to_contributions=true,license_code='all-rights-reserved'
  where owner_id='f3100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000002';
select throws_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31a0000-0000-4000-8000-000000000003',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1')$$,'PT409','contribution_license_unavailable',
  'submission rechecks the project reuse license inside the command');
reset role;
update public.projects set license_code='cc-by-4.0'
  where owner_id='f3100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000002';
select throws_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f3180000-0000-4000-8000-000000000001',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1')$$,'PT409','midi_arrangement_request_conflict',
  'a contribution cannot reuse another actor workspace-freeze request ID');
select lives_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31a0000-0000-4000-8000-000000000001',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1')$$,'submission freezes one shared arrangement snapshot');
select lives_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31a0000-0000-4000-8000-000000000001',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select manifest_sha256 from public.workspaces where owner_id='f3100000-0000-4000-8000-000000000002'),
  'contributor-attestation-v1')$$,'identical contribution submissions replay idempotently');
select throws_ok($$select public.submit_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31a0000-0000-4000-8000-000000000001',1,
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  repeat('0',64),'contributor-attestation-v1')$$,'PT409','contribution_submission_request_conflict',
  'changed contribution submission payloads cannot reuse a request ID');
select ok((select arrangement_version_id is not null from public.contribution_versions),'contribution wrapper references an exact arrangement');
select ok(exists(select 1 from public.arrangement_versions a join public.contribution_versions cv
  on cv.arrangement_version_id=a.id where cv.contribution_id=(select id from public.contributions
    where author_id='f3100000-0000-4000-8000-000000000002')),
  'contribution author reads the submitted arrangement');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000001';
select ok(exists(select 1 from public.arrangement_versions a join public.contribution_versions cv
  on cv.arrangement_version_id=a.id where cv.contribution_id=(select id from public.contributions
    where author_id='f3100000-0000-4000-8000-000000000002')),
  'project owner reads a submitted contribution arrangement for review');
select lives_ok($$select public.accept_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'f31b0000-0000-4000-8000-000000000001',
  (select current_version_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'Accepted exact proposal')$$,'owner atomically accepts a fresh-base contribution');
select is((select status from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  'accepted'::public.contribution_status,'accepted lifecycle is persisted');
select is((select arrangement_version_id from public.project_revisions where accepted_contribution_id is not null),
  (select arrangement_version_id from public.contribution_versions),'acceptance reuses the exact immutable arrangement');
select throws_ok($$select public.accept_contribution_v3(
  (select id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),gen_random_uuid(),
  (select current_version_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),
  (select base_revision_id from public.contributions where author_id='f3100000-0000-4000-8000-000000000002'),null)$$,
  'PT409','contribution_base_outdated','accepted contribution cannot be accepted again');
reset role;

update public.projects set visibility='public' where owner_id='f3100000-0000-4000-8000-000000000001';
do $$
begin
  perform set_config('test.source_project_id',(
    select id::text from public.projects where owner_id='f3100000-0000-4000-8000-000000000001'),true);
  perform set_config('test.source_revision_id',(
    select current_revision_id::text from public.projects where owner_id='f3100000-0000-4000-8000-000000000001'),true);
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub='f3100000-0000-4000-8000-000000000003';
select throws_ok($$select public.fork_project_v3(
  current_setting('test.source_project_id')::uuid,current_setting('test.source_revision_id')::uuid,
  'f31c0000-0000-4000-8000-000000000002','cc-by-4.0','wrong-attestation','Independent fork','')$$,
  '22023','fork_invalid_input','fork command rejects a missing or incorrect rights attestation');
select lives_ok($$select public.fork_project_v3(
  current_setting('test.source_project_id')::uuid,current_setting('test.source_revision_id')::uuid,
  'f31c0000-0000-4000-8000-000000000001','cc-by-4.0','cc-by-4.0-reuse-attestation-v1','Independent fork','')$$,
  'public exact revision forks through copy-on-write pattern references');
select is((select rights_attestation_version from public.projects where owner_id='f3100000-0000-4000-8000-000000000003'),
  'cc-by-4.0-reuse-attestation-v1','fork persists the exact rights attestation version');
select is((select source_project_id from public.projects where owner_id='f3100000-0000-4000-8000-000000000003'),
  current_setting('test.source_project_id')::uuid,'fork keeps source project lineage');
select is((select count(*) from public.midi_pattern_versions),1::bigint,'fork does not duplicate immutable pattern content');
select is((select count(distinct midi_pattern_version_id) from public.arrangement_clips),1::bigint,'source, acceptance, and fork share one exact pattern version');
reset role;

select * from finish();
rollback;
