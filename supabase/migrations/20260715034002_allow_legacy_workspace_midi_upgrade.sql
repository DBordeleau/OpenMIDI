-- Allow an owner to intentionally promote a legacy audio workspace to the
-- composite manifest when importing its first immutable MIDI stem version.
-- Existing v2 contribution authorization remains unchanged; legacy
-- contribution workspaces continue to use the legacy save path.
create or replace function public.save_midi_workspace(
  p_workspace_id uuid,p_request_id uuid,p_expected_lock_version integer,p_manifest jsonb
) returns table(workspace_id uuid,lock_version integer,manifest_sha256 text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_workspace public.workspaces%rowtype;
  v_canonical jsonb; v_checksum text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='workspace_unauthenticated'; end if;
  select * into v_workspace from public.workspaces where id=p_workspace_id
    and owner_id=v_actor and status='active' for update;
  if not found or not (select private.is_active_project_actor())
    or v_workspace.manifest_version not in (1,2)
    or (v_workspace.manifest_version=1 and v_workspace.contribution_id is not null)
    or (v_workspace.contribution_id is not null and not exists(
      select 1 from public.contributions c where c.id=v_workspace.contribution_id
        and c.author_id=v_actor and c.status in ('draft','changes_requested'))) then
    raise sqlstate 'PT404' using message='workspace_not_found'; end if;
  if v_workspace.last_manifest_request_id=p_request_id then
    if v_workspace.last_manifest_expected_lock_version<>p_expected_lock_version then
      raise sqlstate 'PT409' using message='workspace_request_conflict'; end if;
    return query select v_workspace.id,v_workspace.lock_version,
      v_workspace.manifest_sha256,v_workspace.updated_at; return;
  end if;
  if p_request_id is null or v_workspace.lock_version<>p_expected_lock_version then
    raise sqlstate 'PT409' using message='workspace_save_conflict'; end if;
  v_canonical:=private.canonical_project_manifest_v2(v_workspace.project_id,p_manifest,true);
  if v_canonical<>p_manifest then
    raise sqlstate '22023' using message='workspace_manifest_not_canonical'; end if;
  v_checksum:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  perform private.project_v2_projections(v_workspace.id,v_canonical);
  update public.workspaces set manifest=v_canonical,manifest_version=2,
    engine='jam-session-composite',
    engine_version='jam-session-composite-2_tone-15.1.22',
    manifest_sha256=v_checksum,snapshot_asset_id=null,
    lock_version=workspaces.lock_version+1,
    last_manifest_request_id=p_request_id,
    last_manifest_expected_lock_version=p_expected_lock_version,
    updated_at=statement_timestamp() where id=v_workspace.id returning * into v_workspace;
  return query select v_workspace.id,v_workspace.lock_version,
    v_workspace.manifest_sha256,v_workspace.updated_at;
end $$;

revoke all on function public.save_midi_workspace(uuid,uuid,integer,jsonb)
  from public,anon;
grant execute on function public.save_midi_workspace(uuid,uuid,integer,jsonb)
  to authenticated;
