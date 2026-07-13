alter table public.projects drop constraint projects_revision_lifecycle_check;
alter table public.projects add constraint projects_revision_lifecycle_check check (
  visibility in ('private', 'public') and deleted_at is null and
  ((status = 'draft' and visibility = 'private' and current_revision_id is null
    and published_at is null and not open_to_contributions) or
   (status = 'active' and current_revision_id is not null and published_at is not null))
);

create table public.discovery_state (
  singleton boolean primary key default true check (singleton),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default statement_timestamp()
);
insert into public.discovery_state(singleton) values (true);

create table public.project_stats (
  project_id uuid primary key references public.projects(id) on delete cascade,
  revision_events integer not null default 0 check (revision_events >= 0),
  accepted_contributions integer not null default 0 check (accepted_contributions >= 0),
  public_direct_forks integer not null default 0 check (public_direct_forks >= 0),
  last_public_activity_at timestamptz,
  trending_score numeric(18,6) not null default 0,
  updated_at timestamptz not null default statement_timestamp()
);

create table public.public_project_catalog (
  project_id uuid primary key references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  bpm numeric(6,3),
  musical_key text,
  time_signature_numerator smallint not null,
  time_signature_denominator smallint not null,
  license_code text not null,
  license_name text not null,
  license_url text not null,
  license_summary text not null,
  license_allows_derivatives boolean not null,
  open_to_contributions boolean not null,
  current_revision_id uuid not null,
  revision_number integer not null,
  duration_ms integer not null,
  published_at timestamptz not null,
  updated_at timestamptz not null,
  genres jsonb not null check (jsonb_typeof(genres) = 'array'),
  genre_slugs text[] not null,
  tags jsonb not null check (jsonb_typeof(tags) = 'array'),
  tag_slugs text[] not null,
  tracks jsonb not null check (jsonb_typeof(tracks) = 'array'),
  instrument_slugs text[] not null,
  attributions jsonb not null check (jsonb_typeof(attributions) = 'array'),
  trending_score numeric(18,6) not null,
  discovery_version bigint not null,
  search_vector tsvector not null,
  refreshed_at timestamptz not null default statement_timestamp()
);

create index public_project_catalog_search_idx
  on public.public_project_catalog using gin(search_vector);
create index public_project_catalog_recent_idx
  on public.public_project_catalog(published_at desc, project_id desc);
create index public_project_catalog_trending_idx
  on public.public_project_catalog(trending_score desc, published_at desc, project_id desc);
create index public_project_catalog_genres_idx
  on public.public_project_catalog using gin(genre_slugs);
create index public_project_catalog_tags_idx
  on public.public_project_catalog using gin(tag_slugs);
create index public_project_catalog_instruments_idx
  on public.public_project_catalog using gin(instrument_slugs);
create index public_project_catalog_key_bpm_idx
  on public.public_project_catalog(musical_key, bpm)
  where musical_key is not null or bpm is not null;
create index public_project_catalog_open_recent_idx
  on public.public_project_catalog(published_at desc, project_id desc)
  where open_to_contributions;

alter table public.discovery_state enable row level security;
alter table public.project_stats enable row level security;
alter table public.public_project_catalog enable row level security;
revoke all on public.discovery_state, public.project_stats, public.public_project_catalog
  from public, anon, authenticated;
grant select on public.discovery_state, public.public_project_catalog to anon, authenticated;
create policy public_discovery_state_read on public.discovery_state
  for select to anon, authenticated using (singleton);
create policy public_catalog_read on public.public_project_catalog
  for select to anon, authenticated using (true);

create function private.bump_discovery_version()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
  update public.discovery_state
  set version = version + 1, updated_at = statement_timestamp()
  where singleton
  returning version into v_version;
  return v_version;
end
$$;

create function private.refresh_public_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype;
  v_version bigint;
  v_revision_events integer;
  v_accepted integer;
  v_forks integer;
  v_last_activity timestamptz;
  v_signal numeric;
  v_score numeric(18,6);
  v_genres jsonb;
  v_genre_slugs text[];
  v_tags jsonb;
  v_tag_slugs text[];
  v_tracks jsonb;
  v_instrument_slugs text[];
  v_attributions jsonb;
  v_search_text text;
