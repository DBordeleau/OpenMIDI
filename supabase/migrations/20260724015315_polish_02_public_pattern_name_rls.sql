drop policy midi_patterns_read on public.midi_patterns;

create policy midi_patterns_public_arrangement_read
on public.midi_patterns
for select
to anon
using (
  deleted_at is null
  and exists (
    select 1
    from public.midi_pattern_versions v
    join public.arrangement_clips c on c.midi_pattern_version_id = v.id
    where v.midi_pattern_id = midi_patterns.id
      and (select private.can_read_arrangement(c.arrangement_version_id))
  )
);

create policy midi_patterns_authenticated_read
on public.midi_patterns
for select
to authenticated
using (
  deleted_at is null
  and (
    exists (
      select 1
      from public.midi_pattern_versions v
      join public.arrangement_clips c on c.midi_pattern_version_id = v.id
      where v.midi_pattern_id = midi_patterns.id
        and (select private.can_read_arrangement(c.arrangement_version_id))
    )
    or (
      owner_id = (select auth.uid())
      and (select private.is_active_project_actor())
    )
  )
);
