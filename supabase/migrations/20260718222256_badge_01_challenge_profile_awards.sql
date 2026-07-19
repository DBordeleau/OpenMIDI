-- BADGE-01: versioned challenge badge catalog, immutable exact-result awards,
-- transactional result issuance, and a bounded public profile projection.

create table public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  current_version_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint badge_definitions_code_check check (
    code=lower(code) and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(code) between 3 and 40
  ),
  constraint badge_definitions_timestamps_check check (updated_at>=created_at)
);

create table public.badge_definition_versions (
  id uuid primary key default gen_random_uuid(),
  badge_definition_id uuid not null references public.badge_definitions(id) on delete restrict,
  version_number integer not null,
  name text not null,
  description text not null,
  earned_message text not null,
  presentation_code text not null,
  qualification_kind text not null,
  minimum_place integer,
  maximum_place integer,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(badge_definition_id,version_number),
  unique(badge_definition_id,id),
  constraint badge_definition_versions_number_check check (version_number>0),
  constraint badge_definition_versions_name_check check (
    name=btrim(name) and char_length(name) between 1 and 80
  ),
  constraint badge_definition_versions_description_check check (
    description=btrim(description) and char_length(description) between 1 and 240
  ),
  constraint badge_definition_versions_message_check check (
    earned_message=btrim(earned_message) and char_length(earned_message) between 1 and 240
  ),
  constraint badge_definition_versions_presentation_check check (
    presentation_code in ('trophy','favorite','placement')
  ),
  constraint badge_definition_versions_qualification_check check (
    (qualification_kind='official_winner' and minimum_place=1 and maximum_place=1)
    or (qualification_kind='community_favorite' and minimum_place is null and maximum_place is null)
    or (qualification_kind='top_placement' and minimum_place=2 and maximum_place between minimum_place and 20)
  )
);

alter table public.badge_definitions add constraint badge_definitions_current_version_fk
  foreign key(id,current_version_id)
  references public.badge_definition_versions(badge_definition_id,id)
  on delete restrict deferrable initially immediate;

insert into public.badge_definitions(id,code)
values
  ('ba000001-0000-4000-8000-000000000001','challenge-winner'),
  ('ba000001-0000-4000-8000-000000000002','community-favorite'),
  ('ba000001-0000-4000-8000-000000000003','top-placement');

insert into public.badge_definition_versions(
  id,badge_definition_id,version_number,name,description,earned_message,
  presentation_code,qualification_kind,minimum_place,maximum_place,created_by
)
values
  ('ba000001-0000-4000-8000-000000000011','ba000001-0000-4000-8000-000000000001',1,
    'Challenge Winner','Awarded for the official first-place challenge entry.',
    'Your arrangement took the top official spot.','trophy','official_winner',1,1,null),
  ('ba000001-0000-4000-8000-000000000012','ba000001-0000-4000-8000-000000000002',1,
    'Community Favorite','Awarded to every entry tied for the highest final community vote total.',
    'Listeners made this arrangement a community favorite.','favorite','community_favorite',null,null,null),
  ('ba000001-0000-4000-8000-000000000013','ba000001-0000-4000-8000-000000000003',1,
    'Top Placement','Awarded for an official challenge placement after first place.',
    'Your arrangement earned an official top placement.','placement','top_placement',2,20,null);

update public.badge_definitions set
  current_version_id=case code
    when 'challenge-winner' then 'ba000001-0000-4000-8000-000000000011'::uuid
    when 'community-favorite' then 'ba000001-0000-4000-8000-000000000012'::uuid
    when 'top-placement' then 'ba000001-0000-4000-8000-000000000013'::uuid
  end,
  updated_at=statement_timestamp();

alter table public.badge_definitions alter column current_version_id set not null;

