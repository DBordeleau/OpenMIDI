begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000001','authenticated','authenticated','avatar-a@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000002','authenticated','authenticated','avatar-b@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000003','authenticated','authenticated','avatar-incomplete@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000004','authenticated','authenticated','avatar-suspended@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000005','authenticated','authenticated','avatar-deleted@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000006','authenticated','authenticated','avatar-hidden@example.test','','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','39000000-0000-4000-8000-000000000007','authenticated','authenticated','avatar-admin@example.test','','{}','{}',now(),now());

update public.profiles set username='AvatarA',username_normalized='avatara',display_name='Avatar A',credit_name='Avatar A',profile_completed_at=now() where id='39000000-0000-4000-8000-000000000001';
update public.profiles set username='AvatarB',username_normalized='avatarb',display_name='Avatar B',credit_name='Avatar B',profile_completed_at=now() where id='39000000-0000-4000-8000-000000000002';
update public.profiles set username='AvatarSuspended',username_normalized='avatarsuspended',display_name='Avatar Suspended',credit_name='Avatar Suspended',profile_completed_at=now(),status='suspended' where id='39000000-0000-4000-8000-000000000004';
update public.profiles set username='AvatarDeleted',username_normalized='avatardeleted',display_name='Avatar Deleted',credit_name='Avatar Deleted',profile_completed_at=now(),status='deleted' where id='39000000-0000-4000-8000-000000000005';
update public.profiles set username='AvatarHidden',username_normalized='avatarhidden',display_name='Avatar Hidden',credit_name='Avatar Hidden',profile_completed_at=now(),moderation_state='hidden' where id='39000000-0000-4000-8000-000000000006';
update public.profiles set username='AvatarAdmin',username_normalized='avataradmin',display_name='Avatar Admin',credit_name='Avatar Admin',profile_completed_at=now() where id='39000000-0000-4000-8000-000000000007';
insert into private.app_admins(user_id,created_by) values('39000000-0000-4000-8000-000000000007','39000000-0000-4000-8000-000000000007');

create temp table avatar_test_options(value jsonb);
insert into avatar_test_options values ('{"eyebrowsVariant":"variant01","eyesVariant":"variant01","glassesVariant":"variant01","glassesProbability":0,"mouthVariant":"variant01","backgroundColor":"f2d3b1","scale":1,"rotate":0}'::jsonb);
grant select on avatar_test_options to authenticated;

select has_column('public','profiles','avatar_config','profile stores generated avatar config');
select has_column('public','profiles','avatar_config_revision','profile stores avatar concurrency revision');
select is((select count(*) from public.profiles where avatar_config is not null),0::bigint,'migration leaves every existing config null');
select hasnt_column('public','profiles','avatar_path','legacy avatar path is retired after contraction');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'),'OpenMIDI exposes no Storage object policy');
select hasnt_function('public','reserve_profile_image_upload',array['uuid','integer','text','text'],'upload RPC is retired after contraction');
select throws_ok($$update public.profiles set avatar_config=jsonb_build_object('version',2,'seed',id::text,'options',(select value from avatar_test_options)) where id='39000000-0000-4000-8000-000000000001'$$,'23514',null,'database constraint rejects unsupported config version');
select throws_ok($$update public.profiles set avatar_config=jsonb_build_object('version',1,'seed','39000000-0000-4000-8000-000000000099','options',(select value from avatar_test_options)) where id='39000000-0000-4000-8000-000000000001'$$,'23514',null,'database constraint rejects a seed that differs from profile UUID');
select throws_ok($$update public.profiles set avatar_config=jsonb_build_object('version',1,'seed',id::text,'options','{}'::jsonb) where id='39000000-0000-4000-8000-000000000001'$$,'23514',null,'database constraint rejects a full wrapper with empty options');
select is(private.is_valid_avatar_config(jsonb_build_object('version',1,'seed','39000000-0000-4000-8000-000000000001','options','{}'::jsonb)),false,'private validator returns false rather than null for empty options');

