begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(16);

select is(
  (select count(*) from private.midi_synth_presets
   where engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'),
  24::bigint,
  'the preserved synthesis catalog uses the canonical engine version'
);

select is(
  (select count(*) from public.reserved_usernames where username_normalized = 'openmidi'),
  1::bigint,
  'the canonical product username is reserved exactly once'
);

select is(
  (select count(*) from private.signup_invitations where email_normalized = 'openmidi-e2e@example.test'),
  1::bigint,
  'the deterministic local actor invitation uses the canonical identity'
);

select is((select count(*) from public.genres), 12::bigint, 'genre lookup catalog is preserved');
select is((select count(*) from public.instruments), 16::bigint, 'instrument lookup catalog is preserved');
select is((select count(*) from public.midi_library_presets), 24::bigint, 'library preset lookup catalog is preserved');
select is((select count(*) from public.badge_definitions), 3::bigint, 'badge definition catalog is preserved');

select is((select count(*) from public.projects), 0::bigint, 'fresh replay has no prelaunch projects');
select is((select count(*) from public.midi_patterns), 0::bigint, 'fresh replay has no prelaunch patterns');
select is((select count(*) from public.challenges), 0::bigint, 'fresh replay has no prelaunch challenge state');
select is((select count(*) from public.profile_awards), 0::bigint, 'fresh replay has no derived awards');

select is(
  (select count(*)
   from pg_constraint
   where conname in (
     'arrangement_versions_engine_check',
     'arrangement_versions_engine_version_check',
     'project_revisions_manifest_runtime_check',
     'workspaces_manifest_runtime_check',
     'contribution_versions_format_check'
   )
     and pg_get_constraintdef(oid) like '%openmidi-midi%'),
  5::bigint,
  'all persisted engine constraints use the canonical namespace'
);

select is(
  (select count(*)
   from pg_proc as procedure
   join pg_namespace as namespace on namespace.oid = procedure.pronamespace
   where namespace.nspname in ('private', 'public')
     and procedure.prosrc ~ '[[:alnum:]-]+-midi'
     and procedure.prosrc not like '%openmidi-midi%'),
  0::bigint,
  'stored routines contain no noncanonical MIDI engine namespace'
);

select is(
  obj_description('public.project_revisions'::regclass),
  'Immutable canonical OpenMIDI project revisions.',
  'revision authority comment uses the canonical product name'
);

select has_table('public', 'profiles', 'profile authority remains present');
select has_table('public', 'profile_avatar_versions', 'avatar authority remains present');

select * from finish();
rollback;