create table public.profile_awards (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_version_id uuid not null,
  challenge_result_id uuid not null,
  challenge_entry_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_revision_id uuid not null,
  badge_definition_id uuid not null references public.badge_definitions(id) on delete restrict,
  badge_definition_version_id uuid not null,
  badge_code_snapshot text not null,
  badge_name_snapshot text not null,
  badge_description_snapshot text not null,
  badge_earned_message_snapshot text not null,
  presentation_code_snapshot text not null,
  challenge_slug_snapshot text not null,
  challenge_title_snapshot text not null,
  recipient_username_snapshot text not null,
  recipient_display_name_snapshot text not null,
  recipient_credit_name_snapshot text not null,
  project_title_snapshot text not null,
  revision_number_snapshot integer not null,
  award_basis text not null,
  place integer,
  placement_label_snapshot text,
  final_vote_total integer not null,
  awarded_at timestamptz not null default statement_timestamp(),
  unique(challenge_result_id,challenge_entry_id,badge_definition_id),
  constraint profile_awards_challenge_version_fk foreign key(challenge_id,challenge_version_id)
    references public.challenge_versions(challenge_id,id) on delete restrict,
  constraint profile_awards_challenge_result_fk foreign key(challenge_id,challenge_result_id)
    references public.challenge_results(challenge_id,id) on delete restrict,
  constraint profile_awards_result_entry_fk foreign key(challenge_result_id,challenge_entry_id)
    references public.challenge_result_entries(challenge_result_id,challenge_entry_id) on delete restrict,
  constraint profile_awards_challenge_entry_fk foreign key(challenge_id,challenge_entry_id)
    references public.challenge_entries(challenge_id,id) on delete restrict,
  constraint profile_awards_project_revision_fk foreign key(project_id,project_revision_id)
    references public.project_revisions(project_id,id) on delete restrict,
  constraint profile_awards_badge_version_fk foreign key(badge_definition_id,badge_definition_version_id)
    references public.badge_definition_versions(badge_definition_id,id) on delete restrict,
  constraint profile_awards_code_check check (
    badge_code_snapshot=lower(badge_code_snapshot)
    and badge_code_snapshot ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(badge_code_snapshot) between 3 and 40
  ),
  constraint profile_awards_snapshot_text_check check (
    badge_name_snapshot=btrim(badge_name_snapshot) and char_length(badge_name_snapshot) between 1 and 80
    and badge_description_snapshot=btrim(badge_description_snapshot) and char_length(badge_description_snapshot) between 1 and 240
    and badge_earned_message_snapshot=btrim(badge_earned_message_snapshot) and char_length(badge_earned_message_snapshot) between 1 and 240
    and challenge_title_snapshot=btrim(challenge_title_snapshot) and char_length(challenge_title_snapshot) between 1 and 120
    and recipient_username_snapshot=btrim(recipient_username_snapshot) and char_length(recipient_username_snapshot) between 3 and 30
    and recipient_display_name_snapshot=btrim(recipient_display_name_snapshot) and char_length(recipient_display_name_snapshot) between 1 and 80
    and recipient_credit_name_snapshot=btrim(recipient_credit_name_snapshot) and char_length(recipient_credit_name_snapshot) between 1 and 120
    and project_title_snapshot=btrim(project_title_snapshot) and char_length(project_title_snapshot) between 1 and 120
  ),
  constraint profile_awards_presentation_check check (
    presentation_code_snapshot in ('trophy','favorite','placement')
  ),
  constraint profile_awards_slug_check check (
    challenge_slug_snapshot=lower(challenge_slug_snapshot)
    and challenge_slug_snapshot ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(challenge_slug_snapshot) between 3 and 80
  ),
  constraint profile_awards_basis_check check (
    (award_basis='official_winner' and place=1 and placement_label_snapshot is not null)
    or (award_basis='top_placement' and place between 2 and 20 and placement_label_snapshot is not null)
    or (award_basis='community_favorite' and place is null and placement_label_snapshot is null)
  ),
  constraint profile_awards_placement_label_check check (
    placement_label_snapshot is null or
    (placement_label_snapshot=btrim(placement_label_snapshot) and char_length(placement_label_snapshot) between 1 and 80)
  ),
  constraint profile_awards_result_values_check check (
    revision_number_snapshot>0 and final_vote_total>=0
  )
);

create index profile_awards_public_profile_idx
  on public.profile_awards(recipient_id,awarded_at desc,id desc);
create index profile_awards_challenge_result_idx
  on public.profile_awards(challenge_id,challenge_result_id);

create table private.challenge_award_issuance (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  challenge_result_id uuid not null,
  prior_result_id uuid references public.challenge_results(id) on delete restrict,
  source_kind text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  winner_count integer not null,
  favorite_count integer not null,
  top_placement_count integer not null,
  total_awards_inserted integer not null,
  response jsonb not null,
  completed_at timestamptz not null default statement_timestamp(),
  unique(source_kind,actor_id,request_id),
  constraint challenge_award_issuance_result_fk foreign key(challenge_id,challenge_result_id)
    references public.challenge_results(challenge_id,id) on delete restrict,
  constraint challenge_award_issuance_source_check check (source_kind in ('result_finalization','reconciliation')),
  constraint challenge_award_issuance_counts_check check (
    winner_count>=0 and favorite_count>=0 and top_placement_count>=0
    and total_awards_inserted=winner_count+favorite_count+top_placement_count
  ),
  constraint challenge_award_issuance_response_check check (jsonb_typeof(response)='object')
);

