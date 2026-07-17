begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_function(
  'public',
  'activate_signup_invitation',
  array['text'],
  'signup invitation activation command exists'
);
select ok(
  not has_function_privilege('public', 'public.activate_signup_invitation(text)', 'execute'),
  'PUBLIC cannot execute invitation activation'
);
select ok(
  not has_function_privilege('anon', 'public.activate_signup_invitation(text)', 'execute'),
  'anonymous callers cannot execute invitation activation'
);
select ok(
  has_function_privilege('authenticated', 'public.activate_signup_invitation(text)', 'execute'),
  'authenticated callers receive only the narrow command grant'
);
select ok(
  not has_table_privilege('authenticated', 'private.signup_invitations', 'select'),
  'authenticated callers cannot read invitation rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.signup_invitations', 'insert'),
  'authenticated callers cannot insert invitation rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.signup_invitations', 'update'),
  'authenticated callers cannot update invitation rows directly'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'member@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'suspended-admin@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'deleted-admin@example.test', '', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'incomplete-admin@example.test', '', '{}', '{}', now(), now());

update public.profiles
set username = 'InviteMember', username_normalized = 'invitemember',
    display_name = 'Invite Member', credit_name = 'Invite Member',
    profile_completed_at = statement_timestamp(), status = 'active'
where id = 'fa000000-0000-4000-8000-000000000001';
update public.profiles
set username = 'InviteAdmin', username_normalized = 'inviteadmin',
    display_name = 'Invite Admin', credit_name = 'Invite Admin',
    profile_completed_at = statement_timestamp(), status = 'active'
where id = 'fa000000-0000-4000-8000-000000000002';
update public.profiles
set username = 'SuspendedInviteAdmin', username_normalized = 'suspendedinviteadmin',
    display_name = 'Suspended Invite Admin', credit_name = 'Suspended Invite Admin',
    profile_completed_at = statement_timestamp(), status = 'suspended'
where id = 'fa000000-0000-4000-8000-000000000003';
update public.profiles
set username = 'DeletedInviteAdmin', username_normalized = 'deletedinviteadmin',
    display_name = 'Deleted Invite Admin', credit_name = 'Deleted Invite Admin',
    profile_completed_at = statement_timestamp(), status = 'deleted'
where id = 'fa000000-0000-4000-8000-000000000004';

insert into private.app_admins (user_id, created_by) values
  ('fa000000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000002'),
  ('fa000000-0000-4000-8000-000000000003', 'fa000000-0000-4000-8000-000000000002'),
  ('fa000000-0000-4000-8000-000000000004', 'fa000000-0000-4000-8000-000000000002'),
  ('fa000000-0000-4000-8000-000000000005', 'fa000000-0000-4000-8000-000000000002');

