-- CHALLENGE-03: private voting, bounded reports and moderation, immutable
-- result versions, and one canonical featured-challenge projection.

alter table public.challenges
  add column moderation_state text not null default 'visible',
  add column moderation_version integer not null default 1,
  add column moderation_updated_at timestamptz not null default statement_timestamp(),
  add column current_result_id uuid,
  add constraint challenges_moderation_check check (
    moderation_state in ('visible','hidden') and moderation_version > 0
  );

alter table public.challenge_entries
  add constraint challenge_entries_challenge_id_id_key unique(challenge_id,id);

create table public.challenge_votes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_entry_id uuid not null references public.challenge_entries(id) on delete restrict,
  voter_id uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'active',
  vote_version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz,
  excluded_at timestamptz,
  excluded_by uuid references private.app_admins(user_id) on delete restrict,
  constraint challenge_votes_state_check check (state in ('active','removed','excluded')),
  constraint challenge_votes_version_check check (vote_version > 0),
  constraint challenge_votes_timestamps_check check (updated_at >= created_at),
  constraint challenge_votes_state_shape check (
    (state='active' and removed_at is null and excluded_at is null and excluded_by is null)
    or (state='removed' and removed_at is not null and excluded_at is null and excluded_by is null)
    or (state='excluded' and excluded_at is not null and excluded_by is not null)
  ),
  unique(challenge_entry_id,voter_id),
  constraint challenge_votes_entry_challenge_fk foreign key(challenge_id,challenge_entry_id)
    references public.challenge_entries(challenge_id,id) on delete restrict
);

create table private.challenge_vote_commands (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  requested_entry_id uuid not null,
  challenge_id uuid references public.challenges(id) on delete restrict,
  challenge_entry_id uuid references public.challenge_entries(id) on delete restrict,
  requested_active boolean not null,
  prior_vote_version integer,
  new_vote_version integer,
  outcome text not null,
  response jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(actor_id,request_id),
  constraint challenge_vote_command_outcome_check check (outcome in ('accepted','rejected')),
  constraint challenge_vote_command_versions_check check (
    (outcome='accepted' and new_vote_version > 0 and
      (prior_vote_version is null or new_vote_version in (prior_vote_version,prior_vote_version+1)))
    or (outcome='rejected' and prior_vote_version is null and new_vote_version is null)
  )
);

create table private.challenge_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_entry_id uuid references public.challenge_entries(id) on delete restrict,
  target_kind text not null,
  reason text not null,
  details text,
  created_at timestamptz not null default statement_timestamp(),
  unique(reporter_id,request_id),
  constraint challenge_reports_target_check check (
    (target_kind='challenge' and challenge_entry_id is null)
    or (target_kind='entry' and challenge_entry_id is not null)
  ),
  constraint challenge_reports_reason_check check (
    reason in ('spam','harassment','rights_concern','vote_manipulation','other')
  ),
  constraint challenge_reports_details_check check (
    details is null or (details=btrim(details) and char_length(details) between 1 and 1000)
  ),
  constraint challenge_reports_entry_challenge_fk foreign key(challenge_id,challenge_entry_id)
    references public.challenge_entries(challenge_id,id) on delete restrict
);

create table private.challenge_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_entry_id uuid references public.challenge_entries(id) on delete restrict,
  challenge_vote_id uuid references public.challenge_votes(id) on delete restrict,
  action text not null,
  prior_version integer not null,
  new_version integer not null,
  reason text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(actor_id,request_id),
  constraint challenge_moderation_action_check check (
    action in ('challenge_hide','challenge_restore','entry_hide','entry_restore','entry_disqualify','vote_exclude','vote_restore')
  ),
  constraint challenge_moderation_versions_check check (prior_version > 0 and new_version=prior_version+1),
  constraint challenge_moderation_reason_check check (
    reason=btrim(reason) and char_length(reason) between 1 and 500
  ),
  constraint challenge_moderation_target_check check (
    (action like 'challenge_%' and challenge_entry_id is null and challenge_vote_id is null)
    or (action like 'entry_%' and challenge_entry_id is not null and challenge_vote_id is null)
    or (action like 'vote_%' and challenge_entry_id is null and challenge_vote_id is not null)
  )
);

create table public.challenge_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_version_id uuid not null,
  result_version integer not null,
  supersedes_result_id uuid references public.challenge_results(id) on delete restrict,
  finalized_by uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  public_note text not null,
  correction_reason text,
  finalized_at timestamptz not null default statement_timestamp(),
  unique(challenge_id,result_version),
  unique(finalized_by,request_id),
  unique(challenge_id,id),
  constraint challenge_results_version_check check (result_version > 0),
  constraint challenge_results_note_check check (
    public_note=btrim(public_note) and char_length(public_note) between 1 and 2000
  ),
  constraint challenge_results_reason_check check (
    correction_reason is null or
    (correction_reason=btrim(correction_reason) and char_length(correction_reason) between 1 and 500)
  ),
  constraint challenge_results_correction_shape check (
    (result_version=1 and supersedes_result_id is null and correction_reason is null)
    or (result_version>1 and supersedes_result_id is not null and correction_reason is not null)
  ),
  constraint challenge_results_challenge_version_fk foreign key(challenge_id,challenge_version_id)
    references public.challenge_versions(challenge_id,id) on delete restrict
);

create table public.challenge_result_entries (
  challenge_result_id uuid not null references public.challenge_results(id) on delete restrict,
  challenge_entry_id uuid not null references public.challenge_entries(id) on delete restrict,
  final_vote_total integer not null,
  primary key(challenge_result_id,challenge_entry_id),
  constraint challenge_result_entries_total_check check (final_vote_total >= 0)
);

create table public.challenge_result_placements (
  challenge_result_id uuid not null references public.challenge_results(id) on delete restrict,
  place integer not null,
  challenge_entry_id uuid not null references public.challenge_entries(id) on delete restrict,
  placement_label text not null,
  primary key(challenge_result_id,place),
  unique(challenge_result_id,challenge_entry_id),
  constraint challenge_result_placements_place_check check (place between 1 and 20),
  constraint challenge_result_placements_label_check check (
    placement_label=btrim(placement_label) and char_length(placement_label) between 1 and 80
  )
);

