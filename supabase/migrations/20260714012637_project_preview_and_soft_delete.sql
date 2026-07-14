alter table public.projects drop constraint projects_revision_lifecycle_check;
alter table public.projects add constraint projects_revision_lifecycle_check check (
  (
    visibility in ('private', 'public') and deleted_at is null and
    ((status = 'draft' and visibility = 'private' and current_revision_id is null
      and published_at is null and not open_to_contributions) or
     (status = 'active' and current_revision_id is not null and published_at is not null))
  ) or (
    status = 'deleted' and visibility = 'private' and not open_to_contributions
    and deleted_at is not null
    and ((current_revision_id is null and published_at is null)
      or (current_revision_id is not null and published_at is not null))
  )
);

create table private.project_deletion_requests (
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  expected_lock_version integer not null check (expected_lock_version > 0),
  deleted_at timestamptz not null,
  primary key (owner_id, request_id)
);
create index project_deletion_requests_project_idx
  on private.project_deletion_requests(project_id);
revoke all on table private.project_deletion_requests from public, anon, authenticated;

create function public.delete_project(
  p_project_id uuid,
  p_request_id uuid,
  p_expected_lock_version integer
)
returns table(project_id uuid, deleted_at timestamptz, lock_version integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_existing private.project_deletion_requests%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'project_delete_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'project_delete_actor_ineligible';
  end if;
  if p_project_id is null or p_request_id is null
    or p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise sqlstate '22023' using message = 'project_delete_invalid_input';
  end if;

  select * into v_existing from private.project_deletion_requests d
  where d.owner_id = v_actor and d.request_id = p_request_id;
  if found then
    if v_existing.project_id <> p_project_id
      or v_existing.expected_lock_version <> p_expected_lock_version then
      raise sqlstate 'PT409' using message = 'project_delete_request_conflict';
    end if;
    return query select p.id, p.deleted_at, p.lock_version
      from public.projects p where p.id = v_existing.project_id;
    return;
  end if;

  select * into v_project from public.projects p
  where p.id = p_project_id and p.owner_id = v_actor for update;
  if not found then
    raise sqlstate 'PT404' using message = 'project_delete_not_found';
  end if;
  if v_project.status = 'deleted' or v_project.deleted_at is not null then
    raise sqlstate 'PT409' using message = 'project_delete_unavailable';
  end if;
  if v_project.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'project_delete_conflict';
  end if;

  update public.projects p set
    visibility = 'private', status = 'deleted', open_to_contributions = false,
    deleted_at = statement_timestamp(), lock_version = p.lock_version + 1,
    updated_at = statement_timestamp()
  where p.id = p_project_id returning * into v_project;

  insert into private.project_deletion_requests(
    owner_id, request_id, project_id, expected_lock_version, deleted_at
  ) values (
    v_actor, p_request_id, v_project.id, p_expected_lock_version, v_project.deleted_at
  );
  return query select v_project.id, v_project.deleted_at, v_project.lock_version;
end
$$;
revoke all on function public.delete_project(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_project(uuid, uuid, integer) to authenticated;

create function public.get_project_revision_preview(
  p_project_id uuid,
  p_revision_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_sources jsonb;
begin
  if p_project_id is null or p_revision_id is null then
    raise sqlstate '22023' using message = 'preview_invalid_input';
  end if;
  select p.* into v_project from public.projects p
  where p.id = p_project_id and p.current_revision_id = p_revision_id
    and p.status = 'active' and p.deleted_at is null
    and (
      exists (select 1 from public.public_project_catalog c where c.project_id = p.id)
      or ((select private.is_active_project_actor()) and (select private.is_project_member(p.id)))
    );
  if not found then
    raise sqlstate 'PT404' using message = 'preview_not_found';
  end if;
  select * into v_revision from public.project_revisions r
  where r.id = p_revision_id and r.project_id = p_project_id;
  if not found then
    raise sqlstate 'PT404' using message = 'preview_not_found';
  end if;
  select jsonb_agg(jsonb_build_object(
    'assetId', a.id, 'bucket', a.bucket, 'objectPath', a.object_path
  ) order by rt.sort_order) into v_sources
  from public.revision_tracks rt join public.assets a on a.id = rt.asset_id
  where rt.revision_id = v_revision.id and a.kind = 'source_audio'
    and a.status = 'ready' and a.deleted_at is null;
  if coalesce(jsonb_array_length(v_sources), 0)
    <> jsonb_array_length(v_revision.manifest -> 'tracks') then
    raise sqlstate 'PT409' using message = 'preview_audio_unavailable';
  end if;
  return jsonb_build_object(
    'projectId', v_project.id,
    'revisionId', v_revision.id,
    'durationMs', v_revision.duration_ms,
    'manifest', v_revision.manifest,
    'sources', v_sources
  );
end
$$;
revoke all on function public.get_project_revision_preview(uuid, uuid) from public;
grant execute on function public.get_project_revision_preview(uuid, uuid) to anon, authenticated;

create or replace function private.can_read_source_asset(p_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a where a.id = p_asset_id
      and a.kind = 'source_audio' and a.status = 'ready' and a.deleted_at is null
      and (
        exists (
          select 1 from public.revision_tracks rt
          join public.project_revisions r on r.id = rt.revision_id
          join public.public_project_catalog c on c.project_id = r.project_id
            and c.current_revision_id = r.id
          where rt.asset_id = a.id
        )
        or ((select private.is_active_project_actor()) and (
          a.owner_id = (select auth.uid())
          or exists (
            select 1 from public.revision_tracks rt
            join public.project_revisions r on r.id = rt.revision_id
            join public.projects p on p.id = r.project_id and p.deleted_at is null
            where rt.asset_id = a.id and (select private.is_project_member(r.project_id))
          )
          or exists (
            select 1 from public.workspace_tracks wt
            join public.workspaces w on w.id = wt.workspace_id
            join public.projects p on p.id = w.project_id and p.deleted_at is null
            where wt.asset_id = a.id and w.owner_id = (select auth.uid())
              and w.status = 'active'
          )
          or exists (
            select 1 from public.contribution_version_tracks cvt
            join public.contribution_versions cv on cv.id = cvt.contribution_version_id
            join public.contributions c on c.id = cv.contribution_id
            join public.projects p on p.id = c.project_id and p.deleted_at is null
            where cvt.asset_id = a.id and (
              c.author_id = (select auth.uid())
              or (p.owner_id = (select auth.uid()) and c.status <> 'draft')
            )
          )
        ))
      )
  )
$$;
revoke all on function private.can_read_source_asset(uuid) from public, anon;
grant execute on function private.can_read_source_asset(uuid) to authenticated;

create function private.can_read_source_object(p_bucket text, p_object_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'source-audio' and exists (
    select 1 from public.assets a
    where a.bucket = p_bucket and a.object_path = p_object_path
      and (select private.can_read_source_asset(a.id))
  )
$$;
revoke all on function private.can_read_source_object(text, text) from public;
grant execute on function private.can_read_source_object(text, text) to anon, authenticated;

drop policy if exists owned_or_referenced_source_read on storage.objects;
create policy owned_or_referenced_source_read on storage.objects
  for select to anon, authenticated using (
    (select private.can_read_source_object(bucket_id, name))
  );
