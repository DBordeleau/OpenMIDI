create function private.clone_project_workspace(
  p_project_id uuid,
  p_owner_id uuid,
  p_request_id uuid,
  p_revision_id uuid
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision public.project_revisions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_manifest jsonb;
begin
  select * into v_revision
  from public.project_revisions r
  where r.id = p_revision_id and r.project_id = p_project_id;
  if not found then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  v_manifest := jsonb_set(
    v_revision.manifest,
    '{tempoBpm}',
    to_jsonb((v_revision.manifest ->> 'tempoBpm')::double precision)
  );

  insert into public.workspaces(
    project_id, owner_id, create_request_id, base_revision_id, manifest,
    manifest_version, engine, engine_version, manifest_sha256
  ) values (
    p_project_id, p_owner_id, p_request_id, v_revision.id, v_manifest,
    v_revision.manifest_version, v_revision.engine, v_revision.engine_version,
    encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex')
  ) returning * into v_workspace;

  insert into public.workspace_tracks(
    workspace_id, track_id, asset_id, instrument_id, name, position_ms,
    trim_start_ms, duration_ms, gain_db, pan, muted, soloed, sort_order
  )
  select
    v_workspace.id, r.id, r.asset_id, r.instrument_id, r.name, r.position_ms,
    r.trim_start_ms, r.duration_ms, r.gain_db, r.pan, r.muted, r.soloed,
    r.sort_order
  from public.revision_tracks r
  where r.revision_id = v_revision.id
  order by r.sort_order;

  return v_workspace;
end
$$;

revoke all on function private.clone_project_workspace(uuid, uuid, uuid, uuid)
from public, anon, authenticated;

create or replace function public.create_project_workspace(
  p_project_id uuid,
  p_request_id uuid,
  p_expected_current_revision_id uuid
)
returns table(
  workspace_id uuid,
  base_revision_id uuid,
  lock_version integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'workspace_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'workspace_actor_ineligible';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.owner_id = v_actor and w.create_request_id = p_request_id;
  if found then
    if v_workspace.project_id <> p_project_id
      or v_workspace.base_revision_id is distinct from p_expected_current_revision_id then
      raise sqlstate 'PT409' using message = 'workspace_request_conflict';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  select * into v_project
  from public.projects p
  where p.id = p_project_id and p.owner_id = v_actor and p.deleted_at is null
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_project_not_found';
  end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id
    or p_expected_current_revision_id is null then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.project_id = p_project_id and w.owner_id = v_actor and w.status = 'active';
  if found then
    if v_workspace.base_revision_id is distinct from p_expected_current_revision_id then
      raise sqlstate 'PT409' using message = 'workspace_active_base_mismatch';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  v_workspace := private.clone_project_workspace(
    p_project_id, v_actor, p_request_id, p_expected_current_revision_id
  );
  return query
    select v_workspace.id, v_workspace.base_revision_id,
      v_workspace.lock_version, v_workspace.created_at;
exception when unique_violation then
  select * into v_workspace
  from public.workspaces w
  where w.project_id = p_project_id and w.owner_id = v_actor and w.status = 'active';
  if found and v_workspace.base_revision_id is not distinct from p_expected_current_revision_id then
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;
  raise;
end
$$;

create function public.publish_workspace_revision(
  p_workspace_id uuid,
  p_request_id uuid,
  p_expected_lock_version integer,
  p_expected_base_revision_id uuid,
  p_message text
)
returns table(
  revision_id uuid,
  revision_number integer,
  workspace_lock_version integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_existing public.project_revisions%rowtype;
  v_published record;
  v_message text := nullif(btrim(p_message), '');
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'workspace_publish_unauthenticated';
  end if;
  if p_workspace_id is null or p_request_id is null
    or p_expected_lock_version is null or p_expected_lock_version < 1
    or p_expected_base_revision_id is null
    or (v_message is not null and char_length(v_message) > 500) then
    raise sqlstate '22023' using message = 'workspace_publish_invalid_input';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'workspace_publish_actor_ineligible';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.id = p_workspace_id and w.owner_id = v_actor;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_publish_not_found';
  end if;

  select * into v_project
  from public.projects p
  where p.id = v_workspace.project_id and p.owner_id = v_actor and p.deleted_at is null
  for update;
  if not found or not exists (
    select 1 from public.project_members m
    where m.project_id = v_workspace.project_id
      and m.user_id = v_actor and m.role = 'owner'
  ) then
    raise sqlstate 'PT404' using message = 'workspace_publish_not_found';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.id = p_workspace_id and w.owner_id = v_actor
  for update;

  select * into v_existing
  from public.project_revisions r
  where r.project_id = v_workspace.project_id
    and r.publish_request_id = p_request_id;
  if found then
    if v_existing.created_by = v_actor
      and v_existing.expected_base_revision_id is not distinct from p_expected_base_revision_id
      and v_existing.message is not distinct from v_message
      and v_existing.manifest = v_workspace.manifest
      and v_workspace.base_revision_id = v_existing.id
      and v_workspace.lock_version = p_expected_lock_version + 1 then
      return query
        select v_existing.id, v_existing.revision_number,
          v_workspace.lock_version, v_existing.created_at;
      return;
    end if;
    raise sqlstate 'PT409' using message = 'workspace_publish_request_conflict';
  end if;

  if v_workspace.status <> 'active' then
    raise sqlstate 'PT409' using message = 'workspace_publish_unavailable';
  end if;
  if v_workspace.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'workspace_publish_unsaved';
  end if;
  if v_workspace.base_revision_id is distinct from p_expected_base_revision_id
    or v_project.current_revision_id is distinct from p_expected_base_revision_id then
    raise sqlstate 'PT409' using message = 'workspace_publish_stale_base';
  end if;
  if encode(
    extensions.digest(convert_to(v_workspace.manifest::text, 'UTF8'), 'sha256'),
    'hex'
  ) <> v_workspace.manifest_sha256 then
    raise sqlstate 'PT409' using message = 'workspace_publish_invalid_state';
  end if;
  if (select count(*) from public.workspace_tracks wt where wt.workspace_id = v_workspace.id)
    <> jsonb_array_length(v_workspace.manifest -> 'tracks') then
    raise sqlstate 'PT409' using message = 'workspace_publish_invalid_state';
  end if;

  select * into v_published
  from public.publish_project_revision(
    v_workspace.project_id,
    p_request_id,
    p_expected_base_revision_id,
    v_message,
    v_workspace.manifest
  );

  update public.workspaces w
  set base_revision_id = v_published.revision_id,
      lock_version = w.lock_version + 1,
      updated_at = statement_timestamp()
  where w.id = v_workspace.id
  returning * into v_workspace;

  return query
    select v_published.revision_id, v_published.revision_number,
      v_workspace.lock_version, v_published.created_at;
end
$$;

create function public.restart_project_workspace(
  p_workspace_id uuid,
  p_request_id uuid,
  p_expected_lock_version integer,
  p_expected_base_revision_id uuid,
  p_expected_current_revision_id uuid
)
returns table(
  workspace_id uuid,
  base_revision_id uuid,
  lock_version integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_replacement public.workspaces%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'workspace_restart_unauthenticated';
  end if;
  if p_workspace_id is null or p_request_id is null
    or p_expected_lock_version is null or p_expected_lock_version < 1
    or p_expected_base_revision_id is null or p_expected_current_revision_id is null then
    raise sqlstate '22023' using message = 'workspace_restart_invalid_input';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'workspace_restart_actor_ineligible';
  end if;

  select * into v_replacement
  from public.workspaces w
  where w.owner_id = v_actor and w.create_request_id = p_request_id;
  if found then
    if v_replacement.base_revision_id = p_expected_current_revision_id
      and v_replacement.status = 'active'
      and exists (
        select 1 from public.workspaces original
        where original.id = p_workspace_id
          and original.owner_id = v_actor
          and original.project_id = v_replacement.project_id
          and original.status = 'archived'
          and original.base_revision_id = p_expected_base_revision_id
          and original.lock_version = p_expected_lock_version + 1
      ) then
      return query
        select v_replacement.id, v_replacement.base_revision_id,
          v_replacement.lock_version, v_replacement.created_at;
      return;
    end if;
    raise sqlstate 'PT409' using message = 'workspace_restart_request_conflict';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.id = p_workspace_id and w.owner_id = v_actor;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_restart_not_found';
  end if;

  select * into v_project
  from public.projects p
  where p.id = v_workspace.project_id and p.owner_id = v_actor and p.deleted_at is null
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_restart_not_found';
  end if;
  select * into v_workspace
  from public.workspaces w
  where w.id = p_workspace_id and w.owner_id = v_actor
  for update;

  if v_workspace.status <> 'active'
    or v_workspace.lock_version <> p_expected_lock_version
    or v_workspace.base_revision_id is distinct from p_expected_base_revision_id
    or v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message = 'workspace_restart_conflict';
  end if;
  if p_expected_base_revision_id = p_expected_current_revision_id then
    raise sqlstate 'PT409' using message = 'workspace_restart_not_stale';
  end if;

  update public.workspaces w
  set status = 'archived', lock_version = w.lock_version + 1,
      updated_at = statement_timestamp()
  where w.id = v_workspace.id;

  v_replacement := private.clone_project_workspace(
    v_workspace.project_id,
    v_actor,
    p_request_id,
    p_expected_current_revision_id
  );
  return query
    select v_replacement.id, v_replacement.base_revision_id,
      v_replacement.lock_version, v_replacement.created_at;
end
$$;

revoke execute on function
  public.publish_workspace_revision(uuid, uuid, integer, uuid, text),
  public.restart_project_workspace(uuid, uuid, integer, uuid, uuid)
from public, anon;
grant execute on function
  public.publish_workspace_revision(uuid, uuid, integer, uuid, text),
  public.restart_project_workspace(uuid, uuid, integer, uuid, uuid)
to authenticated;

comment on function public.publish_workspace_revision(uuid, uuid, integer, uuid, text)
is 'Publishes the authoritative saved owner workspace through the canonical revision transaction.';
comment on function public.restart_project_workspace(uuid, uuid, integer, uuid, uuid)
is 'Archives a stale owner workspace and clones the exact current project revision without merging.';