set local role anon;
select throws_ok($$select * from public.save_own_avatar_config('{}'::jsonb,0)$$,'42501','permission denied for function save_own_avatar_config','anonymous cannot save avatar config');
select throws_ok($$select public.get_admin_retention_summary()$$,'42501','permission denied for function get_admin_retention_summary','anonymous cannot inspect retention operations');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.save_own_avatar_config('{}'::jsonb,0)$$,'PT400','avatar_config_invalid','owner save rejects empty options');
select is((select avatar_config_revision from public.save_own_avatar_config((select value from avatar_test_options),0)),1,'owner saves valid options and increments revision');
select is((select avatar_config->>'seed' from public.profiles where id='39000000-0000-4000-8000-000000000001'),'39000000-0000-4000-8000-000000000001','save derives seed from authenticated profile UUID');
select is((select avatar_config->>'seed' from public.get_viewer_profile()),'39000000-0000-4000-8000-000000000001','viewer command returns generated avatar config without a second query');
select is((select avatar_config_revision from public.get_viewer_profile()),1,'viewer command returns private avatar revision');
select throws_ok($$update public.profiles set avatar_config=null where id='39000000-0000-4000-8000-000000000001'$$,'42501',null,'direct avatar config update remains denied');
select throws_ok($$select * from public.save_own_avatar_config((select value from avatar_test_options),0)$$,'PT409','avatar_config_stale','stale save revision is rejected');
select throws_ok($$select * from public.reset_own_avatar_config(0)$$,'PT409','avatar_config_stale','stale reset revision is rejected');
select throws_ok($$select * from public.save_own_avatar_config((select value||'{"extra":true}'::jsonb from avatar_test_options),1)$$,'PT400','avatar_config_invalid','unknown option key is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{eyebrowsVariant}','"variant16"'),1)$$,'PT400','avatar_config_invalid','unsupported eyebrow variant is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{eyesVariant}','"variant27"'),1)$$,'PT400','avatar_config_invalid','unsupported eye variant is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{glassesProbability}','50'),1)$$,'PT400','avatar_config_invalid','unsupported glasses probability is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{mouthVariant}','"variant31"'),1)$$,'PT400','avatar_config_invalid','unsupported mouth variant is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{backgroundColor}','"F2D3B1"'),1)$$,'PT400','avatar_config_invalid','noncanonical color is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{scale}','0.81'),1)$$,'PT400','avatar_config_invalid','off-step scale is rejected');
select throws_ok($$select * from public.save_own_avatar_config(jsonb_set((select value from avatar_test_options),'{rotate}','21'),1)$$,'PT400','avatar_config_invalid','out-of-range rotation is rejected');

set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000002';
select is((select avatar_config_revision from public.save_own_avatar_config((select value from avatar_test_options),0)),1,'unrelated actor can mutate only their own avatar');
reset role;
select is((select avatar_config_revision from public.profiles where id='39000000-0000-4000-8000-000000000001'),1,'unrelated save does not change first owner');
set local role authenticated;
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000003';
select throws_ok($$select * from public.save_own_avatar_config((select value from avatar_test_options),0)$$,'PT403','avatar_config_forbidden','incomplete profile cannot save');
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000004';
select throws_ok($$select * from public.save_own_avatar_config((select value from avatar_test_options),0)$$,'PT403','avatar_config_forbidden','suspended profile cannot save');
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000005';
select throws_ok($$select * from public.reset_own_avatar_config(0)$$,'PT403','avatar_config_forbidden','deleted profile cannot reset');
reset role;

update public.profiles set avatar_config=jsonb_build_object('version',1,'seed',id::text,'options',(select value from avatar_test_options)) where id='39000000-0000-4000-8000-000000000006';
set local role anon;
select ok((select avatar_config is not null from public.public_profiles where id='39000000-0000-4000-8000-000000000001'),'anonymous public projection exposes config for visible completed profile');
select ok(not exists(select 1 from public.public_profiles where id in ('39000000-0000-4000-8000-000000000003','39000000-0000-4000-8000-000000000004','39000000-0000-4000-8000-000000000005','39000000-0000-4000-8000-000000000006')),'config does not expose incomplete hidden suspended or deleted profiles');
reset role;

set local role authenticated;
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000007';
select is(jsonb_typeof(public.get_admin_retention_summary()),'object','active administrator receives non-Storage retention summary');
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000001';
select throws_ok($$select public.get_admin_retention_summary()$$,'PT404','admin_not_found','ordinary user cannot inspect retention summary');
select is((select avatar_config from public.reset_own_avatar_config(1)),null::jsonb,'reset restores initials with null config');
reset role;
select is((select avatar_config_revision from public.profiles where id='39000000-0000-4000-8000-000000000001'),2,'reset increments the owner revision');

set local role authenticated;
set local request.jwt.claim.sub='39000000-0000-4000-8000-000000000002';
select lives_ok($$select public.request_account_deletion('39000000-0000-4000-8000-000000000099','AvatarB')$$,'account deletion remains compatible with generated config');
reset role;
select is((select avatar_config from public.profiles where id='39000000-0000-4000-8000-000000000002'),null::jsonb,'account deletion clears generated avatar config');

select * from finish();
rollback;
