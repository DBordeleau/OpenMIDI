-- COLLECTION-01: one latest immutable version per owned pattern identity while
-- preserving saved clips as exact-version bookmarks.

create or replace function public.list_studio_clip_collection(
  p_source text default 'all',
  p_query text default null,
  p_limit integer default 100
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid());
  v_query text:=nullif(btrim(p_query),'');
  v_result jsonb;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message='studio_clip_unauthenticated';
  end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='studio_clip_actor_ineligible';
  end if;
  if p_source is null or p_source not in ('all','owned','saved')
    or (v_query is not null and char_length(v_query)>80)
    or p_limit is null or p_limit not between 1 and 100 then
    raise sqlstate '22023' using message='studio_clip_collection_invalid';
  end if;

  with owned_candidates as (
    select
      latest.id,
      'owned'::text authority_kind,
      latest.version_count,
      greatest(
        p.updated_at,
        latest.created_at,
        coalesce(s.created_at,'-infinity'::timestamptz)
      ) sort_at,
      0 source_priority
    from public.midi_patterns p
    cross join lateral (
      select
        v.id,
        v.created_at,
        v.creator_credit_name,
        count(*) over ()::integer version_count
      from public.midi_pattern_versions v
      where v.midi_pattern_id=p.id
      order by v.version_number desc,v.id desc
      limit 1
    ) latest
    left join public.saved_midi_patterns s
      on s.user_id=v_actor and s.midi_pattern_version_id=latest.id
    where p_source in ('all','owned')
      and p.owner_id=v_actor
      and p.deleted_at is null
      and (
        v_query is null
        or p.name ilike '%'||v_query||'%'
        or latest.creator_credit_name ilike '%'||v_query||'%'
      )
  ), saved_candidates as (
    select
      v.id,
      case
        when p.owner_id=v_actor and p.deleted_at is null and latest.id=v.id
          then 'owned'
        else 'saved'
      end authority_kind,
      case
        when p.owner_id=v_actor and p.deleted_at is null and latest.id=v.id
          then latest.version_count
        else null
      end version_count,
      s.created_at sort_at,
      1 source_priority
    from public.saved_midi_patterns s
    join public.midi_pattern_versions v on v.id=s.midi_pattern_version_id
    join public.midi_patterns p on p.id=v.midi_pattern_id
    left join lateral (
      select
        lv.id,
        count(*) over ()::integer version_count
      from public.midi_pattern_versions lv
      where lv.midi_pattern_id=p.id
      order by lv.version_number desc,lv.id desc
      limit 1
    ) latest on true
    where p_source in ('all','saved')
      and s.user_id=v_actor
      and (
        v_query is null
        or p.name ilike '%'||v_query||'%'
        or v.creator_credit_name ilike '%'||v_query||'%'
      )
  ), candidates as (
    select * from owned_candidates
    union all
    select * from saved_candidates
  ), deduplicated as (
    select distinct on (c.id)
      c.id,c.authority_kind,c.version_count,c.sort_at
    from candidates c
    order by c.id,c.source_priority,c.sort_at desc
  ), bounded as (
    select d.*
    from deduplicated d
    order by d.sort_at desc,d.id desc
    limit p_limit
  ), projected as (
    select
      b.id,
      b.sort_at,
      b.authority_kind,
      b.version_count,
      private.get_studio_clip_authority(b.id,v_actor) item
    from bounded b
  ), normalized as (
    select
      p.id,
      p.sort_at,
      case
        when p.authority_kind='owned' then
          p.item||jsonb_build_object('versionCount',p.version_count)
        else
          p.item||jsonb_build_object(
            'source','saved',
            'availability',p.item->'savedAvailability',
            'canImport',p.item->'savedCanImport'
          )
      end item
    from projected p
    where p.item is not null
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(n.item order by n.sort_at desc,n.id desc),
      '[]'::jsonb
    )
  )
  into v_result
  from normalized n;

  return v_result;
end $$;

comment on function public.list_studio_clip_collection(text,text,integer) is
  'Authenticated bounded collection metadata. Owned results collapse to the latest immutable version per active pattern identity; saved results preserve exact bookmarks. No note arrays are returned.';

revoke all on function public.list_studio_clip_collection(text,text,integer)
  from public,anon;
grant execute on function public.list_studio_clip_collection(text,text,integer)
  to authenticated;
