begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(41);

select has_table('public','public_project_catalog','safe public catalog exists');
select has_table('public','discovery_state','discovery cache version exists');
select has_table('public','project_stats','internal discovery stats exist');
select has_function('public','set_project_visibility',array['uuid','integer','project_visibility'],'visibility command exists');
select has_function('public','get_project_revision_preview',array['uuid','uuid'],'preview authority exists');
select has_function('public','search_public_projects',array['text','text[]','text[]','text[]','text[]','numeric','numeric','boolean','text','numeric','timestamp with time zone','uuid','integer'],'bounded search command exists');
select has_function('public','get_public_project_lineage',array['uuid'],'safe lineage command exists');
select has_function('public','get_public_profile_history',array['uuid'],'safe public profile history command exists');
select has_function('private','refresh_all_project_stats',array[]::text[],'restricted stats repair command exists');
select has_index('public','public_project_catalog','public_project_catalog_search_idx','search vector is indexed');
select has_index('public','public_project_catalog','public_project_catalog_recent_idx','recent keyset order is indexed');
select has_index('public','public_project_catalog','public_project_catalog_trending_idx','trending keyset order is indexed');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000001','authenticated','authenticated','discovery-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000002','authenticated','authenticated','discovery-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000003','authenticated','authenticated','discovery-second@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0000000-0000-4000-8000-000000000004','authenticated','authenticated','discovery-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='DiscoveryOwner',username_normalized='discoveryowner',display_name='Discovery Owner',credit_name='Discovery Owner',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000001';
update public.profiles set username='DiscoveryOther',username_normalized='discoveryother',display_name='Discovery Other',credit_name='Discovery Other',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000002';
update public.profiles set username='DiscoverySecond',username_normalized='discoverysecond',display_name='Discovery Second',credit_name='Discovery Second',profile_completed_at=now() where id='d0000000-0000-4000-8000-000000000003';
update public.profiles set username='DiscoverySuspended',username_normalized='discoverysuspended',display_name='Discovery Suspended',credit_name='Discovery Suspended',profile_completed_at=now(),status='suspended' where id='d0000000-0000-4000-8000-000000000004';