create table public.challenge_result_community_favorites (
  challenge_result_id uuid not null references public.challenge_results(id) on delete restrict,
  challenge_entry_id uuid not null references public.challenge_entries(id) on delete restrict,
  final_vote_total integer not null,
  primary key(challenge_result_id,challenge_entry_id),
  constraint challenge_result_favorites_total_check check (final_vote_total >= 0)
);

alter table public.challenges add constraint challenges_current_result_fk
  foreign key(id,current_result_id) references public.challenge_results(challenge_id,id)
  on delete restrict deferrable initially deferred;

create table private.challenge_featured_selection (
  singleton boolean primary key default true check (singleton),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  selection_version integer not null,
  selected_by uuid not null references private.app_admins(user_id) on delete restrict,
  selected_at timestamptz not null default statement_timestamp(),
  constraint challenge_featured_version_check check (selection_version > 0)
);

create table private.challenge_featured_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  action text not null,
  challenge_id uuid references public.challenges(id) on delete restrict,
  prior_version integer not null,
  new_version integer not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(actor_id,request_id),
  constraint challenge_featured_action_check check (action in ('select','clear')),
  constraint challenge_featured_action_target_check check (
    (action='select' and challenge_id is not null) or (action='clear' and challenge_id is null)
  ),
  constraint challenge_featured_action_version_check check (prior_version >= 0 and new_version=prior_version+1)
);

create index challenge_votes_challenge_active_idx
  on public.challenge_votes(challenge_id,challenge_entry_id) where state='active';
create index challenge_votes_voter_active_idx
  on public.challenge_votes(voter_id,challenge_id) where state='active';
create index challenge_vote_commands_rate_idx
  on private.challenge_vote_commands(actor_id,created_at desc);
create index challenge_reports_rate_idx on private.challenge_reports(reporter_id,created_at desc);
create index challenge_reports_target_idx on private.challenge_reports(challenge_id,challenge_entry_id,created_at desc);
create index challenge_moderation_actions_target_idx
  on private.challenge_moderation_actions(challenge_id,created_at desc);
create index challenge_results_challenge_idx on public.challenge_results(challenge_id,result_version desc);
create index challenge_result_entries_entry_idx on public.challenge_result_entries(challenge_entry_id);
create index challenge_result_placements_entry_idx on public.challenge_result_placements(challenge_entry_id);
create index challenge_result_favorites_entry_idx on public.challenge_result_community_favorites(challenge_entry_id);

create trigger challenge_vote_commands_immutable before update or delete on private.challenge_vote_commands
  for each row execute function private.reject_append_only_change();
create trigger challenge_reports_immutable before update or delete on private.challenge_reports
  for each row execute function private.reject_append_only_change();
create trigger challenge_moderation_actions_immutable before update or delete on private.challenge_moderation_actions
  for each row execute function private.reject_append_only_change();
create trigger challenge_results_immutable before update or delete on public.challenge_results
  for each row execute function private.reject_immutable_change();
create trigger challenge_result_entries_immutable before update or delete on public.challenge_result_entries
  for each row execute function private.reject_immutable_change();
create trigger challenge_result_placements_immutable before update or delete on public.challenge_result_placements
  for each row execute function private.reject_immutable_change();
create trigger challenge_result_favorites_immutable before update or delete on public.challenge_result_community_favorites
  for each row execute function private.reject_immutable_change();
create trigger challenge_featured_actions_immutable before update or delete on private.challenge_featured_actions
  for each row execute function private.reject_append_only_change();

create or replace function private.protect_challenge_vote_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then raise sqlstate 'PT403' using message='challenge_vote_immutable_identity'; end if;
  if row(new.id,new.challenge_id,new.challenge_entry_id,new.voter_id,new.created_at)
    is distinct from row(old.id,old.challenge_id,old.challenge_entry_id,old.voter_id,old.created_at)
  then raise sqlstate 'PT403' using message='challenge_vote_immutable_identity'; end if;
  return new;
end;
$$;

create trigger challenge_votes_protected before update or delete on public.challenge_votes
  for each row execute function private.protect_challenge_vote_change();

