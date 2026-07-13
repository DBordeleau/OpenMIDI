create type public.contribution_review_decision as enum (
  'request_changes',
  'reject',
  'accept'
);

create type public.contribution_review_reason as enum (
  'owner_feedback',
  'base_outdated'
);

alter table public.project_revisions
  add column accepted_contribution_id uuid,
  add column accepted_contribution_version_id uuid;

alter table public.project_revisions
  add constraint project_revisions_accepted_shape check (
    (accepted_contribution_id is null and accepted_contribution_version_id is null)
    or
    (accepted_contribution_id is not null and accepted_contribution_version_id is not null)
  ),
  add constraint project_revisions_accepted_contribution_project_fk
    foreign key (project_id, accepted_contribution_id)
    references public.contributions(project_id, id) on delete restrict,
  add constraint project_revisions_accepted_version_fk
    foreign key (accepted_contribution_id, accepted_contribution_version_id)
    references public.contribution_versions(contribution_id, id) on delete restrict,
  add constraint project_revisions_accepted_result_uq
    unique (accepted_contribution_id, id);

create unique index project_revisions_accepted_contribution_uq
  on public.project_revisions(accepted_contribution_id)
  where accepted_contribution_id is not null;
create unique index project_revisions_accepted_version_uq
  on public.project_revisions(accepted_contribution_version_id)
  where accepted_contribution_version_id is not null;

create table public.contribution_reviews (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete restrict,
  contribution_version_id uuid not null,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  requested_decision public.contribution_review_decision not null,
  applied_decision public.contribution_review_decision not null,
  reason public.contribution_review_reason,
  note text check (
    note is null
    or (note = btrim(note) and char_length(note) between 1 and 5000)
  ),
  expected_project_revision_id uuid not null references public.project_revisions(id) on delete restrict,
  resulting_revision_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  unique (contribution_id, request_id),
  constraint contribution_reviews_version_fk
    foreign key (contribution_id, contribution_version_id)
    references public.contribution_versions(contribution_id, id) on delete restrict,
  constraint contribution_reviews_result_fk
    foreign key (contribution_id, resulting_revision_id)
    references public.project_revisions(accepted_contribution_id, id) on delete restrict,
  constraint contribution_reviews_result_shape check (
    (applied_decision = 'accept' and requested_decision = 'accept'
      and reason is null and resulting_revision_id is not null)
    or
    (applied_decision <> 'accept' and resulting_revision_id is null)
  ),
  constraint contribution_reviews_reason_shape check (
    (requested_decision = 'accept' and applied_decision = 'accept' and reason is null)
    or
    (requested_decision = 'accept' and applied_decision = 'request_changes' and reason = 'base_outdated')
    or
    (requested_decision in ('request_changes', 'reject')
      and applied_decision = requested_decision and reason = 'owner_feedback')
  ),
  constraint contribution_reviews_note_shape check (
    (requested_decision in ('request_changes', 'reject') and note is not null)
    or requested_decision = 'accept'
  )
);

create index contribution_reviews_contribution_created_idx
  on public.contribution_reviews(contribution_id, created_at desc, id desc);
create index contribution_reviews_version_idx
  on public.contribution_reviews(contribution_version_id);
create index contribution_reviews_reviewer_idx
  on public.contribution_reviews(reviewer_id, created_at desc);
create index contribution_reviews_result_idx
  on public.contribution_reviews(resulting_revision_id)
  where resulting_revision_id is not null;

create trigger contribution_reviews_immutable
  before update or delete on public.contribution_reviews
  for each row execute function private.reject_immutable_change();

alter table public.contribution_reviews enable row level security;
revoke all on public.contribution_reviews from public, anon, authenticated;
grant select on public.contribution_reviews to authenticated;

create policy contribution_review_participants_read
on public.contribution_reviews for select to authenticated
using (
  (select private.is_active_project_actor())
  and exists (
    select 1
    from public.contributions c
    join public.projects p on p.id = c.project_id
    where c.id = contribution_reviews.contribution_id
      and (
        c.author_id = (select auth.uid())
        or p.owner_id = (select auth.uid())
      )
  )
);

