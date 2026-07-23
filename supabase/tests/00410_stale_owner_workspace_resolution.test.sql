begin;
reset role;
set local request.jwt.claim.sub='';
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','41000000-0000-4000-8000-000000000001','authenticated','authenticated','draft-owner@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','41000000-0000-4000-8000-000000000002','authenticated','authenticated','draft-contributor@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','41000000-0000-4000-8000-000000000003','authenticated','authenticated','draft-unrelated@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','41000000-0000-4000-8000-000000000004','authenticated','authenticated','draft-incomplete@example.test','','{}','{}',now(),now());

update public.profiles
set username='DraftOwner',username_normalized='draftowner',display_name='Draft Owner',
  credit_name='Draft Owner',profile_completed_at=now()
where id='41000000-0000-4000-8000-000000000001';
update public.profiles
set username='DraftContributor',username_normalized='draftcontributor',display_name='Draft Contributor',
  credit_name='Draft Contributor',profile_completed_at=now()
where id='41000000-0000-4000-8000-000000000002';
update public.profiles
set username='DraftUnrelated',username_normalized='draftunrelated',display_name='Draft Unrelated',
  credit_name='Draft Unrelated',profile_completed_at=now()
where id='41000000-0000-4000-8000-000000000003';

select has_table(
  'private',
  'stale_owner_workspace_resolutions',
  'private resolution receipt table exists'
);
select has_function(
  'public',
  'resolve_stale_owner_workspace_v3',
  array['uuid','uuid','integer','uuid','uuid','text','text'],
  'narrow authenticated stale-draft command exists'
);
select ok(
  not has_function_privilege(
    'public',
    'public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)',
    'execute'
  ),
  'resolution command is revoked from PUBLIC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)',
    'execute'
  ),
  'anonymous callers cannot execute the resolution command'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)',
    'execute'
  ),
  'authenticated callers may execute the resolution command'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)',
    'execute'
  ),
  'resolution command does not add a service-role application path'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.stale_owner_workspace_resolutions',
    'select'
  ),
  'authenticated callers have no direct receipt-table read privilege'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid='private.stale_owner_workspace_resolutions'::regclass),
  'private resolution receipts have RLS enabled'
);
select is(
  (select proconfig
   from pg_proc
   where oid='public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)'::regprocedure),
  array['search_path=""'],
  'security-definer command has an empty search path'
);
select is(
  obj_description(
    'public.resolve_stale_owner_workspace_v3(uuid,uuid,integer,uuid,uuid,text,text)'::regprocedure,
    'pg_proc'
  ),
  'Atomically resolves a stale active owner workspace by restarting from current authority or preserving the acknowledged draft in a private direct fork.',
  'resolution concurrency and authority contract is documented'
);

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select public.create_midi_pattern_v3(
  '41010000-0000-4000-8000-000000000001',
  'Draft recovery pattern'
);
select public.create_midi_pattern_version_v3(
  (select id from public.midi_patterns where owner_id='41000000-0000-4000-8000-000000000001'),
  '41011000-0000-4000-8000-000000000001',
  1,
  480::smallint,
  1920,
  '[{"noteId":"41012000-0000-4000-8000-000000000001","startTick":0,"durationTicks":480,"pitch":64,"velocity":96}]'::jsonb,
  true,
  'cc-by-4.0-attestation-v1'
);
select public.create_midi_project_workspace_v3(
  '41020000-0000-4000-8000-000000000001',
  'Stale draft source',
  'Original project remains authoritative.',
  120::numeric,
  'c-major',
  4::smallint,
  4::smallint,
  'cc-by-4.0',
  '{}'::uuid[],
  null::uuid,
  '{}'::uuid[]
);