begin
  if p_project_id is null then return; end if;
  v_version := private.bump_discovery_version();
  select * into v_project from public.projects p where p.id = p_project_id;
  if not found then
    delete from public.public_project_catalog where project_id = p_project_id;
    delete from public.project_stats where project_id = p_project_id;
    return;
  end if;

  select count(*)::integer, max(ae.created_at)
  into v_revision_events, v_last_activity
  from public.activity_events ae
  where ae.project_id = p_project_id and ae.event_type = 'project_revision_published';
  select count(*)::integer into v_accepted
  from public.project_revisions r
  join public.revision_attributions ra on ra.revision_id = r.id
  where r.project_id = p_project_id and ra.kind = 'accepted_contributor';
  select count(*)::integer into v_forks
  from public.projects child
  where child.source_project_id = p_project_id and child.visibility = 'public'
    and child.status = 'active' and child.deleted_at is null;
  v_signal := 1 + least(v_revision_events, 5) + 4 * least(v_accepted, 5)
    + 3 * least(v_forks, 10);
  v_score := round((ln(v_signal) + extract(epoch from
    (coalesce(v_last_activity, v_project.published_at, v_project.created_at)
      - timestamptz '2026-01-01 00:00:00+00')) / 450000)::numeric, 6);
  insert into public.project_stats(
    project_id, revision_events, accepted_contributions, public_direct_forks,
    last_public_activity_at, trending_score, updated_at
  ) values (
    p_project_id, v_revision_events, v_accepted, v_forks,
    v_last_activity, v_score, statement_timestamp()
  ) on conflict(project_id) do update set
    revision_events = excluded.revision_events,
    accepted_contributions = excluded.accepted_contributions,
    public_direct_forks = excluded.public_direct_forks,
    last_public_activity_at = excluded.last_public_activity_at,
    trending_score = excluded.trending_score,
    updated_at = excluded.updated_at;

  if v_project.visibility <> 'public' or v_project.status <> 'active'
    or v_project.deleted_at is not null or v_project.current_revision_id is null
    or not exists (
      select 1 from public.profiles p where p.id = v_project.owner_id
        and p.status = 'active' and p.profile_completed_at is not null
    ) then
    delete from public.public_project_catalog where project_id = p_project_id;
    return;
  end if;
  select * into v_revision from public.project_revisions r
  where r.id = v_project.current_revision_id and r.project_id = v_project.id;
  if not found then
    delete from public.public_project_catalog where project_id = p_project_id;
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'slug', g.slug, 'name', g.name, 'isPrimary', pg.is_primary
    ) order by pg.is_primary desc, g.sort_order), '[]'::jsonb),
    coalesce(array_agg(g.slug order by g.slug), '{}'::text[])
  into v_genres, v_genre_slugs
  from public.project_genres pg join public.genres g on g.id = pg.genre_id
  where pg.project_id = p_project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'slug', t.slug, 'name', t.display_name
    ) order by t.sort_order), '[]'::jsonb),
    coalesce(array_agg(t.slug order by t.slug), '{}'::text[]),
    coalesce(string_agg(t.display_name, ' ' order by t.sort_order), '')
  into v_tags, v_tag_slugs, v_search_text
  from public.project_tags pt join public.tags t on t.id = pt.tag_id
  where pt.project_id = p_project_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', rt.id, 'name', rt.name, 'durationMs', rt.duration_ms,
      'positionMs', rt.position_ms, 'sortOrder', rt.sort_order,
      'instrument', case when i.id is null then null else jsonb_build_object(
        'id', i.id, 'slug', i.slug, 'name', i.name) end,
      'credits', coalesce((select jsonb_agg(jsonb_build_object(
        'position', rtc.position, 'creditName', rtc.credit_name, 'role', rtc.role,
        'profileId', rtc.user_id) order by rtc.position)
        from public.revision_track_credits rtc
        where rtc.revision_id = rt.revision_id and rtc.track_id = rt.id), '[]'::jsonb)
    ) order by rt.sort_order), '[]'::jsonb),
    coalesce(array_agg(distinct i.slug) filter (where i.slug is not null), '{}'::text[])
  into v_tracks, v_instrument_slugs
  from public.revision_tracks rt
  left join public.instruments i on i.id = rt.instrument_id
  where rt.revision_id = v_revision.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', ra.kind, 'creditName', ra.credit_name, 'profileId', ra.user_id
    ) order by case ra.kind when 'publisher' then 0 else 1 end), '[]'::jsonb)
  into v_attributions
  from public.revision_attributions ra where ra.revision_id = v_revision.id;

  insert into public.public_project_catalog(
    project_id, owner_id, title, description, bpm, musical_key,
    time_signature_numerator, time_signature_denominator,
    license_code, license_name, license_url, license_summary,
    license_allows_derivatives, open_to_contributions, current_revision_id,
    revision_number, duration_ms, published_at, updated_at, genres, genre_slugs,
    tags, tag_slugs, tracks, instrument_slugs, attributions, trending_score,
    discovery_version, search_vector, refreshed_at
  ) select
    v_project.id, v_project.owner_id, v_project.title, v_project.description,
    v_project.bpm, v_project.musical_key, v_project.time_signature_numerator,
    v_project.time_signature_denominator, l.code, l.name, l.url, l.summary,
    l.allows_derivatives, v_project.open_to_contributions, v_revision.id,
    v_revision.revision_number, v_revision.duration_ms, v_project.published_at,
    v_project.updated_at, v_genres, v_genre_slugs, v_tags, v_tag_slugs,
    v_tracks, v_instrument_slugs, v_attributions, v_score, v_version,
    setweight(to_tsvector('simple', v_project.title), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_project.description, '')), 'B') ||
    setweight(to_tsvector('simple', v_search_text), 'C'), statement_timestamp()
  from public.licenses l where l.code = v_project.license_code
  on conflict(project_id) do update set
    owner_id = excluded.owner_id, title = excluded.title,
    description = excluded.description, bpm = excluded.bpm,
    musical_key = excluded.musical_key,
    time_signature_numerator = excluded.time_signature_numerator,
    time_signature_denominator = excluded.time_signature_denominator,
    license_code = excluded.license_code, license_name = excluded.license_name,
    license_url = excluded.license_url, license_summary = excluded.license_summary,
    license_allows_derivatives = excluded.license_allows_derivatives,
    open_to_contributions = excluded.open_to_contributions,
    current_revision_id = excluded.current_revision_id,
    revision_number = excluded.revision_number, duration_ms = excluded.duration_ms,
    published_at = excluded.published_at, updated_at = excluded.updated_at,
    genres = excluded.genres, genre_slugs = excluded.genre_slugs,
    tags = excluded.tags, tag_slugs = excluded.tag_slugs,
    tracks = excluded.tracks, instrument_slugs = excluded.instrument_slugs,
    attributions = excluded.attributions, trending_score = excluded.trending_score,
    discovery_version = excluded.discovery_version,
    search_vector = excluded.search_vector, refreshed_at = excluded.refreshed_at;
