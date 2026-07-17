begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(71);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f3000000-0000-4000-8000-000000000001','authenticated','authenticated','pivot-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f3000000-0000-4000-8000-000000000002','authenticated','authenticated','pivot-contributor@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f3000000-0000-4000-8000-000000000003','authenticated','authenticated','pivot-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f3000000-0000-4000-8000-000000000004','authenticated','authenticated','pivot-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='PivotOwner',username_normalized='pivotowner',display_name='Pivot Owner',credit_name='Pivot Owner',profile_completed_at=now() where id='f3000000-0000-4000-8000-000000000001';
update public.profiles set username='PivotContributor',username_normalized='pivotcontributor',display_name='Pivot Contributor',credit_name='Pivot Contributor',profile_completed_at=now() where id='f3000000-0000-4000-8000-000000000002';
update public.profiles set username='PivotStranger',username_normalized='pivotstranger',display_name='Pivot Stranger',credit_name='Pivot Stranger',profile_completed_at=now() where id='f3000000-0000-4000-8000-000000000003';
update public.profiles set username='PivotSuspended',username_normalized='pivotsuspended',display_name='Pivot Suspended',credit_name='Pivot Suspended',profile_completed_at=now(),status='suspended' where id='f3000000-0000-4000-8000-000000000004';

select has_table('public','midi_patterns','MIDI pattern identities exist');
select has_table('public','midi_pattern_versions','immutable MIDI pattern versions exist');
select has_table('public','midi_pattern_notes','normalized MIDI notes exist');
select has_table('public','arrangement_versions','immutable arrangement versions exist');
select has_table('public','arrangement_tracks','normalized arrangement tracks exist');
select has_table('public','arrangement_clips','normalized arrangement clips exist');
select has_table('private','workspace_snapshots','bounded database workspace snapshots exist');
select has_column('public','project_revisions','arrangement_version_id','revision wrapper has expand-first arrangement reference');
select has_column('public','contribution_versions','arrangement_version_id','contribution wrapper has expand-first arrangement reference');
select has_column('public','workspace_clips','midi_pattern_version_id','workspace clips reference exact pattern versions');
select ok((select count(*)=24 from private.midi_synth_presets where engine_version='jam-session-midi-3_tone-15.1.22_presets-1'),'frozen preset catalog has 24 IDs');
select ok((select min_note=24 and max_note=60 from private.midi_synth_presets where preset_id='sub-bass' and version=1),'database preset bounds match catalog 1');
select ok(exists(select 1 from pg_constraint where conrelid='public.midi_pattern_versions'::regclass
  and pg_get_constraintdef(oid) like 'FOREIGN KEY (midi_pattern_id, parent_pattern_version_id)%'),
  'pattern parents are constrained to the same pattern identity');
select ok((select relrowsecurity from pg_class where oid='public.midi_patterns'::regclass),'pattern identities have RLS');
select ok((select relrowsecurity from pg_class where oid='public.arrangement_versions'::regclass),'arrangements have RLS');
select ok(not exists(select 1 from information_schema.role_table_grants where table_schema='public'
  and table_name in ('midi_patterns','midi_pattern_versions','midi_pattern_notes','arrangement_versions','arrangement_tracks','arrangement_clips')
  and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')),'v3 tables deny direct application writes');
select function_privs_are('public','save_midi_workspace_v3',array['uuid','uuid','integer','jsonb'],'anon',array[]::text[],'anonymous cannot save workspaces');

set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_pattern_v3('f3010000-0000-4000-8000-000000000001','Main phrase')$$,'owner creates pattern identity');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f3020000-0000-4000-8000-000000000001',1,480::smallint,1920,
  '[{"noteId":"f3030000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":60,"velocity":100}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'owner freezes a public reusable pattern version');
select lives_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f3020000-0000-4000-8000-000000000001',1,480::smallint,1920,
  '[{"noteId":"f3030000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":60,"velocity":100}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'identical pattern-version requests replay idempotently');
select throws_ok($$select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f3020000-0000-4000-8000-000000000001',1,480::smallint,1920,
  '[{"noteId":"f3030000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":61,"velocity":100}]'::jsonb,
  true,'cc-by-4.0-attestation-v1')$$,'PT409','midi_pattern_version_request_conflict',
  'changed pattern-version payloads cannot reuse a request ID');
select is((select creator_credit_name from public.midi_pattern_versions),'Pivot Owner','pattern version snapshots creator credit');
select is((select reuse_license_code from public.midi_pattern_versions),'CC-BY-4.0','public reuse stores exact license code');
select is((select count(*) from public.midi_pattern_notes),1::bigint,'normalized notes are projected');
reset role;
select throws_ok($$update public.midi_pattern_notes set pitch=61$$,'55000','immutable_revision_history','pattern notes are immutable');
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_midi_project_workspace_v3(
  'f3040000-0000-4000-8000-000000000001','Pivot project','',120::numeric,'c-major',4::smallint,4::smallint,
  'cc-by-4.0','{}'::uuid[],null::uuid,'{}'::uuid[])$$,'owner creates a v3 project workspace atomically');