select public.save_midi_workspace_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
  '41021000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'manifestVersion',3,
    'engine','openmidi-midi',
    'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
    'projectId',(select project_id from public.workspaces
      where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
    'workspaceId',(select id from public.workspaces
      where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
    'tempoBpm',120,
    'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
    'musicalKey','c-major',
    'ppq',480,
    'durationTicks',7680,
    'tracks',jsonb_build_array(jsonb_build_object(
      'trackId','41022000-0000-4000-8000-000000000001',
      'sortOrder',0,
      'name','Published keys',
      'presetId','warm-keys',
      'presetVersion',1,
      'gainDb',0,
      'pan',0,
      'muted',false,
      'soloed',false,
      'clips',jsonb_build_array(jsonb_build_object(
        'clipId','41023000-0000-4000-8000-000000000001',
        'midiPatternVersionId',(select id from public.midi_pattern_versions
          where creator_id='41000000-0000-4000-8000-000000000001'),
        'startTick',0,
        'durationTicks',1920,
        'sourceStartTick',0,
        'loop',false
      ))
    ))
  )
);
select public.publish_midi_workspace_revision_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
  '41024000-0000-4000-8000-000000000001',
  2,
  null,
  'Source revision'
);
select public.save_midi_workspace_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
  '41025000-0000-4000-8000-000000000001',
  2,
  jsonb_set(
    (select manifest from public.workspaces
     where owner_id='41000000-0000-4000-8000-000000000001' and status='active'),
    '{tracks,0,name}',
    '"Owner rescued keys"'
  )
);
reset role;

do $$
begin
  perform set_config('test.source_project_id',(
    select id::text from public.projects
    where owner_id='41000000-0000-4000-8000-000000000001'
      and title='Stale draft source'
  ),true);
  perform set_config('test.source_workspace_id',(
    select id::text from public.workspaces
    where owner_id='41000000-0000-4000-8000-000000000001'
      and project_id=(
        select id from public.projects
        where owner_id='41000000-0000-4000-8000-000000000001'
          and title='Stale draft source'
      )
  ),true);
  perform set_config('test.source_base_revision_id',(
    select base_revision_id::text from public.workspaces
    where id=current_setting('test.source_workspace_id')::uuid
  ),true);
  perform set_config('test.source_workspace_manifest',(
    select manifest::text from public.workspaces
    where id=current_setting('test.source_workspace_id')::uuid
  ),true);
  perform set_config('test.source_workspace_lock',(
    select lock_version::text from public.workspaces
    where id=current_setting('test.source_workspace_id')::uuid
  ),true);
end;
$$;

update public.projects
set open_to_contributions=true,visibility='public'
where id=current_setting('test.source_project_id')::uuid;
insert into public.project_members(project_id,user_id,role,created_by)
values(
  current_setting('test.source_project_id')::uuid,
  '41000000-0000-4000-8000-000000000002',
  'editor',
  '41000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000002';
select public.create_contribution_workspace_v3(
  current_setting('test.source_project_id')::uuid,
  '41030000-0000-4000-8000-000000000001',
  current_setting('test.source_base_revision_id')::uuid,
  'Accepted contribution',
  ''
);
select public.save_midi_workspace_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000002' and status='active'),
  '41031000-0000-4000-8000-000000000001',
  1,
  jsonb_set(
    (select manifest from public.workspaces
     where owner_id='41000000-0000-4000-8000-000000000002' and status='active'),
    '{tracks,0,name}',
    '"Accepted keys"'
  )
);
select public.submit_contribution_v3(
  (select id from public.contributions
   where author_id='41000000-0000-4000-8000-000000000002' and status='draft'),
  '41032000-0000-4000-8000-000000000001',
  2,
  current_setting('test.source_base_revision_id')::uuid,
  (select manifest_sha256 from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000002' and status='active'),
  'contributor-attestation-v1'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select public.accept_contribution_v3(
  (select id from public.contributions
   where author_id='41000000-0000-4000-8000-000000000002' and status='submitted'),
  '41033000-0000-4000-8000-000000000001',
  (select current_version_id from public.contributions
   where author_id='41000000-0000-4000-8000-000000000002' and status='submitted'),
  current_setting('test.source_base_revision_id')::uuid,
  'Accepted exact proposal'
);
reset role;

do $$
begin
  perform set_config('test.source_current_revision_id',(
    select current_revision_id::text from public.projects
    where id=current_setting('test.source_project_id')::uuid
  ),true);
  perform set_config('test.source_accepted_arrangement_id',(
    select arrangement_version_id::text from public.project_revisions
    where project_id=current_setting('test.source_project_id')::uuid
      and accepted_contribution_id is not null
  ),true);
end;
$$;

set local request.jwt.claim.sub='';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000001',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'preserve_as_fork',
    'Recovered owner draft'
  )$$,
  'PT401',
  'draft_resolution_unauthenticated',
  'anonymous invocation is rejected before resource disclosure'
);

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000002',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'preserve_as_fork',
    'Recovered owner draft'
  )$$,
  'PT404',
  'draft_resolution_workspace_not_found',
  'unrelated authenticated users cannot resolve an owner workspace'
);
reset role;

