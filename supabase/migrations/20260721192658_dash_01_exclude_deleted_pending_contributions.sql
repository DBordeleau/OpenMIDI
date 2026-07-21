create or replace function public.get_viewer_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'dashboard_unauthenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_actor
      and status = 'active'
      and profile_completed_at is not null
  ) then
    raise sqlstate 'PT403' using message = 'dashboard_forbidden';
  end if;

  return jsonb_build_object(
    'ownedProjects', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.project_id desc)
      from (
        select
          p.id as project_id,
          p.title,
          p.status,
          p.current_revision_id,
          pr.revision_number,
          coalesce((
            select count(distinct ac.track_id)::integer
            from public.arrangement_clips ac
            where ac.project_id = p.id
              and ac.arrangement_version_id = pr.arrangement_version_id
          ), 0) as track_count,
          (
            select least(count(*), 99)::integer
            from (
              select c.id
              from public.contributions c
              where c.project_id = p.id
                and c.status = 'submitted'
              limit 100
            ) pending_review
          ) as review_count,
          p.updated_at
        from public.projects p
        left join public.project_revisions pr
          on pr.id = p.current_revision_id
          and pr.project_id = p.id
        where p.owner_id = v_actor
          and p.deleted_at is null
          and p.status in ('draft', 'active')
        order by p.updated_at desc, p.id desc
        limit 7
      ) x
    ), '[]'::jsonb),
    'activeWorkspaces', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.workspace_id desc)
      from (
        select
          w.id as workspace_id,
          w.project_id,
          p.title as project_title,
          w.contribution_id,
          c.title as contribution_title,
          w.lock_version,
          w.updated_at
        from public.workspaces w
        join public.projects p on p.id = w.project_id
        left join public.contributions c on c.id = w.contribution_id
        where w.owner_id = v_actor
          and w.status = 'active'
          and p.deleted_at is null
        order by w.updated_at desc, w.id desc
        limit 7
      ) x
    ), '[]'::jsonb),
    'pendingContributions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.contribution_id desc)
      from (
        select
          c.id as contribution_id,
          c.project_id,
          p.title as project_title,
          c.title,
          c.status,
          c.current_version_id,
          cv.version_number as current_version_number,
          c.updated_at
        from public.contributions c
        join public.projects p on p.id = c.project_id
        left join public.contribution_versions cv on cv.id = c.current_version_id
        where c.author_id = v_actor
          and c.status in ('draft', 'submitted', 'changes_requested')
          and c.deleted_at is null
          and p.deleted_at is null
        order by c.updated_at desc, c.id desc
        limit 7
      ) x
    ), '[]'::jsonb),
    'review', (
      select jsonb_build_object(
        'count', least(count(*), 99),
        'hasMore', count(*) = 100
      )
      from (
        select c.id
        from public.contributions c
        join public.projects p on p.id = c.project_id
        where p.owner_id = v_actor
          and p.deleted_at is null
          and c.status = 'submitted'
        limit 100
      ) q
    ),
    'resume', (
      select to_jsonb(x)
      from (
        select
          w.id as workspace_id,
          w.project_id,
          p.title as project_title,
          w.contribution_id,
          c.title as contribution_title,
          w.updated_at,
          w.lock_version,
          (w.manifest ->> 'tempoBpm')::numeric as tempo_bpm,
          (w.manifest ->> 'durationTicks')::integer as duration_ticks,
          p.musical_key,
          p.time_signature_numerator,
          p.time_signature_denominator,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'track_id', track.value ->> 'trackId',
                'sort_order', (track.value ->> 'sortOrder')::integer,
                'preset_id', track.value ->> 'presetId',
                'clips', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'clip_id', clip.value ->> 'clipId',
                      'start_tick', (clip.value ->> 'startTick')::integer,
                      'duration_ticks', (clip.value ->> 'durationTicks')::integer
                    )
                    order by
                      (clip.value ->> 'startTick')::integer,
                      clip.value ->> 'clipId'
                  )
                  from jsonb_array_elements(coalesce(track.value -> 'clips', '[]'::jsonb)) clip
                ), '[]'::jsonb)
              )
              order by
                (track.value ->> 'sortOrder')::integer,
                track.value ->> 'trackId'
            )
            from jsonb_array_elements(coalesce(w.manifest -> 'tracks', '[]'::jsonb)) track
          ), '[]'::jsonb) as tracks
        from public.workspaces w
        join public.projects p on p.id = w.project_id
        left join public.contributions c on c.id = w.contribution_id
        where w.owner_id = v_actor
          and w.status = 'active'
          and p.deleted_at is null
        order by w.updated_at desc, w.id desc
        limit 1
      ) x
    ),
    'recentClips', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.pattern_version_id desc)
      from (
        select recent.*
        from (
          select distinct on (mpv.id)
            mp.id as pattern_id,
            mp.name as pattern_name,
            mpv.id as pattern_version_id,
            mpv.version_number,
            p.id as project_id,
            p.title as project_title,
            w.id as workspace_id,
            wc.clip_id,
            mpv.duration_ticks,
            mpv.note_count,
            w.updated_at
          from public.midi_patterns mp
          join public.midi_pattern_versions mpv on mpv.midi_pattern_id = mp.id
          join public.workspace_clips wc on wc.midi_pattern_version_id = mpv.id
          join public.workspaces w on w.id = wc.workspace_id
          join public.projects p on p.id = w.project_id
          where mp.owner_id = v_actor
            and mp.deleted_at is null
            and w.owner_id = v_actor
            and w.status = 'active'
            and p.deleted_at is null
          order by mpv.id, w.updated_at desc, w.id desc, wc.clip_id desc
        ) recent
        order by recent.updated_at desc, recent.pattern_version_id desc
        limit 7
      ) x
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'projects', (
        select jsonb_build_object('count', least(count(*), 99), 'hasMore', count(*) = 100)
        from (
          select p.id
          from public.projects p
          where p.owner_id = v_actor
            and p.deleted_at is null
            and p.status in ('draft', 'active')
          limit 100
        ) q
      ),
      'clips', (
        select jsonb_build_object('count', least(count(*), 99), 'hasMore', count(*) = 100)
        from (
          select mp.id
          from public.midi_patterns mp
          where mp.owner_id = v_actor
            and mp.deleted_at is null
          limit 100
        ) q
      ),
      'savedClips', (
        select jsonb_build_object('count', least(count(*), 99), 'hasMore', count(*) = 100)
        from (
          select saved.midi_pattern_version_id
          from public.saved_midi_patterns saved
          where saved.user_id = v_actor
          limit 100
        ) q
      ),
      'pendingContributions', (
        select jsonb_build_object('count', least(count(*), 99), 'hasMore', count(*) = 100)
        from (
          select c.id
          from public.contributions c
          join public.projects p on p.id = c.project_id
          where c.author_id = v_actor
            and c.status in ('draft', 'submitted', 'changes_requested')
            and c.deleted_at is null
            and p.deleted_at is null
          limit 100
        ) q
      ),
      'archivingSoon', (
        select jsonb_build_object('count', least(count(*), 99), 'hasMore', count(*) = 100)
        from (
          select w.id
          from public.workspaces w
          join public.projects p on p.id = w.project_id
          where w.owner_id = v_actor
            and w.status = 'active'
            and p.deleted_at is null
            -- Keep this 23-day warning threshold synchronized with
            -- src/features/dashboard/archive-policy.ts.
            and w.updated_at <= statement_timestamp() - interval '23 days'
          limit 100
        ) q
      )
    )
  );
end;
$$;

alter function public.get_viewer_dashboard() owner to postgres;

comment on function public.get_viewer_dashboard() is
  'Bounded private dashboard launcher envelope for the active authenticated caller.';

revoke all on function public.get_viewer_dashboard() from public;
grant execute on function public.get_viewer_dashboard() to authenticated;
