begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_column('public','projects','source_project_id','projects record source project lineage');
select has_column('public','projects','source_revision_id','projects record exact source revision lineage');
select has_function('public','fork_project',array['uuid','uuid','uuid','text','text','text'],'fork command exists');
select has_index('public','projects','projects_source_children_idx','direct child lineage is indexed');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000001','authenticated','authenticated','fork-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000002','authenticated','authenticated','fork-member@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000003','authenticated','authenticated','fork-other@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000004','authenticated','authenticated','fork-suspended@example.test','','{}','{}',now(),now());
update public.profiles set username='ForkOwner',username_normalized='forkowner',display_name='Fork Owner',credit_name='Fork Owner',profile_completed_at=now() where id='f0000000-0000-4000-8000-000000000001';
update public.profiles set username='ForkMember',username_normalized='forkmember',display_name='Fork Member',credit_name='Fork Member',profile_completed_at=now() where id='f0000000-0000-4000-8000-000000000002';
update public.profiles set username='ForkOther',username_normalized='forkother',display_name='Fork Other',credit_name='Fork Other',profile_completed_at=now() where id='f0000000-0000-4000-8000-000000000003';
update public.profiles set username='ForkSuspended',username_normalized='forksuspended',display_name='Fork Suspended',credit_name='Fork Suspended',profile_completed_at=now(),status='suspended' where id='f0000000-0000-4000-8000-000000000004';

insert into public.projects(id,owner_id,create_request_id,title,description,bpm,musical_key,license_code)
values('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001','Fork source','Source description',120,'c-major','cc-by-4.0');
insert into public.project_members(project_id,user_id,role,created_by) values
('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','owner','f0000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002','viewer','f0000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000004','viewer','f0000000-0000-4000-8000-000000000001');
insert into public.project_genres(project_id,genre_id,is_primary)
values('f1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true);
insert into public.project_tags(project_id,tag_id)
values('f1000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
values('f2000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','ready','f0000000-0000-4000-8000-000000000001/f2000000-0000-4000-8000-000000000001/source','fork.wav',1000,'audio/wav',1000,repeat('f',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('f2000000-0000-4000-8000-000000000001',0,'f0000000-0000-4000-8000-000000000001','Fork Owner','creator');

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select public.confirm_source_asset_credits(
  'f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001',
  '[{"kind":"self","role":"creator"},{"kind":"external","role":"performer","creditName":"Guest Performer"}]'::jsonb
);
select public.publish_project_revision(
  'f1000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001',null,'Source revision',
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"f1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"f5000000-0000-4000-8000-000000000001","assetId":"f2000000-0000-4000-8000-000000000001","instrumentId":"30000000-0000-4000-8000-00000000000a","name":"Fork stem","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
);
reset role;

set local role anon;
select throws_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000099',
  'f6000000-0000-4000-8000-000000000001','cc-by-4.0','Fork target','Target description'
)$$,'42501','permission denied for function fork_project','anonymous actor cannot execute fork command');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000003';
select throws_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000099',
  'f6000000-0000-4000-8000-000000000002','cc-by-4.0','Fork target','Target description'
)$$,'PT404','fork_source_not_found','unrelated actor cannot enumerate the private source');

set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000004';
select throws_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where id='f1000000-0000-4000-8000-000000000001'),
  'f6000000-0000-4000-8000-000000000003','cc-by-4.0','Fork target','Target description'
)$$,'PT403','fork_actor_ineligible','suspended member cannot fork');
reset role;

update public.projects set license_code='all-rights-reserved'
where id='f1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select throws_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where id='f1000000-0000-4000-8000-000000000001'),
  'f6000000-0000-4000-8000-000000000004','all-rights-reserved','Fork target','Target description'
)$$,'PT409','fork_license_unavailable','non-derivative license blocks forking');
reset role;
update public.projects set license_code='cc-by-4.0',open_to_contributions=true
where id='f1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  (select current_revision_id from public.projects where id='f1000000-0000-4000-8000-000000000001'),
  'f6000000-0000-4000-8000-000000000010','cc-by-4.0','Fork target','Target description'
)$$,'authorized member forks regardless of contribution setting');
reset role;

select is((select count(*) from public.projects where owner_id='f0000000-0000-4000-8000-000000000002' and create_request_id='f6000000-0000-4000-8000-000000000010'),1::bigint,'fork creates one target project');
select ok((select status='active' and visibility='private'
  and not open_to_contributions and license_code='cc-by-4.0'
  and bpm=120 and musical_key='c-major' and lock_version=2
  from public.projects
  where owner_id='f0000000-0000-4000-8000-000000000002'
    and create_request_id='f6000000-0000-4000-8000-000000000010'),
  'target inherits conservative metadata defaults');