create or replace function public.set_challenge_vote(
  p_entry_id uuid,
  p_active boolean,
  p_request_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_entry public.challenge_entries%rowtype;
  v_challenge public.challenges%rowtype;
  v_version public.challenge_versions%rowtype;
  v_vote public.challenge_votes%rowtype;
  v_command private.challenge_vote_commands%rowtype;
  v_prior integer;
  v_response jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_vote_unauthenticated'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('challenge-vote-actor:'||v_actor::text,0)
  );
  select * into v_command from private.challenge_vote_commands
    where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_command.requested_entry_id=p_entry_id and v_command.requested_active=p_active
    then return v_command.response; end if;
    return jsonb_build_object('errorCode','PT409');
  end if;
  if (select count(*) from private.challenge_vote_commands
      where actor_id=v_actor and created_at>statement_timestamp()-interval '1 hour') >= 60
  then
    return jsonb_build_object('errorCode','PT429');
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active'
      and p.profile_completed_at is not null and p.moderation_state='visible' and p.purged_at is null)
  then
    v_response := jsonb_build_object('errorCode','PT403');
    insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,requested_active,outcome,response)
      values(v_actor,p_request_id,p_entry_id,p_active,'rejected',v_response);
    return v_response;
  end if;

  select * into v_entry from public.challenge_entries where id=p_entry_id;
  if not found then
    v_response := jsonb_build_object('errorCode','PT404');
    insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,requested_active,outcome,response)
      values(v_actor,p_request_id,p_entry_id,p_active,'rejected',v_response);
    return v_response;
  end if;
  select * into v_challenge from public.challenges where id=v_entry.challenge_id;
  select * into v_version from public.challenge_versions where id=v_challenge.current_version_id;
  if v_challenge.state<>'published' or v_challenge.moderation_state<>'visible'
    or v_entry.challenge_version_id<>v_challenge.current_version_id
    or statement_timestamp()<v_version.voting_opens_at or statement_timestamp()>=v_version.voting_closes_at
    or v_entry.status<>'active' or v_entry.moderation_state<>'visible'
    or not private.challenge_entry_is_public(v_entry,statement_timestamp())
  then
    v_response := jsonb_build_object('errorCode','PT409');
    insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,challenge_id,challenge_entry_id,
      requested_active,outcome,response)
      values(v_actor,p_request_id,p_entry_id,v_entry.challenge_id,v_entry.id,p_active,'rejected',v_response);
    return v_response;
  end if;
  if v_entry.entrant_id=v_actor then
    v_response := jsonb_build_object('errorCode','PT403');
    insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,challenge_id,challenge_entry_id,
      requested_active,outcome,response)
      values(v_actor,p_request_id,p_entry_id,v_entry.challenge_id,v_entry.id,p_active,'rejected',v_response);
    return v_response;
  end if;

  select * into v_vote from public.challenge_votes
    where challenge_entry_id=p_entry_id and voter_id=v_actor for update;
  if found and v_vote.state='excluded' then
    v_response := jsonb_build_object('errorCode','PT409');
    insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,challenge_id,challenge_entry_id,
      requested_active,outcome,response)
      values(v_actor,p_request_id,p_entry_id,v_entry.challenge_id,v_entry.id,p_active,'rejected',v_response);
    return v_response;
  end if;
  if not found then
    insert into public.challenge_votes(challenge_id,challenge_entry_id,voter_id,state,removed_at)
      values(v_entry.challenge_id,v_entry.id,v_actor,case when p_active then 'active' else 'removed' end,
        case when p_active then null else statement_timestamp() end)
      returning * into v_vote;
    v_prior := null;
  elsif (v_vote.state='active')=p_active then
    v_prior := v_vote.vote_version;
  else
    v_prior := v_vote.vote_version;
    update public.challenge_votes set
      state=case when p_active then 'active' else 'removed' end,
      vote_version=vote_version+1,
      updated_at=statement_timestamp(),
      removed_at=case when p_active then null else statement_timestamp() end,
      excluded_at=null,excluded_by=null
      where id=v_vote.id returning * into v_vote;
  end if;
  v_response := jsonb_build_object('entryId',v_entry.id,'active',v_vote.state='active','voteVersion',v_vote.vote_version);
  insert into private.challenge_vote_commands(actor_id,request_id,requested_entry_id,challenge_id,challenge_entry_id,
    requested_active,prior_vote_version,new_vote_version,outcome,response)
  values(v_actor,p_request_id,p_entry_id,v_entry.challenge_id,v_entry.id,p_active,v_prior,v_vote.vote_version,
    'accepted',v_response);
  return v_response;
end;
$$;

create or replace function public.list_my_active_challenge_vote_ids(p_challenge_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_version public.challenge_versions%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_vote_unauthenticated'; end if;
  select v.* into v_version from public.challenges c join public.challenge_versions v on v.id=c.current_version_id
    where c.id=p_challenge_id and c.state='published' and c.moderation_state='visible';
  if not found or statement_timestamp()<v_version.voting_opens_at or statement_timestamp()>=v_version.voting_closes_at
  then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(v.challenge_entry_id order by v.challenge_entry_id)
    from public.challenge_votes v where v.challenge_id=p_challenge_id and v.voter_id=v_actor and v.state='active'),'[]'::jsonb);
end;
$$;

