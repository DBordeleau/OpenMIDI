do $release_01_verify$
begin
  if exists(select 1 from public.projects)
     or exists(select 1 from public.project_revisions)
     or exists(select 1 from public.arrangement_versions)
     or exists(select 1 from public.midi_patterns)
     or exists(select 1 from public.contributions)
     or exists(select 1 from public.contribution_reviews)
     or exists(select 1 from private.moderation_reports where target_project_id is not null or target_contribution_id is not null)
     or exists(select 1 from private.moderation_actions where target_kind in ('project','contribution'))
     or exists(select 1 from public.challenges)
     or exists(select 1 from public.challenge_results)
     or exists(select 1 from public.profile_awards)
     or exists(select 1 from private.challenge_award_issuance)
  then
    raise exception 'release_01_disposable_state_survived';
  end if;

  if (select count(*) from auth.users where id::text like 'fa000000-0000-4000-8000-%') <> 2
     or (select count(*) from public.profiles where id::text like 'fa000000-0000-4000-8000-%') <> 2
     or not exists(select 1 from private.app_admins where user_id='fa000000-0000-4000-8000-000000000001')
     or not exists(select 1 from private.signup_invitations where email_normalized='release-preserved@example.test')
     or not exists(select 1 from private.beta_feedback where id='fa010000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.assets where id='fa020000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.profile_avatar_versions where id='fa030000-0000-4000-8000-000000000001')
  then
    raise exception 'release_01_preserved_state_missing';
  end if;

  if (select count(*) from public.genres) <> 12
     or (select count(*) from public.instruments) <> 16
     or (select count(*) from public.midi_library_presets) <> 24
     or (select count(*) from public.badge_definitions) <> 3
  then
    raise exception 'release_01_lookup_catalog_changed';
  end if;

  if (select count(*) from public.reserved_usernames where reason='product identity') <> 1
     or not exists(
       select 1 from public.reserved_usernames
       where reason='product identity' and username_normalized='openmidi'
     )
     or not exists(
       select 1 from public.licenses
       where code='all-rights-reserved'
         and url='https://openmidi.example/licenses/all-rights-reserved'
     )
     or exists(
       select 1 from private.signup_invitations
       where email_normalized like '%@example.test'
         and note='local and CI browser test actor'
         and email_normalized<>'openmidi-e2e@example.test'
     )
     or not exists(
       select 1 from private.signup_invitations
       where email_normalized='openmidi-e2e@example.test'
         and note='local and CI browser test actor'
     )
  then
    raise exception 'release_01_system_identity_not_reconciled';
  end if;

  if (select count(*) from public.discovery_state where singleton and version=42) <> 1
     or (select count(*) from public.discovery_state) <> 1
  then
    raise exception 'release_01_discovery_state_invalid';
  end if;

  if exists(
    select 1
    from pg_trigger as trigger
    join pg_class as relation on relation.oid=trigger.tgrelid
    join pg_namespace as namespace on namespace.oid=relation.relnamespace
    where not trigger.tgisinternal
      and trigger.tgenabled='D'
      and namespace.nspname in ('public','private')
  ) then
    raise exception 'release_01_user_trigger_left_disabled';
  end if;
end
$release_01_verify$;