create index challenge_award_issuance_result_idx
  on private.challenge_award_issuance(challenge_id,challenge_result_id,completed_at desc);

create trigger badge_definition_versions_immutable before update or delete on public.badge_definition_versions
  for each row execute function private.reject_append_only_change();
create trigger profile_awards_immutable before update or delete on public.profile_awards
  for each row execute function private.reject_append_only_change();
create trigger challenge_award_issuance_immutable before update or delete on private.challenge_award_issuance
  for each row execute function private.reject_append_only_change();

create or replace function private.issue_challenge_awards_for_result(
  p_challenge_id uuid,
  p_result_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_challenge public.challenges%rowtype;
  v_result public.challenge_results%rowtype;
  v_response jsonb;
  v_winner_count integer := 0;
  v_favorite_count integer := 0;
  v_top_count integer := 0;
begin
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found or v_challenge.state<>'completed'
    or v_challenge.moderation_state<>'visible'
    or v_challenge.current_result_id is distinct from p_result_id
  then raise sqlstate 'PT409' using message='challenge_award_result_not_current'; end if;

  select * into v_result from public.challenge_results
    where id=p_result_id and challenge_id=p_challenge_id;
  if not found or v_result.challenge_version_id is distinct from v_challenge.current_version_id
  then raise sqlstate 'PT409' using message='challenge_award_result_not_current'; end if;

  with qualifications as (
    select rp.challenge_entry_id,
      case when rp.place=1 then 'challenge-winner' else 'top-placement' end as badge_code,
      case when rp.place=1 then 'official_winner' else 'top_placement' end as award_basis,
      rp.place,
      rp.placement_label,
      re.final_vote_total
    from public.challenge_result_placements rp
    join public.challenge_result_entries re
      on re.challenge_result_id=rp.challenge_result_id and re.challenge_entry_id=rp.challenge_entry_id
    where rp.challenge_result_id=p_result_id
    union all
    select rf.challenge_entry_id,'community-favorite','community_favorite',null::integer,null::text,
      rf.final_vote_total
    from public.challenge_result_community_favorites rf
    join public.challenge_result_entries re
      on re.challenge_result_id=rf.challenge_result_id and re.challenge_entry_id=rf.challenge_entry_id
      and re.final_vote_total=rf.final_vote_total
    where rf.challenge_result_id=p_result_id
  ), inserted as (
    insert into public.profile_awards(
      recipient_id,challenge_id,challenge_version_id,challenge_result_id,challenge_entry_id,
      project_id,project_revision_id,badge_definition_id,badge_definition_version_id,
      badge_code_snapshot,badge_name_snapshot,badge_description_snapshot,badge_earned_message_snapshot,
      presentation_code_snapshot,challenge_slug_snapshot,challenge_title_snapshot,
      recipient_username_snapshot,recipient_display_name_snapshot,recipient_credit_name_snapshot,
      project_title_snapshot,revision_number_snapshot,award_basis,place,placement_label_snapshot,
      final_vote_total
    )
    select e.entrant_id,e.challenge_id,e.challenge_version_id,p_result_id,e.id,
      e.project_id,e.project_revision_id,d.id,dv.id,d.code,dv.name,dv.description,dv.earned_message,
      dv.presentation_code,c.slug,cv.title,e.entrant_username_snapshot,e.entrant_display_name_snapshot,
      e.entrant_credit_name_snapshot,e.project_title_snapshot,e.revision_number_snapshot,
      q.award_basis,q.place,q.placement_label,q.final_vote_total
    from qualifications q
    join public.challenge_entries e on e.id=q.challenge_entry_id
      and e.challenge_id=p_challenge_id and e.challenge_version_id=v_result.challenge_version_id
    join public.challenges c on c.id=e.challenge_id
    join public.challenge_versions cv on cv.id=e.challenge_version_id and cv.challenge_id=e.challenge_id
    join public.badge_definitions d on d.code=q.badge_code and d.is_active
    join public.badge_definition_versions dv on dv.id=d.current_version_id and dv.badge_definition_id=d.id
      and dv.qualification_kind=q.award_basis
      and (q.place is null or q.place between dv.minimum_place and dv.maximum_place)
    on conflict(challenge_result_id,challenge_entry_id,badge_definition_id) do nothing
    returning award_basis
  )
  select count(*) filter(where award_basis='official_winner')::integer,
    count(*) filter(where award_basis='community_favorite')::integer,
    count(*) filter(where award_basis='top_placement')::integer
  into v_winner_count,v_favorite_count,v_top_count
  from inserted;

  v_response := jsonb_build_object(
    'challengeId',p_challenge_id,
    'resultId',p_result_id,
    'winnerCount',v_winner_count,
    'communityFavoriteCount',v_favorite_count,
    'topPlacementCount',v_top_count,
    'totalAwardsInserted',v_winner_count+v_favorite_count+v_top_count
  );

  insert into private.challenge_award_issuance(
    challenge_id,challenge_result_id,prior_result_id,source_kind,actor_id,request_id,
    winner_count,favorite_count,top_placement_count,total_awards_inserted,response
  ) values(
    p_challenge_id,p_result_id,v_result.supersedes_result_id,'result_finalization',
    v_result.finalized_by,v_result.request_id,v_winner_count,v_favorite_count,v_top_count,
    v_winner_count+v_favorite_count+v_top_count,v_response
  ) on conflict(source_kind,actor_id,request_id) do nothing;

  return v_response;
end;
$$;

create or replace function public.reconcile_current_challenge_awards(
  p_challenge_id uuid,
  p_request_id uuid,
  p_expected_result_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin_actor();
  v_challenge public.challenges%rowtype;
  v_existing private.challenge_award_issuance%rowtype;
  v_result public.challenge_results%rowtype;
  v_response jsonb;
begin
  if p_challenge_id is null or p_request_id is null or p_expected_result_id is null
  then raise sqlstate '22023' using message='challenge_award_reconcile_input_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_request_id::text,0));
  select * into v_existing from private.challenge_award_issuance
    where source_kind='reconciliation' and actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.challenge_id<>p_challenge_id or v_existing.challenge_result_id<>p_expected_result_id
    then raise sqlstate '22023' using message='challenge_award_reconcile_request_mismatch'; end if;
    return v_existing.response;
  end if;
  select * into v_challenge from public.challenges where id=p_challenge_id for update;
  if not found or v_challenge.current_result_id is distinct from p_expected_result_id
  then raise sqlstate 'PT409' using message='challenge_award_result_not_current'; end if;
  select * into v_result from public.challenge_results
    where id=p_expected_result_id and challenge_id=p_challenge_id;
  if not found then raise sqlstate 'PT409' using message='challenge_award_result_not_current'; end if;
  v_response := private.issue_challenge_awards_for_result(p_challenge_id,p_expected_result_id);
  insert into private.challenge_award_issuance(
    challenge_id,challenge_result_id,prior_result_id,source_kind,actor_id,request_id,
    winner_count,favorite_count,top_placement_count,total_awards_inserted,response
  ) values(
    p_challenge_id,p_expected_result_id,v_result.supersedes_result_id,'reconciliation',v_actor,p_request_id,
    (v_response->>'winnerCount')::integer,(v_response->>'communityFavoriteCount')::integer,
    (v_response->>'topPlacementCount')::integer,(v_response->>'totalAwardsInserted')::integer,v_response
  );
  return v_response;
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
  perform private.issue_challenge_awards_for_result(v_challenge.id,v_result_id);
  return jsonb_build_object('challengeId',v_challenge.id,'resultId',v_result_id,'resultVersion',v_result_version,
    'lifecycleVersion',v_challenge.lifecycle_version+1);
end;
$$;

create or replace function public.list_public_profile_awards(
  p_profile_id uuid,
  p_after_awarded_at timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (p_after_awarded_at is null) is distinct from (p_after_id is null)
  then raise sqlstate '22023' using message='profile_award_cursor_invalid'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',x.id,
      'badgeDefinitionVersionId',x.badge_definition_version_id,
      'badgeCode',x.badge_code_snapshot,
      'badgeName',x.badge_name_snapshot,
      'badgeDescription',x.badge_description_snapshot,
      'earnedMessage',x.badge_earned_message_snapshot,
      'presentationCode',x.presentation_code_snapshot,
      'awardBasis',x.award_basis,
      'place',x.place,
      'placementLabel',x.placement_label_snapshot,
      'awardedAt',x.awarded_at,
      'challengeSlug',x.challenge_slug_snapshot,
      'challengeTitle',x.challenge_title_snapshot,
      'challengeResultId',x.challenge_result_id,
      'challengeEntryId',x.challenge_entry_id,
      'projectRevisionId',x.project_revision_id,
      'projectTitle',x.project_title_snapshot,
      'revisionNumber',x.revision_number_snapshot,
      'challengeHref','/challenges/'||x.challenge_slug_snapshot||'?result='||x.challenge_result_id::text||'&entry='||x.challenge_entry_id::text||'#entry-'||x.challenge_entry_id::text
    ) order by x.awarded_at desc,x.id desc)
    from (
      select a.* from public.profile_awards a
      join public.challenges c on c.id=a.challenge_id
      join public.challenge_entries e on e.id=a.challenge_entry_id and e.challenge_id=a.challenge_id
      join public.projects p on p.id=a.project_id
      join public.profiles recipient on recipient.id=a.recipient_id
      where a.recipient_id=p_profile_id
        and c.state='completed' and c.moderation_state='visible'
        and c.current_result_id=a.challenge_result_id
        and e.status='active' and e.moderation_state='visible'
        and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
        and recipient.status='active' and recipient.profile_completed_at is not null
        and recipient.moderation_state='visible' and recipient.purged_at is null
        and (p_after_awarded_at is null or (a.awarded_at,a.id)<(p_after_awarded_at,p_after_id))
      order by a.awarded_at desc,a.id desc
      limit 24
    ) x
  ),'[]'::jsonb);