create or replace function public.report_challenge_content(
  p_request_id uuid,
  p_target_kind text,
  p_challenge_id uuid,
  p_entry_id uuid,
  p_reason text,
  p_details text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_id uuid; v_details text := nullif(btrim(p_details),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='challenge_report_unauthenticated'; end if;
  select id into v_id from private.challenge_reports where reporter_id=v_actor and request_id=p_request_id;
  if found then return v_id; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active'
      and p.profile_completed_at is not null and p.moderation_state='visible' and p.purged_at is null)
  then raise sqlstate 'PT403' using message='challenge_report_actor_ineligible'; end if;
  if (select count(*) from private.challenge_reports where reporter_id=v_actor
      and created_at>statement_timestamp()-interval '1 hour') >= 10
  then raise sqlstate 'PT429' using message='challenge_report_rate_limited'; end if;
  if p_target_kind not in ('challenge','entry') or p_reason not in ('spam','harassment','rights_concern','vote_manipulation','other')
    or v_details is not null and char_length(v_details)>1000
  then raise sqlstate '22023' using message='challenge_report_invalid'; end if;
  if not exists(select 1 from public.challenges c where c.id=p_challenge_id and c.state<>'draft')
    or (p_target_kind='challenge' and p_entry_id is not null)
    or (p_target_kind='entry' and not exists(select 1 from public.challenge_entries e
      where e.id=p_entry_id and e.challenge_id=p_challenge_id))
  then raise sqlstate 'PT404' using message='challenge_report_target_unavailable'; end if;
  insert into private.challenge_reports(reporter_id,request_id,challenge_id,challenge_entry_id,target_kind,reason,details)
    values(v_actor,p_request_id,p_challenge_id,case when p_target_kind='entry' then p_entry_id else null end,p_target_kind,p_reason,v_details)
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.moderate_challenge_target(
  p_request_id uuid,
  p_challenge_id uuid,
  p_entry_id uuid,
  p_vote_id uuid,
  p_action text,
  p_expected_version integer,
  p_reason text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing private.challenge_moderation_actions%rowtype;
  v_reason text := btrim(p_reason);
  v_prior integer;
  v_result text;
begin
  perform private.assert_admin_actor();
  select * into v_existing from private.challenge_moderation_actions where actor_id=v_actor and request_id=p_request_id;
  if found then return jsonb_build_object('action',v_existing.action,'version',v_existing.new_version); end if;
  if char_length(v_reason) not between 1 and 500 then raise sqlstate '22023' using message='challenge_moderation_reason_invalid'; end if;
  if p_action in ('challenge_hide','challenge_restore') then
    select moderation_version into v_prior from public.challenges
      where id=p_challenge_id and moderation_version=p_expected_version for update;
    if not found then raise sqlstate 'PT409' using message='challenge_moderation_stale'; end if;
    v_result := case when p_action='challenge_hide' then 'hidden' else 'visible' end;
    update public.challenges set moderation_state=v_result,moderation_version=moderation_version+1,
      moderation_updated_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_challenge_id;
  elsif p_action in ('entry_hide','entry_restore','entry_disqualify') then
    select moderation_version into v_prior from public.challenge_entries
      where id=p_entry_id and challenge_id=p_challenge_id and moderation_version=p_expected_version
        and status='active' for update;
    if not found then raise sqlstate 'PT409' using message='challenge_moderation_stale'; end if;
    if p_action='entry_disqualify' then
      update public.challenge_entries set status='disqualified',closed_at=coalesce(closed_at,statement_timestamp()),
        moderation_state='hidden',moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp()
        where id=p_entry_id;
    else
      update public.challenge_entries set moderation_state=case when p_action='entry_hide' then 'hidden' else 'visible' end,
        moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=p_entry_id;
    end if;
  elsif p_action in ('vote_exclude','vote_restore') then
    select vote_version into v_prior from public.challenge_votes
      where id=p_vote_id and challenge_id=p_challenge_id and vote_version=p_expected_version
        and ((p_action='vote_exclude' and state='active') or (p_action='vote_restore' and state='excluded')) for update;
    if not found then raise sqlstate 'PT409' using message='challenge_moderation_stale'; end if;
    if p_action='vote_exclude' then
      update public.challenge_votes set state='excluded',vote_version=vote_version+1,updated_at=statement_timestamp(),
        excluded_at=statement_timestamp(),excluded_by=v_actor where id=p_vote_id;
    else
      update public.challenge_votes set state='active',vote_version=vote_version+1,updated_at=statement_timestamp(),
        removed_at=null,excluded_at=null,excluded_by=null where id=p_vote_id;
    end if;
  else raise sqlstate '22023' using message='challenge_moderation_action_invalid';
  end if;
  insert into private.challenge_moderation_actions(actor_id,request_id,challenge_id,challenge_entry_id,challenge_vote_id,
    action,prior_version,new_version,reason)
  values(v_actor,p_request_id,p_challenge_id,
    case when p_action like 'entry_%' then p_entry_id else null end,
    case when p_action like 'vote_%' then p_vote_id else null end,
    p_action,v_prior,v_prior+1,v_reason);
  return jsonb_build_object('action',p_action,'version',v_prior+1);
end;
$$;

create or replace function public.finalize_challenge_result(
  p_challenge_id uuid,
  p_request_id uuid,
  p_expected_lifecycle_version integer,
  p_expected_current_version_id uuid,
  p_expected_current_result_id uuid,
  p_public_note text,
  p_placements jsonb,
  p_correction_reason text default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_challenge public.challenges%rowtype;
  v_version public.challenge_versions%rowtype;
  v_existing public.challenge_results%rowtype;
  v_result_id uuid := gen_random_uuid();
  v_result_version integer;
  v_note text := btrim(p_public_note);
  v_reason text := nullif(btrim(p_correction_reason),'');
  v_max_votes integer;
begin
  perform private.assert_admin_actor();
  select * into v_existing from public.challenge_results where finalized_by=v_actor and request_id=p_request_id;
  if found then return jsonb_build_object('challengeId',v_existing.challenge_id,'resultId',v_existing.id,
    'resultVersion',v_existing.result_version); end if;
  if jsonb_typeof(p_placements)<>'array' or char_length(v_note) not between 1 and 2000
    or v_reason is not null and char_length(v_reason) not between 1 and 500
  then raise sqlstate '22023' using message='challenge_result_input_invalid'; end if;
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found or v_challenge.lifecycle_version<>p_expected_lifecycle_version
    or v_challenge.current_version_id<>p_expected_current_version_id
    or v_challenge.current_result_id is distinct from p_expected_current_result_id
  then raise sqlstate 'PT409' using message='challenge_result_stale'; end if;
  select * into v_version from public.challenge_versions where id=v_challenge.current_version_id;
  if statement_timestamp()<v_version.voting_closes_at
  then raise sqlstate 'PT409' using message='challenge_result_voting_open'; end if;
  if v_challenge.moderation_state<>'visible' or v_challenge.state not in ('published','completed')
  then raise sqlstate 'PT409' using message='challenge_result_unavailable'; end if;
  if (v_challenge.current_result_id is null and (v_challenge.state<>'published' or v_reason is not null))
    or (v_challenge.current_result_id is not null and (v_challenge.state<>'completed' or v_reason is null))
  then raise sqlstate 'PT409' using message='challenge_result_correction_invalid'; end if;
  if jsonb_array_length(p_placements)<>v_version.official_placement_count
  then raise sqlstate 'PT422' using message='challenge_result_placements_incomplete'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_placements) x
    where jsonb_typeof(x)<>'object'
      or (select array_agg(k order by k) from jsonb_object_keys(x) k)
         is distinct from array['entryId','label','place']::text[]
      or not (x->>'entryId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or not (x->>'place' ~ '^[1-9][0-9]*$')
      or (x->>'place')::integer>v_version.official_placement_count
      or x->>'label'<>btrim(x->>'label') or char_length(x->>'label') not between 1 and 80
  ) then raise sqlstate 'PT422' using message='challenge_result_placement_invalid'; end if;
  if (select count(distinct (x->>'place')::integer) from jsonb_array_elements(p_placements) x)
      <>jsonb_array_length(p_placements)
    or (select count(distinct (x->>'entryId')::uuid) from jsonb_array_elements(p_placements) x)
      <>jsonb_array_length(p_placements)
  then raise sqlstate 'PT422' using message='challenge_result_placement_duplicate'; end if;
  if exists(select 1 from jsonb_array_elements(p_placements) x
    where not exists(select 1 from public.challenge_entries e
      where e.id=(x->>'entryId')::uuid and e.challenge_id=v_challenge.id
        and e.challenge_version_id=v_version.id and e.status='active' and e.moderation_state='visible'
        and private.challenge_entry_is_public(e,statement_timestamp())))
  then raise sqlstate 'PT422' using message='challenge_result_placement_ineligible'; end if;

  v_result_version := coalesce((select max(result_version)+1 from public.challenge_results where challenge_id=v_challenge.id),1);
  insert into public.challenge_results(id,challenge_id,challenge_version_id,result_version,supersedes_result_id,
    finalized_by,request_id,public_note,correction_reason)
  values(v_result_id,v_challenge.id,v_version.id,v_result_version,v_challenge.current_result_id,
    v_actor,p_request_id,v_note,v_reason);

  insert into public.challenge_result_entries(challenge_result_id,challenge_entry_id,final_vote_total)
  select v_result_id,e.id,count(v.id)::integer
  from public.challenge_entries e
  left join public.challenge_votes v on v.challenge_entry_id=e.id and v.challenge_id=e.challenge_id and v.state='active'
  where e.challenge_id=v_challenge.id and e.challenge_version_id=v_version.id
    and e.status='active' and e.moderation_state='visible'
    and private.challenge_entry_is_public(e,statement_timestamp())
  group by e.id;
  if not found then raise sqlstate 'PT422' using message='challenge_result_no_eligible_entries'; end if;

  insert into public.challenge_result_placements(challenge_result_id,place,challenge_entry_id,placement_label)
  select v_result_id,(x->>'place')::integer,(x->>'entryId')::uuid,x->>'label'
  from jsonb_array_elements(p_placements) x;

  select max(final_vote_total) into v_max_votes from public.challenge_result_entries where challenge_result_id=v_result_id;
  insert into public.challenge_result_community_favorites(challenge_result_id,challenge_entry_id,final_vote_total)
  select v_result_id,challenge_entry_id,final_vote_total from public.challenge_result_entries
  where challenge_result_id=v_result_id and final_vote_total=v_max_votes;

  update public.challenges set state='completed',completed_at=coalesce(completed_at,statement_timestamp()),
    current_result_id=v_result_id,lifecycle_version=lifecycle_version+1,updated_at=statement_timestamp()
    where id=v_challenge.id;
  return jsonb_build_object('challengeId',v_challenge.id,'resultId',v_result_id,'resultVersion',v_result_version,
    'lifecycleVersion',v_challenge.lifecycle_version+1);
end;
$$;

create or replace function private.challenge_result_projection(p_result_id uuid,p_public boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',r.id,'version',r.result_version,'finalizedAt',r.finalized_at,'note',r.public_note,
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'entryId',e.id,'projectTitle',e.project_title_snapshot,'entrantUsername',e.entrant_username_snapshot,
      'entrantDisplayName',e.entrant_display_name_snapshot,'entrantCreditName',e.entrant_credit_name_snapshot,
      'revisionNumber',e.revision_number_snapshot,'revisionMessage',e.revision_message_snapshot,
      'attributions',e.attribution_snapshot,'durationMs',e.duration_ms_snapshot,'submittedAt',e.submitted_at,
      'voteTotal',re.final_vote_total
    ) order by re.final_vote_total desc,e.id)
      from public.challenge_result_entries re join public.challenge_entries e on e.id=re.challenge_entry_id
      where re.challenge_result_id=r.id
        and (not p_public or private.challenge_entry_is_public(e,statement_timestamp()))),'[]'::jsonb),
    'placements',coalesce((select jsonb_agg(jsonb_build_object(
      'place',rp.place,'label',rp.placement_label,'entryId',e.id,'projectTitle',e.project_title_snapshot,
      'entrantUsername',e.entrant_username_snapshot,'entrantCreditName',e.entrant_credit_name_snapshot
    ) order by rp.place)
      from public.challenge_result_placements rp join public.challenge_entries e on e.id=rp.challenge_entry_id
      where rp.challenge_result_id=r.id
        and (not p_public or private.challenge_entry_is_public(e,statement_timestamp()))),'[]'::jsonb),
    'communityFavorites',coalesce((select jsonb_agg(jsonb_build_object(
      'entryId',e.id,'projectTitle',e.project_title_snapshot,'entrantUsername',e.entrant_username_snapshot,
      'entrantCreditName',e.entrant_credit_name_snapshot,'voteTotal',rf.final_vote_total
    ) order by e.id)
      from public.challenge_result_community_favorites rf join public.challenge_entries e on e.id=rf.challenge_entry_id
      where rf.challenge_result_id=r.id
        and (not p_public or private.challenge_entry_is_public(e,statement_timestamp()))),'[]'::jsonb),
    'supersedesResultId',case when p_public then null else r.supersedes_result_id end,
    'correctionReason',case when p_public then null else r.correction_reason end
  ) from public.challenge_results r where r.id=p_result_id
