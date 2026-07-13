begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('private', 'signup_invitations', 'private invitation table exists');
select has_function('private', 'hook_require_signup_invitation', array['jsonb'], 'signup hook exists');
select has_function('public', 'get_viewer_profile', array[]::text[], 'viewer command exists');
select has_function('public', 'save_own_profile', array['text','text','text','text'], 'profile command exists');

insert into private.signup_invitations (email_normalized, note)
values ('invited@example.test', 'must never appear in hook errors'),
       ('revoked@example.test', 'revoked test');
update private.signup_invitations set revoked_at = now() where email_normalized = 'revoked@example.test';

select is(private.hook_require_signup_invitation('{"user":{"email":" Invited@Example.Test "}}'), '{}'::jsonb, 'hook normalizes invited email');
select is(private.hook_require_signup_invitation('{"user":{"email":"unknown@example.test"}}')->'error'->>'http_code', '403', 'unknown email denied');
select is(private.hook_require_signup_invitation('{"user":{"email":"revoked@example.test"}}')->'error'->>'http_code', '403', 'revoked email denied');
select is(private.hook_require_signup_invitation('{"user":{}}')->'error'->>'http_code', '403', 'missing email denied');
select ok(private.hook_require_signup_invitation('{"user":{"email":"unknown@example.test"}}')::text !~ 'unknown|must never', 'denial is generic');

set local role anon;
select throws_ok($$select * from private.signup_invitations$$, '42501', null, 'anon cannot read invitations');
select throws_ok($$select private.hook_require_signup_invitation('{}')$$, '42501', null, 'anon cannot execute hook');
select throws_ok($$select * from public.get_viewer_profile()$$, '42501', null, 'anon cannot read viewer');
select throws_ok($$select * from public.save_own_profile('AnonOne','Anon','Anon',null)$$, '42501', null, 'anon cannot save profile');

reset role;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'suspended@example.test', '', '{}', '{}', now(), now());
update public.profiles set status = 'suspended' where id = '50000000-0000-0000-0000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
select results_eq(
  $$select username, display_name, credit_name, bio from public.save_own_profile('ArtistOne','Artist One','A. One','First bio')$$,
  $$values ('ArtistOne'::text,'Artist One'::text,'A. One'::text,'First bio'::text)$$,
  'active user completes profile atomically'
);
reset role;
select ok((select profile_completed_at is not null from public.profiles where id = '50000000-0000-0000-0000-000000000001'), 'completion timestamp set');
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
select lives_ok($$select * from public.save_own_profile('ArtistOne','Updated','Updated Credit',null)$$, 'same username edit succeeds');
reset role;
select is((select username from public.profiles where id = '50000000-0000-0000-0000-000000000001'), 'ArtistOne', 'edit preserves username casing');
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
select throws_ok($$select * from public.save_own_profile('Renamed','Updated','Updated Credit',null)$$, 'PT412', 'username_already_claimed', 'rename denied');
select results_eq($$select id, status from public.get_viewer_profile()$$, $$values ('50000000-0000-0000-0000-000000000001'::uuid, 'active'::public.account_status)$$, 'viewer command returns caller lifecycle only');

set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';
select throws_ok($$select * from public.save_own_profile('ArtistOne','Other','Other',null)$$, 'PT409', 'username_unavailable', 'collision is stable');
select throws_ok($$select * from public.save_own_profile('admin','Other','Other',null)$$, 'PT409', 'username_unavailable', 'reserved username is stable');
select throws_ok($$select * from public.save_own_profile('FreshName','','Other',null)$$, 'PT400', 'display_name_invalid', 'validation fails before mutation');
reset role;
select is((select username from public.profiles where id = '50000000-0000-0000-0000-000000000002'), null, 'failed validation leaves username unclaimed');

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000003';
select throws_ok($$select * from public.save_own_profile('SuspendedOne','Suspended','Suspended',null)$$, 'PT403', 'account_inactive', 'suspended user denied');

select * from finish();
rollback;