end;
$$;

create or replace function public.get_public_challenge_award_target(
  p_slug text,
  p_result_id uuid,
  p_entry_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.challenge_entry_public_projection(e.id,statement_timestamp())||jsonb_build_object(
    'resultId',r.id,
    'resultVersion',r.result_version,
    'resultFinalizedAt',r.finalized_at
  )
  from public.challenges c
  join public.challenge_results r on r.id=c.current_result_id and r.challenge_id=c.id
  join public.challenge_result_entries re
    on re.challenge_result_id=r.id and re.challenge_entry_id=p_entry_id
  join public.challenge_entries e
    on e.id=re.challenge_entry_id and e.challenge_id=c.id and e.challenge_version_id=r.challenge_version_id
  where c.slug=p_slug
    and c.state='completed'
    and c.moderation_state='visible'
    and r.id=p_result_id
    and private.challenge_entry_is_public(e,statement_timestamp())
    and exists(
      select 1 from public.profile_awards a
      where a.challenge_id=c.id
        and a.challenge_result_id=r.id
        and a.challenge_entry_id=e.id
    )
$$;

alter table public.badge_definitions enable row level security;
alter table public.badge_definition_versions enable row level security;
alter table public.profile_awards enable row level security;
alter table private.challenge_award_issuance enable row level security;

revoke all on table public.badge_definitions,public.badge_definition_versions,
  public.profile_awards,private.challenge_award_issuance from public,anon,authenticated;
grant select,insert,update,delete on table public.badge_definitions,public.badge_definition_versions,
  public.profile_awards,private.challenge_award_issuance to service_role;

revoke all on function private.issue_challenge_awards_for_result(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reconcile_current_challenge_awards(uuid,uuid,uuid) from public,anon;
revoke all on function public.list_public_profile_awards(uuid,timestamptz,uuid) from public;
revoke all on function public.get_public_challenge_award_target(text,uuid,uuid) from public;
grant execute on function public.reconcile_current_challenge_awards(uuid,uuid,uuid) to authenticated;
grant execute on function public.list_public_profile_awards(uuid,timestamptz,uuid) to anon,authenticated;
grant execute on function public.get_public_challenge_award_target(text,uuid,uuid) to anon,authenticated;

comment on table public.badge_definitions is 'Stable badge identities with one current immutable presentation version used only for future issuance.';
comment on table public.badge_definition_versions is 'Append-only bounded badge presentation and qualification versions.';
comment on table public.profile_awards is 'Immutable exact challenge-result, entry, revision, recipient, and badge-version award evidence.';
comment on table private.challenge_award_issuance is 'Private append-only finalization and reconciliation award issuance audit evidence.';
comment on function public.list_public_profile_awards(uuid,timestamptz,uuid) is 'Bounded current-result-only public profile award projection with moderation and source visibility inheritance.';
comment on function public.get_public_challenge_award_target(text,uuid,uuid) is 'Exact current-result award-entry target that fails closed across challenge, result, entry, award, and public-visibility boundaries.';
