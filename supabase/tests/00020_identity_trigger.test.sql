begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'metadata@example.test', '',
  '{"provider":"google","role":"admin"}',
  '{"username":"root","display_name":"Injected","credit_name":"Injected"}',
  now(), now()
);

select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'auth trigger creates exactly one profile');
select is((select status::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 'active', 'new profile is active');
select is((select username from public.profiles where id = '10000000-0000-0000-0000-000000000001'), null, 'provider username is ignored');
select is((select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'), null, 'provider display name is ignored');
select is((select credit_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'), null, 'provider credit name is ignored');
select is((select profile_completed_at from public.profiles where id = '10000000-0000-0000-0000-000000000001'), null, 'new profile is incomplete');
select ok((select created_at is not null and updated_at is not null from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 'profile timestamps default');
select throws_ok(
  $$insert into public.profiles (id) values ('10000000-0000-0000-0000-000000000001')$$,
  '23505',
  'duplicate key value violates unique constraint "profiles_pkey"',
  'duplicate profile integrity is not hidden'
);
select throws_ok(
  $$delete from auth.users where id = '10000000-0000-0000-0000-000000000001'$$,
  '23503',
  'update or delete on table "users" violates foreign key constraint "profiles_id_fkey" on table "profiles"',
  'auth deletion is restricted while profile exists'
);

select lives_ok(
  $$update public.profiles set bio = 'short bio' where id = '10000000-0000-0000-0000-000000000001'$$,
  'valid profile update succeeds for privileged maintenance'
);
select ok((select updated_at >= created_at from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 'updated-at trigger preserves timestamp order');
select throws_ok(
  $$update public.profiles set username = 'Valid_Name', username_normalized = null where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'paired username nullability is enforced'
);
select throws_ok(
  $$update public.profiles set profile_completed_at = now() where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'incomplete identity cannot be marked completed'
);

select * from finish();
rollback;
