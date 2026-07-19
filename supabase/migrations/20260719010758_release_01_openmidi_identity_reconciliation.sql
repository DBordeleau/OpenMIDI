begin;

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

-- The deferred owner triggers assume a project survives every membership or
-- project update. This one-time transaction removes both sides together.
alter table public.project_members disable trigger members_owner_invariant;
alter table public.projects disable trigger projects_owner_invariant;

delete from public.project_genres;
delete from public.project_members;
delete from public.project_stats;
delete from public.project_tags;
delete from public.public_project_catalog;
delete from public.discovery_state;

delete from public.arrangement_clips;
delete from public.arrangement_tracks;

update public.projects
set current_revision_id = null,
    source_project_id = null,
    source_revision_id = null;

update public.project_revisions
set parent_revision_id = null,
    expected_base_revision_id = null,
    accepted_contribution_id = null,
    accepted_contribution_version_id = null;

update public.contributions
set current_version_id = null;

delete from public.contribution_versions;
delete from public.contributions;
delete from public.project_revisions;
delete from public.arrangement_versions;
delete from public.projects;

alter table public.project_members enable trigger members_owner_invariant;
alter table public.projects enable trigger projects_owner_invariant;

update public.midi_patterns
set source_pattern_id = null,
    source_pattern_version_id = null;

update public.midi_pattern_versions
set parent_pattern_version_id = null,
    source_pattern_version_id = null;

delete from public.midi_pattern_notes;
delete from public.midi_pattern_versions;
delete from public.midi_patterns;

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

commit;