update public.profiles
set status='suspended'
where id='41000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000003',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT403',
  'draft_resolution_actor_ineligible',
  'suspended owners cannot resolve stale drafts'
);
reset role;
update public.profiles
set status='active'
where id='41000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000008',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT403',
  'draft_resolution_actor_ineligible',
  'profile-incomplete actors cannot resolve stale drafts'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    (select id from public.workspaces
     where owner_id='41000000-0000-4000-8000-000000000002'),
    '41040000-0000-4000-8000-000000000004',
    2,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT404',
  'draft_resolution_workspace_not_found',
  'contribution workspaces cannot enter the owner resolution path'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.publish_midi_workspace_revision_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000005',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    'Stale publication must remain rejected'
  )$$,
  'PT409',
  'midi_publish_conflict',
  'existing publication command still rejects the stale base'
);
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000006',
    current_setting('test.source_workspace_lock')::integer + 1,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT409',
  'draft_resolution_workspace_changed',
  'changed workspace locks are rejected'
);
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41040000-0000-4000-8000-000000000007',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_base_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT409',
  'draft_resolution_project_changed',
  'changed project authority is rejected'
);

create temp table preserve_result as
select *
from public.resolve_stale_owner_workspace_v3(
  current_setting('test.source_workspace_id')::uuid,
  '41041000-0000-4000-8000-000000000001',
  current_setting('test.source_workspace_lock')::integer,
  current_setting('test.source_base_revision_id')::uuid,
  current_setting('test.source_current_revision_id')::uuid,
  'preserve_as_fork',
  '  Recovered owner draft  '
);
reset role;

