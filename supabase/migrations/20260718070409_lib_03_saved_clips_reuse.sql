-- LIB-03: private saved clips and authoritative commercially reusable Studio paths.

create table public.saved_midi_patterns (
  user_id uuid not null references public.profiles(id) on delete cascade,
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  source_listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  save_request_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(user_id,midi_pattern_version_id),
  unique(user_id,save_request_id)
);

comment on table public.saved_midi_patterns is
  'Private exact-version bookmarks. Rows copy no notes and transfer no ownership or license.';

create table private.saved_midi_pattern_removals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  removed_saved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  primary key(user_id,request_id)
);

create table private.midi_library_reuses (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  operation text not null check (operation=any(array['import','fork','open_editor'])),
  request_payload_sha256 text not null check (request_payload_sha256~'^[0-9a-f]{64}$'),
  source_listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  source_pattern_id uuid not null references public.midi_patterns(id) on delete restrict,
  source_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  source_creator_credit_name text not null,
  reuse_license_code text not null check (reuse_license_code='CC-BY-4.0'),
  reuse_license_version text not null check (reuse_license_version='4.0'),
  reuse_license_url text not null check (reuse_license_url='https://creativecommons.org/licenses/by/4.0/'),
  external_credits jsonb not null check (jsonb_typeof(external_credits)='array'),
  derived_pattern_id uuid references public.midi_patterns(id) on delete restrict,
  derived_pattern_version_id uuid references public.midi_pattern_versions(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  track_id uuid,
  clip_id uuid,
  resulting_workspace_lock_version integer,
  created_at timestamptz not null default statement_timestamp(),
  unique(actor_id,request_id),
  check ((operation='fork' and workspace_id is null and clip_id is null)
    or (operation in ('import','open_editor') and workspace_id is not null and clip_id is not null)),
  check ((operation='import' and derived_pattern_version_id is null)
    or (operation in ('fork','open_editor') and derived_pattern_version_id is not null))
);

create table private.midi_library_reuse_access (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  midi_pattern_version_id uuid not null references public.midi_pattern_versions(id) on delete restrict,
  source_listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  granted_at timestamptz not null default statement_timestamp(),
  primary key(actor_id,midi_pattern_version_id)
);

comment on table private.midi_library_reuses is
  'Immutable source listing/version, CC terms, creator, and external-credit provenance for authorized reuse.';

alter table public.midi_pattern_external_credits alter column listing_id drop not null;
alter table public.midi_pattern_external_credits add constraint midi_pattern_external_credits_origin_check
  check (listing_id is not null or inherited_from_credit_id is not null);
create unique index midi_pattern_inherited_credit_position_idx
  on public.midi_pattern_external_credits(midi_pattern_version_id,position)
  where listing_id is null;

alter function public.list_midi_library_pattern_version(
  uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid
) set schema private;
revoke all on function private.list_midi_library_pattern_version(
  uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid
) from public,anon,authenticated;

create or replace function public.list_midi_library_pattern_version(
  p_pattern_version_id uuid,
  p_request_id uuid,
  p_reuse_mode text,
  p_rights_basis text,
  p_attestation_version text,
  p_description text,
  p_supporting_source_url text,
  p_supporting_source_terms text,
  p_public_domain_rationale text,
  p_category_code text,
  p_suggested_preset_id text,
  p_suggested_preset_version integer,
  p_tags text[],
  p_external_credits jsonb,
  p_replace_listing_id uuid default null
) returns table(listing_id uuid,creator_version integer,listed_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_pattern public.midi_patterns%rowtype;
  v_version public.midi_pattern_versions%rowtype;
  v_inherited_version_id uuid;
  v_inherited_credits jsonb := '[]'::jsonb;
  v_combined_credits jsonb;
begin
  select * into v_version from public.midi_pattern_versions where id=p_pattern_version_id;
  if found then
    select * into v_pattern from public.midi_patterns
    where id=v_version.midi_pattern_id and owner_id=v_actor and deleted_at is null;
  end if;
  if v_pattern.id is not null and (
    v_pattern.source_pattern_version_id is not null or v_version.source_pattern_version_id is not null
  ) then
    if p_rights_basis is distinct from 'authorized_adaptation' then
      raise sqlstate 'PT409' using message='midi_library_derived_rights_basis_required';
    end if;
    select pv.id into v_inherited_version_id
    from public.midi_pattern_versions pv
    where pv.midi_pattern_id=v_pattern.id and exists(
      select 1 from public.midi_pattern_external_credits ec
      where ec.midi_pattern_version_id=pv.id and ec.listing_id is null
    )
    order by pv.version_number,pv.id limit 1;
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,
      'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,
      'attributionNote',ec.attribution_note
    )) order by ec.position),'[]'::jsonb) into v_inherited_credits
    from public.midi_pattern_external_credits ec
    where ec.midi_pattern_version_id=v_inherited_version_id and ec.listing_id is null;
  end if;
  if p_external_credits is null or jsonb_typeof(p_external_credits)<>'array' then
    v_combined_credits:=p_external_credits;
  else
    v_combined_credits:=v_inherited_credits||p_external_credits;
  end if;
  return query select * from private.list_midi_library_pattern_version(
    p_pattern_version_id,p_request_id,p_reuse_mode,p_rights_basis,p_attestation_version,
    p_description,p_supporting_source_url,p_supporting_source_terms,p_public_domain_rationale,
    p_category_code,p_suggested_preset_id,p_suggested_preset_version,p_tags,
    v_combined_credits,p_replace_listing_id
  );
