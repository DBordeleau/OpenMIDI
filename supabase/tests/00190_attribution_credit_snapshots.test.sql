begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public','revision_track_credits','revision track credit snapshots exist');
select has_table('public','revision_attributions','revision attribution snapshots exist');
select has_column('public','assets','credits_confirmed_at','assets record credit confirmation');
select has_function('public','confirm_source_asset_credits',array['uuid','uuid','jsonb'],'credit confirmation command exists');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000001','authenticated','authenticated','credit-owner@example.test','','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e0000000-0000-4000-8000-000000000002','authenticated','authenticated','credit-other@example.test','','{}','{}',now(),now());
update public.profiles set username='CreditOwner',username_normalized='creditowner',display_name='Credit Owner',credit_name='Original Credit',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000001';
update public.profiles set username='CreditOther',username_normalized='creditother',display_name='Other',credit_name='Other',profile_completed_at=now() where id='e0000000-0000-4000-8000-000000000002';

insert into public.projects(id,owner_id,create_request_id,title,bpm,license_code)
values('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000011','Credit project',120,'all-rights-reserved');
insert into public.project_members(project_id,user_id,role,created_by)
values('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','owner','e0000000-0000-4000-8000-000000000001');
insert into public.assets(id,owner_id,status,object_path,original_filename,reserved_byte_size,media_type,byte_size,sha256,duration_ms,sample_rate_hz,channels,verification_version,ready_at)
values('e2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','ready','e0000000-0000-4000-8000-000000000001/e2000000-0000-4000-8000-000000000001/source','credit.wav',1000,'audio/wav',1000,repeat('a',64),1000,48000,2,'test',now());
insert into public.asset_credits(asset_id,position,user_id,credit_name,role)
values('e2000000-0000-4000-8000-000000000001',0,'e0000000-0000-4000-8000-000000000001','Original Credit','creator');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.confirm_source_asset_credits(
  'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
  '[{"kind":"self","role":"creator"},{"kind":"external","role":"performer","creditName":"Guest Player"}]'::jsonb
)$$,'owner confirms ordered self and external credits');
reset role;
select is((select count(*) from public.asset_credits where asset_id='e2000000-0000-4000-8000-000000000001'),2::bigint,'confirmation replaces complete credit set');
select is((select credit_name from public.asset_credits where asset_id='e2000000-0000-4000-8000-000000000001' and position=1),'Guest Player','external name is retained');
select is((select credit_name from public.asset_credits where asset_id='e2000000-0000-4000-8000-000000000001' and position=0),'Original Credit','self name is database-derived');
select isnt((select credits_confirmed_at from public.assets where id='e2000000-0000-4000-8000-000000000001'),null::timestamptz,'asset is confirmed');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select lives_ok($$select public.confirm_source_asset_credits(
  'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
  '[{"kind":"self","role":"creator"},{"kind":"external","role":"performer","creditName":"Guest Player"}]'::jsonb
)$$,'exact confirmation retry is idempotent');
select throws_ok($$select public.confirm_source_asset_credits(
  'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002',
  '[{"kind":"self","role":"creator"}]'::jsonb
)$$,'PT409','asset_credits_already_confirmed','different confirmation conflicts');
select lives_ok($$select public.publish_project_revision(
  'e1000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001',null,'Credits',
  '{"manifestVersion":1,"engine":"waveform-playlist","engineVersion":"browser-15.3.4_playout-12.5.4_tone-15.1.22","workspaceId":"e1000000-0000-4000-8000-000000000001","tempoBpm":120,"tracks":[{"trackId":"e5000000-0000-4000-8000-000000000001","assetId":"e2000000-0000-4000-8000-000000000001","instrumentId":null,"name":"Credited stem","positionMs":0,"trimStartMs":0,"durationMs":1000,"gainDb":0,"pan":0,"muted":false,"soloed":false,"sortOrder":0}]}'::jsonb
)$$,'publish snapshots confirmed credits');
reset role;
select is((select count(*) from public.revision_track_credits),2::bigint,'all ordered credits are snapshotted');
select is((select credit_name from public.revision_attributions where kind='publisher'),'Original Credit','publisher credit is snapshotted');
update public.profiles set credit_name='Renamed Credit' where id='e0000000-0000-4000-8000-000000000001';
select is((select credit_name from public.revision_track_credits where position=0),'Original Credit','profile rename does not rewrite musical snapshot');

set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.revision_track_credits),0::bigint,'unrelated user cannot read private snapshots');
reset role;
select throws_ok($$update public.revision_track_credits set credit_name='Changed'$$,'55000','immutable_revision_history','revision credits are immutable');

select * from finish();
rollback;
