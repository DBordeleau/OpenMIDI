begin;

-- This one-time prelaunch reset intentionally clears rows protected by normal
-- immutable, append-only, lifecycle, and discovery-maintenance triggers. Keep
-- the complete affected relation set in one place so every user trigger is
-- restored before this transaction can commit.
create temporary table release_01_trigger_tables (
  relation_name text primary key
) on commit drop;

insert into release_01_trigger_tables (relation_name)
select relation_name
from unnest(array[
  'private.deletion_request_workspaces',
  'private.moderation_actions',
  'private.moderation_reports',
  'private.content_holds',
  'private.deletion_requests',
  'public.profile_awards',
  'private.challenge_award_issuance',
  'public.challenge_result_community_favorites',
  'public.challenge_result_placements',
  'public.challenge_result_entries',
  'private.challenge_featured_selection',
  'private.challenge_featured_actions',
  'private.challenge_moderation_actions',
  'private.challenge_reports',
  'private.challenge_vote_commands',
  'private.challenge_entry_commands',
  'private.challenge_admin_actions',
  'public.challenge_votes',
  'public.challenge_entries',
  'public.challenge_results',
  'public.challenge_judge_credits',
  'public.challenge_versions',
  'public.challenges',
  'private.midi_library_moderation_actions',
  'private.midi_library_reports',
  'private.saved_midi_pattern_removals',
  'public.saved_midi_patterns',
  'private.midi_library_reuse_access',
  'private.midi_library_reuses',
  'public.midi_library_listing_tags',
  'public.midi_pattern_external_credits',
  'public.midi_library_listings',
  'private.workspace_snapshots',
  'public.workspace_clips',
  'public.workspace_tracks',
  'public.workspaces',
  'public.contribution_reviews',
  'public.revision_attributions',
  'public.activity_events',
  'public.project_genres',
  'public.project_members',
  'public.project_stats',
  'public.project_tags',
  'public.public_project_catalog',
  'public.arrangement_clips',
  'public.arrangement_tracks',
  'public.projects',
  'public.project_revisions',
  'public.contributions',
  'public.contribution_versions',
  'public.arrangement_versions',
  'public.midi_patterns',
  'public.midi_pattern_versions',
  'public.midi_pattern_notes'
]) as candidate(relation_name)
where to_regclass(relation_name) is not null;

do $release_01$
declare
  relation_name text;
begin
  for relation_name in
    select trigger_table.relation_name
    from release_01_trigger_tables as trigger_table
    order by trigger_table.relation_name
  loop
    execute format('alter table %s disable trigger user', relation_name);
  end loop;
end
$release_01$;

-- Preserve identity, operator, feedback, avatar, and lookup-catalog state while
-- removing prelaunch musical state and any audit rows that depend on it.
create temporary table release_01_deletion_requests_to_remove
on commit drop
as
with recursive impacted_requests as (
  select request.id
  from private.deletion_requests as request
  where request.target_project_id is not null
     or request.target_contribution_id is not null
     or exists (
       select 1
       from private.deletion_request_workspaces as link
       where link.deletion_request_id = request.id
     )

  union

  select child.id
  from private.deletion_requests as child
  join impacted_requests as parent
    on child.parent_request_id = parent.id
)
select id from impacted_requests;

delete from private.deletion_request_workspaces;

delete from private.moderation_actions as action
using private.moderation_reports as report
where action.report_id = report.id
  and (
    report.target_project_id is not null
    or report.target_contribution_id is not null
  );

delete from private.moderation_reports
where target_project_id is not null
   or target_contribution_id is not null;

delete from private.content_holds
where target_project_id is not null
   or target_contribution_id is not null;

delete from private.deletion_requests as request
using release_01_deletion_requests_to_remove as impacted
where request.id = impacted.id;

do $release_01$
declare
  relation_name text;
begin
  if to_regclass('public.challenges') is not null then
    execute 'update public.challenges set current_version_id = null, current_result_id = null';
  end if;

  if to_regclass('public.challenge_entries') is not null then
    execute 'update public.challenge_entries set replacement_of_entry_id = null, replaced_by_entry_id = null';
  end if;

  if to_regclass('public.challenge_results') is not null then
    execute 'update public.challenge_results set supersedes_result_id = null';
  end if;

  foreach relation_name in array array[
    'public.profile_awards',
    'private.challenge_award_issuance',
    'public.challenge_result_community_favorites',
    'public.challenge_result_placements',
    'public.challenge_result_entries',
    'private.challenge_featured_selection',
    'private.challenge_featured_actions',
    'private.challenge_moderation_actions',
    'private.challenge_reports',
    'private.challenge_vote_commands',
    'private.challenge_entry_commands',
    'private.challenge_admin_actions',
    'public.challenge_votes',
    'public.challenge_entries',
    'public.challenge_results',
    'public.challenge_judge_credits',
    'public.challenge_versions',
    'public.challenges'
  ] loop
    if to_regclass(relation_name) is not null then
      execute format('delete from %s', relation_name);
    end if;
  end loop;

  if to_regclass('public.midi_pattern_external_credits') is not null then
    execute 'update public.midi_pattern_external_credits set inherited_from_credit_id = null';
  end if;

  foreach relation_name in array array[
    'private.midi_library_moderation_actions',
    'private.midi_library_reports',
    'private.saved_midi_pattern_removals',
    'public.saved_midi_patterns',
    'private.midi_library_reuse_access',
    'private.midi_library_reuses',
    'public.midi_library_listing_tags',
    'public.midi_pattern_external_credits',
    'public.midi_library_listings'
  ] loop
    if to_regclass(relation_name) is not null then
      execute format('delete from %s', relation_name);
    end if;
  end loop;