alter table public.contributions drop constraint contributions_status_shape;
alter table public.contributions add constraint contributions_status_shape check (
  (status = 'draft'
    and current_version_id is null and submitted_at is null and withdrawn_at is null
    and reviewed_at is null and reviewed_by is null and review_note is null)
  or
  (status = 'submitted'
    and current_version_id is not null and submitted_at is not null and withdrawn_at is null
    and ((reviewed_at is null and reviewed_by is null and review_note is null)
      or (reviewed_at is not null and reviewed_by is not null)))
  or
  (status = 'changes_requested'
    and current_version_id is not null and submitted_at is not null and withdrawn_at is null
    and reviewed_at is not null and reviewed_by is not null)
  or
  (status = 'withdrawn' and withdrawn_at is not null
    and ((reviewed_at is null and reviewed_by is null and review_note is null)
      or (reviewed_at is not null and reviewed_by is not null)))
  or
  (status in ('accepted', 'rejected')
    and current_version_id is not null and submitted_at is not null and withdrawn_at is null
    and reviewed_at is not null and reviewed_by is not null)
);

drop policy if exists owned_or_referenced_assets_read on public.assets;
create policy owned_or_referenced_assets_read
on public.assets for select to authenticated
using (
  (select private.is_active_project_actor())
  and (
    owner_id = (select auth.uid())
    or (
      kind = 'source_audio'
      and status = 'ready'
      and deleted_at is null
      and (
        exists (
          select 1
          from public.revision_tracks rt
          join public.project_revisions r on r.id = rt.revision_id
          where rt.asset_id = assets.id
            and (select private.is_project_member(r.project_id))
        )
        or exists (
          select 1
          from public.contribution_version_tracks cvt
          join public.contribution_versions cv on cv.id = cvt.contribution_version_id
          join public.contributions c on c.id = cv.contribution_id
          join public.projects p on p.id = c.project_id
          where cvt.asset_id = assets.id
            and c.status <> 'draft'
            and (c.author_id = (select auth.uid()) or p.owner_id = (select auth.uid()))
        )
      )
    )
  )
);

drop policy if exists owned_credits_read on public.asset_credits;
create policy visible_asset_credits_read
on public.asset_credits for select to authenticated
using (
  (select private.is_active_project_actor())
  and exists (
    select 1 from public.assets a where a.id = asset_credits.asset_id
  )
);

drop policy if exists owned_or_referenced_source_read on storage.objects;
create policy owned_or_referenced_source_read
on storage.objects for select to authenticated
using (
  bucket_id = 'source-audio'
  and (select private.is_active_project_actor())
  and exists (
    select 1
    from public.assets a
    where a.bucket = bucket_id
      and a.object_path = name
      and a.kind = 'source_audio'
      and a.deleted_at is null
      and (
        (a.owner_id = (select auth.uid()) and a.status in ('processing', 'ready'))
        or (
          a.status = 'ready'
          and (
            exists (
              select 1
              from public.revision_tracks rt
              join public.project_revisions r on r.id = rt.revision_id
              where rt.asset_id = a.id
                and (select private.is_project_member(r.project_id))
            )
            or exists (
              select 1
              from public.contribution_version_tracks cvt
              join public.contribution_versions cv on cv.id = cvt.contribution_version_id
              join public.contributions c on c.id = cv.contribution_id
              join public.projects p on p.id = c.project_id
              where cvt.asset_id = a.id
                and c.status <> 'draft'
                and (c.author_id = (select auth.uid()) or p.owner_id = (select auth.uid()))
            )
          )
        )
      )
  )
);

