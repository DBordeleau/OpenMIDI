begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_schema('private', 'private schema exists');
select has_type('public', 'account_status', 'account status enum exists');
select enum_has_labels('public', 'account_status', array['active', 'suspended', 'deleted'], 'account status values are stable');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'reserved_usernames', 'reserved usernames table exists');
select has_table('private', 'app_admins', 'private administrator mapping exists');
select has_view('public', 'public_profiles', 'safe public projection exists');
select has_function('public', 'claim_username', array['text'], 'username claim command exists');
select has_function('private', 'is_admin', array[]::text[], 'admin helper exists');
select col_type_is('public', 'profiles', 'id', 'uuid', 'profile id is uuid');
select col_type_is('public', 'profiles', 'status', 'account_status', 'profile status uses lifecycle enum');
select col_type_is('public', 'profiles', 'profile_completed_at', 'timestamp with time zone', 'completion is a timestamptz');
select col_is_null('public', 'profiles', 'username', 'username is nullable during onboarding');
select col_is_null('public', 'profiles', 'display_name', 'display name is nullable during onboarding');
select col_is_null('public', 'profiles', 'credit_name', 'credit name is nullable during onboarding');
select has_index('public', 'profiles', 'profiles_username_normalized_uq', 'normalized username index exists');
select index_is_unique('public', 'profiles', 'profiles_username_normalized_uq', 'normalized username index is unique');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.reserved_usernames'::regclass), 'reserved names has RLS enabled');
select is(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.public_profiles'::regclass),
  true,
  'public projection is security invoker'
);
select is(
  (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'public_profiles'),
  'id,username,username_normalized,display_name,credit_name,bio,created_at,updated_at,avatar_config',
  'public projection exposes exactly the safe columns'
);
select ok(not has_table_privilege('anon', 'public.profiles', 'INSERT,UPDATE,DELETE'), 'anon cannot mutate profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT,UPDATE,DELETE'), 'authenticated cannot mutate profiles');
select ok(
  has_function_privilege('authenticated', 'public.claim_username(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.claim_username(text)', 'EXECUTE'),
  'only authenticated application users can execute username claim'
);

select * from finish();
rollback;
