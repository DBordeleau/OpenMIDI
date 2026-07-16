-- Restore the two live v3 contracts that remain after the application audio
-- cutover. Both commands keep authorization in Postgres and expose only the
-- minimum authenticated surface.

alter table public.assets drop constraint assets_ready_check;
alter table public.assets add constraint assets_ready_check check(
  (status = 'ready' and failure_code is null and failed_at is null
    and ready_at is not null and deleted_at is null
    and media_type in ('image/jpeg', 'image/png', 'image/webp')
    and byte_size between 1 and 5242880 and sha256 is not null
    and verification_version = 'profile-image-v1'
    and image_width between 128 and 4096 and image_height between 128 and 4096
    and image_width::bigint * image_height::bigint <= 16777216 and frame_count = 1)
  or (status = 'deleted' and deleted_at is not null)
  or (status not in ('ready', 'deleted') and ready_at is null and deleted_at is null)
);

create function public.get_admin_storage_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();

  return jsonb_build_object(
    'thresholds', jsonb_build_object(
      'warningBytes', 104857600,
      'stopBytes', 209715200
    ),
    'total', jsonb_build_object(
      'objectCount', (
        select count(*)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
      ),
      'bytes', (
        select coalesce(sum(
          case
            when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
            else 0
          end
        ), 0)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
      ),
      'unknownSizeCount', (
        select count(*)
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
          and not coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
      )
    ),
    'buckets', coalesce((
      select jsonb_agg(to_jsonb(bucket_summary) order by bucket_summary.bucket)
      from (
        select
          o.bucket_id as bucket,
          count(*) as object_count,
          coalesce(sum(
            case
              when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
              else 0
            end
          ), 0) as bytes,
          count(*) filter (
            where not coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
          ) as unknown_size_count
        from storage.objects o
        where o.bucket_id in ('profile-images', 'public-avatars')
        group by o.bucket_id
      ) bucket_summary
    ), '[]'::jsonb),
    'untrackedObjectCount', (
      select count(*)
      from storage.objects o
      where o.bucket_id in ('profile-images', 'public-avatars')
        and (
          (o.bucket_id = 'profile-images' and not exists (
            select 1
            from public.assets a
            where a.bucket = o.bucket_id and a.object_path = o.name
          ))
          or
          (o.bucket_id = 'public-avatars' and not exists (
            select 1
            from public.profile_avatar_versions v
            where v.public_object_path = o.name
          ))
        )
    ),
    'dueCleanupCount', (
      (select count(*) from private.profile_avatar_cleanup_jobs j
        where j.status in ('pending', 'retry')
          and j.next_attempt_at <= statement_timestamp())
      +
      (select count(*) from private.deletion_requests d
        where d.status = 'recoverable'
          and d.restore_until <= statement_timestamp())
      +
      (select count(*) from private.moderation_reports r
        where r.status in ('resolved', 'dismissed')
          and r.resolved_at <= statement_timestamp() - interval '180 days'
          and r.detail is not null)
    ),
    'lastRun', (
      select jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'requestedAt', r.requested_at,
        'completedAt', r.completed_at,
        'candidateCount', r.candidate_count,
        'completedCount', r.completed_count,
        'blockedCount', r.blocked_count,
        'failedCount', r.failed_count
      )
      from private.retention_runs r
      order by r.requested_at desc, r.id desc
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_admin_storage_summary()
  from public, anon, authenticated;
grant execute on function public.get_admin_storage_summary()
  to authenticated;

create function public.create_project_workspace_v3(
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
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_workspace public.workspaces%rowtype;
  v_workspace_id uuid := gen_random_uuid();
  v_manifest jsonb;
  v_manifest_sha256 text;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'workspace_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'workspace_actor_ineligible';
  end if;
  if p_project_id is null or p_request_id is null
    or p_expected_current_revision_id is null then
    raise sqlstate '22023' using message = 'workspace_invalid_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'project-workspace:' || v_actor::text || ':' || p_request_id::text,
    0
  ));

  select * into v_workspace
  from public.workspaces w
  where w.owner_id = v_actor and w.create_request_id = p_request_id;
  if found then
    if v_workspace.project_id <> p_project_id
      or v_workspace.base_revision_id is distinct from p_expected_current_revision_id
      or v_workspace.manifest_version <> 3
      or v_workspace.contribution_id is not null then
      raise sqlstate 'PT409' using message = 'workspace_request_conflict';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  select * into v_project
  from public.projects p
  where p.id = p_project_id and p.owner_id = v_actor
    and p.status = 'active' and p.deleted_at is null
    and p.moderation_state = 'visible'
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'workspace_project_not_found';
  end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  select * into v_workspace
  from public.workspaces w
  where w.project_id = p_project_id and w.owner_id = v_actor
    and w.contribution_id is null and w.status = 'active'
  for update;
  if found then
    if v_workspace.base_revision_id is distinct from p_expected_current_revision_id
      or v_workspace.manifest_version <> 3 then
      raise sqlstate 'PT409' using message = 'workspace_active_base_mismatch';
    end if;
    return query
      select v_workspace.id, v_workspace.base_revision_id,
        v_workspace.lock_version, v_workspace.created_at;
    return;
  end if;

  select * into v_revision
  from public.project_revisions r
  where r.id = p_expected_current_revision_id
    and r.project_id = p_project_id
    and r.manifest_version = 3
    and r.arrangement_version_id is not null;
  if not found then
    raise sqlstate 'PT409' using message = 'workspace_base_changed';
  end if;

  v_manifest := v_revision.manifest || jsonb_build_object('workspaceId', v_workspace_id);
  v_manifest := private.canonical_manifest_v3(v_manifest, p_project_id, v_workspace_id);
  v_manifest_sha256 := encode(extensions.digest(
    convert_to(v_manifest::text, 'UTF8'),
    'sha256'
  ), 'hex');

  insert into public.workspaces(
    id, project_id, owner_id, create_request_id, base_revision_id,
    manifest, manifest_version, engine, engine_version, manifest_sha256
  ) values (
    v_workspace_id, p_project_id, v_actor, p_request_id, v_revision.id,
    v_manifest, 3, 'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1', v_manifest_sha256
  ) returning * into v_workspace;

  perform private.replace_workspace_projection_v3(v_workspace.id, v_manifest);
  insert into private.workspace_snapshots(
    workspace_id, project_id, owner_id, request_id, lock_version,
    manifest, manifest_sha256
  ) values (
    v_workspace.id, v_workspace.project_id, v_actor, p_request_id,
    v_workspace.lock_version, v_manifest, v_manifest_sha256
  );
  delete from private.workspace_snapshots s
  where s.workspace_id = v_workspace.id and s.id in (
    select s2.id
    from private.workspace_snapshots s2
    where s2.workspace_id = v_workspace.id
    order by s2.lock_version desc
    offset 20
  );

  return query
    select v_workspace.id, v_workspace.base_revision_id,
      v_workspace.lock_version, v_workspace.created_at;