select is(
  (select status::text from public.workspaces
   where id=current_setting('test.source_workspace_id')::uuid),
  'archived',
  'preserve path archives the source workspace only after target creation'
);
select ok(
  (select visibility='private'
      and open_to_contributions=false
      and source_project_id=current_setting('test.source_project_id')::uuid
      and source_revision_id=current_setting('test.source_base_revision_id')::uuid
   from public.projects
   where id=(select target_project_id from preserve_result)),
  'recovered project is a private direct fork of the exact stale base'
);
select is(
  (select revision_number from public.project_revisions
   where id=(select target_base_revision_id from preserve_result)),
  1,
  'recovered fork starts with immutable revision 1'
);
select is(
  (select manifest from public.project_revisions
   where id=(select target_base_revision_id from preserve_result)),
  private.canonical_manifest_v3(
    jsonb_set(
      (select manifest from public.project_revisions
       where id=current_setting('test.source_base_revision_id')::uuid),
      '{projectId}',
      to_jsonb((select target_project_id from preserve_result))
    ),
    (select target_project_id from preserve_result),
    null
  ),
  'fork revision 1 is the exact stale base with target authority rewritten'
);
select is(
  (select manifest from public.workspaces
   where id=(select target_workspace_id from preserve_result)),
  private.canonical_manifest_v3(
    jsonb_set(
      jsonb_set(
        current_setting('test.source_workspace_manifest')::jsonb,
        '{projectId}',
        to_jsonb((select target_project_id from preserve_result))
      ),
      '{workspaceId}',
      to_jsonb((select target_workspace_id from preserve_result))
    ),
    (select target_project_id from preserve_result),
    (select target_workspace_id from preserve_result)
  ),
  'recovered active workspace carries the acknowledged stale draft exactly'
);
select ok(
  (select status='active'
      and lock_version=1
      and base_revision_id=(select target_base_revision_id from preserve_result)
   from public.workspaces
   where id=(select target_workspace_id from preserve_result)),
  'recovered workspace starts active on fork revision 1'
);
select is(
  (select count(*) from public.midi_pattern_versions
   where creator_id='41000000-0000-4000-8000-000000000001'),
  1::bigint,
  'preserve path reuses immutable pattern versions without duplication'
);
select is(
  (select midi_pattern_version_id from public.arrangement_clips
   where arrangement_version_id=(
     select arrangement_version_id from public.project_revisions
     where id=(select target_base_revision_id from preserve_result)
   )),
  (select midi_pattern_version_id from public.arrangement_clips
   where arrangement_version_id=(
     select arrangement_version_id from public.project_revisions
     where id=current_setting('test.source_base_revision_id')::uuid
   )),
  'recovered revision retains exact pattern-version attribution'
);
select is(
  (select current_revision_id from public.projects
   where id=current_setting('test.source_project_id')::uuid),
  current_setting('test.source_current_revision_id')::uuid,
  'original project current revision remains the accepted contribution revision'
);
select is(
  (select arrangement_version_id from public.project_revisions
   where id=current_setting('test.source_current_revision_id')::uuid),
  current_setting('test.source_accepted_arrangement_id')::uuid,
  'accepted contribution arrangement remains unchanged'
);
select is(
  (select normalized_fork_title
   from private.stale_owner_workspace_resolutions
   where actor_id='41000000-0000-4000-8000-000000000001'
     and request_id='41041000-0000-4000-8000-000000000001'),
  'Recovered owner draft',
  'idempotency receipt retains the normalized fork title'
);
set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select is(
  (select target_project_id
   from public.resolve_stale_owner_workspace_v3(
     current_setting('test.source_workspace_id')::uuid,
     '41041000-0000-4000-8000-000000000001',
     current_setting('test.source_workspace_lock')::integer,
     current_setting('test.source_base_revision_id')::uuid,
     current_setting('test.source_current_revision_id')::uuid,
     'preserve_as_fork',
     'Recovered owner draft'
   )),
  (select target_project_id from preserve_result),
  'identical retries replay the original recovered fork'
);
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.source_workspace_id')::uuid,
    '41041000-0000-4000-8000-000000000001',
    current_setting('test.source_workspace_lock')::integer,
    current_setting('test.source_base_revision_id')::uuid,
    current_setting('test.source_current_revision_id')::uuid,
    'preserve_as_fork',
    'Different recovery title'
  )$$,
  'PT409',
  'draft_resolution_request_conflict',
  'changed payloads cannot reuse a resolution request ID'
);
select throws_ok(
  $$select * from private.stale_owner_workspace_resolutions$$,
  '42501',
  null,
  'authenticated callers cannot read private idempotency receipts directly'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select public.create_midi_project_workspace_v3(
  '41050000-0000-4000-8000-000000000001',
  'Restart source',
  '',
  100::numeric,
  'a-minor',
  4::smallint,
  4::smallint,
  'cc-by-4.0',
  '{}'::uuid[],
  null::uuid,
  '{}'::uuid[]
);
select public.save_midi_workspace_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000001'
     and project_id=(select id from public.projects where title='Restart source')),
  '41051000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'manifestVersion',3,
    'engine','openmidi-midi',
    'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
    'projectId',(select id from public.projects where title='Restart source'),
    'workspaceId',(select id from public.workspaces
      where owner_id='41000000-0000-4000-8000-000000000001'
        and project_id=(select id from public.projects where title='Restart source')),
    'tempoBpm',100,
    'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
    'musicalKey','a-minor',
    'ppq',480,
    'durationTicks',7680,
    'tracks',jsonb_build_array(jsonb_build_object(
      'trackId','41052000-0000-4000-8000-000000000001',
      'sortOrder',0,
      'name','Restart published keys',
      'presetId','warm-keys',
      'presetVersion',1,
      'gainDb',0,
      'pan',0,
      'muted',false,
      'soloed',false,
      'clips',jsonb_build_array(jsonb_build_object(
        'clipId','41053000-0000-4000-8000-000000000001',
        'midiPatternVersionId',(select id from public.midi_pattern_versions
          where creator_id='41000000-0000-4000-8000-000000000001'),
        'startTick',0,
        'durationTicks',1920,
        'sourceStartTick',0,
        'loop',false
      ))
    ))
  )
);
select public.publish_midi_workspace_revision_v3(
  (select id from public.workspaces
   where owner_id='41000000-0000-4000-8000-000000000001'
     and project_id=(select id from public.projects where title='Restart source')),
  '41054000-0000-4000-8000-000000000001',
  2,
  null,
  'Restart revision 1'
);
reset role;

