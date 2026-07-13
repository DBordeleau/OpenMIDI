begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'a@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'b@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'incomplete@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'suspended@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'deleted@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'admin@example.test', '', '{}', '{}', now(), now());

update public.profiles set username = 'ActiveA', username_normalized = 'activea', display_name = 'Active A', credit_name = 'Active A', profile_completed_at = now() where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set username = 'ActiveB', username_normalized = 'activeb', display_name = 'Active B', credit_name = 'Active B', profile_completed_at = now() where id = '30000000-0000-0000-0000-000000000002';
update public.profiles set username = 'SuspendMe', username_normalized = 'suspendme', display_name = 'Suspended', credit_name = 'Suspended', profile_completed_at = now(), status = 'suspended' where id = '30000000-0000-0000-0000-000000000004';
update public.profiles set username = 'DeleteMe', username_normalized = 'deleteme', display_name = 'Deleted', credit_name = 'Deleted', profile_completed_at = now(), status = 'deleted' where id = '30000000-0000-0000-0000-000000000005';
insert into private.app_admins (user_id) values ('30000000-0000-0000-0000-000000000006');

set local role anon;
select results_eq($$select id from public.public_profiles order by id$$, $$values ('30000000-0000-0000-0000-000000000001'::uuid), ('30000000-0000-0000-0000-000000000002'::uuid)$$, 'anon sees only completed active profiles');
select throws_ok($$select status from public.profiles$$, '42501', null, 'anon cannot select lifecycle status');
select throws_ok($$select reason from public.reserved_usernames$$, '42501', null, 'anon cannot read reservation reasons');
select throws_ok($$select private.is_admin()$$, '42501', null, 'anon cannot execute admin helper');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select results_eq($$select id from public.public_profiles order by id$$, $$values ('30000000-0000-0000-0000-000000000001'::uuid), ('30000000-0000-0000-0000-000000000002'::uuid), ('30000000-0000-0000-0000-000000000003'::uuid)$$, 'incomplete user sees public rows plus own safe row');
select is(private.is_admin(), false, 'normal user is not an administrator');
select throws_ok($$select last_active_at from public.profiles$$, '42501', null, 'authenticated user cannot select operational activity');
select throws_ok($$select * from public.reserved_usernames$$, '42501', null, 'authenticated user cannot read reserved names');
select throws_ok($$select * from private.app_admins$$, '42501', null, 'authenticated user cannot read administrator mapping');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';
select ok(exists(select 1 from public.public_profiles where id = '30000000-0000-0000-0000-000000000004'), 'suspended user sees own safe projection');
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select ok(not exists(select 1 from public.public_profiles where id = '30000000-0000-0000-0000-000000000004'), 'other users cannot see suspended profile');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000005';
select ok(exists(select 1 from public.public_profiles where id = '30000000-0000-0000-0000-000000000005'), 'deleted user sees own safe projection for recovery');
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select ok(not exists(select 1 from public.public_profiles where id = '30000000-0000-0000-0000-000000000005'), 'other users cannot see deleted profile');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000006';
select is(private.is_admin(), true, 'administrator helper sees caller membership');
select ok(not exists(select 1 from public.public_profiles where id = '30000000-0000-0000-0000-000000000004'), 'administrator membership grants no profile RLS bypass');
select is((select pronargs from pg_proc where oid = 'private.is_admin()'::regprocedure), 0::smallint, 'admin helper cannot probe an arbitrary user id');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select is(private.is_admin(), false, 'admin helper returns false without an authenticated claim');

select * from finish();
rollback;