end $$;

drop function public.list_owned_midi_library_versions(integer);
create or replace function public.list_owned_midi_library_versions(p_limit integer default 100)
returns table(
  pattern_id uuid,pattern_name text,pattern_version_id uuid,version_number integer,created_at timestamptz,
  reuse_license_code text,duration_ticks integer,note_count integer,has_source_lineage boolean,
  has_inherited_external_credits boolean,
  active_listing_id uuid,active_listing_pattern_version_id uuid,active_reuse_mode text,active_creator_version integer
)
language sql stable security definer set search_path=''
as $$
  select p.id,p.name,v.id,v.version_number,v.created_at,v.reuse_license_code,v.duration_ticks,v.note_count,
    p.source_pattern_version_id is not null or v.source_pattern_version_id is not null,
    exists(select 1 from public.midi_pattern_versions inherited_version
      join public.midi_pattern_external_credits inherited_credit
        on inherited_credit.midi_pattern_version_id=inherited_version.id
        and inherited_credit.listing_id is null
      where inherited_version.midi_pattern_id=p.id),
    l.id,l.midi_pattern_version_id,l.reuse_mode,l.creator_version
  from public.midi_patterns p
  join public.midi_pattern_versions v on v.midi_pattern_id=p.id
  left join public.midi_library_listings l on l.midi_pattern_id=p.id and l.unlisted_at is null
  where (select auth.uid()) is not null and (select private.is_active_project_actor())
    and p.owner_id=(select auth.uid()) and p.deleted_at is null
  order by v.created_at desc,v.id desc
  limit least(greatest(coalesce(p_limit,100),1),100)
$$;

create index saved_midi_patterns_user_recent_idx
  on public.saved_midi_patterns(user_id,created_at desc,midi_pattern_version_id);
create index saved_midi_patterns_listing_idx on public.saved_midi_patterns(source_listing_id);
create index midi_library_reuses_source_version_idx
  on private.midi_library_reuses(source_pattern_version_id,created_at desc);
create index midi_library_reuses_workspace_clip_idx
  on private.midi_library_reuses(workspace_id,clip_id) where workspace_id is not null;

alter table public.saved_midi_patterns enable row level security;
create policy saved_midi_patterns_owner_read on public.saved_midi_patterns
  for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.saved_midi_patterns from anon,authenticated;
grant select on public.saved_midi_patterns to authenticated;

create or replace function private.can_read_pattern_version(p_pattern_version_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.midi_pattern_versions v join public.midi_patterns p on p.id=v.midi_pattern_id
    where v.id=p_pattern_version_id and p.deleted_at is null and (
      (p.owner_id=(select auth.uid()) and (select private.is_active_project_actor()))
      or exists(select 1 from public.arrangement_clips c where c.midi_pattern_version_id=v.id
        and (select private.can_read_arrangement(c.arrangement_version_id)))
      or exists(select 1 from private.midi_library_reuse_access a
        where a.actor_id=(select auth.uid()) and a.midi_pattern_version_id=v.id
          and (select private.is_active_project_actor()))
    )
  )
$$;