$$;

create or replace function public.get_admin_challenge_results(p_challenge_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();
  return jsonb_build_object(
    'challenge',private.challenge_projection(p_challenge_id,false),
    'results',coalesce((select jsonb_agg(private.challenge_result_projection(r.id,false) order by r.result_version desc)
      from public.challenge_results r where r.challenge_id=p_challenge_id),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('entryId',e.id,'projectTitle',e.project_title_snapshot,
      'entrantUsername',e.entrant_username_snapshot,'status',e.status,'moderationState',e.moderation_state,
      'moderationVersion',e.moderation_version,'voteTotal',(select count(*) from public.challenge_votes v where v.challenge_entry_id=e.id and v.state='active'))
      order by e.submitted_at,e.id) from public.challenge_entries e where e.challenge_id=p_challenge_id),'[]'::jsonb),
    'votes',coalesce((select jsonb_agg(jsonb_build_object('voteId',v.id,'entryId',v.challenge_entry_id,
      'voterId',v.voter_id,'state',v.state,'voteVersion',v.vote_version,'updatedAt',v.updated_at) order by v.updated_at desc,v.id)
      from public.challenge_votes v where v.challenge_id=p_challenge_id),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(jsonb_build_object(
      'reportId',r.id,'targetKind',r.target_kind,'entryId',r.challenge_entry_id,
      'targetLabel',case when r.target_kind='challenge' then cv.title else e.project_title_snapshot end,
      'reason',r.reason,'details',r.details,'createdAt',r.created_at
    ) order by r.created_at desc,r.id)
      from private.challenge_reports r
      join public.challenges c on c.id=r.challenge_id
      join public.challenge_versions cv on cv.id=c.current_version_id
      left join public.challenge_entries e on e.id=r.challenge_entry_id
      where r.challenge_id=p_challenge_id),'[]'::jsonb),
    'reportCount',(select count(*) from private.challenge_reports r where r.challenge_id=p_challenge_id),
    'featuredSelection',jsonb_build_object(
      'challengeId',(select challenge_id from private.challenge_featured_selection where singleton),
      'version',coalesce((select selection_version from private.challenge_featured_selection where singleton),
        (select max(new_version) from private.challenge_featured_actions),0)
    )
  );
