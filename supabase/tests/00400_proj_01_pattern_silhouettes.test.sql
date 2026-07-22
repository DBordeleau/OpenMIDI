begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','40100000-0000-4000-8000-000000000001','authenticated','authenticated','proj01-owner@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','40100000-0000-4000-8000-000000000002','authenticated','authenticated','proj01-reader@example.test','','{}','{}',now(),now());
update public.profiles
set username='ProjOwner',username_normalized='projowner',display_name='Project Owner',credit_name='Project Owner',profile_completed_at=now()
where id='40100000-0000-4000-8000-000000000001';
update public.profiles
set username='ProjReader',username_normalized='projreader',display_name='Project Reader',credit_name='Project Reader',profile_completed_at=now()
where id='40100000-0000-4000-8000-000000000002';

select has_column('public','midi_pattern_versions','silhouette_v1','pattern versions store a silhouette');
select has_column('public','midi_pattern_versions','silhouette_min_pitch','pattern versions store silhouette minimum pitch');
select has_column('public','midi_pattern_versions','silhouette_max_pitch','pattern versions store silhouette maximum pitch');
select has_function('private','compute_pattern_silhouette_v1',array['uuid'],'silhouette computation function exists');
select has_function('public','get_public_project_silhouettes',array['uuid','uuid'],'bounded public silhouette RPC exists');
select ok(not has_function_privilege('anon','private.compute_pattern_silhouette_v1(uuid)','execute'),'anonymous cannot invoke silhouette computation');
select ok(not has_function_privilege('authenticated','private.compute_pattern_silhouette_v1(uuid)','execute'),'authenticated callers cannot invoke silhouette computation');
select ok(has_function_privilege('anon','public.get_public_project_silhouettes(uuid,uuid)','execute'),'anonymous may call the public silhouette RPC');
select ok(has_function_privilege('authenticated','public.get_public_project_silhouettes(uuid,uuid)','execute'),'authenticated callers may call the public silhouette RPC');
select ok(
  not exists(
    select 1
    from aclexplode(coalesce(
      (select proacl from pg_proc where oid='public.get_public_project_silhouettes(uuid,uuid)'::regprocedure),
      acldefault('f',0)
    )) privilege
    where privilege.grantee=0 and privilege.privilege_type='EXECUTE'
  ),
  'the public silhouette RPC revokes default PUBLIC execution'
);
select is(
  (select action_orientation from information_schema.triggers
    where event_object_schema='public' and event_object_table='midi_pattern_notes'
      and trigger_name='midi_pattern_notes_silhouette_after_insert'),
  'STATEMENT',
  'silhouette trigger fires once per insert statement'
);
select is(
  (select action_reference_new_table from information_schema.triggers
    where event_object_schema='public' and event_object_table='midi_pattern_notes'
      and trigger_name='midi_pattern_notes_silhouette_after_insert'),
  'inserted',
  'silhouette trigger uses the inserted transition table'
);

