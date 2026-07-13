begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'one@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'two@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'suspended@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'deleted@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'missing@example.test', '', '{}', '{}', now(), now());

update public.profiles set status = 'suspended' where id = '20000000-0000-0000-0000-000000000003';
update public.profiles set status = 'deleted' where id = '20000000-0000-0000-0000-000000000004';
delete from public.profiles where id = '20000000-0000-0000-0000-000000000005';

set local role anon;
select throws_ok($$select * from public.claim_username('AnonName')$$, '42501', null, 'anon has no execute grant');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
select is((select auth.uid()), '20000000-0000-0000-0000-000000000001'::uuid, 'test JWT selects the expected actor');
select results_eq($$select * from public.claim_username('MixedCase')$$, $$values ('MixedCase'::text, 'mixedcase'::text)$$, 'valid mixed-case username is claimed');
select results_eq($$select * from public.claim_username('mixedcase')$$, $$values ('MixedCase'::text, 'mixedcase'::text)$$, 'same normalized claim is idempotent and preserves casing');
select throws_ok($$select * from public.claim_username('Different')$$, 'PT412', 'username_already_claimed', 'rename is deferred');
select throws_ok($$select * from public.claim_username(' admin')$$, 'PT400', 'username_invalid', 'leading whitespace is invalid');
select throws_ok($$select * from public.claim_username('@name')$$, 'PT400', 'username_invalid', 'at sign is invalid');
select throws_ok($$select * from public.claim_username('a-b')$$, 'PT400', 'username_invalid', 'punctuation is invalid');
select throws_ok($$select * from public.claim_username('ab')$$, 'PT400', 'username_invalid', 'too-short username is invalid');
select throws_ok($$select * from public.claim_username('Ｎame')$$, 'PT400', 'username_invalid', 'Unicode lookalike is invalid');

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select throws_ok($$select * from public.claim_username('MIXEDCASE')$$, 'PT409', 'username_unavailable', 'case-insensitive collision is unavailable');
select throws_ok($$select * from public.claim_username('admin')$$, 'PT409', 'username_unavailable', 'reserved name is unavailable without revealing why');

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
select throws_ok($$select * from public.claim_username('SuspendedOne')$$, 'PT403', 'account_inactive', 'suspended account cannot claim');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000004';
select throws_ok($$select * from public.claim_username('DeletedOne')$$, 'PT403', 'account_inactive', 'deleted account cannot claim');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000005';
select throws_ok($$select * from public.claim_username('MissingOne')$$, 'PT500', 'profile_missing', 'missing profile is an integrity error');

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select throws_ok($$update public.profiles set username = 'Bypass', username_normalized = 'bypass' where id = '20000000-0000-0000-0000-000000000002'$$, '42501', null, 'direct self update is denied');
reset role;
select is((select count(*) from public.profiles where username_normalized = 'mixedcase'), 1::bigint, 'unique normalized owner remains singular');
select is((select pronargs from pg_proc where oid = 'public.claim_username(text)'::regprocedure), 1::smallint, 'claim command accepts no caller-selected user id');
select is((select username_normalized from public.profiles where id = '20000000-0000-0000-0000-000000000001'), 'mixedcase', 'claim updates only caller profile');

select * from finish();
rollback;