create or replace function private.get_midi_library_reuse_authority(
  p_listing_id uuid,
  p_pattern_version_id uuid,
  p_actor uuid,
  p_require_active boolean default false
) returns public.midi_library_listings
language plpgsql stable security definer set search_path=''
as $$
declare v_listing public.midi_library_listings%rowtype;
begin
  select l.* into v_listing
  from public.midi_library_listings l
  join public.midi_pattern_versions v on v.id=l.midi_pattern_version_id
  join public.midi_patterns p on p.id=l.midi_pattern_id
  join public.profiles owner_profile on owner_profile.id=l.owner_id
  join public.midi_library_presets lp on lp.preset_id=l.suggested_preset_id
    and lp.version=l.suggested_preset_version and lp.active
  join private.midi_synth_presets sp on sp.preset_id=lp.preset_id and sp.version=lp.version
    and sp.engine_version='jam-session-midi-3_tone-15.1.22_presets-1' and sp.is_active
  where l.id=p_listing_id and l.midi_pattern_version_id=p_pattern_version_id
    and l.reuse_mode='commercial_reuse' and l.moderation_hidden_at is null
    and v.reuse_license_code='CC-BY-4.0' and v.reuse_license_version='4.0'
    and v.reuse_license_url='https://creativecommons.org/licenses/by/4.0/'
    and p.deleted_at is null and owner_profile.status='active'
    and owner_profile.moderation_state='visible' and owner_profile.purged_at is null
    and not exists(select 1 from public.midi_pattern_notes n where n.midi_pattern_version_id=v.id
      and n.pitch not between sp.min_note and sp.max_note)
    and (l.unlisted_at is null or (not p_require_active and exists(
      select 1 from public.saved_midi_patterns s where s.user_id=p_actor
        and s.midi_pattern_version_id=l.midi_pattern_version_id and s.source_listing_id=l.id
    )));
  if not found then raise sqlstate 'PT404' using message='midi_library_reuse_source_not_found'; end if;
  return v_listing;
end $$;