end;
$$;

revoke all on function public.create_project_workspace_v3(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_project_workspace_v3(uuid, uuid, uuid)
  to authenticated;

create function public.get_project_revision_history_v3(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'revision_history_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'revision_history_actor_ineligible';
  end if;
  if not exists (
    select 1
    from public.projects p
    join public.project_members m on m.project_id = p.id
    where p.id = p_project_id and m.user_id = v_actor
  ) then
    raise sqlstate 'PT404' using message = 'revision_history_not_found';
  end if;

  return coalesce((
    select jsonb_agg(revision_document order by revision_number desc)
    from (
      select
        r.revision_number,
        jsonb_build_object(
          'id', r.id,
          'revisionNumber', r.revision_number,
          'message', r.message,
          'durationMs', r.duration_ms,
          'createdAt', r.created_at,
          'authorName', publisher.credit_name,
          'publisher', jsonb_build_object(
            'creditName', publisher.credit_name,
            'profileUsername', publisher_profile.username
          ),
          'acceptedContributor', case
            when contributor.credit_name is null then null
            else jsonb_build_object(
              'creditName', contributor.credit_name,
              'profileUsername', contributor_profile.username
            )
          end,
          'tracks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', track.track_id,
                'kind', 'midi',
                'instrumentName', track.preset_id,
                'name', track.name,
                'durationMs', r.duration_ms,
                'sortOrder', track.sort_order,
                'creditName', coalesce(
                  track_credits.credits->0->>'creditName',
                  publisher.credit_name
                ),
                'credits', case
                  when jsonb_array_length(track_credits.credits) > 0 then track_credits.credits
                  else jsonb_build_array(jsonb_build_object(
                    'creditName', publisher.credit_name,
                    'role', 'creator',
                    'position', 0,
                    'profileUsername', publisher_profile.username
                  ))
                end
              ) order by track.sort_order, track.track_id
            )
            from public.arrangement_tracks track
            cross join lateral (
              with recursive lineage as (
                select
                  version.id,
                  version.creator_id,
                  version.creator_credit_name,
                  version.parent_pattern_version_id,
                  version.source_pattern_version_id,
                  version.created_at,
                  0 as depth,
                  array[version.id] as path
                from public.arrangement_clips clip
                join public.midi_pattern_versions version
                  on version.id = clip.midi_pattern_version_id
                where clip.arrangement_version_id = track.arrangement_version_id
                  and clip.track_id = track.track_id

                union all

                select
                  ancestor.id,
                  ancestor.creator_id,
                  ancestor.creator_credit_name,
                  ancestor.parent_pattern_version_id,
                  ancestor.source_pattern_version_id,
                  ancestor.created_at,
                  lineage.depth + 1,
                  lineage.path || ancestor.id
                from lineage
                cross join lateral unnest(array[
                  lineage.parent_pattern_version_id,
                  lineage.source_pattern_version_id
                ]) ancestor_id
                join public.midi_pattern_versions ancestor on ancestor.id = ancestor_id
                where ancestor_id is not null
                  and not ancestor.id = any(lineage.path)
              ), distinct_credits as (
                select
                  creator_id,
                  creator_credit_name,
                  min(depth) as depth,
                  min(created_at) as created_at
                from lineage
                group by creator_id, creator_credit_name
              ), ordered_credits as (
                select
                  credit.creator_id,
                  credit.creator_credit_name,
                  credit.depth,
                  row_number() over (
                    order by credit.depth, credit.created_at, credit.creator_id
                  ) - 1 as position
                from distinct_credits credit
              )
              select coalesce(jsonb_agg(jsonb_build_object(
                'creditName', credit.creator_credit_name,
                'role', case when credit.depth = 0 then 'creator' else 'derivation' end,
                'position', credit.position,
                'profileUsername', profile.username
              ) order by credit.position), '[]'::jsonb) as credits
              from ordered_credits credit
              left join public.public_profiles profile on profile.id = credit.creator_id
            ) track_credits
            where track.arrangement_version_id = r.arrangement_version_id
          ), '[]'::jsonb)
        ) as revision_document
      from (
        select revision.*
        from public.project_revisions revision
        where revision.project_id = p_project_id
          and revision.manifest_version = 3
          and revision.arrangement_version_id is not null
        order by revision.revision_number desc
        limit 20
      ) r
      join public.revision_attributions publisher
        on publisher.revision_id = r.id and publisher.kind = 'publisher'
      left join public.public_profiles publisher_profile
        on publisher_profile.id = publisher.user_id
      left join public.revision_attributions contributor
        on contributor.revision_id = r.id and contributor.kind = 'accepted_contributor'
      left join public.public_profiles contributor_profile
        on contributor_profile.id = contributor.user_id
    ) revision_rows
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_project_revision_history_v3(uuid)
  from public, anon, authenticated;
grant execute on function public.get_project_revision_history_v3(uuid)
  to authenticated;