end
$$;

create function private.refresh_public_project_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid; v_old_source uuid; v_new_source uuid;
begin
  if tg_table_name = 'projects' then
    if tg_op = 'DELETE' then
      v_project_id := old.id;
      v_old_source := old.source_project_id;
    elsif tg_op = 'INSERT' then
      v_project_id := new.id;
      v_new_source := new.source_project_id;
    else
      v_project_id := new.id;
      v_old_source := old.source_project_id;
      v_new_source := new.source_project_id;
    end if;
  elsif tg_table_name in ('project_genres', 'project_tags') then
    v_project_id := coalesce(new.project_id, old.project_id);
  elsif tg_table_name = 'activity_events' then
    v_project_id := coalesce(new.project_id, old.project_id);
  elsif tg_table_name = 'revision_tracks' then
    select r.project_id into v_project_id from public.project_revisions r
    where r.id = coalesce(new.revision_id, old.revision_id);
  elsif tg_table_name in ('revision_track_credits', 'revision_attributions') then
    select r.project_id into v_project_id from public.project_revisions r
    where r.id = coalesce(new.revision_id, old.revision_id);
  end if;
  perform private.refresh_public_project(v_project_id);
  if v_old_source is not null and v_old_source is distinct from v_project_id then
    perform private.refresh_public_project(v_old_source);
  end if;
  if v_new_source is not null and v_new_source is distinct from v_old_source
    and v_new_source is distinct from v_project_id then
    perform private.refresh_public_project(v_new_source);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger projects_refresh_public_catalog
  after insert or update or delete on public.projects for each row
  execute function private.refresh_public_project_trigger();