do $$
begin
  perform set_config('test.restart_project_id',(
    select id::text from public.projects
    where owner_id='41000000-0000-4000-8000-000000000001'
      and title='Restart source'
  ),true);
  perform set_config('test.restart_workspace_id',(
    select id::text from public.workspaces
    where project_id=current_setting('test.restart_project_id')::uuid
  ),true);
  perform set_config('test.restart_base_revision_id',(
    select base_revision_id::text from public.workspaces
    where id=current_setting('test.restart_workspace_id')::uuid
  ),true);
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.restart_workspace_id')::uuid,
    '41055000-0000-4000-8000-000000000001',
    2,
    current_setting('test.restart_base_revision_id')::uuid,
    current_setting('test.restart_base_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT409',
  'draft_resolution_not_stale',
  'current owner workspaces cannot enter stale resolution'
);
select public.save_midi_workspace_v3(
  current_setting('test.restart_workspace_id')::uuid,
  '41055000-0000-4000-8000-000000000002',
  2,
  jsonb_set(
    (select manifest from public.workspaces
     where id=current_setting('test.restart_workspace_id')::uuid),
    '{tracks,0,name}',
    '"Discardable stale keys"'
  )
);
reset role;

insert into public.arrangement_versions(
  id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
  manifest,manifest_sha256,tempo_bpm,time_signature_numerator,
  time_signature_denominator,musical_key,ppq,duration_ticks
)
select
  '41056000-0000-4000-8000-000000000003',
  project_id,
  '41000000-0000-4000-8000-000000000001',
  '41056000-0000-4000-8000-000000000004',
  manifest_version,
  engine,
  engine_version,
  manifest,
  manifest_sha256,
  tempo_bpm,
  time_signature_numerator,
  time_signature_denominator,
  musical_key,
  ppq,
  duration_ticks
from public.arrangement_versions
where id=(
  select arrangement_version_id from public.project_revisions
  where id=current_setting('test.restart_base_revision_id')::uuid
);
insert into public.arrangement_tracks(
  arrangement_version_id,project_id,track_id,sort_order,name,preset_id,
  preset_version,gain_db,pan,muted,soloed
)
select
  '41056000-0000-4000-8000-000000000003',
  project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed
from public.arrangement_tracks
where arrangement_version_id=(
  select arrangement_version_id from public.project_revisions
  where id=current_setting('test.restart_base_revision_id')::uuid
);
insert into public.arrangement_clips(
  arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,
  start_tick,duration_ticks,source_start_tick,loop
)
select
  '41056000-0000-4000-8000-000000000003',
  project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,
  source_start_tick,loop
from public.arrangement_clips
where arrangement_version_id=(
  select arrangement_version_id from public.project_revisions
  where id=current_setting('test.restart_base_revision_id')::uuid
);
insert into public.project_revisions(
  id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,
  expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,
  manifest_sha256,duration_ms,arrangement_version_id
)
select
  '41056000-0000-4000-8000-000000000001',
  project_id,
  2,
  id,
  '41000000-0000-4000-8000-000000000001',
  '41056000-0000-4000-8000-000000000002',
  id,
  'Server-authoritative revision 2',
  manifest,
  manifest_version,
  engine,
  engine_version,
  manifest_sha256,
  duration_ms,
  '41056000-0000-4000-8000-000000000003'