create or replace function public.save_midi_library_pattern(
  p_listing_id uuid,p_pattern_version_id uuid,p_request_id uuid
) returns table(midi_pattern_version_id uuid,source_listing_id uuid,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_saved public.saved_midi_patterns%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if p_request_id is null or not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='midi_library_actor_ineligible'; end if;
  select * into v_saved from public.saved_midi_patterns s
    where s.user_id=v_actor and s.save_request_id=p_request_id;
  if found then
    if v_saved.midi_pattern_version_id<>p_pattern_version_id or v_saved.source_listing_id<>p_listing_id then
      raise sqlstate 'PT409' using message='midi_library_save_request_conflict'; end if;
    return query select v_saved.midi_pattern_version_id,v_saved.source_listing_id,v_saved.created_at; return;
  end if;
  perform private.get_midi_library_reuse_authority(p_listing_id,p_pattern_version_id,v_actor,true);
  insert into public.saved_midi_patterns(user_id,midi_pattern_version_id,source_listing_id,save_request_id)
  values(v_actor,p_pattern_version_id,p_listing_id,p_request_id)
  on conflict(user_id,midi_pattern_version_id) do nothing;
  select * into strict v_saved from public.saved_midi_patterns s
    where s.user_id=v_actor and s.midi_pattern_version_id=p_pattern_version_id;
  return query select v_saved.midi_pattern_version_id,v_saved.source_listing_id,v_saved.created_at;
end $$;

create or replace function public.remove_saved_midi_library_pattern(
  p_pattern_version_id uuid,p_request_id uuid
) returns table(midi_pattern_version_id uuid,removed boolean)
language plpgsql security definer set search_path=''
as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_prior private.saved_midi_pattern_removals%rowtype;
  v_saved_at timestamptz;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if p_request_id is null or not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='midi_library_actor_ineligible'; end if;
  select * into v_prior from private.saved_midi_pattern_removals r
    where r.user_id=v_actor and r.request_id=p_request_id;
  if found then
    if v_prior.midi_pattern_version_id<>p_pattern_version_id then
      raise sqlstate 'PT409' using message='midi_library_remove_request_conflict'; end if;
    return query select p_pattern_version_id,v_prior.removed_saved_at is not null; return;
  end if;
  delete from public.saved_midi_patterns s where s.user_id=v_actor
    and s.midi_pattern_version_id=p_pattern_version_id returning s.created_at into v_saved_at;
  insert into private.saved_midi_pattern_removals(user_id,request_id,midi_pattern_version_id,removed_saved_at)
    values(v_actor,p_request_id,p_pattern_version_id,v_saved_at);
  return query select p_pattern_version_id,v_saved_at is not null;
end $$;

create or replace function public.list_saved_midi_library_patterns(p_limit integer default 100)
returns table(
  midi_pattern_version_id uuid,source_listing_id uuid,title text,creator_username text,
  creator_display_name text,creator_credit_name text,reuse_mode text,license_code text,
  license_version text,license_url text,category_name text,preset_id text,preset_version integer,
  preset_name text,duration_ticks integer,note_count integer,created_at timestamptz,
  source_availability text,can_reuse boolean,external_credits jsonb,notes jsonb
)
language sql stable security definer set search_path=''
as $$
  select s.midi_pattern_version_id,s.source_listing_id,l.title,l.creator_username,l.creator_display_name,
    l.creator_credit_name,l.reuse_mode,v.reuse_license_code,v.reuse_license_version,v.reuse_license_url,
    c.display_name,pr.preset_id,pr.version,pr.display_name,l.duration_ticks,l.note_count,s.created_at,
    case when l.moderation_hidden_at is not null then 'moderation_hidden'
      when p.deleted_at is not null or op.status<>'active' or op.moderation_state<>'visible' or op.purged_at is not null then 'unavailable'
      when l.unlisted_at is not null then 'unlisted' else 'active' end,
    l.moderation_hidden_at is null and p.deleted_at is null and op.status='active'
      and op.moderation_state='visible' and op.purged_at is null
      and v.reuse_license_code='CC-BY-4.0' and v.reuse_license_version='4.0'
      and v.reuse_license_url='https://creativecommons.org/licenses/by/4.0/',
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,'sourceUrl',ec.source_url,
      'sourceTerms',ec.source_terms,'attributionNote',ec.attribution_note)) order by ec.position)
      from public.midi_pattern_external_credits ec where ec.listing_id=l.id),'[]'::jsonb),
    case when l.moderation_hidden_at is null and p.deleted_at is null and op.status='active'
      and op.moderation_state='visible' and op.purged_at is null then
      coalesce((select jsonb_agg(jsonb_build_object('noteId',n.note_id,'startTick',n.start_tick,
        'durationTicks',n.duration_ticks,'pitch',n.pitch,'velocity',n.velocity)
        order by n.start_tick,n.pitch,n.note_id) from public.midi_pattern_notes n
        where n.midi_pattern_version_id=v.id),'[]'::jsonb) else '[]'::jsonb end
  from public.saved_midi_patterns s
  join public.midi_library_listings l on l.id=s.source_listing_id
  join public.midi_pattern_versions v on v.id=s.midi_pattern_version_id
  join public.midi_patterns p on p.id=v.midi_pattern_id
  join public.profiles op on op.id=l.owner_id
  join public.midi_library_categories c on c.code=l.category_code
  join public.midi_library_presets pr on pr.preset_id=l.suggested_preset_id and pr.version=l.suggested_preset_version
  where s.user_id=(select auth.uid()) and (select private.is_active_project_actor())
  order by s.created_at desc,s.midi_pattern_version_id desc
  limit least(greatest(coalesce(p_limit,100),1),100)
$$;

create or replace function public.list_saved_midi_library_pattern_ids(p_pattern_version_ids uuid[])
returns table(midi_pattern_version_id uuid)
language sql stable security definer set search_path=''
as $$
  select s.midi_pattern_version_id
  from public.saved_midi_patterns s
  where s.user_id=(select auth.uid()) and (select private.is_active_project_actor())
    and cardinality(coalesce(p_pattern_version_ids,'{}'::uuid[])) between 1 and 25
    and s.midi_pattern_version_id=any(p_pattern_version_ids)
  order by s.midi_pattern_version_id
$$;