create trigger project_genres_refresh_public_catalog
  after insert or update or delete on public.project_genres for each row
  execute function private.refresh_public_project_trigger();
create trigger project_tags_refresh_public_catalog
  after insert or update or delete on public.project_tags for each row
  execute function private.refresh_public_project_trigger();
create trigger activity_refresh_public_catalog
  after insert on public.activity_events for each row
  execute function private.refresh_public_project_trigger();
create trigger revision_tracks_refresh_public_catalog
  after insert on public.revision_tracks for each row
  execute function private.refresh_public_project_trigger();
create trigger revision_track_credits_refresh_public_catalog
  after insert on public.revision_track_credits for each row
  execute function private.refresh_public_project_trigger();
create trigger revision_attributions_refresh_public_catalog
  after insert on public.revision_attributions for each row
  execute function private.refresh_public_project_trigger();

create function private.bump_discovery_for_profile_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.username is distinct from old.username
    or new.display_name is distinct from old.display_name
    or new.status is distinct from old.status
    or new.profile_completed_at is distinct from old.profile_completed_at then
    perform private.bump_discovery_version();
    if old.id is not null then
      perform private.refresh_public_project(p.id)
      from public.projects p where p.owner_id = old.id;
    end if;
  end if;
  return new;
end
$$;
create trigger profiles_bump_public_discovery
  after update on public.profiles for each row
  execute function private.bump_discovery_for_profile_trigger();