from public.project_revisions
where id=current_setting('test.restart_base_revision_id')::uuid;
update public.projects
set current_revision_id='41056000-0000-4000-8000-000000000001',
  lock_version=lock_version+1,
  updated_at=statement_timestamp()
where id=current_setting('test.restart_project_id')::uuid;
select set_config('test.restart_current_revision_id','41056000-0000-4000-8000-000000000001',true);

create function pg_temp.fail_restart_target()
returns trigger
language plpgsql
as $$
begin
  if new.create_request_id='41057000-0000-4000-8000-000000000001'::uuid then
    raise exception 'forced_target_failure';
  end if;
  return new;
end;
$$;
create trigger fail_restart_target
before insert on public.workspaces
for each row execute function pg_temp.fail_restart_target();

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.restart_workspace_id')::uuid,
    '41057000-0000-4000-8000-000000000001',
    3,
    current_setting('test.restart_base_revision_id')::uuid,
    current_setting('test.restart_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'P0001',
  'forced_target_failure',
  'target creation failure aborts the entire restart transaction'
);
reset role;
select is(
  (select status::text from public.workspaces
   where id=current_setting('test.restart_workspace_id')::uuid),
  'active',
  'failed target creation leaves the source workspace active'
);
drop trigger fail_restart_target on public.workspaces;

set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
create temp table restart_result as
select *
from public.resolve_stale_owner_workspace_v3(
  current_setting('test.restart_workspace_id')::uuid,
  '41057000-0000-4000-8000-000000000002',
  3,
  current_setting('test.restart_base_revision_id')::uuid,
  current_setting('test.restart_current_revision_id')::uuid,
  'restart_latest',
  null
);
reset role;
select ok(
  (select target_project_id=current_setting('test.restart_project_id')::uuid
      and target_base_revision_id=current_setting('test.restart_current_revision_id')::uuid
   from restart_result),
  'restart path stays in the original project and targets exact current authority'
);
select is(
  (select manifest from public.workspaces
   where id=(select target_workspace_id from restart_result)),
  private.canonical_manifest_v3(
    (select manifest from public.project_revisions
     where id=current_setting('test.restart_current_revision_id')::uuid)
      || jsonb_build_object('workspaceId',(select target_workspace_id from restart_result)),
    current_setting('test.restart_project_id')::uuid,
    (select target_workspace_id from restart_result)
  ),
  'restart workspace is rebuilt from the exact current immutable revision'
);
select ok(
  (select status='active' and lock_version=1
   from public.workspaces
   where id=(select target_workspace_id from restart_result)),
  'restart target is a fresh active owner workspace'
);
select is(
  (select status::text from public.workspaces
   where id=current_setting('test.restart_workspace_id')::uuid),
  'archived',
  'successful restart archives the stale source workspace'
);
select is(
  (select count(*) from public.workspace_tracks
   where workspace_id=(select target_workspace_id from restart_result)),
  (select jsonb_array_length(manifest->'tracks') from public.workspaces
   where id=(select target_workspace_id from restart_result))::bigint,
  'restart rebuilds normalized workspace projections'
);
set local role authenticated;
set local request.jwt.claim.sub='41000000-0000-4000-8000-000000000001';
select is(
  (select target_workspace_id
   from public.resolve_stale_owner_workspace_v3(
     current_setting('test.restart_workspace_id')::uuid,
     '41057000-0000-4000-8000-000000000002',
     3,
     current_setting('test.restart_base_revision_id')::uuid,
     current_setting('test.restart_current_revision_id')::uuid,
     'restart_latest',
     null
   )),
  (select target_workspace_id from restart_result),
  'identical restart retries replay the original target'
);
select throws_ok(
  $$select public.resolve_stale_owner_workspace_v3(
    current_setting('test.restart_workspace_id')::uuid,
    '41057000-0000-4000-8000-000000000003',
    3,
    current_setting('test.restart_base_revision_id')::uuid,
    current_setting('test.restart_current_revision_id')::uuid,
    'restart_latest',
    null
  )$$,
  'PT404',
  'draft_resolution_workspace_not_found',
  'a competing request cannot create a second target after the source is archived'
);
reset role;

select * from finish();
rollback;