select is((select manifest_version from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),3::smallint,'new workspace uses manifest v3');
select is((select engine_version from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),'jam-session-midi-3_tone-15.1.22_presets-1','workspace pins the frozen engine version');
select lives_ok($$select public.save_midi_workspace_v3(
  (select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f3050000-0000-4000-8000-000000000001',1,
  jsonb_build_object('manifestVersion',3,'engine','jam-session-midi','engineVersion','jam-session-midi-3_tone-15.1.22_presets-1',
    'projectId',(select project_id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),
    'workspaceId',(select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),
    'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),'musicalKey','c-major','ppq',480,'durationTicks',7680,
    'tracks',jsonb_build_array(jsonb_build_object('trackId','f3060000-0000-4000-8000-000000000001','sortOrder',0,'name','Lead',
      'presetId','saw-lead','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,
      'clips',jsonb_build_array(jsonb_build_object('clipId','f3070000-0000-4000-8000-000000000001',
        'midiPatternVersionId',(select id from public.midi_pattern_versions),'startTick',0,'durationTicks',1920,'sourceStartTick',0,'loop',false)))))
)$$,'optimistic save validates and projects the complete v3 manifest');
reset role;
select is((select count(*) from private.workspace_snapshots),1::bigint,'save records one Postgres recovery snapshot');
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000001';
select is((select count(*) from public.workspace_clips where midi_pattern_version_id is not null),1::bigint,'workspace projection uses an exact pattern version');
select throws_ok($$select public.save_midi_workspace_v3(
  (select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),gen_random_uuid(),2,
  jsonb_set((select manifest from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),
    '{musicalKey}',to_jsonb('h-major'::text)))$$,
  '22023','midi_manifest_v3_invalid','workspace save rejects musical keys outside the TypeScript contract');
select throws_ok($$select public.save_midi_workspace_v3(
  (select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),gen_random_uuid(),2,
  jsonb_set((select manifest from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),'{tracks}',(
    select jsonb_agg(jsonb_build_object('trackId',gen_random_uuid(),'sortOrder',n,'name','Track '||n,
      'presetId','warm-keys','presetVersion',1,'gainDb',0,'pan',0,'muted',false,'soloed',false,'clips','[]'::jsonb)
      order by n) from generate_series(0,16) n)))$$,
  '22023','midi_manifest_v3_track_limit','workspace save enforces the 16-track TypeScript contract');
select throws_ok($$select public.save_midi_workspace_v3(
  (select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),gen_random_uuid(),1,
  (select manifest from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'))$$,
  'PT409','midi_workspace_save_conflict','stale workspace saves conflict');
select lives_ok($$select public.publish_midi_workspace_revision_v3(
  (select id from public.workspaces where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f3080000-0000-4000-8000-000000000001',2,null,'First v3 arrangement')$$,'publication freezes one immutable arrangement and wrapper');
select is((select count(*) from public.arrangement_versions),1::bigint,'one arrangement snapshot is stored');
select is((select count(*) from public.arrangement_tracks),1::bigint,'arrangement tracks are normalized');
select is((select count(*) from public.arrangement_clips),1::bigint,'arrangement clips are normalized');
select ok((select arrangement_version_id is not null from public.project_revisions where manifest_version=3),'revision points to its exact arrangement');
select is((select count(*) from public.arrangement_versions),1::bigint,'project owner reads the private arrangement');
select is(jsonb_array_length(public.get_project_revision_history_v3(
  (select id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'))),1,
  'private revision history reads the arrangement wrapper');
select is((public.get_project_revision_history_v3(
  (select id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'))
  ->0->'tracks'->0->'credits'->0->>'creditName'),'Pivot Owner',
  'private revision history derives track credit from pattern creator lineage');
reset role;
select throws_ok($$update public.arrangement_clips set start_tick=1$$,'55000','immutable_revision_history','arrangement projections are immutable');

update public.workspaces set status='archived'
where owner_id='f3000000-0000-4000-8000-000000000001' and contribution_id is null;
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_project_workspace_v3(
  (select id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f30a0000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'))$$,
  'owner creates an existing-project v3 workspace');
select lives_ok($$select public.create_project_workspace_v3(
  (select id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'),
  'f30a0000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where owner_id='f3000000-0000-4000-8000-000000000001'))$$,
  'existing-project workspace request replays idempotently');
select is((select count(*) from public.workspaces where status='active' and contribution_id is null),1::bigint,
  'idempotent workspace creation leaves one active owner workspace');
reset role;
select is((select count(*) from private.workspace_snapshots where request_id='f30a0000-0000-4000-8000-000000000001'),1::bigint,
  'existing-project creation records its initial bounded Postgres snapshot');
create temp table existing_project_fixture as
select id project_id,current_revision_id
from public.projects where owner_id='f3000000-0000-4000-8000-000000000001';
grant select on existing_project_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000003';
select throws_ok($$select public.create_project_workspace_v3(
  (select project_id from existing_project_fixture),gen_random_uuid(),
  (select current_revision_id from existing_project_fixture))$$,
  'PT404','workspace_project_not_found','unrelated actor cannot create a private project workspace');
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000004';
select throws_ok($$select public.create_project_workspace_v3(
  (select project_id from existing_project_fixture),gen_random_uuid(),
  (select current_revision_id from existing_project_fixture))$$,
  'PT403','workspace_actor_ineligible','suspended actor cannot create a project workspace');
reset role;
set local role anon;
select throws_ok($$select public.get_project_revision_history_v3(gen_random_uuid())$$,
  '42501','permission denied for function get_project_revision_history_v3',
  'anonymous cannot call private revision history');
select throws_ok($$select public.create_project_workspace_v3(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())$$,
  '42501','permission denied for function create_project_workspace_v3',
  'anonymous cannot create an existing-project workspace');
reset role;

insert into public.project_members(project_id,user_id,role,created_by)
select id,'f3000000-0000-4000-8000-000000000002','editor','f3000000-0000-4000-8000-000000000001'
from public.projects where owner_id='f3000000-0000-4000-8000-000000000001';
insert into public.project_members(project_id,user_id,role,created_by)
select id,'f3000000-0000-4000-8000-000000000004','editor','f3000000-0000-4000-8000-000000000001'
from public.projects where owner_id='f3000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000002';
select is((select count(*) from public.arrangement_versions),1::bigint,'active project member reads a private arrangement');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000003';
select is((select count(*) from public.workspaces),0::bigint,'unrelated actor cannot read private workspaces');
select is((select count(*) from public.arrangement_versions),0::bigint,'unrelated actor cannot read a private arrangement');
select is((select count(*) from public.midi_pattern_versions),1::bigint,'public CC BY pattern is reusable by another actor');
select lives_ok($$select public.create_midi_pattern_v3(
  'f3090000-0000-4000-8000-000000000001','Derived phrase',(select id from public.midi_pattern_versions))$$,
  'copy-on-write pattern identity retains an exact public source version');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-4000-8000-000000000004';
select is((select count(*) from public.arrangement_versions),0::bigint,'suspended project member cannot read a private arrangement');
select throws_ok($$select public.create_midi_pattern_v3(gen_random_uuid(),'Blocked')$$,
  'PT403','midi_pattern_actor_ineligible','suspended actor cannot mutate patterns');
reset role;

select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('create_midi_pattern_v3','create_midi_pattern_version_v3',
    'create_midi_project_workspace_v3','save_midi_workspace_v3','publish_midi_workspace_revision_v3',
    'create_contribution_workspace_v3','submit_contribution_v3','accept_contribution_v3','fork_project_v3')
    and has_function_privilege('anon',p.oid,'execute')),
  'anonymous has no execute privilege on MIDI v3 commands');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('create_midi_pattern_v3','create_midi_pattern_version_v3',
    'create_midi_project_workspace_v3','save_midi_workspace_v3','publish_midi_workspace_revision_v3',
    'create_contribution_workspace_v3','submit_contribution_v3','accept_contribution_v3','fork_project_v3')
    and not has_function_privilege('authenticated',p.oid,'execute')),
  'authenticated receives only the explicit MIDI v3 command surface');

update public.projects set visibility='public' where owner_id='f3000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.arrangement_versions),1::bigint,'anonymous reads a visible public arrangement');
select is((select count(*) from public.project_revisions),1::bigint,'anonymous resolves a visible public revision wrapper');
select is((select count(*) from public.revision_attributions),1::bigint,'anonymous reads immutable credit for a visible public revision');
reset role;
update public.projects set moderation_state='hidden' where owner_id='f3000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.arrangement_versions),0::bigint,'anonymous cannot read a hidden public arrangement');
select is((select count(*) from public.project_revisions),0::bigint,'anonymous cannot read a hidden public revision wrapper');
select is((select count(*) from public.revision_attributions),0::bigint,'anonymous cannot read credit for a hidden public revision');
reset role;
update public.projects set moderation_state='visible',visibility='private',status='deleted',
  open_to_contributions=false,deleted_at=statement_timestamp()
where owner_id='f3000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.arrangement_versions),0::bigint,'anonymous cannot read a deleted public arrangement');
select is((select count(*) from public.project_revisions),0::bigint,'anonymous cannot read a deleted public revision wrapper');
select is((select count(*) from public.revision_attributions),0::bigint,'anonymous cannot read credit for a deleted public revision');
reset role;

set local role anon;
select is((select count(*) from public.arrangement_versions),0::bigint,'anonymous cannot read private arrangements');
select is((select count(*) from public.midi_pattern_versions),1::bigint,'anonymous can read explicitly public CC BY pattern content');
reset role;

select * from finish();
rollback;