create function public.set_project_visibility(
  p_project_id uuid,
  p_expected_lock_version integer,
  p_visibility public.project_visibility
)
returns table(project_id uuid, visibility public.project_visibility, lock_version integer, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_project public.projects%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'visibility_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message = 'visibility_actor_ineligible';
  end if;
  if p_project_id is null or p_expected_lock_version is null
    or p_expected_lock_version < 1 or p_visibility not in ('private', 'public') then
    raise sqlstate '22023' using message = 'visibility_invalid_input';
  end if;
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or v_project.owner_id <> v_actor or not exists (
    select 1 from public.project_members m where m.project_id = p_project_id
      and m.user_id = v_actor and m.role = 'owner'
  ) then raise sqlstate 'PT404' using message = 'visibility_project_not_found'; end if;
  if v_project.status <> 'active' or v_project.current_revision_id is null
    or v_project.published_at is null or v_project.deleted_at is not null then
    raise sqlstate 'PT409' using message = 'visibility_project_unavailable';
  end if;
  if v_project.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'visibility_project_conflict';
  end if;
  if v_project.visibility = p_visibility then
    return query select v_project.id, v_project.visibility,
      v_project.lock_version, v_project.updated_at;
    return;
  end if;
  update public.projects p set visibility = p_visibility,
    lock_version = p.lock_version + 1, updated_at = statement_timestamp()
  where p.id = p_project_id returning * into v_project;
  return query select v_project.id, v_project.visibility,
    v_project.lock_version, v_project.updated_at;
end
$$;
revoke all on function public.set_project_visibility(uuid, integer, public.project_visibility)
  from public, anon;
grant execute on function public.set_project_visibility(uuid, integer, public.project_visibility)
  to authenticated;

create function public.search_public_projects(
  p_query text default null,
  p_genres text[] default '{}',
  p_tags text[] default '{}',
  p_instruments text[] default '{}',
  p_keys text[] default '{}',
  p_bpm_min numeric default null,
  p_bpm_max numeric default null,
  p_open boolean default null,
  p_sort text default 'recent',
  p_after_score numeric default null,
  p_after_published_at timestamptz default null,
  p_after_project_id uuid default null,
  p_limit integer default 25
)
returns table(
  project_id uuid, owner_id uuid, title text, description text, bpm numeric,
  musical_key text, license_code text, license_name text, license_summary text,
  license_allows_derivatives boolean, open_to_contributions boolean,
  current_revision_id uuid, revision_number integer, duration_ms integer,
  published_at timestamptz, updated_at timestamptz, genres jsonb, tags jsonb,
  tracks jsonb, attributions jsonb, trending_score numeric, discovery_version bigint
)
language sql stable security invoker set search_path = '' as $$
  select c.project_id, c.owner_id, c.title, c.description, c.bpm, c.musical_key,
    c.license_code, c.license_name, c.license_summary,
    c.license_allows_derivatives, c.open_to_contributions,
    c.current_revision_id, c.revision_number, c.duration_ms, c.published_at,
    c.updated_at, c.genres, c.tags, c.tracks, c.attributions,
    c.trending_score, c.discovery_version
  from public.public_project_catalog c
  where (nullif(btrim(p_query), '') is null or c.search_vector @@
      websearch_to_tsquery('simple', nullif(btrim(p_query), '')))
    and (cardinality(coalesce(p_genres, '{}')) = 0 or c.genre_slugs && p_genres)
    and (cardinality(coalesce(p_tags, '{}')) = 0 or c.tag_slugs && p_tags)
    and (cardinality(coalesce(p_instruments, '{}')) = 0 or c.instrument_slugs && p_instruments)
    and (cardinality(coalesce(p_keys, '{}')) = 0 or c.musical_key = any(p_keys))
    and (p_bpm_min is null or c.bpm >= p_bpm_min)
    and (p_bpm_max is null or c.bpm <= p_bpm_max)
    and (p_open is null or c.open_to_contributions = p_open)
    and (
      p_after_project_id is null or
      (p_sort = 'recent' and (c.published_at, c.project_id) <
        (p_after_published_at, p_after_project_id)) or
      (p_sort = 'trending' and (c.trending_score, c.published_at, c.project_id) <
        (p_after_score, p_after_published_at, p_after_project_id))
    )
  order by
    case when p_sort = 'trending' then c.trending_score end desc,
    c.published_at desc, c.project_id desc
  limit least(greatest(p_limit, 1), 25)
$$;
revoke all on function public.search_public_projects(
  text, text[], text[], text[], text[], numeric, numeric, boolean, text,
  numeric, timestamptz, uuid, integer
) from public;
grant execute on function public.search_public_projects(
  text, text[], text[], text[], text[], numeric, numeric, boolean, text,
  numeric, timestamptz, uuid, integer
) to anon, authenticated;

create function public.get_public_project_lineage(p_project_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with child as (
    select p.source_project_id, p.source_revision_id
    from public.projects p join public.public_project_catalog c on c.project_id = p.id
    where p.id = p_project_id
  ), source as (
    select c.project_id, c.title, r.id as revision_id, r.revision_number
    from child x
    join public.public_project_catalog c on c.project_id = x.source_project_id
    join public.project_revisions r on r.id = x.source_revision_id
      and r.project_id = c.project_id
  ), forks as (
    select c.project_id, c.title, c.published_at
    from public.projects p join public.public_project_catalog c on c.project_id = p.id
    where p.source_project_id = p_project_id
    order by c.published_at desc, c.project_id desc limit 21
  )
  select jsonb_build_object(
    'source', (select jsonb_build_object(
      'projectId', s.project_id, 'title', s.title,
      'revisionId', s.revision_id, 'revisionNumber', s.revision_number
    ) from source s),
    'sourceUnavailable', exists(select 1 from child x where x.source_project_id is not null)
      and not exists(select 1 from source),
    'directForks', coalesce((select jsonb_agg(jsonb_build_object(
      'projectId', f.project_id, 'title', f.title, 'publishedAt', f.published_at
    ) order by f.published_at desc, f.project_id desc) from (select * from forks limit 20) f), '[]'::jsonb),
    'hasMoreDirectForks', (select count(*) > 20 from forks)
  )
$$;
revoke all on function public.get_public_project_lineage(uuid) from public;
grant execute on function public.get_public_project_lineage(uuid) to anon, authenticated;

create function public.get_public_profile_history(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'projects', coalesce((select jsonb_agg(jsonb_build_object(
      'projectId', c.project_id, 'title', c.title, 'publishedAt', c.published_at
    ) order by c.published_at desc, c.project_id desc)
      from (select * from public.public_project_catalog
        where owner_id = p_profile_id order by published_at desc, project_id desc limit 20) c
    ), '[]'::jsonb),
    'acceptedContributions', coalesce((select jsonb_agg(jsonb_build_object(
      'projectId', accepted.project_id, 'projectTitle', accepted.title,
      'revisionId', accepted.revision_id, 'revisionNumber', accepted.revision_number,
      'creditName', accepted.credit_name, 'acceptedAt', accepted.created_at
    ) order by accepted.created_at desc, accepted.revision_id desc)
      from (select c.project_id, c.title, r.id as revision_id,
          r.revision_number, ra.credit_name, ra.created_at
        from public.revision_attributions ra
        join public.project_revisions r on r.id = ra.revision_id
        join public.public_project_catalog c on c.project_id = r.project_id
        where ra.kind = 'accepted_contributor' and ra.user_id = p_profile_id
        order by ra.created_at desc, r.id desc limit 20) accepted
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.get_public_profile_history(uuid) from public;
grant execute on function public.get_public_profile_history(uuid) to anon, authenticated;

create function public.get_contribution_project_context(p_contribution_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', p.title,
    'ownerId', p.owner_id,
    'currentRevisionId', p.current_revision_id,
    'currentRevisionNumber', current_revision.revision_number,
    'baseRevisionNumber', base_revision.revision_number,
    'license', jsonb_build_object(
      'code', l.code, 'name', l.name, 'url', l.url, 'summary', l.summary
    )
  )
  from public.contributions c
  join public.projects p on p.id = c.project_id
  join public.licenses l on l.code = p.license_code
  join public.project_revisions base_revision on base_revision.id = c.base_revision_id
  left join public.project_revisions current_revision on current_revision.id = p.current_revision_id
  where c.id = p_contribution_id
    and (select private.is_active_project_actor())
    and (c.author_id = (select auth.uid()) or p.owner_id = (select auth.uid()))
$$;
revoke all on function public.get_contribution_project_context(uuid) from public, anon;
grant execute on function public.get_contribution_project_context(uuid) to authenticated;

create function private.can_read_source_asset(p_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.is_active_project_actor()) and exists (
    select 1 from public.assets a where a.id = p_asset_id
      and a.kind = 'source_audio' and a.status = 'ready' and a.deleted_at is null
      and (
        a.owner_id = (select auth.uid())
        or exists (
          select 1 from public.revision_tracks rt
          join public.project_revisions r on r.id = rt.revision_id
          where rt.asset_id = a.id and (select private.is_project_member(r.project_id))
        )
        or exists (
          select 1 from public.workspace_tracks wt
          join public.workspaces w on w.id = wt.workspace_id
          where wt.asset_id = a.id and w.owner_id = (select auth.uid())
            and w.status = 'active'
        )
        or exists (
          select 1 from public.contribution_version_tracks cvt
          join public.contribution_versions cv on cv.id = cvt.contribution_version_id
          join public.contributions c on c.id = cv.contribution_id
          join public.projects p on p.id = c.project_id
          where cvt.asset_id = a.id and (
            c.author_id = (select auth.uid())
            or (p.owner_id = (select auth.uid()) and c.status <> 'draft')
          )
        )
      )
  )
$$;
revoke all on function private.can_read_source_asset(uuid) from public, anon;
grant execute on function private.can_read_source_asset(uuid) to authenticated;

drop policy if exists owned_or_referenced_assets_read on public.assets;
create policy owned_or_referenced_assets_read on public.assets
  for select to authenticated using (
    owner_id = (select auth.uid()) or (select private.can_read_source_asset(assets.id))
  );
drop policy if exists owned_or_referenced_source_read on storage.objects;
create policy owned_or_referenced_source_read on storage.objects
  for select to authenticated using (
    bucket_id = 'source-audio' and exists (
      select 1 from public.assets a where a.bucket = bucket_id and a.object_path = name
        and (select private.can_read_source_asset(a.id))
    )
  );

-- Existing active workflows must continue after a project becomes public.
do $$
declare v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.set_project_contributions_open(uuid,integer,boolean)'::regprocedure
  );
  if position('v_project.visibility <> ''private''' in v_definition) = 0 then
    raise exception 'set_project_contributions_open visibility guard changed';
  end if;
  execute replace(v_definition,
    'v_project.visibility <> ''private''',
    'v_project.visibility not in (''private'', ''public'')');

  v_definition := pg_get_functiondef(
    'public.create_contribution_workspace(uuid,uuid,uuid,text,text)'::regprocedure
  );
  if position('v_project.visibility <> ''private''' in v_definition) = 0 then
    raise exception 'create_contribution_workspace visibility guard changed';
  end if;
  v_definition := replace(v_definition,
    'v_project.visibility <> ''private''',
    'v_project.visibility not in (''private'', ''public'')');
  v_definition := regexp_replace(v_definition,
    'if v_project.owner_id = v_actor or not exists \(\s+select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = v_actor and m.role in \(''editor'', ''viewer''\)\s+\) then',
    $replacement$if v_project.owner_id = v_actor or (v_project.visibility = 'private' and not exists (
    select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = v_actor and m.role in ('editor', 'viewer')
  )) then$replacement$);
  if position('v_project.visibility = ''private'' and not exists' in v_definition) = 0 then
    raise exception 'create_contribution_workspace membership guard changed';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef(
    'public.submit_contribution(uuid,uuid,integer,uuid,text,text)'::regprocedure
  );
  if position('v_project.visibility <> ''private''' in v_definition) = 0 then
    raise exception 'submit_contribution visibility guard changed';
  end if;
  v_definition := replace(v_definition,
    'v_project.visibility <> ''private''',
    'v_project.visibility not in (''private'', ''public'')');
  v_definition := replace(v_definition,
    'if not exists (select 1 from public.project_members m where m.project_id = v_project.id and m.user_id = v_actor) then',
    'if not exists (select 1 from public.project_members m where m.project_id = v_project.id and m.user_id = v_actor) and v_contribution.author_id <> v_actor then');
  if position('and v_contribution.author_id <> v_actor then' in v_definition) = 0 then
    raise exception 'submit_contribution participant guard changed';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef(
    'public.review_contribution(uuid,uuid,public.contribution_review_decision,public.contribution_status,uuid,uuid,text)'::regprocedure
  );
  if position('v_project.visibility <> ''private''' in v_definition) = 0 then
    raise exception 'review_contribution visibility guard changed';
  end if;
  execute replace(v_definition,
    'v_project.visibility <> ''private''',
    'v_project.visibility not in (''private'', ''public'')');

  v_definition := pg_get_functiondef(
    'public.fork_project(uuid,uuid,uuid,text,text,text)'::regprocedure
  );
  if position('v_source.visibility <> ''private''' in v_definition) = 0 then
    raise exception 'fork_project visibility guard changed';
  end if;
  v_definition := replace(v_definition,
    'v_source.visibility <> ''private''',
    'v_source.visibility not in (''private'', ''public'')');
  v_definition := regexp_replace(v_definition,
    'or not exists \(\s+select 1 from public.project_members m\s+where m.project_id = v_source.id and m.user_id = v_actor\s+\) then',
    $replacement$or (v_source.visibility = 'private' and not exists (
      select 1 from public.project_members m
      where m.project_id = v_source.id and m.user_id = v_actor
    )) then$replacement$);
  if position('v_source.visibility = ''private'' and not exists' in v_definition) = 0 then
    raise exception 'fork_project membership guard changed';
  end if;
  execute v_definition;
end
$$;

revoke all on function private.bump_discovery_version(),
  private.refresh_public_project(uuid), private.refresh_public_project_trigger(),
  private.bump_discovery_for_profile_trigger() from public, anon, authenticated;

create function private.refresh_all_project_stats()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid; v_count integer := 0;
begin
  for v_project_id in select p.id from public.projects p loop
    perform private.refresh_public_project(v_project_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;
revoke all on function private.refresh_all_project_stats() from public, anon, authenticated;

do $$ declare v_project_id uuid; begin
  for v_project_id in select p.id from public.projects p loop
    perform private.refresh_public_project(v_project_id);
  end loop;
end $$;

comment on table public.public_project_catalog is
  'RLS-protected safe public search/presentation projection; never write authority.';
comment on function public.search_public_projects(
  text, text[], text[], text[], text[], numeric, numeric, boolean, text,
  numeric, timestamptz, uuid, integer
) is 'Bounded keyset-paginated public project discovery over the safe catalog.';