insert into public.midi_patterns(id,owner_id,create_request_id,name)
select
  ('40110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '40100000-0000-4000-8000-000000000001',
  ('40111000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'Silhouette pattern '||n
from generate_series(1,6) n;

insert into public.midi_pattern_versions(
  id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,
  ppq,duration_ticks,note_count,content_sha256
)
select
  ('40120000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('40110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  1,
  ('40121000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '40100000-0000-4000-8000-000000000001',
  'Project Owner',480,640,
  case n when 1 then 0 when 5 then 3 else 2 end,
  repeat(n::text,64)
from generate_series(1,6) n;

-- One bulk statement covers multiple versions and every occupancy edge.
insert into public.midi_pattern_notes(
  midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity
) values
  ('40120000-0000-4000-8000-000000000002','40130000-0000-4000-8000-000000000001',0,80,60,100),
  ('40120000-0000-4000-8000-000000000002','40130000-0000-4000-8000-000000000002',320,80,60,90),
  ('40120000-0000-4000-8000-000000000003','40130000-0000-4000-8000-000000000003',640,1,64,100),
  ('40120000-0000-4000-8000-000000000003','40130000-0000-4000-8000-000000000004',0,1,60,90),
  ('40120000-0000-4000-8000-000000000004','40130000-0000-4000-8000-000000000005',600,2000,48,100),
  ('40120000-0000-4000-8000-000000000004','40130000-0000-4000-8000-000000000006',0,10,72,90),
  ('40120000-0000-4000-8000-000000000005','40130000-0000-4000-8000-000000000007',20,300,40,100),
  ('40120000-0000-4000-8000-000000000005','40130000-0000-4000-8000-000000000008',100,300,64,90),
  ('40120000-0000-4000-8000-000000000005','40130000-0000-4000-8000-000000000009',280,200,88,80),
  ('40120000-0000-4000-8000-000000000006','40130000-0000-4000-8000-000000000010',0,10,0,100),
  ('40120000-0000-4000-8000-000000000006','40130000-0000-4000-8000-000000000011',630,10,127,100);

select ok(
  (select silhouette_v1 is null and silhouette_min_pitch is null and silhouette_max_pitch is null
    from public.midi_pattern_versions where id='40120000-0000-4000-8000-000000000001'),
  'zero-note patterns retain the all-null safe degradation shape'
);
select ok(
  (select silhouette_min_pitch=60 and silhouette_max_pitch=60
    from public.midi_pattern_versions where id='40120000-0000-4000-8000-000000000002'),
  'one-pitch patterns preserve equal minimum and maximum pitch'
);
select ok(
  (select bool_and(get_byte(decode(silhouette_v1,'base64'),column_index) in (0,1))
    from public.midi_pattern_versions cross join generate_series(0,63) column_index
    where id='40120000-0000-4000-8000-000000000002'),
  'one-pitch patterns occupy only band zero without division by zero'
);
select ok(
  (select get_byte(decode(silhouette_v1,'base64'),63)<>0
      and not exists(select 1 from generate_series(1,62) i where get_byte(decode(silhouette_v1,'base64'),i)<>0)
    from public.midi_pattern_versions where id='40120000-0000-4000-8000-000000000003'),
  'a note starting exactly at duration clamps to column 63'
);
select ok(
  (select get_byte(decode(silhouette_v1,'base64'),63)<>0
    from public.midi_pattern_versions where id='40120000-0000-4000-8000-000000000004'),
  'notes extending beyond the pattern clamp at the final column'
);
select ok(
  (select count(*)>20 from generate_series(0,63) i
    cross join public.midi_pattern_versions v
    where v.id='40120000-0000-4000-8000-000000000005'
      and get_byte(decode(v.silhouette_v1,'base64'),i)<>0),
  'overlapping notes and note durations occupy multiple columns'
);
select ok(
  (select silhouette_min_pitch=0 and silhouette_max_pitch=127
      and (get_byte(decode(silhouette_v1,'base64'),0) & 1)=1
      and (get_byte(decode(silhouette_v1,'base64'),63) & 128)=128
    from public.midi_pattern_versions where id='40120000-0000-4000-8000-000000000006'),
  'minimum and maximum MIDI pitches map to the lowest and highest bands'
);
select ok(
  not exists(
    select 1 from public.midi_pattern_versions
    where silhouette_v1 is not null and (
      length(silhouette_v1)<>88
      or silhouette_v1 !~ '^[A-Za-z0-9+/]{86}==$'
      or octet_length(decode(silhouette_v1,'base64'))<>64
      or silhouette_v1 ~ E'[\r\n]'
    )
  ),
  'every non-null silhouette is canonical unwrapped base64 for exactly 64 bytes'
);
select throws_ok(
  $$update public.midi_pattern_versions set silhouette_v1=repeat('A',88),silhouette_min_pitch=0,silhouette_max_pitch=127 where id='40120000-0000-4000-8000-000000000001'$$,
  '23514',null,'noncanonical silhouette padding is rejected'
);
select throws_ok(
  $$update public.midi_pattern_versions set silhouette_v1=null,silhouette_min_pitch=0,silhouette_max_pitch=127 where id='40120000-0000-4000-8000-000000000001'$$,
  '23514',null,'silhouette fields cannot mix null and non-null values'
);
select throws_ok(
  $$update public.midi_pattern_versions set silhouette_v1=repeat('A',86)||'==',silhouette_min_pitch=100,silhouette_max_pitch=99 where id='40120000-0000-4000-8000-000000000001'$$,
  '23514',null,'silhouette pitch bounds require minimum not above maximum'
);
select throws_ok(
  $$update public.midi_pattern_versions set silhouette_v1=repeat('A',86)||'==',silhouette_min_pitch=-1,silhouette_max_pitch=127 where id='40120000-0000-4000-8000-000000000001'$$,
  '23514',null,'silhouette pitch bounds remain inside the valid MIDI range'
);
select throws_ok(
  $$update public.midi_pattern_versions set duration_ticks=641 where id='40120000-0000-4000-8000-000000000002'$$,
  '55000','immutable_revision_history','musical pattern-version fields remain immutable'
);

insert into public.projects(id,owner_id,create_request_id,title,license_code)
values('40140000-0000-4000-8000-000000000001','40100000-0000-4000-8000-000000000001',
  '40141000-0000-4000-8000-000000000001','Silhouette project','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by)
values('40140000-0000-4000-8000-000000000001','40100000-0000-4000-8000-000000000001','owner','40100000-0000-4000-8000-000000000001');
insert into public.arrangement_versions(
  id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,
  manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks
) values(
  '40150000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001',
  '40100000-0000-4000-8000-000000000001','40151000-0000-4000-8000-000000000001',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('a',64),120,4,4,'c-major',480,640
);
insert into public.arrangement_tracks(
  arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed
) values(
  '40150000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001',
  '40152000-0000-4000-8000-000000000001',0,'Map track','warm-keys',1,0,0,false,false
);
insert into public.arrangement_clips(
  arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop
) values
  ('40150000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001','40152000-0000-4000-8000-000000000001','40153000-0000-4000-8000-000000000001','40120000-0000-4000-8000-000000000002',0,640,0,true),
  ('40150000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001','40152000-0000-4000-8000-000000000001','40153000-0000-4000-8000-000000000002','40120000-0000-4000-8000-000000000002',640,640,0,true),
  ('40150000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001','40152000-0000-4000-8000-000000000001','40153000-0000-4000-8000-000000000003','40120000-0000-4000-8000-000000000005',1280,640,0,false);
insert into public.project_revisions(
  id,project_id,revision_number,created_by,publish_request_id,message,manifest,manifest_version,
  engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id
) values(
  '40160000-0000-4000-8000-000000000001','40140000-0000-4000-8000-000000000001',1,
  '40100000-0000-4000-8000-000000000001','40161000-0000-4000-8000-000000000001','First map revision',
  '{}',3,'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('b',64),4000,
  '40150000-0000-4000-8000-000000000001'
);
update public.projects
set visibility='public',status='active',current_revision_id='40160000-0000-4000-8000-000000000001',
  published_at=now(),rights_attestation_version='cc-by-4.0-reuse-attestation-v1'
where id='40140000-0000-4000-8000-000000000001';

set local role anon;
select is(
  (select count(*) from public.get_public_project_silhouettes(
    '40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),
  2::bigint,
  'anonymous reads one row per distinct version despite repeated looped clips'
);
reset role;
set local role authenticated;
set local request.jwt.claim.sub='40100000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.get_public_project_silhouettes(
    '40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),
  2::bigint,
  'an unrelated authenticated actor receives the same actor-independent public data'
);
reset role;
select is(
  (select count(*) from public.get_public_project_silhouettes(
    '40140000-0000-4000-8000-000000000099','40160000-0000-4000-8000-000000000001')),
  0::bigint,
  'a mismatched project and revision returns zero rows'
);

-- Preserve a deliberately stale catalog row while proving current authority is rechecked.
set constraints all immediate;
alter table public.projects disable trigger projects_refresh_public_catalog;
alter table public.projects disable trigger projects_hidden_mutation;
alter table public.profiles disable trigger profiles_bump_public_discovery;

update public.projects set moderation_state='hidden' where id='40140000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'hidden project returns zero rows even with stale catalog membership');
update public.projects set moderation_state='visible',purged_at=now() where id='40140000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'purged project returns zero rows even with stale catalog membership');
update public.projects set purged_at=null,visibility='private' where id='40140000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'private or unlisted project returns zero rows even with stale catalog membership');
update public.projects
set status='draft',current_revision_id=null,published_at=null,rights_attestation_version=null
where id='40140000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'draft project returns zero rows even with stale catalog membership');
update public.projects
set visibility='public',status='active',current_revision_id='40160000-0000-4000-8000-000000000001',
  published_at=now(),rights_attestation_version='cc-by-4.0-reuse-attestation-v1'
where id='40140000-0000-4000-8000-000000000001';
update public.projects set visibility='private',status='deleted',deleted_at=now(),open_to_contributions=false where id='40140000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'deleted project returns zero rows even with stale catalog membership');
update public.projects set visibility='public',status='active',deleted_at=null where id='40140000-0000-4000-8000-000000000001';
update public.profiles set moderation_state='hidden' where id='40100000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'hidden ownership state cannot leak through stale catalog membership');
update public.profiles set moderation_state='visible' where id='40100000-0000-4000-8000-000000000001';
update public.profiles set status='suspended' where id='40100000-0000-4000-8000-000000000001';
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000001')),0::bigint,'suspended ownership state cannot leak through stale catalog membership');
update public.profiles set status='active' where id='40100000-0000-4000-8000-000000000001';

alter table public.profiles enable trigger profiles_bump_public_discovery;
alter table public.projects enable trigger projects_hidden_mutation;
alter table public.projects enable trigger projects_refresh_public_catalog;

-- A catalog-authorized revision with no clips is a safe empty response.
insert into public.arrangement_versions(
  id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,
  manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks
) values(
  '40150000-0000-4000-8000-000000000002','40140000-0000-4000-8000-000000000001',
  '40100000-0000-4000-8000-000000000001','40151000-0000-4000-8000-000000000002',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('c',64),120,4,4,'c-major',480,640
);
insert into public.project_revisions(
  id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,
  engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id
) values(
  '40160000-0000-4000-8000-000000000002','40140000-0000-4000-8000-000000000001',2,
  '40160000-0000-4000-8000-000000000001','40100000-0000-4000-8000-000000000001',
  '40161000-0000-4000-8000-000000000002','Empty map revision','{}',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('d',64),4000,
  '40150000-0000-4000-8000-000000000002'
);
select is((select count(*) from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000002')),0::bigint,'revision with no clips returns zero rows');

-- More than 64 distinct referenced versions is rejected rather than truncated.
create temp table proj01_limit_patterns as
select n,gen_random_uuid() pattern_id,gen_random_uuid() pattern_version_id
from generate_series(1,65) n;
insert into public.midi_patterns(id,owner_id,create_request_id,name)
select pattern_id,'40100000-0000-4000-8000-000000000001',gen_random_uuid(),'Limit pattern '||n
from proj01_limit_patterns;
insert into public.midi_pattern_versions(
  id,midi_pattern_id,version_number,create_request_id,creator_id,creator_credit_name,ppq,duration_ticks,note_count,content_sha256
)
select pattern_version_id,pattern_id,1,gen_random_uuid(),'40100000-0000-4000-8000-000000000001','Project Owner',480,640,0,repeat('e',64)
from proj01_limit_patterns;
insert into public.arrangement_versions(
  id,project_id,created_by,create_request_id,manifest_version,engine,engine_version,manifest,
  manifest_sha256,tempo_bpm,time_signature_numerator,time_signature_denominator,musical_key,ppq,duration_ticks
) values(
  '40150000-0000-4000-8000-000000000003','40140000-0000-4000-8000-000000000001',
  '40100000-0000-4000-8000-000000000001','40151000-0000-4000-8000-000000000003',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1','{}',repeat('f',64),120,4,4,'c-major',480,640
);
insert into public.arrangement_tracks(
  arrangement_version_id,project_id,track_id,sort_order,name,preset_id,preset_version,gain_db,pan,muted,soloed
) values(
  '40150000-0000-4000-8000-000000000003','40140000-0000-4000-8000-000000000001',
  '40152000-0000-4000-8000-000000000003',0,'Limit track','warm-keys',1,0,0,false,false
);
insert into public.arrangement_clips(
  arrangement_version_id,project_id,track_id,clip_id,midi_pattern_version_id,start_tick,duration_ticks,source_start_tick,loop
)
select '40150000-0000-4000-8000-000000000003','40140000-0000-4000-8000-000000000001',
  '40152000-0000-4000-8000-000000000003',gen_random_uuid(),pattern_version_id,(n-1)*10,10,0,false
from proj01_limit_patterns;
insert into public.project_revisions(
  id,project_id,revision_number,parent_revision_id,created_by,publish_request_id,message,manifest,manifest_version,
  engine,engine_version,manifest_sha256,duration_ms,arrangement_version_id
) values(
  '40160000-0000-4000-8000-000000000003','40140000-0000-4000-8000-000000000001',3,
  '40160000-0000-4000-8000-000000000002','40100000-0000-4000-8000-000000000001',
  '40161000-0000-4000-8000-000000000003','Bounded map revision','{}',3,
  'openmidi-midi','openmidi-midi-3_tone-15.1.22_presets-1',repeat('9',64),4000,
  '40150000-0000-4000-8000-000000000003'
);
select throws_ok(
  $$select * from public.get_public_project_silhouettes('40140000-0000-4000-8000-000000000001','40160000-0000-4000-8000-000000000003')$$,
  '22023','project_silhouette_limit','more than 64 distinct versions raises the public silhouette limit'
);

select * from finish();
rollback;