end
$release_01$;

delete from private.workspace_snapshots;
delete from public.workspace_clips;
delete from public.workspace_tracks;
delete from public.workspaces;

delete from public.contribution_reviews;
delete from public.revision_attributions;
delete from public.activity_events;

delete from public.project_genres;
delete from public.project_members;
delete from public.project_stats;
delete from public.project_tags;
delete from public.public_project_catalog;

insert into public.discovery_state(singleton, version, updated_at)
values (true, 1, statement_timestamp())
on conflict (singleton) do update
set version = public.discovery_state.version + 1,
    updated_at = statement_timestamp();

delete from public.arrangement_clips;
delete from public.arrangement_tracks;

update public.projects
set current_revision_id = null,
    source_project_id = null,
    source_revision_id = null,
    status = 'draft',
    visibility = 'private',
    open_to_contributions = false,
    published_at = null,
    rights_attestation_version = null;

update public.project_revisions
set parent_revision_id = null,
    expected_base_revision_id = null,
    accepted_contribution_id = null,
    accepted_contribution_version_id = null;

update public.contributions
set current_version_id = null,
    status = 'draft',
    submitted_at = null,
    withdrawn_at = null,
    reviewed_at = null,
    reviewed_by = null,
    review_note = null;

delete from public.contribution_versions;
delete from public.contributions;
delete from public.project_revisions;
delete from public.arrangement_versions;
delete from public.projects;

update public.midi_patterns
set source_pattern_id = null,
    source_pattern_version_id = null;

update public.midi_pattern_versions
set parent_pattern_version_id = null,
    source_pattern_version_id = null;

delete from public.midi_pattern_notes;
delete from public.midi_pattern_versions;
delete from public.midi_patterns;

with removed_product_identity as (
  delete from public.reserved_usernames
  where reason = 'product identity'
  returning 1
)
insert into public.reserved_usernames(username_normalized, reason)
select 'openmidi', 'product identity'
where exists(select 1 from removed_product_identity);

update public.licenses
set url = 'https://openmidi.example/licenses/all-rights-reserved'
where code = 'all-rights-reserved';

delete from private.signup_invitations
where email_normalized like '%@example.test'
  and note = 'local and CI browser test actor'
  and email_normalized <> 'openmidi-e2e@example.test';

update private.midi_synth_presets
set engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1';

alter table public.arrangement_versions
  drop constraint arrangement_versions_engine_check,
  add constraint arrangement_versions_engine_check
    check (engine = 'openmidi-midi');

alter table public.arrangement_versions
  drop constraint arrangement_versions_engine_version_check,
  add constraint arrangement_versions_engine_version_check
    check (engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1');

alter table public.project_revisions
  drop constraint project_revisions_manifest_runtime_check,
  add constraint project_revisions_manifest_runtime_check
    check (
      manifest_version = 3
      and engine = 'openmidi-midi'
      and engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
      and arrangement_version_id is not null
    );

alter table public.workspaces
  drop constraint workspaces_manifest_runtime_check,
  add constraint workspaces_manifest_runtime_check
    check (
      manifest_version = 3
      and engine = 'openmidi-midi'
      and engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
    );

alter table public.contribution_versions
  drop constraint contribution_versions_format_check,
  add constraint contribution_versions_format_check
    check (
      manifest_version = 3
      and engine = 'openmidi-midi'
      and engine_version = 'openmidi-midi-3_tone-15.1.22_presets-1'
      and arrangement_version_id is not null
    );

-- Recreate every stored routine that embeds the manifest engine. The pattern is
-- deliberately namespace-neutral so the migration is safe on both the retained
-- seven-migration state and a clean replay whose functions are already canonical.
do $release_01$
declare
  routine record;
  definition text;
begin
  for routine in
    select procedure.oid
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('private', 'public')
      and procedure.prosrc ~ '[[:alnum:]-]+-midi'
  loop
    definition := pg_get_functiondef(routine.oid);
    definition := regexp_replace(
      definition,
      '[[:alnum:]-]+-midi-3_tone-15\\.1\\.22_presets-1',
      'openmidi-midi-3_tone-15.1.22_presets-1',
      'g'
    );
    definition := regexp_replace(
      definition,
      '[[:alnum:]-]+-midi',
      'openmidi-midi',
      'g'
    );
    execute definition;
  end loop;
end
$release_01$;

comment on table public.project_revisions is
  'Immutable canonical OpenMIDI project revisions.';

comment on table private.midi_synth_presets is
  'Versioned deterministic OpenMIDI synthesis preset catalog retained across the prelaunch musical reset.';

do $release_01$
declare
  relation_name text;
begin
  for relation_name in
    select trigger_table.relation_name
    from release_01_trigger_tables as trigger_table
    order by trigger_table.relation_name
  loop
    execute format('alter table %s enable trigger user', relation_name);
  end loop;
end
$release_01$;

commit;