create function public.review_contribution(
  p_contribution_id uuid,
  p_request_id uuid,
  p_decision public.contribution_review_decision,
  p_expected_status public.contribution_status,
  p_expected_current_version_id uuid,
  p_expected_project_revision_id uuid,
  p_note text default null
)
returns table (
  contribution_id uuid,
  contribution_version_id uuid,
  requested_decision public.contribution_review_decision,
  applied_decision public.contribution_review_decision,
  reason public.contribution_review_reason,
  status public.contribution_status,
  revision_id uuid,
  revision_number integer,
  reviewed_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype;
  v_version public.contribution_versions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_existing public.contribution_reviews%rowtype;
  v_review public.contribution_reviews%rowtype;
  v_revision public.project_revisions%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_canonical jsonb;
  v_duration integer;
  v_track_count integer;
  v_added_bytes bigint;
  v_added_count integer;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'contribution_review_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'contribution_review_actor_ineligible';
  end if;
  if p_contribution_id is null or p_request_id is null or p_decision is null
    or p_expected_status <> 'submitted' or p_expected_current_version_id is null
    or p_expected_project_revision_id is null or (v_note is not null and char_length(v_note) > 5000)
    or (p_decision in ('request_changes', 'reject') and v_note is null) then
    raise sqlstate '22023' using message = 'contribution_review_invalid_input';
  end if;

  select p.* into v_project
  from public.contributions c
  join public.projects p on p.id = c.project_id
  where c.id = p_contribution_id
  for update of p;
  if not found or v_project.owner_id <> v_actor
    or not exists (
      select 1 from public.project_members m
      where m.project_id = v_project.id and m.user_id = v_actor and m.role = 'owner'
    ) then
    raise sqlstate 'PT404' using message = 'contribution_review_not_found';
  end if;

  select * into v_contribution
  from public.contributions c
  where c.id = p_contribution_id and c.project_id = v_project.id
  for update;

  select * into v_existing
  from public.contribution_reviews cr
  where cr.contribution_id = p_contribution_id and cr.request_id = p_request_id;
  if found then
    if v_existing.requested_decision <> p_decision
      or v_existing.contribution_version_id <> p_expected_current_version_id
      or v_existing.expected_project_revision_id <> p_expected_project_revision_id
      or v_existing.note is distinct from v_note then
      raise sqlstate 'PT409' using message = 'contribution_review_request_conflict';
    end if;
    return query
      select v_existing.contribution_id, v_existing.contribution_version_id,
        v_existing.requested_decision, v_existing.applied_decision, v_existing.reason,
        case v_existing.applied_decision
          when 'request_changes' then 'changes_requested'::public.contribution_status
          when 'reject' then 'rejected'::public.contribution_status
          else 'accepted'::public.contribution_status
        end,
        v_existing.resulting_revision_id, r.revision_number, v_existing.created_at
      from (select 1) x
      left join public.project_revisions r on r.id = v_existing.resulting_revision_id;
    return;
  end if;

  if v_project.status <> 'active' or v_project.visibility <> 'private'
    or v_project.deleted_at is not null or v_project.current_revision_id is null then
    raise sqlstate 'PT409' using message = 'contribution_review_project_unavailable';
  end if;
  if v_contribution.status <> p_expected_status
    or v_contribution.current_version_id is distinct from p_expected_current_version_id then
    raise sqlstate 'PT409' using message = 'contribution_review_conflict';
  end if;

  select * into v_version
  from public.contribution_versions cv
  where cv.id = p_expected_current_version_id
    and cv.contribution_id = v_contribution.id
  for update;
  if not found or v_version.base_revision_id <> v_contribution.base_revision_id then
    raise sqlstate 'PT409' using message = 'contribution_review_invalid_version';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.contribution_id = v_contribution.id
  for update;
  if not found then
    raise sqlstate 'PT409' using message = 'contribution_review_invalid_version';
  end if;

  if p_decision = 'accept'
    and (v_project.current_revision_id <> p_expected_project_revision_id
      or v_version.base_revision_id <> v_project.current_revision_id) then
    insert into public.contribution_reviews(
      contribution_id, contribution_version_id, reviewer_id, request_id,
      requested_decision, applied_decision, reason, note,
      expected_project_revision_id
    ) values (
      v_contribution.id, v_version.id, v_actor, p_request_id,
      'accept', 'request_changes', 'base_outdated', v_note,
      p_expected_project_revision_id
    ) returning * into v_review;
    update public.contributions set
      status = 'changes_requested', reviewed_at = v_review.created_at,
      reviewed_by = v_actor, review_note = v_note,
      updated_at = v_review.created_at
    where id = v_contribution.id;
    update public.workspaces set status = 'active', updated_at = v_review.created_at
    where id = v_workspace.id;
    return query select v_contribution.id, v_version.id, 'accept'::public.contribution_review_decision,
      'request_changes'::public.contribution_review_decision,
      'base_outdated'::public.contribution_review_reason,
      'changes_requested'::public.contribution_status, null::uuid, null::integer,
      v_review.created_at;
    return;
  end if;

  if v_project.current_revision_id <> p_expected_project_revision_id then
    raise sqlstate 'PT409' using message = 'contribution_review_conflict';
  end if;

  if p_decision = 'request_changes' then
    insert into public.contribution_reviews(
      contribution_id, contribution_version_id, reviewer_id, request_id,
      requested_decision, applied_decision, reason, note, expected_project_revision_id
    ) values (
      v_contribution.id, v_version.id, v_actor, p_request_id,
      'request_changes', 'request_changes', 'owner_feedback', v_note,
      p_expected_project_revision_id
    ) returning * into v_review;
    update public.contributions set
      status = 'changes_requested', reviewed_at = v_review.created_at,
      reviewed_by = v_actor, review_note = v_note, updated_at = v_review.created_at
    where id = v_contribution.id;
    update public.workspaces set status = 'active', updated_at = v_review.created_at
    where id = v_workspace.id;
    return query select v_contribution.id, v_version.id, p_decision, p_decision,
      'owner_feedback'::public.contribution_review_reason,
      'changes_requested'::public.contribution_status, null::uuid, null::integer,
      v_review.created_at;
    return;
  end if;

  if p_decision = 'reject' then
    insert into public.contribution_reviews(
      contribution_id, contribution_version_id, reviewer_id, request_id,
      requested_decision, applied_decision, reason, note, expected_project_revision_id
    ) values (
      v_contribution.id, v_version.id, v_actor, p_request_id,
      'reject', 'reject', 'owner_feedback', v_note, p_expected_project_revision_id
    ) returning * into v_review;
    update public.contributions set
      status = 'rejected', reviewed_at = v_review.created_at,
      reviewed_by = v_actor, review_note = v_note, updated_at = v_review.created_at
    where id = v_contribution.id;
    update public.workspaces set status = 'archived', updated_at = v_review.created_at
    where id = v_workspace.id;
    return query select v_contribution.id, v_version.id, p_decision, p_decision,
      'owner_feedback'::public.contribution_review_reason,
      'rejected'::public.contribution_status, null::uuid, null::integer,
      v_review.created_at;
    return;
  end if;

  if v_version.manifest_version <> 1 or v_version.engine <> 'waveform-playlist'
    or v_version.engine_version <> 'browser-15.3.4_playout-12.5.4_tone-15.1.22'
    or v_version.manifest->>'workspaceId' <> v_project.id::text
    or encode(extensions.digest(convert_to(v_version.manifest::text, 'UTF8'), 'sha256'), 'hex') <> v_version.manifest_sha256 then
    raise sqlstate 'PT409' using message = 'contribution_review_invalid_version';
  end if;
  select count(*), coalesce(max(position_ms + duration_ms), 0)
    into v_track_count, v_duration
  from public.contribution_version_tracks cvt
  where cvt.contribution_version_id = v_version.id;
  if v_track_count not between 1 and 12 or v_duration <> v_version.duration_ms
    or v_track_count <> jsonb_array_length(v_version.manifest->'tracks')
    or exists (
      select 1
      from public.contribution_version_tracks cvt
      left join public.assets a on a.id = cvt.asset_id
      left join public.instruments i on i.id = cvt.instrument_id
      where cvt.contribution_version_id = v_version.id
        and (a.id is null or a.kind <> 'source_audio' or a.status <> 'ready'
          or a.deleted_at is not null or a.byte_size is null or a.duration_ms is null
          or cvt.trim_start_ms + cvt.duration_ms > a.duration_ms
          or (cvt.instrument_id is not null and (i.id is null or not i.is_active)))
    ) then
    raise sqlstate 'PT409' using message = 'contribution_review_asset_unavailable';
  end if;
  select jsonb_build_object(
    'manifestVersion', 1,
    'engine', 'waveform-playlist',
    'engineVersion', 'browser-15.3.4_playout-12.5.4_tone-15.1.22',
    'workspaceId', v_project.id,
    'tempoBpm', v_project.bpm,
    'tracks', jsonb_agg(jsonb_build_object(
      'trackId', track_id, 'assetId', asset_id, 'instrumentId', instrument_id,
      'name', name, 'positionMs', position_ms, 'trimStartMs', trim_start_ms,
      'durationMs', duration_ms, 'gainDb', gain_db, 'pan', pan,
      'muted', muted, 'soloed', soloed, 'sortOrder', sort_order
    ) order by sort_order)
  ) into v_canonical
  from public.contribution_version_tracks cvt
  where cvt.contribution_version_id = v_version.id;
  if v_canonical <> v_version.manifest then
    raise sqlstate 'PT409' using message = 'contribution_review_invalid_version';
  end if;

  insert into public.project_storage_usage(project_id) values(v_project.id)
    on conflict do nothing;
  perform 1 from public.project_storage_usage where project_id = v_project.id for update;
  select coalesce(sum(a.byte_size), 0), count(*)
    into v_added_bytes, v_added_count
  from public.contribution_version_tracks cvt
  join public.assets a on a.id = cvt.asset_id
  left join public.project_asset_references par
    on par.project_id = v_project.id and par.asset_id = a.id
  where cvt.contribution_version_id = v_version.id and par.asset_id is null;
  if (select source_bytes from public.project_storage_usage where project_id = v_project.id)
      + v_added_bytes > 262144000 then
    raise sqlstate 'PT429' using message = 'contribution_review_project_quota_exceeded';
  end if;

  insert into public.project_revisions(
    project_id, revision_number, parent_revision_id, created_by,
    publish_request_id, expected_base_revision_id, message, manifest,
    manifest_version, engine, engine_version, manifest_sha256, duration_ms,
    accepted_contribution_id, accepted_contribution_version_id
  ) values (
    v_project.id,
    (select r.revision_number + 1 from public.project_revisions r where r.id = v_project.current_revision_id),
    v_project.current_revision_id, v_actor, p_request_id, p_expected_project_revision_id,
    left('Accepted contribution: ' || v_contribution.title, 500),
    v_version.manifest, v_version.manifest_version, v_version.engine,
    v_version.engine_version, v_version.manifest_sha256, v_version.duration_ms,
    v_contribution.id, v_version.id
  ) returning * into v_revision;

  insert into public.revision_tracks(
    revision_id, id, asset_id, instrument_id, name, position_ms, trim_start_ms,
    duration_ms, gain_db, pan, muted, soloed, sort_order, added_by
  ) select
    v_revision.id, track_id, asset_id, instrument_id, name, position_ms,
    trim_start_ms, duration_ms, gain_db, pan, muted, soloed, sort_order, added_by
  from public.contribution_version_tracks cvt
  where cvt.contribution_version_id = v_version.id order by cvt.sort_order;

  insert into public.project_asset_references(project_id, asset_id, first_revision_id, added_by)
  select v_project.id, asset_id, v_revision.id, added_by
  from public.contribution_version_tracks cvt
  where cvt.contribution_version_id = v_version.id
  on conflict do nothing;
  update public.project_storage_usage set
    source_bytes = source_bytes + v_added_bytes,
    unique_source_count = unique_source_count + v_added_count,
    updated_at = statement_timestamp()
  where project_id = v_project.id;
  insert into public.activity_events(actor_id, project_id, subject_id, event_type, payload)
  values (v_actor, v_project.id, v_revision.id, 'project_revision_published',
    jsonb_build_object('revisionNumber', v_revision.revision_number));
  update public.projects set
    current_revision_id = v_revision.id, lock_version = lock_version + 1,
    updated_at = statement_timestamp()
  where id = v_project.id;

  insert into public.contribution_reviews(
    contribution_id, contribution_version_id, reviewer_id, request_id,
    requested_decision, applied_decision, reason, note,
    expected_project_revision_id, resulting_revision_id
  ) values (
    v_contribution.id, v_version.id, v_actor, p_request_id,
    'accept', 'accept', null, v_note, p_expected_project_revision_id, v_revision.id
  ) returning * into v_review;
  update public.contributions set
    status = 'accepted', reviewed_at = v_review.created_at,
    reviewed_by = v_actor, review_note = v_note, updated_at = v_review.created_at
  where id = v_contribution.id;
  update public.workspaces set status = 'archived', updated_at = v_review.created_at
  where id = v_workspace.id;

  return query select v_contribution.id, v_version.id, 'accept'::public.contribution_review_decision,
    'accept'::public.contribution_review_decision, null::public.contribution_review_reason,
    'accepted'::public.contribution_status, v_revision.id, v_revision.revision_number,
    v_review.created_at;
exception
  when invalid_text_representation or numeric_value_out_of_range or null_value_not_allowed then
    raise sqlstate '22023' using message = 'contribution_review_invalid_input';
end
$$;

revoke all on function public.review_contribution(
  uuid, uuid, public.contribution_review_decision, public.contribution_status,
  uuid, uuid, text
) from public, anon;
grant execute on function public.review_contribution(
  uuid, uuid, public.contribution_review_decision, public.contribution_status,
  uuid, uuid, text
) to authenticated;

comment on table public.contribution_reviews is
  'Immutable idempotent owner review decisions for exact contribution versions.';
comment on column public.project_revisions.accepted_contribution_id is
  'Private normalized lineage for a revision created by accepted contribution.';
comment on function public.review_contribution(
  uuid, uuid, public.contribution_review_decision, public.contribution_status,
  uuid, uuid, text
) is 'Owner-only atomic request-changes, reject, or exact-version acceptance command.';