select is((select count(*) from public.project_members m join public.projects p on p.id=m.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and m.role='owner'),1::bigint,'target has one owner');
select is((select count(*) from public.project_members m join public.projects p on p.id=m.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and m.user_id='f0000000-0000-4000-8000-000000000001'),0::bigint,'source owner receives no target membership');
select is((select r.manifest->>'workspaceId' from public.project_revisions r join public.projects p on p.current_revision_id=r.id where p.create_request_id='f6000000-0000-4000-8000-000000000010'),(select id::text from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),'target manifest uses target project identity');
select ok((select tr.manifest-'workspaceId'=sr.manifest-'workspaceId' from public.projects tp join public.project_revisions tr on tr.id=tp.current_revision_id join public.project_revisions sr on sr.id=tp.source_revision_id where tp.create_request_id='f6000000-0000-4000-8000-000000000010'),'target manifest otherwise matches source');
select ok(not exists(
  (select id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by from public.revision_tracks where revision_id=(select current_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010')
   except
   select id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,added_by from public.revision_tracks where revision_id=(select source_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'))
),'target track projection preserves source arrangement and provenance');
select ok(not exists(
  (select track_id,asset_id,position,source_credit_position,user_id,credit_name,role from public.revision_track_credits where revision_id=(select current_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010')
   except
   select track_id,asset_id,position,source_credit_position,user_id,credit_name,role from public.revision_track_credits where revision_id=(select source_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'))
),'target musical credits preserve source snapshots');
select is((select ra.user_id from public.revision_attributions ra join public.projects p on p.current_revision_id=ra.revision_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and ra.kind='publisher'),'f0000000-0000-4000-8000-000000000002'::uuid,'forking actor is target publisher');
select is((select count(*) from public.revision_attributions ra join public.projects p on p.current_revision_id=ra.revision_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and ra.kind='accepted_contributor'),0::bigint,'source activity is not relabeled on target');
select is((select count(*) from public.assets where id='f2000000-0000-4000-8000-000000000001'),1::bigint,'fork creates no asset row');
select is((select count(*) from public.project_asset_references par join public.projects p on p.id=par.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010'),1::bigint,'target has its own asset reference');
select is((select source_bytes from public.project_storage_usage u join public.projects p on p.id=u.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010'),1000::bigint,'target usage projects referenced bytes');
select is((select source_bytes from public.project_storage_usage where project_id='f1000000-0000-4000-8000-000000000001'),1000::bigint,'source usage is unchanged');
select is((select count(*) from public.workspaces w join public.projects p on p.id=w.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010'),0::bigint,'fork creates no eager workspace');
select is((select count(*) from public.activity_events e join public.projects p on p.id=e.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and e.event_type='project_forked'),1::bigint,'fork records one bounded activity event');

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select lives_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  (select source_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),
  'f6000000-0000-4000-8000-000000000010','cc-by-4.0','Fork target','Target description'
)$$,'exact retry returns the existing target');
reset role;
select is((select count(*) from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),1::bigint,'exact retry creates no duplicate target');
select is((select count(*) from public.activity_events e join public.projects p on p.id=e.project_id where p.create_request_id='f6000000-0000-4000-8000-000000000010' and e.event_type='project_forked'),1::bigint,'exact retry creates no duplicate event');

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select throws_ok($$select public.fork_project(
  'f1000000-0000-4000-8000-000000000001',
  (select source_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),
  'f6000000-0000-4000-8000-000000000010','cc-by-4.0','Different title','Target description'
)$$,'PT409','fork_request_conflict','request id reuse with different input conflicts');
reset role;
select throws_ok($$update public.projects set source_project_id=id where create_request_id='f6000000-0000-4000-8000-000000000010'$$,'55000','immutable_project_fork_lineage','lineage cannot be redirected or made self-referential');

set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),0::bigint,'source owner cannot read another user private fork');
reset role;

delete from public.project_members where project_id='f1000000-0000-4000-8000-000000000001' and user_id='f0000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.projects where id='f1000000-0000-4000-8000-000000000001'),0::bigint,'source access removal hides the source');
select is((select count(*) from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010'),1::bigint,'target remains readable through target ownership');
select is((select count(*) from public.assets where id='f2000000-0000-4000-8000-000000000001'),1::bigint,'shared source asset remains readable through target revision');
select is((select count(*) from public.project_revisions where id=(select current_revision_id from public.projects where create_request_id='f6000000-0000-4000-8000-000000000010')),1::bigint,'target revision remains readable without source access');
reset role;

select * from finish();
rollback;
