begin;
reset role;
create extension if not exists pgtap with schema extensions;
select plan(40);

select hasnt_table('public','asset_uploads','source upload reservations are removed');
select hasnt_table('public','asset_credits','source credit records are removed');
select hasnt_table('public','waveform_peak_derivatives','waveform derivatives are removed');
select hasnt_table('public','project_asset_references','project source references are removed');
select hasnt_table('public','project_storage_usage','project source quotas are removed');
select hasnt_table('public','user_storage_usage','user source quotas are removed');
select hasnt_table('public','global_storage_usage','global source quotas are removed');
select hasnt_table('public','revision_tracks','legacy revision tracks are removed');
select hasnt_table('public','revision_clips','legacy revision clips are removed');
select hasnt_table('public','contribution_version_tracks','legacy contribution tracks are removed');
select hasnt_table('public','contribution_version_clips','legacy contribution clips are removed');
select hasnt_table('private','asset_verification_jobs','audio verification jobs are removed');
select hasnt_table('private','source_admission_control','source admission control is removed');
select hasnt_table('private','workspace_snapshot_uploads','Storage-backed snapshots are removed');
select hasnt_table('public','midi_stems','pre-pivot stem identities are removed');
select hasnt_table('public','midi_stem_versions','pre-pivot stem versions are removed');
select hasnt_table('public','midi_stem_drafts','pre-pivot stem drafts are removed');
select hasnt_table('private','studio_midi_apply_requests','standalone stem apply requests are removed');
select hasnt_column('public','workspaces','snapshot_asset_id','workspaces never reference Storage snapshots');
select hasnt_column('public','project_revisions','snapshot_asset_id','revisions never reference Storage snapshots');
select hasnt_column('public','workspace_tracks','asset_id','workspace tracks are MIDI-only');
select hasnt_column('public','workspace_clips','midi_stem_version_id','workspace clips reference pattern versions only');

select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and (p.proname ilike any(array[
    '%audio%','%source%','%waveform%','%quota%','%verification%','%workspace_snapshot%'])
    or p.prosrc ilike any(array['%source_audio%','%revision_tracks%','%contribution_version_tracks%',
      '%waveform_peak%','%asset_verification%','%global_storage_usage%','%workspace-snapshots%']))),
  'no audio command or stale function body remains');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef
    and coalesce(array_to_string(p.proconfig,','),'') !~ 'search_path='),
  'every security-definer function pins search_path');
select ok(not exists(
  select 1
  from pg_default_acl d
  join pg_namespace n on n.oid=d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  join pg_roles r on r.oid=a.grantee
  where n.nspname='public'
    and d.defaclrole=(select oid from pg_roles where rolname='postgres')
    and d.defaclobjtype in ('r','S')
    and r.rolname in ('anon','authenticated')
), 'postgres-created public tables and sequences grant no default privileges to application roles');
select is((select count(*) from storage.objects where bucket_id in ('profile-images','public-avatars')),0::bigint,
  'legacy avatar buckets contain no objects after clean replay');
select is((select count(*) from pg_policies where schemaname='storage'),0::bigint,
  'OpenMIDI exposes no Storage object policy');
select hasnt_table('public','assets','avatar-only asset metadata is removed');
select hasnt_table('public','profile_avatar_versions','uploaded avatar versions are removed');
select hasnt_extension('pg_cron','audio cron extension is removed');
select hasnt_extension('pg_net','audio recovery network extension is removed');

select has_table('public','arrangement_versions','immutable arrangements remain');
select has_table('public','midi_pattern_versions','immutable MIDI patterns remain');
select has_table('public','workspaces','mutable MIDI workspaces remain');
select has_table('private','workspace_snapshots','bounded Postgres workspace snapshots remain');
select ok(not exists(select 1 from information_schema.columns where table_schema='public'
  and table_name='assets'),'avatar asset metadata is absent');
select ok(public.operator_retention_preview()::text !~
  'failed_upload|snapshot_30d|peak_expired|account_source','retention policy has no audio rules');
select has_function('public','submit_moderation_report',
  array['uuid','text','uuid','text','text'],'moderation reporting remains');
select has_function('public','delete_project',array['uuid','uuid','integer'],
  'project deletion remains');
select hasnt_function('public','reserve_profile_image_upload',array['uuid','integer','text','text'],
  'avatar reservation command is removed');

select * from finish();
rollback;