insert into public.projects(id,owner_id,create_request_id,title,description,bpm,musical_key,license_code)
values('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001','Midnight Circuit','Warm electronic collaboration',124,'c-minor','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by)
values('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','owner','d0000000-0000-4000-8000-000000000001');
insert into public.project_genres(project_id,genre_id,is_primary)
values('d1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true);
insert into public.project_tags(project_id,tag_id)
values('d1000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
values('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','ready','d0000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000001/source','midnight.wav',1000,'audio/wav',1000,repeat('d',64),1000,48000,2,'test',now());
insert into storage.objects(id,bucket_id,name,owner_id)
values('d2100000-0000-4000-8000-000000000001','source-audio','d0000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000001/source','d0000000-0000-4000-8000-000000000001');
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('d2000000-0000-4000-8000-000000000001',0,'d0000000-0000-4000-8000-000000000001','Discovery Owner','creator');

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
select public.confirm_source_asset_credits(
  'd2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',
  '[{"kind":"self","role":"creator"}]'::jsonb
);
select public.publish_project_revision(
  'd1000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',null,'First public arrangement',
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"d1000000-0000-4000-8000-000000000001","tempoBpm":124,"tracks":[{"trackId":"d5000000-0000-4000-8000-000000000001","assetId":"d2000000-0000-4000-8000-000000000001","instrumentId":"30000000-0000-4000-8000-00000000000a","name":"Analog pulse","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
);
select lives_ok(format('select public.set_project_visibility(%L,%s,%L)',
  'd1000000-0000-4000-8000-000000000001',
  (select lock_version from public.projects where id='d1000000-0000-4000-8000-000000000001'),
  'public'),'owner can publish project visibility');
select public.set_project_contributions_open(
  'd1000000-0000-4000-8000-000000000001',
  (select lock_version from public.projects where id='d1000000-0000-4000-8000-000000000001'),true
);
reset role;

select is((select count(*) from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001'),1::bigint,'public transition creates one catalog row');
select ok((select tracks->0->>'name'='Analog pulse' and tracks->0 ? 'credits'
  and not (tracks->0 ? 'assetId') from public.public_project_catalog
  where project_id='d1000000-0000-4000-8000-000000000001'),'catalog track summary contains presentation data but no asset id');
select ok((select discovery_version > 1 and trending_score > 0
  from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001'),'catalog carries cache version and deterministic score');

set local role anon;
set local request.jwt.claim.sub='';
select is((select count(*) from public.public_project_catalog),1::bigint,'anonymous visitor reads only public catalog rows');
select lives_ok($$select public.get_project_revision_preview(
  'd1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001')
)$$,'anonymous visitor can request the current public preview');
select is((select count(*) from storage.objects where bucket_id='source-audio'),1::bigint,'anonymous visitor can read the referenced public source object');
select is((select count(*) from public.search_public_projects('midnight',array['electronic'],array['remix-friendly'],array['synthesizer'],array['c-minor'],120,130,true,'recent',null,null,null,25)),1::bigint,'combined indexed filters find the eligible project');
select is((select count(*) from public.search_public_projects('midnight',array['rock'],array[]::text[],array[]::text[],array[]::text[],null,null,null,'recent',null,null,null,25)),0::bigint,'mismatched filter excludes the project');
select throws_ok($$select count(*) from public.projects$$,'42501','permission denied for table projects','anonymous visitor cannot read authoritative projects');
select throws_ok($$select count(*) from public.project_stats$$,'42501','permission denied for table project_stats','anonymous visitor cannot read internal ranking inputs');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.get_project_revision_preview(
  'd1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001')
)$$,'active nonmember can request the current public preview');
select throws_ok(format('select public.set_project_visibility(%L,%s,%L)',
  'd1000000-0000-4000-8000-000000000001',
  1,
  'private'),'PT404','visibility_project_not_found','unrelated actor cannot change visibility');
select lives_ok($$select public.fork_project(
  'd1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001'),
  'd6000000-0000-4000-8000-000000000001','cc-by-4.0','Midnight Rework','A new direction'
)$$,'active nonmember can fork a public derivative-permitted project');
reset role;

select is((select count(*) from public.project_members where project_id='d1000000-0000-4000-8000-000000000001' and user_id='d0000000-0000-4000-8000-000000000002'),0::bigint,'public fork does not grant source membership');
select ok((select visibility='private' and status='active' from public.projects
  where owner_id='d0000000-0000-4000-8000-000000000002' and create_request_id='d6000000-0000-4000-8000-000000000001'),'new fork remains private');

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
select public.set_project_contributions_open(
  'd1000000-0000-4000-8000-000000000001',
  (select lock_version from public.projects where id='d1000000-0000-4000-8000-000000000001'),true
);
reset role;
set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000003';
select lives_ok($$select public.create_contribution_workspace(
  'd1000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001'),
  'A brighter chorus','Contribution draft'
)$$,'active nonmember can start a private contribution to an open public project');
select is((select count(*) from public.assets where id='d2000000-0000-4000-8000-000000000001'),1::bigint,'contributor can read source asset through own active workspace');
reset role;
select is((select count(*) from public.project_members where project_id='d1000000-0000-4000-8000-000000000001' and user_id='d0000000-0000-4000-8000-000000000003'),0::bigint,'public contribution does not grant project membership');

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000001';
select public.set_project_visibility(
  'd1000000-0000-4000-8000-000000000001',
  (select lock_version from public.projects where id='d1000000-0000-4000-8000-000000000001'),'private'
);
select lives_ok($$select public.get_project_revision_preview(
  'd1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where id='d1000000-0000-4000-8000-000000000001')
)$$,'owner retains preview access after making the project private');
reset role;
select is((select count(*) from public.public_project_catalog where project_id='d1000000-0000-4000-8000-000000000001'),0::bigint,'private transition removes catalog row transactionally');
set local role anon;
set local request.jwt.claim.sub='';
select throws_ok($$select public.get_project_revision_preview(
  'd1000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001'
)$$,'PT404','preview_not_found','anonymous visitor cannot preview a private project');
select is((select count(*) from storage.objects where bucket_id='source-audio'),0::bigint,'anonymous visitor loses private source object access');
set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.assets where id='d2000000-0000-4000-8000-000000000001'),1::bigint,'existing contributor retains exact workspace source access after private transition');
select is((public.get_contribution_project_context(
  (select id from public.contributions where author_id='d0000000-0000-4000-8000-000000000003')
)->>'title'),'Midnight Circuit','contributor retains safe project context after private transition');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select throws_ok($$select public.get_project_revision_preview(
  'd1000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001'
)$$,'PT404','preview_not_found','unrelated actor cannot preview a private project');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000004';
select throws_ok($$select public.fork_project(
  'd1000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000004','cc-by-4.0','No fork','Suspended'
)$$,'PT403','fork_actor_ineligible','suspended actor cannot fork public or private content');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='d0000000-0000-4000-8000-000000000002';
select public.set_project_visibility(
  (select id from public.projects where owner_id='d0000000-0000-4000-8000-000000000002' and create_request_id='d6000000-0000-4000-8000-000000000001'),
  (select lock_version from public.projects where owner_id='d0000000-0000-4000-8000-000000000002' and create_request_id='d6000000-0000-4000-8000-000000000001'),'public'
);
reset role;
set local role anon;
set local request.jwt.claim.sub='';
select ok((public.get_public_project_lineage((select project_id from public.public_project_catalog where owner_id='d0000000-0000-4000-8000-000000000002'))->>'sourceUnavailable')::boolean,'public child reports unavailable private source');
select is((public.get_public_project_lineage(
  (select project_id from public.public_project_catalog where owner_id='d0000000-0000-4000-8000-000000000002')
)->'source')::text,'null','private source id and title are not returned');
reset role;

select * from finish();
rollback;
