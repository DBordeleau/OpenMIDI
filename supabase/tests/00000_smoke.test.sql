begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select has_schema('public', 'public schema is available');
select has_schema('auth', 'auth schema is available');
select has_function('auth', 'uid', array[]::text[], 'auth.uid() is available');

select * from finish();

rollback;