create or replace function public.list_owned_private_midi_workspaces()
returns table(project_id uuid,project_title text,workspace_id uuid,lock_version integer,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select p.id,p.title,w.id,w.lock_version,w.updated_at from public.projects p
  join public.workspaces w on w.project_id=p.id and w.owner_id=p.owner_id and w.status='active' and w.contribution_id is null
  where p.owner_id=(select auth.uid()) and p.visibility='private' and p.status in ('draft','active')
    and p.deleted_at is null and (select private.is_active_project_actor())
  order by w.updated_at desc,w.id desc limit 100
$$;

create or replace function public.reuse_midi_library_pattern(
  p_listing_id uuid,p_pattern_version_id uuid,p_request_id uuid,p_operation text,
  p_workspace_id uuid default null,p_expected_workspace_lock_version integer default null,
  p_copy_name text default null,p_start_tick integer default 0
) returns table(
  operation text,source_pattern_version_id uuid,derived_pattern_id uuid,derived_pattern_version_id uuid,
  project_id uuid,workspace_id uuid,track_id uuid,clip_id uuid,lock_version integer
)
language plpgsql security definer set search_path=''
as $$
#variable_conflict use_column
declare v_actor uuid:=(select auth.uid()); v_listing public.midi_library_listings%rowtype;
  v_source public.midi_pattern_versions%rowtype; v_workspace public.workspaces%rowtype;
  v_existing private.midi_library_reuses%rowtype;
  v_pattern public.midi_patterns%rowtype; v_child public.midi_pattern_versions%rowtype;
  v_manifest jsonb; v_track jsonb; v_track_id uuid; v_clip_id uuid; v_used_version uuid;
  v_name text:=btrim(p_copy_name); v_payload_hash text; v_credits jsonb; v_hash text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_library_actor_ineligible'; end if;
  if p_request_id is null or p_operation<>all(array['import','fork','open_editor']) or p_start_tick<0
    or (p_operation='fork' and (p_workspace_id is not null or p_expected_workspace_lock_version is not null))
    or (p_operation in ('import','open_editor') and (p_workspace_id is null or p_expected_workspace_lock_version is null))
    or (p_operation in ('fork','open_editor') and (p_copy_name is null or p_copy_name<>v_name or char_length(v_name) not between 1 and 120)) then
    raise sqlstate '22023' using message='midi_library_reuse_invalid'; end if;
  v_payload_hash:=encode(extensions.digest(convert_to(jsonb_build_object('listingId',p_listing_id,
    'patternVersionId',p_pattern_version_id,'operation',p_operation,'workspaceId',p_workspace_id,
    'expectedLockVersion',p_expected_workspace_lock_version,'copyName',p_copy_name,'startTick',p_start_tick)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.midi_library_reuses r where r.actor_id=v_actor and r.request_id=p_request_id;
  if found then
    if v_existing.request_payload_sha256<>v_payload_hash then raise sqlstate 'PT409' using message='midi_library_reuse_request_conflict'; end if;
    return query select v_existing.operation,v_existing.source_pattern_version_id,v_existing.derived_pattern_id,
      v_existing.derived_pattern_version_id,v_existing.project_id,v_existing.workspace_id,v_existing.track_id,
      v_existing.clip_id,v_existing.resulting_workspace_lock_version; return;
  end if;
  v_listing:=private.get_midi_library_reuse_authority(p_listing_id,p_pattern_version_id,v_actor,false);
  select * into strict v_source from public.midi_pattern_versions where id=p_pattern_version_id;
  insert into private.midi_library_reuse_access(actor_id,midi_pattern_version_id,source_listing_id)
    values(v_actor,v_source.id,v_listing.id) on conflict(actor_id,midi_pattern_version_id) do nothing;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('creditedName',ec.credited_name,
    'role',ec.role,'workTitle',ec.work_title,'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,
    'attributionNote',ec.attribution_note)) order by ec.position),'[]'::jsonb) into v_credits
    from public.midi_pattern_external_credits ec where ec.listing_id=v_listing.id;

  v_used_version:=v_source.id;
  if p_operation in ('fork','open_editor') then
    insert into public.midi_patterns(owner_id,create_request_id,name,source_pattern_id,source_pattern_version_id)
      values(v_actor,p_request_id,v_name,v_source.midi_pattern_id,v_source.id) returning * into v_pattern;
    insert into public.midi_pattern_versions(midi_pattern_id,version_number,create_request_id,creator_id,
      creator_credit_name,parent_pattern_version_id,source_pattern_version_id,ppq,duration_ticks,note_count,
      content_sha256,reuse_license_code,reuse_license_version,reuse_license_url)
    select v_pattern.id,1,p_request_id,v_actor,p.credit_name,null,v_source.id,v_source.ppq,v_source.duration_ticks,
      v_source.note_count,v_source.content_sha256,v_source.reuse_license_code,v_source.reuse_license_version,
      v_source.reuse_license_url from public.profiles p where p.id=v_actor returning * into v_child;
    insert into public.midi_pattern_notes(midi_pattern_version_id,note_id,start_tick,duration_ticks,pitch,velocity)
      select v_child.id,n.note_id,n.start_tick,n.duration_ticks,n.pitch,n.velocity
      from public.midi_pattern_notes n where n.midi_pattern_version_id=v_source.id;
    insert into public.midi_pattern_external_credits(listing_id,midi_pattern_version_id,position,credited_name,role,
      work_title,source_url,source_terms,attribution_note,inherited_from_credit_id)
      select null,v_child.id,ec.position,ec.credited_name,ec.role,ec.work_title,ec.source_url,ec.source_terms,
        ec.attribution_note,ec.id from public.midi_pattern_external_credits ec where ec.listing_id=v_listing.id;
    v_used_version:=v_child.id;
  end if;

  if p_operation in ('import','open_editor') then
    select * into v_workspace from public.workspaces w where w.id=p_workspace_id and w.owner_id=v_actor
      and w.status='active' and w.contribution_id is null and w.manifest_version=3 for update;
    if not found then raise sqlstate 'PT404' using message='midi_library_workspace_not_found'; end if;
    perform 1 from public.projects p where p.id=v_workspace.project_id and p.owner_id=v_actor
      and p.visibility='private' and p.status in ('draft','active') and p.deleted_at is null;
    if not found then raise sqlstate 'PT404' using message='midi_library_workspace_not_found'; end if;
    if v_workspace.lock_version<>p_expected_workspace_lock_version then raise sqlstate 'PT409' using message='midi_library_workspace_conflict'; end if;
    if jsonb_array_length(v_workspace.manifest->'tracks')>=16 then raise sqlstate 'PT409' using message='midi_library_workspace_track_limit'; end if;
    v_track_id:=gen_random_uuid(); v_clip_id:=gen_random_uuid();
    v_track:=jsonb_build_object('trackId',v_track_id,'sortOrder',jsonb_array_length(v_workspace.manifest->'tracks'),
      'name',case when p_operation='open_editor' then v_name else v_listing.title end,
      'presetId',v_listing.suggested_preset_id,'presetVersion',v_listing.suggested_preset_version,
      'gainDb',-6,'pan',0,'muted',false,'soloed',false,'clips',jsonb_build_array(jsonb_build_object(
      'clipId',v_clip_id,'midiPatternVersionId',v_used_version,'startTick',p_start_tick,
      'durationTicks',v_source.duration_ticks,'sourceStartTick',0,'loop',false)));
    v_manifest:=jsonb_set(v_workspace.manifest,'{durationTicks}',to_jsonb(greatest(
      (v_workspace.manifest->>'durationTicks')::integer,p_start_tick+v_source.duration_ticks)));
    v_manifest:=jsonb_set(v_manifest,'{tracks}',(v_manifest->'tracks')||jsonb_build_array(v_track));
    v_manifest:=private.canonical_manifest_v3(v_manifest,v_workspace.project_id,v_workspace.id);
    v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
    perform private.replace_workspace_projection_v3(v_workspace.id,v_manifest);
    update public.workspaces set manifest=v_manifest,manifest_sha256=v_hash,lock_version=lock_version+1,
      last_manifest_request_id=p_request_id,last_manifest_expected_lock_version=p_expected_workspace_lock_version,
      updated_at=statement_timestamp() where id=v_workspace.id returning * into v_workspace;
    insert into private.workspace_snapshots(workspace_id,project_id,owner_id,request_id,lock_version,manifest,manifest_sha256)
      values(v_workspace.id,v_workspace.project_id,v_actor,p_request_id,v_workspace.lock_version,v_manifest,v_hash);
    delete from private.workspace_snapshots s where s.workspace_id=v_workspace.id and s.id in (
      select s2.id from private.workspace_snapshots s2 where s2.workspace_id=v_workspace.id order by s2.lock_version desc offset 20);
  end if;
  insert into private.midi_library_reuses(actor_id,request_id,operation,request_payload_sha256,source_listing_id,
    source_pattern_id,source_pattern_version_id,source_creator_credit_name,reuse_license_code,reuse_license_version,
    reuse_license_url,external_credits,derived_pattern_id,derived_pattern_version_id,project_id,workspace_id,track_id,
    clip_id,resulting_workspace_lock_version)
  values(v_actor,p_request_id,p_operation,v_payload_hash,v_listing.id,v_listing.midi_pattern_id,v_source.id,
    v_listing.creator_credit_name,v_source.reuse_license_code,v_source.reuse_license_version,v_source.reuse_license_url,
    v_credits,v_pattern.id,v_child.id,v_workspace.project_id,v_workspace.id,v_track_id,v_clip_id,v_workspace.lock_version)
  returning * into v_existing;
  return query select v_existing.operation,v_existing.source_pattern_version_id,v_existing.derived_pattern_id,
    v_existing.derived_pattern_version_id,v_existing.project_id,v_existing.workspace_id,v_existing.track_id,
    v_existing.clip_id,v_existing.resulting_workspace_lock_version;
end $$;

create or replace function public.get_midi_library_export(
  p_listing_id uuid,p_pattern_version_id uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_listing public.midi_library_listings%rowtype;
  v_version public.midi_pattern_versions%rowtype; v_credits jsonb;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='midi_library_actor_ineligible'; end if;
  v_listing:=private.get_midi_library_reuse_authority(p_listing_id,p_pattern_version_id,v_actor,false);
  select * into strict v_version from public.midi_pattern_versions where id=p_pattern_version_id;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('creditedName',ec.credited_name,'role',ec.role,
    'workTitle',ec.work_title,'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,'attributionNote',ec.attribution_note))
    order by ec.position),'[]'::jsonb) into v_credits from public.midi_pattern_external_credits ec where ec.listing_id=v_listing.id;
  return jsonb_build_object('listingId',v_listing.id,'midiPatternId',v_listing.midi_pattern_id,
    'midiPatternVersionId',v_version.id,'title',v_listing.title,'creatorCreditName',v_listing.creator_credit_name,
    'license',jsonb_build_object('code',v_version.reuse_license_code,'version',v_version.reuse_license_version,
      'url',v_version.reuse_license_url),'externalCredits',v_credits,'ppq',v_version.ppq,
    'durationTicks',v_version.duration_ticks,'presetId',v_listing.suggested_preset_id,
    'presetVersion',v_listing.suggested_preset_version,'notes',coalesce((select jsonb_agg(jsonb_build_object(
      'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,'pitch',n.pitch,'velocity',n.velocity)
      order by n.start_tick,n.pitch,n.note_id) from public.midi_pattern_notes n where n.midi_pattern_version_id=v_version.id),'[]'::jsonb));
end $$;

revoke all on function private.get_midi_library_reuse_authority(uuid,uuid,uuid,boolean) from public;
revoke all on function private.can_read_pattern_version(uuid) from public;
revoke all on function public.list_midi_library_pattern_version(
  uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid
) from public,anon;
grant execute on function public.list_midi_library_pattern_version(
  uuid,uuid,text,text,text,text,text,text,text,text,text,integer,text[],jsonb,uuid
) to authenticated;
revoke all on function public.list_owned_midi_library_versions(integer) from public,anon;
grant execute on function public.list_owned_midi_library_versions(integer) to authenticated;
revoke all on function public.save_midi_library_pattern(uuid,uuid,uuid) from public,anon;
grant execute on function public.save_midi_library_pattern(uuid,uuid,uuid) to authenticated;
revoke all on function public.remove_saved_midi_library_pattern(uuid,uuid) from public,anon;
grant execute on function public.remove_saved_midi_library_pattern(uuid,uuid) to authenticated;
revoke all on function public.list_saved_midi_library_patterns(integer) from public,anon;
grant execute on function public.list_saved_midi_library_patterns(integer) to authenticated;
revoke all on function public.list_saved_midi_library_pattern_ids(uuid[]) from public,anon;
grant execute on function public.list_saved_midi_library_pattern_ids(uuid[]) to authenticated;
revoke all on function public.list_owned_private_midi_workspaces() from public,anon;
grant execute on function public.list_owned_private_midi_workspaces() to authenticated;
revoke all on function public.reuse_midi_library_pattern(uuid,uuid,uuid,text,uuid,integer,text,integer) from public,anon;
grant execute on function public.reuse_midi_library_pattern(uuid,uuid,uuid,text,uuid,integer,text,integer) to authenticated;
revoke all on function public.get_midi_library_export(uuid,uuid) from public,anon;
grant execute on function public.get_midi_library_export(uuid,uuid) to authenticated;