set local role anon;
select throws_ok(
  $$select public.activate_signup_invitation('anon@example.test')$$,
  '42501',
  'permission denied for function activate_signup_invitation',
  'anonymous execution is denied by the grant'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000001';
select is(public.assert_viewer_admin(), false, 'normal active member gets a false display probe');
select throws_ok(
  $$select public.activate_signup_invitation('denied@example.test')$$,
  'PT404',
  'admin_not_found',
  'normal member is denied by the administrator mutation guard'
);
reset role;
select is(
  (select count(*) from private.signup_invitations where email_normalized = 'denied@example.test'),
  0::bigint,
  'denied command creates no invitation'
);

set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000003';
select is(public.assert_viewer_admin(), false, 'suspended administrator gets a false display probe');
select throws_ok(
  $$select public.activate_signup_invitation('suspended-denied@example.test')$$,
  'PT404', 'admin_not_found', 'suspended administrator cannot activate invitations'
);
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000004';
select is(public.assert_viewer_admin(), false, 'deleted administrator gets a false display probe');
select throws_ok(
  $$select public.activate_signup_invitation('deleted-denied@example.test')$$,
  'PT404', 'admin_not_found', 'deleted administrator cannot activate invitations'
);
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000005';
select is(public.assert_viewer_admin(), false, 'incomplete administrator gets a false display probe');
select throws_ok(
  $$select public.activate_signup_invitation('incomplete-denied@example.test')$$,
  'PT404', 'admin_not_found', 'incomplete administrator cannot activate invitations'
);

set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000002';
select ok(public.assert_viewer_admin(), 'active completed administrator gets a true display probe');
select is(
  public.activate_signup_invitation('  Collaborator@Example.Test  '),
  '{"email": "collaborator@example.test", "status": "activated"}'::jsonb,
  'administrator activates a normalized address'
);
reset role;
select is(
  (select email_normalized from private.signup_invitations where email_normalized = 'collaborator@example.test'),
  'collaborator@example.test',
  'stored invitation email is normalized'
);
select is(
  (select created_by from private.signup_invitations where email_normalized = 'collaborator@example.test'),
  'fa000000-0000-4000-8000-000000000002'::uuid,
  'new invitation records the administrator actor'
);

set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000002';
select is(
  public.activate_signup_invitation('collaborator@example.test')->>'status',
  'already_active',
  'exact retry is an idempotent success'
);
reset role;
select is(
  (select count(*) from private.signup_invitations where email_normalized = 'collaborator@example.test'),
  1::bigint,
  'repeated activation leaves one row'
);

insert into private.signup_invitations (email_normalized, revoked_at, note)
values ('returning@example.test', statement_timestamp(), 'synthetic revoked fixture');
set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000002';
select is(
  public.activate_signup_invitation('returning@example.test')->>'status',
  'reactivated',
  'revoked invitation is reactivated'
);
reset role;
select ok(
  (select revoked_at is null from private.signup_invitations where email_normalized = 'returning@example.test'),
  'reactivated row is active'
);
select is(
  (select created_by from private.signup_invitations where email_normalized = 'returning@example.test'),
  'fa000000-0000-4000-8000-000000000002'::uuid,
  'reactivation records the current administrator'
);

set local role authenticated;
set local request.jwt.claim.sub = 'fa000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.activate_signup_invitation(null)$$,
  'PT400', 'signup_invitation_email_invalid', 'null input is rejected'
);
select throws_ok(
  $$select public.activate_signup_invitation('   ')$$,
  'PT400', 'signup_invitation_email_invalid', 'blank input is rejected'
);
select throws_ok(
  $$select public.activate_signup_invitation('not-an-email')$$,
  'PT400', 'signup_invitation_email_invalid', 'malformed input is rejected'
);
select throws_ok(
  $$select public.activate_signup_invitation('internal space@example.test')$$,
  'PT400', 'signup_invitation_email_invalid', 'internal whitespace is rejected'
);
select throws_ok(
  $$select public.activate_signup_invitation(repeat('a', 243) || '@example.test')$$,
  'PT400', 'signup_invitation_email_invalid', 'overlong input is rejected'
);
reset role;
select is(
  (select count(*) from private.signup_invitations where email_normalized in ('', 'not-an-email', 'internal space@example.test')),
  0::bigint,
  'invalid inputs create no rows'
);
select is(
  private.hook_require_signup_invitation('{"user":{"email":" Collaborator@Example.Test "}}'),
  '{}'::jsonb,
  'existing Auth hook accepts an address activated by the command'
);
select is(
  private.hook_require_signup_invitation('{"user":{"email":"unknown-invite@example.test"}}')->'error'->>'http_code',
  '403',
  'existing Auth hook still rejects an unknown address'
);
update private.signup_invitations
set revoked_at = statement_timestamp()
where email_normalized = 'returning@example.test';
select is(
  private.hook_require_signup_invitation('{"user":{"email":"returning@example.test"}}')->'error'->>'message',
  'An invitation is required to create an account.',
  'existing Auth hook still rejects a revoked address generically'
);

select * from finish();
rollback;