end;
$$;

create or replace function public.set_featured_challenge(
  p_request_id uuid,
  p_challenge_id uuid,
  p_expected_version integer
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_existing private.challenge_featured_actions%rowtype;
  v_current integer;
begin
  perform private.assert_admin_actor();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('challenge-featured-selection',0)
  );
  select * into v_existing from private.challenge_featured_actions where actor_id=v_actor and request_id=p_request_id;
  if found then return jsonb_build_object('challengeId',v_existing.challenge_id,'selectionVersion',v_existing.new_version); end if;
  select coalesce((select selection_version from private.challenge_featured_selection where singleton),
    (select max(new_version) from private.challenge_featured_actions),0) into v_current;
  if v_current<>p_expected_version then raise sqlstate 'PT409' using message='challenge_featured_stale'; end if;
  if not exists(select 1 from public.challenges c where c.id=p_challenge_id
      and c.state in ('published','completed') and c.moderation_state='visible')
  then raise sqlstate 'PT422' using message='challenge_featured_unavailable'; end if;
  insert into private.challenge_featured_selection(singleton,challenge_id,selection_version,selected_by)
    values(true,p_challenge_id,v_current+1,v_actor)
    on conflict(singleton) do update set challenge_id=excluded.challenge_id,selection_version=excluded.selection_version,
      selected_by=excluded.selected_by,selected_at=statement_timestamp();
  insert into private.challenge_featured_actions(actor_id,request_id,action,challenge_id,prior_version,new_version)
    values(v_actor,p_request_id,'select',p_challenge_id,v_current,v_current+1);
  return jsonb_build_object('challengeId',p_challenge_id,'selectionVersion',v_current+1);
end;
$$;

create or replace function public.clear_featured_challenge(p_request_id uuid,p_expected_version integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := (select auth.uid()); v_existing private.challenge_featured_actions%rowtype; v_current integer;
begin
  perform private.assert_admin_actor();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('challenge-featured-selection',0)
  );
  select * into v_existing from private.challenge_featured_actions where actor_id=v_actor and request_id=p_request_id;
  if found then return jsonb_build_object('challengeId',null,'selectionVersion',v_existing.new_version); end if;
  select coalesce((select selection_version from private.challenge_featured_selection where singleton),
    (select max(new_version) from private.challenge_featured_actions),0) into v_current;
  if v_current<>p_expected_version then raise sqlstate 'PT409' using message='challenge_featured_stale'; end if;
  delete from private.challenge_featured_selection where singleton;
  insert into private.challenge_featured_actions(actor_id,request_id,action,prior_version,new_version)
    values(v_actor,p_request_id,'clear',v_current,v_current+1);
  return jsonb_build_object('challengeId',null,'selectionVersion',v_current+1);
end;
$$;

