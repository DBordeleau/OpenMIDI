begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','ca000000-0000-4000-8000-000000000001','authenticated','authenticated','clip-actor@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca000000-0000-4000-8000-000000000002','authenticated','authenticated','clip-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca000000-0000-4000-8000-000000000003','authenticated','authenticated','clip-stranger@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca000000-0000-4000-8000-000000000004','authenticated','authenticated','clip-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='ClipActor',username_normalized='clipactor',
  display_name='Clip Actor',credit_name='Clip Actor',profile_completed_at=now()
where id='ca000000-0000-4000-8000-000000000001';
update public.profiles set username='ClipOwner',username_normalized='clipowner',
  display_name='Clip Owner',credit_name='Clip Owner',profile_completed_at=now()
where id='ca000000-0000-4000-8000-000000000002';
update public.profiles set username='ClipStranger',username_normalized='clipstranger',
  display_name='Clip Stranger',credit_name='Clip Stranger',profile_completed_at=now()
where id='ca000000-0000-4000-8000-000000000003';
update public.profiles set username='ClipSuspended',username_normalized='clipsuspended',
  display_name='Clip Suspended',credit_name='Clip Suspended',profile_completed_at=now(),status='suspended'
where id='ca000000-0000-4000-8000-000000000004';

select has_table('private','studio_clip_import_receipts','private import receipt authority exists');
select ok(not exists(
  select 1 from information_schema.role_table_grants
  where table_schema='private' and table_name='studio_clip_import_receipts'
    and grantee in ('anon','authenticated')
),'receipt authority has no direct application grants');
select ok(not has_function_privilege(
  'anon','public.list_studio_clip_collection(text,text,integer)','execute'
),'anonymous cannot list the Studio collection');
select ok(not has_function_privilege(
  'anon','public.get_studio_clip_detail(uuid)','execute'
),'anonymous cannot request exact Studio clip detail');
select ok(not has_function_privilege(
  'anon','public.import_studio_clip(uuid,text,uuid,uuid,integer,integer)','execute'
),'anonymous cannot execute Studio clip import');
select ok(has_function_privilege(
  'authenticated','public.import_studio_clip(uuid,text,uuid,uuid,integer,integer)','execute'
),'authenticated actors receive only the bounded import command');
select ok(position('noteId' in
  pg_get_functiondef('public.list_studio_clip_collection(text,text,integer)'::regprocedure))=0,
  'collection projection does not aggregate note arrays');

insert into public.midi_patterns(
  id,owner_id,create_request_id,name,visibility,rights_attestation_version,published_at
) values
('ca100000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000001','Private owned phrase','private',null,null),
('ca100000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000001','ca110000-0000-4000-8000-000000000002','Owned and saved phrase','public','cc-by-4.0-attestation-v1',now()),
('ca100000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000002','ca110000-0000-4000-8000-000000000003','Reusable library phrase','public','cc-by-4.0-attestation-v1',now()),
('ca100000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000002','ca110000-0000-4000-8000-000000000004','Reference library phrase','private',null,null),
('ca100000-0000-4000-8000-000000000005','ca000000-0000-4000-8000-000000000002','ca110000-0000-4000-8000-000000000005','Hidden library phrase','public','cc-by-4.0-attestation-v1',now()),
('ca100000-0000-4000-8000-000000000006','ca000000-0000-4000-8000-000000000002','ca110000-0000-4000-8000-000000000006','Unsaved third-party phrase','private',null,null);
insert into public.midi_pattern_versions(
  id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,
  parent_pattern_version_id,source_pattern_version_id,ppq,duration_ticks,note_count,
  content_sha256,reuse_license_code,reuse_license_version,reuse_license_url
) values
('ca200000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000001',1,'ca210000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001','Clip Actor',null,null,480,960,2,repeat('1',64),null,null,null),
('ca200000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000002',1,'ca210000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000001','Clip Actor',null,null,480,960,1,repeat('2',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('ca200000-0000-4000-8000-000000000003','ca100000-0000-4000-8000-000000000003',1,'ca210000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000002','Clip Owner',null,'ca200000-0000-4000-8000-000000000002',480,960,2,repeat('3',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('ca200000-0000-4000-8000-000000000004','ca100000-0000-4000-8000-000000000004',1,'ca210000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000002','Clip Owner',null,null,480,960,1,repeat('4',64),null,null,null),
('ca200000-0000-4000-8000-000000000005','ca100000-0000-4000-8000-000000000005',1,'ca210000-0000-4000-8000-000000000005','ca000000-0000-4000-8000-000000000002','Clip Owner',null,null,480,960,1,repeat('5',64),'CC-BY-4.0','4.0','https://creativecommons.org/licenses/by/4.0/'),
('ca200000-0000-4000-8000-000000000006','ca100000-0000-4000-8000-000000000006',1,'ca210000-0000-4000-8000-000000000006','ca000000-0000-4000-8000-000000000002','Clip Owner',null,null,480,960,1,repeat('6',64),null,null,null);
insert into public.midi_pattern_notes(
  midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity
) values
('ca200000-0000-4000-8000-000000000001','ca220000-0000-4000-8000-000000000001',0,240,60,100),
('ca200000-0000-4000-8000-000000000001','ca220000-0000-4000-8000-000000000002',480,240,64,96),
('ca200000-0000-4000-8000-000000000002','ca220000-0000-4000-8000-000000000003',0,480,67,90),
('ca200000-0000-4000-8000-000000000003','ca220000-0000-4000-8000-000000000004',0,240,55,100),
('ca200000-0000-4000-8000-000000000003','ca220000-0000-4000-8000-000000000005',480,240,59,96),
('ca200000-0000-4000-8000-000000000004','ca220000-0000-4000-8000-000000000006',0,480,72,90),
('ca200000-0000-4000-8000-000000000005','ca220000-0000-4000-8000-000000000007',0,480,69,90),
('ca200000-0000-4000-8000-000000000006','ca220000-0000-4000-8000-000000000008',0,480,65,90);

insert into public.midi_library_listings(
  id,midi_pattern_id,midi_pattern_version_id,owner_id,request_id,request_payload_sha256,
  rights_payload_sha256,title,description,creator_username,creator_display_name,
  creator_credit_name,reuse_mode,rights_basis,attestation_version,attested_by,
  category_code,suggested_preset_id,suggested_preset_version,instrument_family_code,
  duration_ticks,duration_beats,note_count,min_pitch,max_pitch,polyphony_kind,search_vector,
  supporting_source_url,supporting_source_terms,moderation_hidden_at
) values
('ca300000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','ca200000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000001','ca310000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'Owned and saved phrase','','ClipActor','Clip Actor','Clip Actor','commercial_reuse','original','midi-library-commercial-attestation-v1','ca000000-0000-4000-8000-000000000001','melody','warm-keys',1,'keys',960,2,1,67,67,'monophonic',to_tsvector('simple','Owned and saved phrase'),null,null,null),
('ca300000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000003','ca200000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000002','ca310000-0000-4000-8000-000000000002',repeat('c',64),repeat('d',64),'Reusable library phrase','','ClipOwner','Clip Owner','Clip Owner','commercial_reuse','authorized_adaptation','midi-library-commercial-attestation-v1','ca000000-0000-4000-8000-000000000002','rhythm','warm-keys',1,'keys',960,2,2,55,59,'monophonic',to_tsvector('simple','Reusable library phrase'),'https://example.test/source','CC BY 4.0 source',null),
('ca300000-0000-4000-8000-000000000003','ca100000-0000-4000-8000-000000000004','ca200000-0000-4000-8000-000000000004','ca000000-0000-4000-8000-000000000002','ca310000-0000-4000-8000-000000000003',repeat('e',64),repeat('f',64),'Reference library phrase','','ClipOwner','Clip Owner','Clip Owner','reference_only','original','midi-library-reference-display-attestation-v1','ca000000-0000-4000-8000-000000000002','melody','soft-lead',1,'leads',960,2,1,72,72,'monophonic',to_tsvector('simple','Reference library phrase'),null,null,null),
('ca300000-0000-4000-8000-000000000004','ca100000-0000-4000-8000-000000000005','ca200000-0000-4000-8000-000000000005','ca000000-0000-4000-8000-000000000002','ca310000-0000-4000-8000-000000000004',repeat('0',64),repeat('9',64),'Hidden library phrase','','ClipOwner','Clip Owner','Clip Owner','commercial_reuse','original','midi-library-commercial-attestation-v1','ca000000-0000-4000-8000-000000000002','melody','soft-lead',1,'leads',960,2,1,69,69,'monophonic',to_tsvector('simple','Hidden library phrase'),null,null,now());
insert into public.midi_pattern_external_credits(
  id,listing_id,midi_pattern_version_id,position,credited_name,role,source_url,source_terms
) values(
  'ca320000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002',
  'ca200000-0000-4000-8000-000000000003',1,'Outside Composer','Composer',
  'https://example.test/source','CC BY 4.0 source'
);
insert into public.saved_midi_patterns(
  user_id,midi_pattern_version_id,source_listing_id,save_request_id
) values
('ca000000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000002','ca300000-0000-4000-8000-000000000001','ca330000-0000-4000-8000-000000000001'),
('ca000000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000003','ca300000-0000-4000-8000-000000000002','ca330000-0000-4000-8000-000000000002'),
('ca000000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000004','ca300000-0000-4000-8000-000000000003','ca330000-0000-4000-8000-000000000003'),
('ca000000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000005','ca300000-0000-4000-8000-000000000004','ca330000-0000-4000-8000-000000000004');

insert into public.projects(id,owner_id,create_request_id,title,license_code) values
('ca400000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001','Actor project','all-rights-reserved'),
('ca400000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000002','Contribution project','cc-by-4.0'),
('ca400000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000003','Full project','all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by) values
('ca400000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000001','owner','ca000000-0000-4000-8000-000000000001'),
('ca400000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000002','owner','ca000000-0000-4000-8000-000000000002'),
('ca400000-0000-4000-8000-000000000002','ca000000-0000-4000-8000-000000000001','editor','ca000000-0000-4000-8000-000000000002'),
('ca400000-0000-4000-8000-000000000003','ca000000-0000-4000-8000-000000000001','owner','ca000000-0000-4000-8000-000000000001');

with m as (
  select jsonb_build_object(
    'manifestVersion',3,'engine','openmidi-midi',
    'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
    'projectId','ca400000-0000-4000-8000-000000000002'::uuid,
    'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
    'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb
  ) manifest
), a as (
  insert into public.arrangement_versions(
    id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,
    manifest,manifest_sha256,tempo_bpm,time_signature_numerator,
    time_signature_denominator,musical_key,ppq,duration_ticks
  )
  select 'ca700000-0000-4000-8000-000000000001','ca400000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000002','ca701000-0000-4000-8000-000000000001',
    3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',manifest,
    encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex'),
    120,4,4,'c-major',480,1920 from m returning *
)
insert into public.project_revisions(
  id,project_id,revision_number,created_by,publish_request_id,manifest,manifest_version,
  engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id
)
select 'ca710000-0000-4000-8000-000000000001',a.project_id,1,a.created_by,
  'ca711000-0000-4000-8000-000000000001',a.manifest,3,a.engine,a.engine_version,
  a.manifest_sha256,2000,a.id from a;
update public.projects set status='active',visibility='public',
  current_revision_id='ca710000-0000-4000-8000-000000000001',published_at=now(),
  open_to_contributions=true
where id='ca400000-0000-4000-8000-000000000002';
insert into public.contributions(
  id,project_id,author_id,create_request_id,base_revision_id,title,description
) values(
  'ca600000-0000-4000-8000-000000000001','ca400000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000001','ca610000-0000-4000-8000-000000000001',
  'ca710000-0000-4000-8000-000000000001','Editable contribution','Exact workspace'
);

with manifests as (
  select 'ca420000-0000-4000-8000-000000000001'::uuid workspace_id,
    'ca400000-0000-4000-8000-000000000001'::uuid project_id,
    'ca000000-0000-4000-8000-000000000001'::uuid owner_id,
    null::uuid contribution_id,null::uuid base_revision_id,
    jsonb_build_object(
      'manifestVersion',3,'engine','openmidi-midi',
      'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
      'projectId','ca400000-0000-4000-8000-000000000001'::uuid,
      'workspaceId','ca420000-0000-4000-8000-000000000001'::uuid,
      'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
      'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb
    ) manifest
  union all
  select 'ca420000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000001','ca600000-0000-4000-8000-000000000001',
    'ca710000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'manifestVersion',3,'engine','openmidi-midi',
      'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
      'projectId','ca400000-0000-4000-8000-000000000002'::uuid,
      'workspaceId','ca420000-0000-4000-8000-000000000002'::uuid,
      'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
      'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks','[]'::jsonb
    )
)
insert into public.workspaces(
  id,project_id,owner_id,create_request_id,base_revision_id,contribution_id,
  manifest,manifest_version,engine,engine_version,manifest_sha256
)
select workspace_id,project_id,owner_id,gen_random_uuid(),base_revision_id,contribution_id,
  manifest,3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',
  encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex')
from manifests;

with tracks as (
  select jsonb_agg(jsonb_build_object(
    'trackId',gen_random_uuid(),'sortOrder',n,'name','Track '||(n+1),
    'presetId','warm-keys','presetVersion',1,'gainDb',-6,'pan',0,
    'muted',false,'soloed',false,'clips','[]'::jsonb
  ) order by n) value
  from generate_series(0,15) n
), manifest as (
  select jsonb_build_object(
    'manifestVersion',3,'engine','openmidi-midi',
    'engineVersion','openmidi-midi-3_tone-15.1.22_presets-1',
    'projectId','ca400000-0000-4000-8000-000000000003'::uuid,
    'workspaceId','ca420000-0000-4000-8000-000000000003'::uuid,
    'tempoBpm',120,'timeSignature',jsonb_build_object('numerator',4,'denominator',4),
    'musicalKey','c-major','ppq',480,'durationTicks',1920,'tracks',value
  ) value from tracks
)
insert into public.workspaces(
  id,project_id,owner_id,create_request_id,manifest,manifest_version,engine,engine_version,manifest_sha256
)
select 'ca420000-0000-4000-8000-000000000003','ca400000-0000-4000-8000-000000000003',
  'ca000000-0000-4000-8000-000000000001','ca430000-0000-4000-8000-000000000003',
  value,3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',
  encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex'
) from manifest;
select private.replace_workspace_projection_v3(
  'ca420000-0000-4000-8000-000000000003',
  (select manifest from public.workspaces where id='ca420000-0000-4000-8000-000000000003')
);

set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
select is(
  jsonb_array_length(public.list_studio_clip_collection()->'items'),5,
  'owned and explicitly saved exact versions form one bounded collection'
);
select is(
  (select count(*) from jsonb_array_elements(public.list_studio_clip_collection()->'items') item
    where item->>'patternVersionId'='ca200000-0000-4000-8000-000000000002'),
  1::bigint,'an exact owned-and-saved version is deduplicated'
);
select is(
  (select item->>'source' from jsonb_array_elements(public.list_studio_clip_collection()->'items') item
    where item->>'patternVersionId'='ca200000-0000-4000-8000-000000000002'),
  'owned','owner authority wins the deduplicated source'
);
select ok(
  (select (item->>'isSaved')::boolean from jsonb_array_elements(public.list_studio_clip_collection()->'items') item
    where item->>'patternVersionId'='ca200000-0000-4000-8000-000000000002'),
  'saved provenance remains represented on the owner-authorized item'
);
select is(
  jsonb_array_length(public.list_studio_clip_collection('owned')->'items'),2,
  'My clips contains every non-deleted actor-owned exact version'
);
select is(
  jsonb_array_length(public.list_studio_clip_collection('saved')->'items'),4,
  'Saved clips contains only explicit exact-version bookmarks'
);
select is(
  jsonb_array_length(public.list_studio_clip_collection('all','private owned',100)->'items'),1,
  'bounded search filters collection metadata without loading notes'
);
select ok(
  not ((public.list_studio_clip_collection()->'items'->0) ? 'notes'),
  'collection rows contain no eager note array'
);
select is(
  (select item->>'availability' from jsonb_array_elements(public.list_studio_clip_collection('saved')->'items') item
    where item->>'patternVersionId'='ca200000-0000-4000-8000-000000000004'),
  'reference_only','reference-only saved evidence stays visible with a truthful denial'
);
select is(
  (select item->>'availability' from jsonb_array_elements(public.list_studio_clip_collection('saved')->'items') item
    where item->>'patternVersionId'='ca200000-0000-4000-8000-000000000005'),
  'moderation_hidden','moderation-hidden saved evidence stays visible with a truthful denial'
);
select is(
  jsonb_array_length(public.get_studio_clip_detail('ca200000-0000-4000-8000-000000000001')->'pattern'->'notes'),
  2,'owned private exact-version detail returns bounded structured MIDI on demand'
);
select is(
  public.get_studio_clip_detail('ca200000-0000-4000-8000-000000000005')->'pattern',
  'null'::jsonb,'unavailable saved detail returns no MIDI payload'
);
select throws_ok(
  $$select public.get_studio_clip_detail('ca200000-0000-4000-8000-000000000006')$$,
  'PT404','studio_clip_source_unavailable',
  'an unsaved third-party exact version cannot be previewed through the Studio collection'
);

select lives_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001',1,480
  )$$,'owned private exact version imports without a public listing'
);
select is(
  (select lock_version from public.workspaces where id='ca420000-0000-4000-8000-000000000001'),
  2,'atomic import advances the exact optimistic workspace lock once'
);
select is(
  (select count(*) from public.workspace_tracks where workspace_id='ca420000-0000-4000-8000-000000000001'),
  1::bigint,'import creates one new MIDI track'
);
select is(
  (select midi_pattern_version_id from public.workspace_clips
    where workspace_id='ca420000-0000-4000-8000-000000000001'),
  'ca200000-0000-4000-8000-000000000001'::uuid,
  'imported clip keeps the exact immutable pattern version'
);
select ok(
  (select w.manifest_sha256=encode(extensions.digest(convert_to(w.manifest::text,'UTF8'),'sha256'),'hex')
    from public.workspaces w where w.id='ca420000-0000-4000-8000-000000000001'),
  'canonical workspace manifest hash matches the stored manifest'
);
select ok(
  (select w.manifest->'tracks'->0->>'trackId'=wt.track_id::text
    and w.manifest->'tracks'->0->'clips'->0->>'clipId'=wc.clip_id::text
    from public.workspaces w
    join public.workspace_tracks wt on wt.workspace_id=w.id
    join public.workspace_clips wc on wc.workspace_id=w.id and wc.track_id=wt.track_id
    where w.id='ca420000-0000-4000-8000-000000000001'),
  'canonical manifest and normalized track/clip projections agree'
);
reset role;
select ok(
  exists(select 1 from private.workspace_snapshots s
    join public.workspaces w on w.id=s.workspace_id
    where s.workspace_id='ca420000-0000-4000-8000-000000000001'
      and s.lock_version=w.lock_version and s.manifest=w.manifest
      and s.manifest_sha256=w.manifest_sha256),
  'import records the matching canonical recovery snapshot'
);
set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
reset role;
select is(
  public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001',1,480
  ),
  (select response from private.studio_clip_import_receipts
    where actor_id='ca000000-0000-4000-8000-000000000001'
      and request_id='ca500000-0000-4000-8000-000000000001'),
  'exact retry replays the canonical import response'
);
set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
select is(
  (select lock_version from public.workspaces where id='ca420000-0000-4000-8000-000000000001'),
  2,'exact retry creates no second workspace mutation'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001',1,481
  )$$,'PT409','studio_clip_import_request_mismatch',
  'changed retry payload is rejected specifically'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000002',1,0
  )$$,'PT409','studio_clip_workspace_stale',
  'stale optimistic lock rejects the whole import'
);
select is(
  (select count(*) from public.workspace_clips where workspace_id='ca420000-0000-4000-8000-000000000001'),
  1::bigint,'stale-lock rejection rolls back track and clip mutation'
);
reset role;
select ok(
  not exists(select 1 from private.studio_clip_import_receipts
    where request_id='ca500000-0000-4000-8000-000000000002'),
  'stale-lock rejection rolls back its provisional receipt'
);
set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000004','saved',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),2,0
  )$$,'PT409','studio_clip_saved_source_unavailable',
  'reference-only saved source cannot import'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000005','saved',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),2,0
  )$$,'PT409','studio_clip_saved_source_unavailable',
  'moderation-hidden saved source cannot import'
);
select lives_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000003','saved',
    'ca420000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000003',2,0
  )$$,'explicitly saved eligible library version imports after fresh authority checks'
);
reset role;
select ok(
  (select source_kind='saved'
    and source_pattern_version_id='ca200000-0000-4000-8000-000000000003'
    and source_listing_id='ca300000-0000-4000-8000-000000000002'
    and reuse_license_code='CC-BY-4.0'
    and external_credits->0->>'creditedName'='Outside Composer'
    from private.studio_clip_import_receipts
    where request_id='ca500000-0000-4000-8000-000000000003'),
  'saved import receipt preserves exact lineage, license, listing, and external attribution'
);
select is(
  (select response->'importedPattern'->>'sourceMidiPatternVersionId'
    from private.studio_clip_import_receipts
    where request_id='ca500000-0000-4000-8000-000000000003'),
  'ca200000-0000-4000-8000-000000000002',
  'immediate playback payload preserves source-version lineage'
);
set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000004',1,0
  )$$,'editable contribution author can import into their exact workspace'
);
reset role;
select is(
  (select contribution_id from private.studio_clip_import_receipts
    where request_id='ca500000-0000-4000-8000-000000000004'),
  'ca600000-0000-4000-8000-000000000001'::uuid,
  'contribution import result remains bound to the editable contribution'
);
set local role authenticated;
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000003',gen_random_uuid(),1,0
  )$$,'PT409','studio_clip_track_limit',
  '16-track workspace rejects another imported track'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),3,99999999
  )$$,'22023','studio_clip_invalid_start_tick',
  'invalid caller start tick is rejected specifically'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000003','owned',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),3,0
  )$$,'PT404','studio_clip_source_unavailable',
  'invalid actor/source-version pairing is rejected'
);

set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000003','owned',
    'ca420000-0000-4000-8000-000000000002',gen_random_uuid(),2,0
  )$$,'PT404','studio_clip_workspace_unavailable',
  'project owner or reviewer cannot mutate the author-owned contribution workspace'
);
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000003','owned',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),3,0
  )$$,'PT404','studio_clip_source_unavailable',
  'unrelated authenticated actor cannot reuse an unsaved third-party source'
);
set local request.jwt.claim.sub='ca000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.list_studio_clip_collection()$$,
  'PT403','studio_clip_actor_ineligible',
  'suspended actor cannot enumerate Studio clip authority'
);
select throws_ok(
  $$select public.import_studio_clip(
    'ca200000-0000-4000-8000-000000000001','owned',
    'ca420000-0000-4000-8000-000000000001',gen_random_uuid(),3,0
  )$$,'PT403','studio_clip_actor_ineligible',
  'suspended actor cannot import'
);

select * from finish();
rollback;