create or replace function private.challenge_entry_is_public(p_entry public.challenge_entries,p_now timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entry.status='active' and p_entry.moderation_state='visible' and exists(
    select 1 from public.challenges c
    join public.challenge_versions v on v.id=p_entry.challenge_version_id and v.challenge_id=c.id
    join public.projects p on p.id=p_entry.project_id
    join public.profiles entrant on entrant.id=p_entry.entrant_id
    where c.id=p_entry.challenge_id and c.current_version_id=p_entry.challenge_version_id
      and c.moderation_state='visible'
      and (c.state='completed' or (c.state='published' and p_now>=v.voting_opens_at))
      and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
      and entrant.status='active' and entrant.profile_completed_at is not null
      and entrant.moderation_state='visible' and entrant.purged_at is null
  )
$$;

create or replace function private.challenge_entry_public_projection(p_entry_id uuid,p_now timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('entryId',e.id,'challengeId',e.challenge_id,'challengeVersionId',e.challenge_version_id,
    'projectTitle',e.project_title_snapshot,'entrantUsername',e.entrant_username_snapshot,
    'entrantDisplayName',e.entrant_display_name_snapshot,'entrantCreditName',e.entrant_credit_name_snapshot,
    'revisionNumber',e.revision_number_snapshot,'revisionMessage',e.revision_message_snapshot,
    'attributions',e.attribution_snapshot,'durationMs',e.duration_ms_snapshot,'submittedAt',e.submitted_at,
    'voteTotal',case when p_now>=v.voting_closes_at then
      case when c.current_result_id is not null then (select re.final_vote_total from public.challenge_result_entries re
        where re.challenge_result_id=c.current_result_id and re.challenge_entry_id=e.id)
      else (select count(*)::integer from public.challenge_votes cv where cv.challenge_entry_id=e.id and cv.state='active') end
      else null end)
  from public.challenge_entries e join public.challenges c on c.id=e.challenge_id
  join public.challenge_versions v on v.id=e.challenge_version_id
  where e.id=p_entry_id and private.challenge_entry_is_public(e,p_now)
$$;

drop function public.list_public_challenge_entries(text);
create function public.list_public_challenge_entries(
  p_slug text,
  p_rotation_bucket timestamptz default null,
  p_after_rotation_key text default null,
  p_after_entry_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_challenge public.challenges%rowtype;
  v_now timestamptz := statement_timestamp();
  v_current_bucket timestamptz := date_trunc('hour',statement_timestamp(),'UTC');
  v_bucket timestamptz := coalesce(p_rotation_bucket,date_trunc('hour',statement_timestamp(),'UTC'));
  v_entries jsonb;
  v_has_more boolean;
  v_next_cursor jsonb;
begin
  if (p_after_rotation_key is null)<>(p_after_entry_id is null)
  then raise sqlstate '22023' using message='challenge_entry_cursor_invalid'; end if;
  if v_bucket<>date_trunc('hour',v_bucket,'UTC') or v_bucket>v_current_bucket or v_bucket<v_current_bucket-interval '1 hour'
  then raise sqlstate '22023' using message='challenge_rotation_bucket_invalid'; end if;
  select * into v_challenge from public.challenges where slug=p_slug and state<>'draft' and moderation_state='visible';
  if not found then
    return jsonb_build_object('rotationBucket',v_bucket,'entries','[]'::jsonb,'nextCursor',null);
  end if;
  with ranked as (
    select q.id,q.rotation_key,row_number() over(order by q.rotation_key,q.id) as ordinal from (
      select e.id,encode(extensions.digest(pg_catalog.convert_to(v_challenge.id::text||':'||v_challenge.current_version_id::text||':'||
        v_bucket::text||':'||e.id::text,'UTF8'),'sha256'),'hex') rotation_key
      from public.challenge_entries e where e.challenge_id=v_challenge.id and private.challenge_entry_is_public(e,v_now)
    ) q where p_after_rotation_key is null or (q.rotation_key,q.id)>(p_after_rotation_key,p_after_entry_id)
      order by q.rotation_key,q.id limit 26
  )
  select coalesce(jsonb_agg(
      private.challenge_entry_public_projection(ranked.id,v_now)||jsonb_build_object('rotationKey',ranked.rotation_key)
      order by ranked.rotation_key,ranked.id
    ) filter (where ranked.ordinal<=25),'[]'::jsonb),count(*)>25
    into v_entries,v_has_more from ranked;
  if v_has_more then
    v_next_cursor := jsonb_build_object(
      'rotationKey',(v_entries->-1)->>'rotationKey',
      'entryId',(v_entries->-1)->>'entryId'
    );
  end if;
  return jsonb_build_object('rotationBucket',v_bucket,'entries',v_entries,'nextCursor',v_next_cursor);
end;
$$;

create or replace function private.challenge_projection(p_challenge_id uuid,p_public boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',c.id,'slug',c.slug,'state',c.state,
    'phase',private.challenge_public_phase(c.state,v.opens_at,v.submissions_close_at,statement_timestamp()),
    'acceptsVotes',c.state='published' and c.moderation_state='visible'
      and statement_timestamp()>=v.voting_opens_at and statement_timestamp()<v.voting_closes_at,
    'lifecycleVersion',c.lifecycle_version,'currentVersionId',c.current_version_id,'versionNumber',v.version_number,
    'title',v.title,'prompt',v.prompt,'description',v.description,'eligibilityTerms',v.eligibility_terms,
    'presentationCode',v.presentation_code,'opensAt',v.opens_at,'submissionsCloseAt',v.submissions_close_at,
    'votingOpensAt',v.voting_opens_at,'votingClosesAt',v.voting_closes_at,'resultsExpectedAt',v.results_expected_at,
    'judgingMode',v.judging_mode,'officialPlacementCount',v.official_placement_count,
    'constraints',v.constraints,'constraintsSha256',v.constraints_sha256,
    'judges',coalesce((select jsonb_agg(jsonb_build_object('position',j.position,'role',j.role,'displayName',j.display_name,
      'profileId',j.profile_id,'creditName',j.credit_name) order by j.position)
      from public.challenge_judge_credits j where j.challenge_version_id=v.id),'[]'::jsonb),
    'starter',case when v.starter_project_id is null then null else jsonb_build_object(
      'projectId',v.starter_project_id,'revisionId',v.starter_revision_id,'projectTitle',v.starter_project_title,
      'creatorCreditName',v.starter_creator_credit_name,'revisionNumber',v.starter_revision_number,
      'licenseCode',v.starter_license_code,'available',exists(select 1 from public.projects p where p.id=v.starter_project_id
        and p.visibility='public' and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
        and p.license_code='cc-by-4.0')) end,
    'publishedAt',c.published_at,'completedAt',c.completed_at,'cancelledAt',c.cancelled_at,
    'cancellationNote',c.cancellation_note,'createdAt',c.created_at,'updatedAt',c.updated_at,
    'moderationState',case when p_public then null else c.moderation_state end,
    'moderationVersion',case when p_public then null else c.moderation_version end,
    'currentResultId',c.current_result_id,
    'result',case when c.current_result_id is null then null else private.challenge_result_projection(c.current_result_id,p_public) end
  ) from public.challenges c join public.challenge_versions v on v.id=c.current_version_id
  where c.id=p_challenge_id and (not p_public or c.moderation_state='visible')
    and (not p_public or c.state<>'draft') and (not p_public or c.state<>'cancelled' or c.published_at is not null)
$$;

create or replace function public.list_public_challenges(
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (p_after_updated_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='challenge_cursor_invalid'; end if;
  return coalesce((select jsonb_agg(private.challenge_projection(c.id,true) order by c.updated_at desc,c.id desc)
    from (select id,updated_at from public.challenges where state<>'draft' and moderation_state='visible'
      and (state<>'cancelled' or published_at is not null)
      and (p_after_updated_at is null or (updated_at,id)<(p_after_updated_at,p_after_id))
      order by updated_at desc,id desc limit 25) c),'[]'::jsonb);
end;
$$;

create or replace function public.get_public_challenge(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.challenge_projection(c.id,true) from public.challenges c
  where c.slug=p_slug and c.moderation_state='visible'
$$;

create or replace function public.get_featured_challenge()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_id uuid; v_kind text; v_label text; v_now timestamptz := statement_timestamp();
begin
  select s.challenge_id into v_id from private.challenge_featured_selection s join public.challenges c on c.id=s.challenge_id
    where c.moderation_state='visible' and c.state in ('published','completed');
  if found then v_kind:='selected'; v_label:='Featured selection';
  else
    select c.id into v_id from public.challenges c join public.challenge_versions v on v.id=c.current_version_id
      where c.state='published' and c.moderation_state='visible' and v.opens_at>v_now
      order by v.opens_at,c.id limit 1;
    if found then v_kind:='next_scheduled'; v_label:='Up next';
    else
      select c.id into v_id from public.challenges c join public.challenge_versions v on v.id=c.current_version_id
        where c.state='published' and c.moderation_state='visible' and v.opens_at<=v_now and v.voting_closes_at>v_now
        order by v.opens_at desc,c.id limit 1;
      if found then
        v_kind:='active';
        v_label:=case when exists(select 1 from public.challenge_versions v2 where v2.id=(select current_version_id from public.challenges where id=v_id)
          and v_now>=v2.voting_opens_at) then 'Voting now' else 'Open now' end;
      else
        select c.id into v_id from public.challenges c where c.state='completed' and c.moderation_state='visible'
          order by c.completed_at desc,c.id limit 1;
        if found then v_kind:='recent_completed'; v_label:='Latest results'; end if;
      end if;
    end if;
  end if;
  if v_id is null then return null; end if;
  return jsonb_build_object('selectionKind',v_kind,'label',v_label,'challenge',private.challenge_projection(v_id,true));
end;
$$;

alter table public.challenge_votes enable row level security;
alter table public.challenge_results enable row level security;
alter table public.challenge_result_entries enable row level security;
alter table public.challenge_result_placements enable row level security;
alter table public.challenge_result_community_favorites enable row level security;
alter table private.challenge_vote_commands enable row level security;
alter table private.challenge_reports enable row level security;
alter table private.challenge_moderation_actions enable row level security;
alter table private.challenge_featured_selection enable row level security;
alter table private.challenge_featured_actions enable row level security;

revoke all on table public.challenge_votes,public.challenge_results,public.challenge_result_entries,
  public.challenge_result_placements,public.challenge_result_community_favorites from public,anon,authenticated;
revoke all on table private.challenge_vote_commands,private.challenge_reports,private.challenge_moderation_actions,
  private.challenge_featured_selection,private.challenge_featured_actions from public,anon,authenticated;
grant select,insert,update,delete on table public.challenge_votes,public.challenge_results,public.challenge_result_entries,
  public.challenge_result_placements,public.challenge_result_community_favorites to service_role;
grant select,insert,update,delete on table private.challenge_vote_commands,private.challenge_reports,
  private.challenge_moderation_actions,private.challenge_featured_selection,private.challenge_featured_actions to service_role;

revoke all on function private.protect_challenge_vote_change() from public,anon,authenticated;
revoke all on function private.challenge_result_projection(uuid,boolean) from public,anon,authenticated;
revoke all on function public.set_challenge_vote(uuid,boolean,uuid) from public,anon;
revoke all on function public.list_my_active_challenge_vote_ids(uuid) from public,anon;
revoke all on function public.report_challenge_content(uuid,text,uuid,uuid,text,text) from public,anon;
revoke all on function public.moderate_challenge_target(uuid,uuid,uuid,uuid,text,integer,text) from public,anon;
revoke all on function public.finalize_challenge_result(uuid,uuid,integer,uuid,uuid,text,jsonb,text) from public,anon;
revoke all on function public.get_admin_challenge_results(uuid) from public,anon;
revoke all on function public.set_featured_challenge(uuid,uuid,integer) from public,anon;
revoke all on function public.clear_featured_challenge(uuid,integer) from public,anon;
revoke all on function public.list_public_challenge_entries(text,timestamptz,text,uuid) from public;
revoke all on function public.get_featured_challenge() from public;

grant execute on function public.set_challenge_vote(uuid,boolean,uuid) to authenticated;
grant execute on function public.list_my_active_challenge_vote_ids(uuid) to authenticated;
grant execute on function public.report_challenge_content(uuid,text,uuid,uuid,text,text) to authenticated;
grant execute on function public.moderate_challenge_target(uuid,uuid,uuid,uuid,text,integer,text) to authenticated;
grant execute on function public.finalize_challenge_result(uuid,uuid,integer,uuid,uuid,text,jsonb,text) to authenticated;
grant execute on function public.get_admin_challenge_results(uuid) to authenticated;
grant execute on function public.set_featured_challenge(uuid,uuid,integer) to authenticated;
grant execute on function public.clear_featured_challenge(uuid,integer) to authenticated;
grant execute on function public.list_public_challenge_entries(text,timestamptz,text,uuid) to anon,authenticated;
grant execute on function public.get_featured_challenge() to anon,authenticated;

comment on table public.challenge_votes is 'One private logical vote per voter and exact challenge entry; totals are exposed only by phase-safe projections.';
comment on table private.challenge_vote_commands is 'Private idempotency and rate-limit audit for serialized vote add/remove commands.';
comment on table private.challenge_reports is 'Bounded private challenge and challenge-entry reports; intake alone never changes visibility.';
comment on table private.challenge_moderation_actions is 'Private optimistic administrator audit for challenge, entry, and vote moderation.';
comment on table public.challenge_results is 'Append-only immutable finalized challenge result versions and correction chain.';
comment on table public.challenge_result_entries is 'Frozen eligible entry and final included-vote totals for one immutable result version.';
comment on table public.challenge_result_placements is 'Normalized immutable official placements for one complete result version.';
comment on table public.challenge_result_community_favorites is 'Every immutable highest-vote tie computed by Postgres during result finalization.';
comment on table private.challenge_featured_selection is 'Singleton administrator-selected featured challenge authority.';
comment on table private.challenge_featured_actions is 'Append-only featured selection and clear audit history.';
