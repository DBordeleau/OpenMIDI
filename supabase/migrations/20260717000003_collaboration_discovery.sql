-- PIVOT-09 reviewed baseline: contribution review, attribution, forks, and public discovery.
set check_function_bodies = false;

CREATE OR REPLACE FUNCTION "private"."bump_discovery_version"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_version bigint;
begin
  update public.discovery_state
  set version = version + 1, updated_at = statement_timestamp()
  where singleton
  returning version into v_version;
  return v_version;
end
$$;

ALTER FUNCTION "private"."bump_discovery_version"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."fill_contribution_version_project_v3"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_project_id uuid;
begin
  select c.project_id into v_project_id from public.contributions c where c.id=new.contribution_id;
  if v_project_id is null then raise sqlstate '23503' using message='contribution_version_parent_missing'; end if;
  if new.project_id is not null and new.project_id<>v_project_id then
    raise sqlstate '23503' using message='contribution_version_project_mismatch';
  end if;
  new.project_id:=v_project_id;
  return new;
end;
$$;

ALTER FUNCTION "private"."fill_contribution_version_project_v3"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."prevent_hidden_workspace_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin
  if exists(select 1 from public.projects p where p.id=coalesce(new.project_id,old.project_id) and (p.deleted_at is not null or p.moderation_state='hidden'))
    or exists(select 1 from public.contributions c where c.id=coalesce(new.contribution_id,old.contribution_id) and (c.deleted_at is not null or c.moderation_state='hidden'))
    then raise sqlstate 'PT403' using message='moderated_content_unavailable'; end if;
  return new;
end $$;

ALTER FUNCTION "private"."prevent_hidden_workspace_mutation"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."refresh_moderated_project"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ begin
  if exists(select 1 from public.projects where id=p_project_id and moderation_state='hidden') then
    delete from public.public_project_catalog where project_id=p_project_id;
  else
    perform private.refresh_public_project(p_project_id);
  end if;
end $$;

ALTER FUNCTION "private"."refresh_moderated_project"("p_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."refresh_public_project"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_project public.projects%rowtype; v_revision public.project_revisions%rowtype;
  v_version bigint; v_revision_events integer; v_accepted integer; v_forks integer;
  v_last_activity timestamptz; v_signal numeric; v_score numeric(18,6);
  v_genres jsonb; v_genre_slugs text[]; v_tags jsonb; v_tag_slugs text[];
  v_tracks jsonb; v_preset_ids text[]; v_attributions jsonb; v_search_text text;
begin
  if p_project_id is null then return; end if;
  v_version:=private.bump_discovery_version();
  select * into v_project from public.projects where id=p_project_id;
  if not found then
    delete from public.public_project_catalog where project_id=p_project_id;
    delete from public.project_stats where project_id=p_project_id; return;
  end if;
  select count(*)::integer,max(created_at) into v_revision_events,v_last_activity
    from public.activity_events where project_id=p_project_id and event_type='project_revision_published';
  select count(*)::integer into v_accepted from public.project_revisions r
    join public.revision_attributions ra on ra.revision_id=r.id
    where r.project_id=p_project_id and ra.kind='accepted_contributor';
  select count(*)::integer into v_forks from public.projects child
    where child.source_project_id=p_project_id and child.visibility='public'
      and child.status='active' and child.deleted_at is null;
  v_signal:=1+least(v_revision_events,5)+4*least(v_accepted,5)+3*least(v_forks,10);
  v_score:=round((ln(v_signal)+extract(epoch from (coalesce(v_last_activity,v_project.published_at,
    v_project.created_at)-timestamptz '2026-01-01 00:00:00+00'))/450000)::numeric,6);
  insert into public.project_stats(project_id,revision_events,accepted_contributions,public_direct_forks,
    last_public_activity_at,trending_score,updated_at)
  values(p_project_id,v_revision_events,v_accepted,v_forks,v_last_activity,v_score,statement_timestamp())
  on conflict(project_id) do update set revision_events=excluded.revision_events,
    accepted_contributions=excluded.accepted_contributions,public_direct_forks=excluded.public_direct_forks,
    last_public_activity_at=excluded.last_public_activity_at,trending_score=excluded.trending_score,
    updated_at=excluded.updated_at;
  if v_project.visibility<>'public' or v_project.status<>'active' or v_project.deleted_at is not null
    or v_project.current_revision_id is null or not exists(select 1 from public.profiles p
      where p.id=v_project.owner_id and p.status='active' and p.profile_completed_at is not null) then
    delete from public.public_project_catalog where project_id=p_project_id; return;
  end if;
  select * into v_revision from public.project_revisions r where r.id=v_project.current_revision_id
    and r.project_id=v_project.id and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then delete from public.public_project_catalog where project_id=p_project_id; return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'slug',g.slug,'name',g.name,
      'isPrimary',pg.is_primary) order by pg.is_primary desc,g.sort_order),'[]'::jsonb),
    coalesce(array_agg(g.slug order by g.slug),'{}'::text[])
    into v_genres,v_genre_slugs from public.project_genres pg join public.genres g on g.id=pg.genre_id
    where pg.project_id=p_project_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'slug',t.slug,'name',t.display_name)
      order by t.sort_order),'[]'::jsonb),coalesce(array_agg(t.slug order by t.slug),'{}'::text[]),
    coalesce(string_agg(t.display_name,' ' order by t.sort_order),'') into v_tags,v_tag_slugs,v_search_text
    from public.project_tags pt join public.tags t on t.id=pt.tag_id where pt.project_id=p_project_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',at.track_id,'kind','midi','name',at.name,
      'durationMs',v_revision.duration_ms,'positionMs',0,'sortOrder',at.sort_order,
      'preset',jsonb_build_object('id',at.preset_id,'version',at.preset_version),
      'instrument',null,'credits','[]'::jsonb) order by at.sort_order),'[]'::jsonb),
    coalesce(array_agg(distinct at.preset_id),'{}'::text[]) into v_tracks,v_preset_ids
    from public.arrangement_tracks at where at.arrangement_version_id=v_revision.arrangement_version_id;
  select coalesce(jsonb_agg(jsonb_build_object('kind',ra.kind,'creditName',ra.credit_name,
      'profileId',ra.user_id) order by case ra.kind when 'publisher' then 0 else 1 end),'[]'::jsonb)
    into v_attributions from public.revision_attributions ra where ra.revision_id=v_revision.id;
  insert into public.public_project_catalog(project_id,owner_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,license_name,license_url,
    license_summary,license_allows_derivatives,open_to_contributions,current_revision_id,revision_number,
    duration_ms,published_at,updated_at,genres,genre_slugs,tags,tag_slugs,tracks,instrument_slugs,
    attributions,trending_score,discovery_version,search_vector,refreshed_at)
  select v_project.id,v_project.owner_id,v_project.title,v_project.description,v_project.bpm,
    v_project.musical_key,v_project.time_signature_numerator,v_project.time_signature_denominator,
    l.code,l.name,l.url,l.summary,l.allows_derivatives,v_project.open_to_contributions,v_revision.id,
    v_revision.revision_number,v_revision.duration_ms,v_project.published_at,v_project.updated_at,
    v_genres,v_genre_slugs,v_tags,v_tag_slugs,v_tracks,v_preset_ids,v_attributions,v_score,v_version,
    setweight(to_tsvector('simple',v_project.title),'A')||
      setweight(to_tsvector('simple',coalesce(v_project.description,'')),'B')||
      setweight(to_tsvector('simple',v_search_text),'C'),statement_timestamp()
    from public.licenses l where l.code=v_project.license_code
  on conflict(project_id) do update set owner_id=excluded.owner_id,title=excluded.title,
    description=excluded.description,bpm=excluded.bpm,musical_key=excluded.musical_key,
    time_signature_numerator=excluded.time_signature_numerator,
    time_signature_denominator=excluded.time_signature_denominator,license_code=excluded.license_code,
    license_name=excluded.license_name,license_url=excluded.license_url,
    license_summary=excluded.license_summary,license_allows_derivatives=excluded.license_allows_derivatives,
    open_to_contributions=excluded.open_to_contributions,current_revision_id=excluded.current_revision_id,
    revision_number=excluded.revision_number,duration_ms=excluded.duration_ms,published_at=excluded.published_at,
    updated_at=excluded.updated_at,genres=excluded.genres,genre_slugs=excluded.genre_slugs,tags=excluded.tags,
    tag_slugs=excluded.tag_slugs,tracks=excluded.tracks,instrument_slugs=excluded.instrument_slugs,
    attributions=excluded.attributions,trending_score=excluded.trending_score,
    discovery_version=excluded.discovery_version,search_vector=excluded.search_vector,
    refreshed_at=excluded.refreshed_at;
end $$;

ALTER FUNCTION "private"."refresh_public_project"("p_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."refresh_public_project_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_project_id uuid; v_old_source uuid; v_new_source uuid;
begin
  if tg_table_name='projects' then
    if tg_op='DELETE' then v_project_id:=old.id; v_old_source:=old.source_project_id;
    elsif tg_op='INSERT' then v_project_id:=new.id; v_new_source:=new.source_project_id;
    else v_project_id:=new.id; v_old_source:=old.source_project_id; v_new_source:=new.source_project_id;
    end if;
  elsif tg_table_name in ('project_genres','project_tags') then
    v_project_id:=coalesce(new.project_id,old.project_id);
  elsif tg_table_name='activity_events' then
    v_project_id:=coalesce(new.project_id,old.project_id);
  elsif tg_table_name='revision_attributions' then
    select r.project_id into v_project_id from public.project_revisions r
      where r.id=coalesce(new.revision_id,old.revision_id);
  end if;
  perform private.refresh_public_project(v_project_id);
  if v_old_source is not null and v_old_source is distinct from v_project_id then
    perform private.refresh_public_project(v_old_source); end if;
  if v_new_source is not null and v_new_source is distinct from v_old_source
    and v_new_source is distinct from v_project_id then
    perform private.refresh_public_project(v_new_source); end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;

ALTER FUNCTION "private"."refresh_public_project_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."snapshot_revision_attributions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_publisher_name text;
  v_contributor_id uuid;
  v_contributor_name text;
begin
  select p.credit_name into v_publisher_name
  from public.profiles p where p.id = new.created_by;
  if v_publisher_name is null then
    raise sqlstate 'PT409' using message = 'revision_publisher_credit_unavailable';
  end if;
  insert into public.revision_attributions(revision_id, kind, user_id, credit_name)
  values(new.id, 'publisher', new.created_by, v_publisher_name);

  if new.accepted_contribution_id is not null then
    select c.author_id, p.credit_name into v_contributor_id, v_contributor_name
    from public.contributions c
    join public.profiles p on p.id = c.author_id
    where c.id = new.accepted_contribution_id
      and c.current_version_id = new.accepted_contribution_version_id;
    if v_contributor_id is null or v_contributor_name is null then
      raise sqlstate 'PT409' using message = 'revision_contributor_credit_unavailable';
    end if;
    insert into public.revision_attributions(
      revision_id, kind, user_id, credit_name, contribution_id, contribution_version_id
    ) values (
      new.id, 'accepted_contributor', v_contributor_id, v_contributor_name,
      new.accepted_contribution_id, new.accepted_contribution_version_id
    );
  end if;
  return new;
end
$$;

ALTER FUNCTION "private"."snapshot_revision_attributions"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."accept_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_contribution_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_message" "text" DEFAULT NULL::"text") RETURNS TABLE("revision_id" "uuid", "revision_number" integer, "arrangement_version_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_version public.contribution_versions%rowtype;
  v_existing public.contribution_reviews%rowtype; v_revision public.project_revisions%rowtype;
  v_number integer; v_message text:=nullif(btrim(p_message),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_review_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='contribution_review_actor_ineligible'; end if;
  select * into v_contribution from public.contributions where id=p_contribution_id for update;
  if not found then raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_project from public.projects where id=v_contribution.project_id and owner_id=v_actor
    and deleted_at is null and moderation_state='visible' for update;
  if not found then raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_existing from public.contribution_reviews cr where cr.contribution_id=p_contribution_id and cr.request_id=p_request_id;
  if found then
    if v_existing.requested_decision<>'accept' or v_existing.contribution_version_id<>p_expected_contribution_version_id
      or v_existing.expected_project_revision_id<>p_expected_project_revision_id then
      raise sqlstate 'PT409' using message='contribution_review_request_conflict'; end if;
    if v_existing.resulting_revision_id is null then raise sqlstate 'PT409' using message='contribution_base_outdated'; end if;
    select * into v_revision from public.project_revisions where id=v_existing.resulting_revision_id;
    return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at; return;
  end if;
  select * into v_version from public.contribution_versions cv where cv.contribution_id=p_contribution_id
    and cv.id=p_expected_contribution_version_id and cv.arrangement_version_id is not null;
  if not found or v_contribution.status<>'submitted' or v_contribution.current_version_id<>v_version.id
    or v_project.current_revision_id<>p_expected_project_revision_id
    or v_contribution.base_revision_id<>p_expected_project_revision_id
    or (v_message is not null and char_length(v_message)>500) then
    raise sqlstate 'PT409' using message='contribution_base_outdated'; end if;
  select coalesce(max(r.revision_number)+1,1) into v_number from public.project_revisions r where r.project_id=v_project.id;
  insert into public.project_revisions(project_id,revision_number,parent_revision_id,created_by,publish_request_id,
    expected_base_revision_id,message,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,
    accepted_contribution_id,accepted_contribution_version_id,arrangement_version_id)
  values(v_project.id,v_number,v_project.current_revision_id,v_actor,p_request_id,p_expected_project_revision_id,
    v_message,v_version.manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',
    v_version.manifest_sha256,v_version.duration_ms,v_contribution.id,v_version.id,v_version.arrangement_version_id)
  returning * into v_revision;
  insert into public.contribution_reviews(contribution_id,contribution_version_id,reviewer_id,request_id,
    requested_decision,applied_decision,reason,note,expected_project_revision_id,resulting_revision_id)
  values(v_contribution.id,v_version.id,v_actor,p_request_id,'accept','accept',null,null,
    p_expected_project_revision_id,v_revision.id);
  update public.contributions set status='accepted',reviewed_at=statement_timestamp(),reviewed_by=v_actor,
    review_note=null,updated_at=statement_timestamp() where id=v_contribution.id;
  update public.projects set current_revision_id=v_revision.id,lock_version=lock_version+1,
    updated_at=statement_timestamp() where id=v_project.id;
  update public.workspaces set status='archived',updated_at=statement_timestamp()
    where contribution_id=v_contribution.id and status='active';
  insert into public.activity_events(actor_id,project_id,subject_id,event_type,payload)
  values(v_actor,v_project.id,v_revision.id,'project_revision_published',jsonb_build_object('revisionNumber',v_number));
  return query select v_revision.id,v_revision.revision_number,v_revision.arrangement_version_id,v_revision.created_at;
end;
$$;

ALTER FUNCTION "public"."accept_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_contribution_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_contribution_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid", "p_title" "text", "p_description" "text") RETURNS TABLE("contribution_id" "uuid", "workspace_id" "uuid", "base_revision_id" "uuid", "lock_version" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_revision public.project_revisions%rowtype; v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype; v_workspace_id uuid:=gen_random_uuid();
  v_title text:=btrim(p_title); v_description text:=nullif(btrim(p_description),'');
  v_manifest jsonb; v_hash text;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  if p_project_id is null or p_request_id is null or p_expected_current_revision_id is null
    or v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description)>5000) then
    raise sqlstate '22023' using message='contribution_invalid_input'; end if;
  select * into v_contribution from public.contributions c
    where c.author_id=v_actor and c.create_request_id=p_request_id;
  if found then
    if v_contribution.project_id<>p_project_id or v_contribution.base_revision_id<>p_expected_current_revision_id
      or v_contribution.title<>v_title or v_contribution.description is distinct from v_description then
      raise sqlstate 'PT409' using message='contribution_request_conflict'; end if;
    select * into v_workspace from public.workspaces w where w.contribution_id=v_contribution.id;
    return query select v_contribution.id,v_workspace.id,v_contribution.base_revision_id,
      v_workspace.lock_version,v_contribution.created_at; return;
  end if;
  select * into v_project from public.projects where id=p_project_id for update;
  if not found or v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or not v_project.open_to_contributions then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if v_project.current_revision_id is distinct from p_expected_current_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if v_project.owner_id=v_actor or (v_project.visibility='private' and not exists(
    select 1 from public.project_members m where m.project_id=p_project_id and m.user_id=v_actor
      and m.role in ('editor','viewer'))) then
    raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if exists(select 1 from public.contributions c where c.project_id=p_project_id and c.author_id=v_actor
      and c.status in ('draft','submitted','changes_requested'))
    or exists(select 1 from public.workspaces w where w.project_id=p_project_id and w.owner_id=v_actor
      and w.status='active') then raise sqlstate 'PT409' using message='contribution_live_exists'; end if;
  select * into v_revision from public.project_revisions r
    where r.project_id=p_project_id and r.id=p_expected_current_revision_id
      and r.manifest_version=3 and r.arrangement_version_id is not null;
  if not found then raise sqlstate 'PT404' using message='contribution_base_not_midi_v3'; end if;
  v_manifest:=v_revision.manifest||jsonb_build_object('workspaceId',v_workspace_id);
  v_manifest:=private.canonical_manifest_v3(v_manifest,p_project_id,v_workspace_id);
  v_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.contributions(project_id,author_id,create_request_id,base_revision_id,title,description)
    values(p_project_id,v_actor,p_request_id,p_expected_current_revision_id,v_title,v_description)
    returning * into v_contribution;
  insert into public.workspaces(id,project_id,owner_id,create_request_id,base_revision_id,contribution_id,
    manifest,manifest_version,engine,engine_version,manifest_sha256)
  values(v_workspace_id,p_project_id,v_actor,p_request_id,p_expected_current_revision_id,v_contribution.id,
    v_manifest,3,'jam-session-midi','jam-session-midi-3_tone-15.1.22_presets-1',v_hash)
    returning * into v_workspace;
  perform private.replace_workspace_projection_v3(v_workspace.id,v_manifest);
  return query select v_contribution.id,v_workspace.id,v_contribution.base_revision_id,
    v_workspace.lock_version,v_contribution.created_at;
exception when unique_violation then raise sqlstate 'PT409' using message='contribution_live_exists';
end $$;

ALTER FUNCTION "public"."create_contribution_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid", "p_title" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_contribution_project_context"("p_contribution_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_contribution_project_context"("p_contribution_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_profile_history"("p_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_public_profile_history"("p_profile_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_project_lineage"("p_project_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_public_project_lineage"("p_project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_viewer_dashboard"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='dashboard_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='dashboard_forbidden';
  end if;
  return jsonb_build_object(
    'ownedProjects', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.project_id desc) from (
      select p.id project_id,p.title,p.status,p.current_revision_id,p.updated_at
      from public.projects p where p.owner_id=v_actor and p.deleted_at is null and p.status in ('draft','active')
      order by p.updated_at desc,p.id desc limit 7) x),'[]'::jsonb),
    'activeWorkspaces', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.workspace_id desc) from (
      select w.id workspace_id,w.project_id,p.title project_title,w.contribution_id,c.title contribution_title,w.lock_version,w.updated_at
      from public.workspaces w join public.projects p on p.id=w.project_id left join public.contributions c on c.id=w.contribution_id
      where w.owner_id=v_actor and w.status='active' and p.deleted_at is null
      order by w.updated_at desc,w.id desc limit 7) x),'[]'::jsonb),
    'pendingContributions', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.contribution_id desc) from (
      select c.id contribution_id,c.project_id,p.title project_title,c.title,c.status,c.current_version_id,
        cv.version_number current_version_number,c.updated_at
      from public.contributions c join public.projects p on p.id=c.project_id
      left join public.contribution_versions cv on cv.id=c.current_version_id
      where c.author_id=v_actor and c.status in ('draft','submitted','changes_requested') and p.deleted_at is null
      order by c.updated_at desc,c.id desc limit 7) x),'[]'::jsonb),
    'review', (select jsonb_build_object('count',least(count(*),99),'hasMore',count(*)=100) from (
      select c.id from public.contributions c join public.projects p on p.id=c.project_id
      where p.owner_id=v_actor and p.deleted_at is null and c.status='submitted' limit 100) q)
  );
end $$;

ALTER FUNCTION "public"."get_viewer_dashboard"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_viewer_dashboard"() IS 'Bounded private dashboard envelope for the active authenticated caller.';

CREATE OR REPLACE FUNCTION "public"."list_viewer_contributions"("p_status" "text" DEFAULT 'active'::"text", "p_after_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contributions_unauthenticated'; end if;
  if p_status not in ('active','submitted','history') or ((p_after_updated_at is null) <> (p_after_id is null)) then
    raise sqlstate 'PT400' using message='contributions_query_invalid';
  end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='contributions_forbidden';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.contribution_id desc) from (
    select c.id contribution_id,c.project_id,p.title project_title,c.title,c.status,c.base_revision_id,c.current_version_id,
      cv.version_number current_version_number,c.updated_at,
      case when c.author_id=v_actor then 'author' else 'reviewer' end viewer_relationship
    from public.contributions c join public.projects p on p.id=c.project_id
    left join public.contribution_versions cv on cv.id=c.current_version_id
    where p.deleted_at is null and (c.author_id=v_actor or (p.owner_id=v_actor and c.status <> 'draft'))
      and ((p_status='active' and c.status in ('draft','submitted','changes_requested')) or
           (p_status='submitted' and c.status='submitted') or
           (p_status='history' and c.status in ('accepted','rejected','withdrawn')))
      and (p_after_updated_at is null or (c.updated_at,c.id) < (p_after_updated_at,p_after_id))
    order by c.updated_at desc,c.id desc limit 25) x),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_viewer_contributions"("p_status" "text", "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_viewer_projects"("p_scope" "text" DEFAULT 'all'::"text", "p_review" boolean DEFAULT false, "p_after_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise sqlstate 'PT401' using message='projects_unauthenticated'; end if;
  if p_scope not in ('all','owned') or (p_review and p_scope <> 'owned') or ((p_after_updated_at is null) <> (p_after_id is null)) then
    raise sqlstate 'PT400' using message='projects_query_invalid';
  end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then
    raise sqlstate 'PT403' using message='projects_forbidden';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.project_id desc) from (
    select p.id project_id,p.title,p.description,p.status,p.current_revision_id,p.updated_at,m.role,
      exists(select 1 from public.contributions c where c.project_id=p.id and c.status='submitted') needs_review
    from public.projects p join public.project_members m on m.project_id=p.id and m.user_id=v_actor
    where p.deleted_at is null and p.status <> 'deleted'
      and (p_scope='all' or p.owner_id=v_actor)
      and (not p_review or exists(select 1 from public.contributions c where c.project_id=p.id and c.status='submitted'))
      and (p_after_updated_at is null or (p.updated_at,p.id) < (p_after_updated_at,p_after_id))
    order by p.updated_at desc,p.id desc limit 25) x),'[]'::jsonb);
end $$;

ALTER FUNCTION "public"."list_viewer_projects"("p_scope" "text", "p_review" boolean, "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."review_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_decision" "public"."contribution_review_decision", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS TABLE("contribution_id" "uuid", "contribution_version_id" "uuid", "requested_decision" "public"."contribution_review_decision", "applied_decision" "public"."contribution_review_decision", "reason" "public"."contribution_review_reason", "status" "public"."contribution_status", "revision_id" "uuid", "revision_number" integer, "reviewed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_contribution public.contributions%rowtype; v_version public.contribution_versions%rowtype;
  v_workspace public.workspaces%rowtype; v_existing public.contribution_reviews%rowtype;
  v_review public.contribution_reviews%rowtype; v_note text:=nullif(btrim(p_note),'');
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_review_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='contribution_review_actor_ineligible'; end if;
  if p_contribution_id is null or p_request_id is null
    or p_decision not in ('request_changes','reject') or p_expected_status<>'submitted'
    or p_expected_current_version_id is null or p_expected_project_revision_id is null
    or v_note is null or char_length(v_note)>5000 then
    raise sqlstate '22023' using message='contribution_review_invalid_input'; end if;
  select p.* into v_project from public.contributions c join public.projects p on p.id=c.project_id
    where c.id=p_contribution_id for update of p;
  if not found or v_project.owner_id<>v_actor or not exists(
    select 1 from public.project_members m where m.project_id=v_project.id
      and m.user_id=v_actor and m.role='owner') then
    raise sqlstate 'PT404' using message='contribution_review_not_found'; end if;
  select * into v_contribution from public.contributions
    where id=p_contribution_id and project_id=v_project.id for update;
  select * into v_existing from public.contribution_reviews cr
    where cr.contribution_id=p_contribution_id and cr.request_id=p_request_id;
  if found then
    if v_existing.requested_decision<>p_decision
      or v_existing.contribution_version_id<>p_expected_current_version_id
      or v_existing.expected_project_revision_id<>p_expected_project_revision_id
      or v_existing.note is distinct from v_note then
      raise sqlstate 'PT409' using message='contribution_review_request_conflict'; end if;
    return query select v_existing.contribution_id,v_existing.contribution_version_id,
      v_existing.requested_decision,v_existing.applied_decision,v_existing.reason,
      case v_existing.applied_decision when 'request_changes' then 'changes_requested'::public.contribution_status
        else 'rejected'::public.contribution_status end,null::uuid,null::integer,v_existing.created_at;
    return;
  end if;
  if v_project.status<>'active' or v_project.visibility not in ('private','public')
    or v_project.deleted_at is not null or v_project.current_revision_id is null then
    raise sqlstate 'PT409' using message='contribution_review_project_unavailable'; end if;
  if v_project.current_revision_id<>p_expected_project_revision_id
    or v_contribution.status<>p_expected_status
    or v_contribution.current_version_id is distinct from p_expected_current_version_id then
    raise sqlstate 'PT409' using message='contribution_review_conflict'; end if;
  select * into v_version from public.contribution_versions cv
    where cv.id=p_expected_current_version_id and cv.contribution_id=v_contribution.id
      and cv.manifest_version=3 and cv.arrangement_version_id is not null for update;
  select * into v_workspace from public.workspaces w where w.contribution_id=v_contribution.id for update;
  if v_version.id is null or v_workspace.id is null or v_version.base_revision_id<>v_contribution.base_revision_id then
    raise sqlstate 'PT409' using message='contribution_review_invalid_version'; end if;
  insert into public.contribution_reviews(contribution_id,contribution_version_id,reviewer_id,request_id,
    requested_decision,applied_decision,reason,note,expected_project_revision_id)
  values(v_contribution.id,v_version.id,v_actor,p_request_id,p_decision,p_decision,
    'owner_feedback',v_note,p_expected_project_revision_id) returning * into v_review;
  if p_decision='request_changes' then
    update public.contributions set status='changes_requested',reviewed_at=v_review.created_at,
      reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at where id=v_contribution.id;
    update public.workspaces set status='active',updated_at=v_review.created_at where id=v_workspace.id;
    return query select v_contribution.id,v_version.id,p_decision,p_decision,
      'owner_feedback'::public.contribution_review_reason,'changes_requested'::public.contribution_status,
      null::uuid,null::integer,v_review.created_at;
  else
    update public.contributions set status='rejected',reviewed_at=v_review.created_at,
      reviewed_by=v_actor,review_note=v_note,updated_at=v_review.created_at where id=v_contribution.id;
    update public.workspaces set status='archived',updated_at=v_review.created_at where id=v_workspace.id;
    return query select v_contribution.id,v_version.id,p_decision,p_decision,
      'owner_feedback'::public.contribution_review_reason,'rejected'::public.contribution_status,
      null::uuid,null::integer,v_review.created_at;
  end if;
end $$;

ALTER FUNCTION "public"."review_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_decision" "public"."contribution_review_decision", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."search_public_projects"("p_query" "text" DEFAULT NULL::"text", "p_genres" "text"[] DEFAULT '{}'::"text"[], "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_instruments" "text"[] DEFAULT '{}'::"text"[], "p_keys" "text"[] DEFAULT '{}'::"text"[], "p_bpm_min" numeric DEFAULT NULL::numeric, "p_bpm_max" numeric DEFAULT NULL::numeric, "p_open" boolean DEFAULT NULL::boolean, "p_sort" "text" DEFAULT 'recent'::"text", "p_after_score" numeric DEFAULT NULL::numeric, "p_after_published_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_project_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 25) RETURNS TABLE("project_id" "uuid", "owner_id" "uuid", "title" "text", "description" "text", "bpm" numeric, "musical_key" "text", "license_code" "text", "license_name" "text", "license_summary" "text", "license_allows_derivatives" boolean, "open_to_contributions" boolean, "current_revision_id" "uuid", "revision_number" integer, "duration_ms" integer, "published_at" timestamp with time zone, "updated_at" timestamp with time zone, "genres" "jsonb", "tags" "jsonb", "tracks" "jsonb", "attributions" "jsonb", "trending_score" numeric, "discovery_version" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."search_public_projects"("p_query" "text", "p_genres" "text"[], "p_tags" "text"[], "p_instruments" "text"[], "p_keys" "text"[], "p_bpm_min" numeric, "p_bpm_max" numeric, "p_open" boolean, "p_sort" "text", "p_after_score" numeric, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid", "p_limit" integer) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."search_public_projects"("p_query" "text", "p_genres" "text"[], "p_tags" "text"[], "p_instruments" "text"[], "p_keys" "text"[], "p_bpm_min" numeric, "p_bpm_max" numeric, "p_open" boolean, "p_sort" "text", "p_after_score" numeric, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid", "p_limit" integer) IS 'Bounded keyset-paginated public project discovery over the safe catalog.';

CREATE OR REPLACE FUNCTION "public"."submit_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_expected_manifest_sha256" "text", "p_attestation_version" "text") RETURNS TABLE("contribution_id" "uuid", "contribution_version_id" "uuid", "version_number" integer, "arrangement_version_id" "uuid", "status" "public"."contribution_status", "submitted_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid:=(select auth.uid()); v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype; v_project public.projects%rowtype;
  v_existing public.contribution_versions%rowtype;
  v_arrangement public.arrangement_versions%rowtype; v_version public.contribution_versions%rowtype;
  v_arrangement_id uuid; v_number integer; v_duration_ms integer;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message='contribution_actor_ineligible'; end if;
  select * into v_contribution from public.contributions where id=p_contribution_id and author_id=v_actor for update;
  if not found then
    raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  select * into v_workspace from public.workspaces w where w.contribution_id=p_contribution_id
    and w.owner_id=v_actor and w.status='active' for update;
  if not found or v_workspace.manifest_version<>3 then
    raise sqlstate 'PT404' using message='contribution_workspace_not_found'; end if;
  select * into v_existing from public.contribution_versions cv
    where cv.contribution_id=p_contribution_id and cv.submission_request_id=p_request_id;
  if found then
    if v_workspace.lock_version<>p_expected_workspace_lock_version
      or v_workspace.base_revision_id<>p_expected_base_revision_id
      or v_workspace.manifest_sha256<>p_expected_manifest_sha256
      or v_existing.base_revision_id<>p_expected_base_revision_id
      or v_existing.attestation_version<>p_attestation_version then
      raise sqlstate 'PT409' using message='contribution_submission_request_conflict';
    end if;
    return query select v_contribution.id,v_existing.id,v_existing.version_number,
      v_existing.arrangement_version_id,v_contribution.status,v_contribution.submitted_at; return;
  end if;
  select * into v_project from public.projects p where p.id=v_contribution.project_id
    and p.deleted_at is null and p.moderation_state='visible' for update;
  if not found then raise sqlstate 'PT404' using message='contribution_project_not_found'; end if;
  if v_project.license_code<>'cc-by-4.0' then
    raise sqlstate 'PT409' using message='contribution_license_unavailable'; end if;
  if v_project.current_revision_id<>p_expected_base_revision_id then
    raise sqlstate 'PT409' using message='contribution_base_changed'; end if;
  if not v_project.open_to_contributions then
    raise sqlstate 'PT409' using message='contribution_submissions_closed'; end if;
  if v_contribution.status not in ('draft','changes_requested') then
    raise sqlstate 'PT404' using message='contribution_not_found'; end if;
  if v_workspace.lock_version<>p_expected_workspace_lock_version
    or v_workspace.base_revision_id<>p_expected_base_revision_id
    or v_workspace.manifest_sha256<>p_expected_manifest_sha256
    or v_contribution.base_revision_id<>p_expected_base_revision_id
    or p_attestation_version<>'contributor-attestation-v1' then
    raise sqlstate 'PT409' using message='contribution_submission_conflict'; end if;
  v_arrangement_id:=private.freeze_workspace_arrangement_v3(v_workspace.id,p_request_id,v_actor);
  select * into strict v_arrangement from public.arrangement_versions where id=v_arrangement_id;
  select coalesce(max(cv.version_number)+1,1) into v_number from public.contribution_versions cv
    where cv.contribution_id=p_contribution_id;
  v_duration_ms:=ceil(v_arrangement.duration_ticks*60000.0/(v_arrangement.tempo_bpm*v_arrangement.ppq));
  insert into public.contribution_versions(contribution_id,project_id,version_number,submission_request_id,
    base_revision_id,workspace_lock_version,manifest,manifest_version,engine,engine_version,
    manifest_sha256,duration_ms,attestation_version,created_by,arrangement_version_id)
  values(v_contribution.id,v_contribution.project_id,v_number,p_request_id,v_contribution.base_revision_id,
    v_workspace.lock_version,v_arrangement.manifest,3,'jam-session-midi',
    'jam-session-midi-3_tone-15.1.22_presets-1',v_arrangement.manifest_sha256,v_duration_ms,
    p_attestation_version,v_actor,v_arrangement.id) returning * into v_version;
  update public.contributions set status='submitted',current_version_id=v_version.id,
    submitted_at=statement_timestamp(),withdrawn_at=null,reviewed_at=null,reviewed_by=null,
    review_note=null,updated_at=statement_timestamp() where id=v_contribution.id returning * into v_contribution;
  return query select v_contribution.id,v_version.id,v_version.version_number,v_version.arrangement_version_id,
    v_contribution.status,v_contribution.submitted_at;
end;
$$;

ALTER FUNCTION "public"."submit_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_expected_manifest_sha256" "text", "p_attestation_version" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."withdraw_contribution"("p_contribution_id" "uuid", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid") RETURNS TABLE("contribution_id" "uuid", "status" "public"."contribution_status", "current_version_id" "uuid", "withdrawn_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_project_id uuid;
  v_contribution public.contributions%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message = 'contribution_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then raise sqlstate 'PT403' using message = 'contribution_actor_ineligible'; end if;
  select c.project_id into v_project_id from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor;
  if not found then raise sqlstate 'PT404' using message = 'contribution_not_found'; end if;
  perform 1 from public.projects p where p.id = v_project_id for update;
  select * into v_contribution from public.contributions c where c.id = p_contribution_id and c.author_id = v_actor for update;
  select * into v_workspace from public.workspaces w where w.contribution_id = p_contribution_id for update;
  if v_contribution.status = 'withdrawn' then
    if p_expected_status <> 'withdrawn' or v_contribution.current_version_id is distinct from p_expected_current_version_id then raise sqlstate 'PT409' using message = 'contribution_withdraw_conflict'; end if;
    return query select v_contribution.id, v_contribution.status, v_contribution.current_version_id, v_contribution.withdrawn_at;
    return;
  end if;
  if v_contribution.status not in ('draft', 'submitted', 'changes_requested') or v_contribution.status <> p_expected_status or v_contribution.current_version_id is distinct from p_expected_current_version_id then raise sqlstate 'PT409' using message = 'contribution_withdraw_conflict'; end if;
  update public.contributions c set status = 'withdrawn', withdrawn_at = statement_timestamp(), updated_at = statement_timestamp() where c.id = p_contribution_id returning * into v_contribution;
  update public.workspaces w set status = 'archived', updated_at = statement_timestamp() where w.id = v_workspace.id and w.status = 'active';
  return query select v_contribution.id, v_contribution.status, v_contribution.current_version_id, v_contribution.withdrawn_at;
end $$;

ALTER FUNCTION "public"."withdraw_contribution"("p_contribution_id" "uuid", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "activity_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['project_revision_published'::"text", 'project_forked'::"text"]))),
    CONSTRAINT "activity_events_payload_check" CHECK ((("jsonb_typeof"("payload") = 'object'::"text") AND ("payload" ? 'revisionNumber'::"text") AND (("payload" - 'revisionNumber'::"text") = '{}'::"jsonb") AND ("jsonb_typeof"(("payload" -> 'revisionNumber'::"text")) = 'number'::"text")))
);

ALTER TABLE "public"."activity_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."contribution_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contribution_id" "uuid" NOT NULL,
    "contribution_version_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "requested_decision" "public"."contribution_review_decision" NOT NULL,
    "applied_decision" "public"."contribution_review_decision" NOT NULL,
    "reason" "public"."contribution_review_reason",
    "note" "text",
    "expected_project_revision_id" "uuid" NOT NULL,
    "resulting_revision_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "contribution_reviews_note_check" CHECK ((("note" IS NULL) OR (("note" = "btrim"("note")) AND (("char_length"("note") >= 1) AND ("char_length"("note") <= 5000))))),
    CONSTRAINT "contribution_reviews_note_shape" CHECK (((("requested_decision" = ANY (ARRAY['request_changes'::"public"."contribution_review_decision", 'reject'::"public"."contribution_review_decision"])) AND ("note" IS NOT NULL)) OR ("requested_decision" = 'accept'::"public"."contribution_review_decision"))),
    CONSTRAINT "contribution_reviews_reason_shape" CHECK (((("requested_decision" = 'accept'::"public"."contribution_review_decision") AND ("applied_decision" = 'accept'::"public"."contribution_review_decision") AND ("reason" IS NULL)) OR (("requested_decision" = 'accept'::"public"."contribution_review_decision") AND ("applied_decision" = 'request_changes'::"public"."contribution_review_decision") AND ("reason" = 'base_outdated'::"public"."contribution_review_reason")) OR (("requested_decision" = ANY (ARRAY['request_changes'::"public"."contribution_review_decision", 'reject'::"public"."contribution_review_decision"])) AND ("applied_decision" = "requested_decision") AND ("reason" = 'owner_feedback'::"public"."contribution_review_reason")))),
    CONSTRAINT "contribution_reviews_result_shape" CHECK (((("applied_decision" = 'accept'::"public"."contribution_review_decision") AND ("requested_decision" = 'accept'::"public"."contribution_review_decision") AND ("reason" IS NULL) AND ("resulting_revision_id" IS NOT NULL)) OR (("applied_decision" <> 'accept'::"public"."contribution_review_decision") AND ("resulting_revision_id" IS NULL))))
);

ALTER TABLE "public"."contribution_reviews" OWNER TO "postgres";

COMMENT ON TABLE "public"."contribution_reviews" IS 'Immutable idempotent owner review decisions for exact contribution versions.';

CREATE TABLE IF NOT EXISTS "public"."contribution_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contribution_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "submission_request_id" "uuid" NOT NULL,
    "base_revision_id" "uuid" NOT NULL,
    "workspace_lock_version" integer NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "manifest_version" smallint NOT NULL,
    "engine" "text" NOT NULL,
    "engine_version" "text" NOT NULL,
    "manifest_sha256" "text" NOT NULL,
    "duration_ms" integer NOT NULL,
    "attestation_version" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "arrangement_version_id" "uuid",
    CONSTRAINT "contribution_versions_attestation_version_check" CHECK (("attestation_version" = 'contributor-attestation-v1'::"text")),
    CONSTRAINT "contribution_versions_duration_ms_check" CHECK (("duration_ms" >= 0)),
    CONSTRAINT "contribution_versions_manifest_sha256_check" CHECK (("manifest_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "contribution_versions_version_number_check" CHECK (("version_number" > 0)),
    CONSTRAINT "contribution_versions_workspace_lock_version_check" CHECK (("workspace_lock_version" > 0)),
    CONSTRAINT "contribution_versions_format_check" CHECK (("manifest_version" = 3) AND ("engine" = 'jam-session-midi'::"text") AND ("engine_version" = 'jam-session-midi-3_tone-15.1.22_presets-1'::"text") AND ("arrangement_version_id" IS NOT NULL))
);

ALTER TABLE "public"."contribution_versions" OWNER TO "postgres";

COMMENT ON TABLE "public"."contribution_versions" IS 'Immutable submitted snapshots of acknowledged contribution workspaces.';

COMMENT ON COLUMN "public"."contribution_versions"."attestation_version" IS 'Versioned rights attestation accepted for this immutable submission.';

COMMENT ON COLUMN "public"."contribution_versions"."arrangement_version_id" IS 'Expand-first manifest-v3 arrangement reference; null for transitional v1/v2 submissions.';

CREATE TABLE IF NOT EXISTS "public"."contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "create_request_id" "uuid" NOT NULL,
    "base_revision_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."contribution_status" DEFAULT 'draft'::"public"."contribution_status" NOT NULL,
    "current_version_id" "uuid",
    "submitted_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "moderation_state" "text" DEFAULT 'visible'::"text" NOT NULL,
    "moderation_version" integer DEFAULT 1 NOT NULL,
    "moderation_updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "purged_at" timestamp with time zone,
    CONSTRAINT "contributions_description_check" CHECK ((("description" IS NULL) OR (("description" = "btrim"("description")) AND (("char_length"("description") >= 1) AND ("char_length"("description") <= 5000))))),
    CONSTRAINT "contributions_moderation_state_check" CHECK (("moderation_state" = ANY (ARRAY['visible'::"text", 'hidden'::"text"]))),
    CONSTRAINT "contributions_moderation_version_check" CHECK (("moderation_version" > 0)),
    CONSTRAINT "contributions_review_note_check" CHECK ((("review_note" IS NULL) OR (("review_note" = "btrim"("review_note")) AND (("char_length"("review_note") >= 1) AND ("char_length"("review_note") <= 5000))))),
    CONSTRAINT "contributions_status_shape" CHECK (((("status" = 'draft'::"public"."contribution_status") AND ("current_version_id" IS NULL) AND ("submitted_at" IS NULL) AND ("withdrawn_at" IS NULL) AND ("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL) AND ("review_note" IS NULL)) OR (("status" = 'submitted'::"public"."contribution_status") AND ("current_version_id" IS NOT NULL) AND ("submitted_at" IS NOT NULL) AND ("withdrawn_at" IS NULL) AND ((("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL) AND ("review_note" IS NULL)) OR (("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL)))) OR (("status" = 'changes_requested'::"public"."contribution_status") AND ("current_version_id" IS NOT NULL) AND ("submitted_at" IS NOT NULL) AND ("withdrawn_at" IS NULL) AND ("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL)) OR (("status" = 'withdrawn'::"public"."contribution_status") AND ("withdrawn_at" IS NOT NULL) AND ((("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL) AND ("review_note" IS NULL)) OR (("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL)))) OR (("status" = ANY (ARRAY['accepted'::"public"."contribution_status", 'rejected'::"public"."contribution_status"])) AND ("current_version_id" IS NOT NULL) AND ("submitted_at" IS NOT NULL) AND ("withdrawn_at" IS NULL) AND ("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL)))),
    CONSTRAINT "contributions_title_check" CHECK ((("title" = "btrim"("title")) AND (("char_length"("title") >= 1) AND ("char_length"("title") <= 120))))
);

ALTER TABLE "public"."contributions" OWNER TO "postgres";

COMMENT ON TABLE "public"."contributions" IS 'Private contribution lifecycle rooted at an exact immutable project revision.';

CREATE TABLE IF NOT EXISTS "public"."discovery_state" (
    "singleton" boolean DEFAULT true NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "discovery_state_singleton_check" CHECK ("singleton"),
    CONSTRAINT "discovery_state_version_check" CHECK (("version" > 0))
);

ALTER TABLE "public"."discovery_state" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_stats" (
    "project_id" "uuid" NOT NULL,
    "revision_events" integer DEFAULT 0 NOT NULL,
    "accepted_contributions" integer DEFAULT 0 NOT NULL,
    "public_direct_forks" integer DEFAULT 0 NOT NULL,
    "last_public_activity_at" timestamp with time zone,
    "trending_score" numeric(18,6) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "project_stats_accepted_contributions_check" CHECK (("accepted_contributions" >= 0)),
    CONSTRAINT "project_stats_public_direct_forks_check" CHECK (("public_direct_forks" >= 0)),
    CONSTRAINT "project_stats_revision_events_check" CHECK (("revision_events" >= 0))
);

ALTER TABLE "public"."project_stats" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."public_project_catalog" (
    "project_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "bpm" numeric(6,3),
    "musical_key" "text",
    "time_signature_numerator" smallint NOT NULL,
    "time_signature_denominator" smallint NOT NULL,
    "license_code" "text" NOT NULL,
    "license_name" "text" NOT NULL,
    "license_url" "text" NOT NULL,
    "license_summary" "text" NOT NULL,
    "license_allows_derivatives" boolean NOT NULL,
    "open_to_contributions" boolean NOT NULL,
    "current_revision_id" "uuid" NOT NULL,
    "revision_number" integer NOT NULL,
    "duration_ms" integer NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "genres" "jsonb" NOT NULL,
    "genre_slugs" "text"[] NOT NULL,
    "tags" "jsonb" NOT NULL,
    "tag_slugs" "text"[] NOT NULL,
    "tracks" "jsonb" NOT NULL,
    "instrument_slugs" "text"[] NOT NULL,
    "attributions" "jsonb" NOT NULL,
    "trending_score" numeric(18,6) NOT NULL,
    "discovery_version" bigint NOT NULL,
    "search_vector" "tsvector" NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "public_project_catalog_attributions_check" CHECK (("jsonb_typeof"("attributions") = 'array'::"text")),
    CONSTRAINT "public_project_catalog_genres_check" CHECK (("jsonb_typeof"("genres") = 'array'::"text")),
    CONSTRAINT "public_project_catalog_tags_check" CHECK (("jsonb_typeof"("tags") = 'array'::"text")),
    CONSTRAINT "public_project_catalog_tracks_check" CHECK (("jsonb_typeof"("tracks") = 'array'::"text"))
);

ALTER TABLE "public"."public_project_catalog" OWNER TO "postgres";

COMMENT ON TABLE "public"."public_project_catalog" IS 'RLS-protected safe public search/presentation projection; never write authority.';

CREATE TABLE IF NOT EXISTS "public"."revision_attributions" (
    "revision_id" "uuid" NOT NULL,
    "kind" "public"."revision_attribution_kind" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_name" "text" NOT NULL,
    "contribution_id" "uuid",
    "contribution_version_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "statement_timestamp"() NOT NULL,
    CONSTRAINT "revision_attributions_credit_name_check" CHECK ((("credit_name" = "btrim"("credit_name")) AND (("char_length"("credit_name") >= 1) AND ("char_length"("credit_name") <= 120)))),
    CONSTRAINT "revision_attributions_kind_shape" CHECK (((("kind" = 'publisher'::"public"."revision_attribution_kind") AND ("contribution_id" IS NULL) AND ("contribution_version_id" IS NULL)) OR (("kind" = 'accepted_contributor'::"public"."revision_attribution_kind") AND ("contribution_id" IS NOT NULL) AND ("contribution_version_id" IS NOT NULL))))
);

ALTER TABLE "public"."revision_attributions" OWNER TO "postgres";

COMMENT ON TABLE "public"."revision_attributions" IS 'Immutable publisher and accepted-contributor activity attribution for a revision.';

ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_contribution_id_request_id_key" UNIQUE ("contribution_id", "request_id");

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_contribution_id_id_key" UNIQUE ("contribution_id", "id");

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_contribution_id_submission_request_id_key" UNIQUE ("contribution_id", "submission_request_id");

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_contribution_id_version_number_key" UNIQUE ("contribution_id", "version_number");

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_author_id_create_request_id_key" UNIQUE ("author_id", "create_request_id");

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_id_project_id_author_id_base_revision_id_key" UNIQUE ("id", "project_id", "author_id", "base_revision_id");

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_project_id_id_key" UNIQUE ("project_id", "id");

ALTER TABLE ONLY "public"."discovery_state"
    ADD CONSTRAINT "discovery_state_pkey" PRIMARY KEY ("singleton");

ALTER TABLE ONLY "public"."project_stats"
    ADD CONSTRAINT "project_stats_pkey" PRIMARY KEY ("project_id");

ALTER TABLE ONLY "public"."public_project_catalog"
    ADD CONSTRAINT "public_project_catalog_pkey" PRIMARY KEY ("project_id");

ALTER TABLE ONLY "public"."revision_attributions"
    ADD CONSTRAINT "revision_attributions_pkey" PRIMARY KEY ("revision_id", "kind");

CREATE INDEX "activity_events_actor_idx" ON "public"."activity_events" USING "btree" ("actor_id");

CREATE INDEX "activity_events_project_created_idx" ON "public"."activity_events" USING "btree" ("project_id", "created_at" DESC);

CREATE INDEX "activity_events_subject_idx" ON "public"."activity_events" USING "btree" ("subject_id");

CREATE INDEX "contribution_reviews_contribution_created_idx" ON "public"."contribution_reviews" USING "btree" ("contribution_id", "created_at" DESC, "id" DESC);

CREATE INDEX "contribution_reviews_result_idx" ON "public"."contribution_reviews" USING "btree" ("resulting_revision_id") WHERE ("resulting_revision_id" IS NOT NULL);

CREATE INDEX "contribution_reviews_reviewer_idx" ON "public"."contribution_reviews" USING "btree" ("reviewer_id", "created_at" DESC);

CREATE INDEX "contribution_reviews_version_idx" ON "public"."contribution_reviews" USING "btree" ("contribution_version_id");

CREATE UNIQUE INDEX "contribution_versions_arrangement_uq" ON "public"."contribution_versions" USING "btree" ("arrangement_version_id") WHERE ("arrangement_version_id" IS NOT NULL);

CREATE INDEX "contribution_versions_base_revision_idx" ON "public"."contribution_versions" USING "btree" ("base_revision_id");

CREATE INDEX "contribution_versions_created_by_idx" ON "public"."contribution_versions" USING "btree" ("created_by");

CREATE INDEX "contribution_versions_created_idx" ON "public"."contribution_versions" USING "btree" ("created_at" DESC, "id" DESC);

CREATE INDEX "contributions_author_active_updated_idx" ON "public"."contributions" USING "btree" ("author_id", "updated_at" DESC, "id" DESC) WHERE ("status" = ANY (ARRAY['draft'::"public"."contribution_status", 'submitted'::"public"."contribution_status", 'changes_requested'::"public"."contribution_status"]));

CREATE INDEX "contributions_author_updated_idx" ON "public"."contributions" USING "btree" ("author_id", "updated_at" DESC, "id" DESC);

CREATE INDEX "contributions_base_revision_idx" ON "public"."contributions" USING "btree" ("base_revision_id");

CREATE UNIQUE INDEX "contributions_live_author_project_uq" ON "public"."contributions" USING "btree" ("project_id", "author_id") WHERE ("status" = ANY (ARRAY['draft'::"public"."contribution_status", 'submitted'::"public"."contribution_status", 'changes_requested'::"public"."contribution_status"]));

CREATE INDEX "contributions_moderation_idx" ON "public"."contributions" USING "btree" ("moderation_state", "id");

CREATE INDEX "contributions_owner_queue_idx" ON "public"."contributions" USING "btree" ("project_id", "submitted_at" DESC, "id" DESC) WHERE ("status" <> 'draft'::"public"."contribution_status");

CREATE INDEX "contributions_submitted_project_idx" ON "public"."contributions" USING "btree" ("project_id", "submitted_at" DESC, "id" DESC) WHERE ("status" = 'submitted'::"public"."contribution_status");

CREATE INDEX "public_project_catalog_genres_idx" ON "public"."public_project_catalog" USING "gin" ("genre_slugs");

CREATE INDEX "public_project_catalog_instruments_idx" ON "public"."public_project_catalog" USING "gin" ("instrument_slugs");

CREATE INDEX "public_project_catalog_key_bpm_idx" ON "public"."public_project_catalog" USING "btree" ("musical_key", "bpm") WHERE (("musical_key" IS NOT NULL) OR ("bpm" IS NOT NULL));

CREATE INDEX "public_project_catalog_open_recent_idx" ON "public"."public_project_catalog" USING "btree" ("published_at" DESC, "project_id" DESC) WHERE "open_to_contributions";

CREATE INDEX "public_project_catalog_recent_idx" ON "public"."public_project_catalog" USING "btree" ("published_at" DESC, "project_id" DESC);

CREATE INDEX "public_project_catalog_search_idx" ON "public"."public_project_catalog" USING "gin" ("search_vector");

CREATE INDEX "public_project_catalog_tags_idx" ON "public"."public_project_catalog" USING "gin" ("tag_slugs");

CREATE INDEX "public_project_catalog_trending_idx" ON "public"."public_project_catalog" USING "btree" ("trending_score" DESC, "published_at" DESC, "project_id" DESC);

CREATE INDEX "revision_attributions_accepted_profile_idx" ON "public"."revision_attributions" USING "btree" ("user_id", "created_at" DESC, "revision_id" DESC) WHERE ("kind" = 'accepted_contributor'::"public"."revision_attribution_kind");

CREATE INDEX "revision_attributions_contribution_idx" ON "public"."revision_attributions" USING "btree" ("contribution_id") WHERE ("contribution_id" IS NOT NULL);

CREATE INDEX "revision_attributions_user_kind_created_idx" ON "public"."revision_attributions" USING "btree" ("user_id", "kind", "created_at" DESC);

CREATE OR REPLACE TRIGGER "activity_events_immutable" BEFORE DELETE OR UPDATE ON "public"."activity_events" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "activity_refresh_public_catalog" AFTER INSERT ON "public"."activity_events" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_public_project_trigger"();

CREATE OR REPLACE TRIGGER "contribution_reviews_immutable" BEFORE DELETE OR UPDATE ON "public"."contribution_reviews" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "contribution_versions_fill_project_v3" BEFORE INSERT ON "public"."contribution_versions" FOR EACH ROW EXECUTE FUNCTION "private"."fill_contribution_version_project_v3"();

CREATE OR REPLACE TRIGGER "contribution_versions_immutable" BEFORE DELETE OR UPDATE ON "public"."contribution_versions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "contributions_hidden_mutation" BEFORE UPDATE ON "public"."contributions" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_hidden_content_mutation"();

CREATE OR REPLACE TRIGGER "project_genres_refresh_public_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_genres" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_public_project_trigger"();

CREATE OR REPLACE TRIGGER "project_revisions_snapshot_attributions" AFTER INSERT ON "public"."project_revisions" FOR EACH ROW EXECUTE FUNCTION "private"."snapshot_revision_attributions"();

CREATE OR REPLACE TRIGGER "project_tags_refresh_public_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_tags" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_public_project_trigger"();

CREATE OR REPLACE TRIGGER "projects_refresh_public_catalog" AFTER INSERT OR DELETE OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_public_project_trigger"();

CREATE OR REPLACE TRIGGER "revision_attributions_immutable" BEFORE DELETE OR UPDATE ON "public"."revision_attributions" FOR EACH ROW EXECUTE FUNCTION "private"."reject_immutable_change"();

CREATE OR REPLACE TRIGGER "revision_attributions_refresh_public_catalog" AFTER INSERT ON "public"."revision_attributions" FOR EACH ROW EXECUTE FUNCTION "private"."refresh_public_project_trigger"();

CREATE OR REPLACE TRIGGER "workspaces_hidden_mutation" BEFORE INSERT OR UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "private"."prevent_hidden_workspace_mutation"();

ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_project_id_subject_id_fkey" FOREIGN KEY ("project_id", "subject_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_expected_project_revision_id_fkey" FOREIGN KEY ("expected_project_revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_result_fk" FOREIGN KEY ("contribution_id", "resulting_revision_id") REFERENCES "public"."project_revisions"("accepted_contribution_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_reviews"
    ADD CONSTRAINT "contribution_reviews_version_fk" FOREIGN KEY ("contribution_id", "contribution_version_id") REFERENCES "public"."contribution_versions"("contribution_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_arrangement_fk" FOREIGN KEY ("project_id", "arrangement_version_id") REFERENCES "public"."arrangement_versions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_base_revision_id_fkey" FOREIGN KEY ("base_revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_contribution_project_fk" FOREIGN KEY ("project_id", "contribution_id") REFERENCES "public"."contributions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contribution_versions"
    ADD CONSTRAINT "contribution_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_current_version_fk" FOREIGN KEY ("id", "current_version_id") REFERENCES "public"."contribution_versions"("contribution_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_project_base_fk" FOREIGN KEY ("project_id", "base_revision_id") REFERENCES "public"."project_revisions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."contributions"
    ADD CONSTRAINT "contributions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_accepted_contribution_project_fk" FOREIGN KEY ("project_id", "accepted_contribution_id") REFERENCES "public"."contributions"("project_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_revisions"
    ADD CONSTRAINT "project_revisions_accepted_version_fk" FOREIGN KEY ("accepted_contribution_id", "accepted_contribution_version_id") REFERENCES "public"."contribution_versions"("contribution_id", "id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."project_stats"
    ADD CONSTRAINT "project_stats_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."public_project_catalog"
    ADD CONSTRAINT "public_project_catalog_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."public_project_catalog"
    ADD CONSTRAINT "public_project_catalog_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."revision_attributions"
    ADD CONSTRAINT "revision_attributions_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."revision_attributions"
    ADD CONSTRAINT "revision_attributions_contribution_version_id_fkey" FOREIGN KEY ("contribution_version_id") REFERENCES "public"."contribution_versions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."revision_attributions"
    ADD CONSTRAINT "revision_attributions_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."revision_attributions"
    ADD CONSTRAINT "revision_attributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_contribution_identity_fk" FOREIGN KEY ("contribution_id", "project_id", "owner_id", "base_revision_id") REFERENCES "public"."contributions"("id", "project_id", "author_id", "base_revision_id") ON DELETE RESTRICT;

ALTER TABLE "public"."activity_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contribution_participants_read" ON "public"."contributions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("status" <> 'draft'::"public"."contribution_status") AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "contributions"."project_id") AND ("p"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))))));

CREATE POLICY "contribution_review_participants_read" ON "public"."contribution_reviews" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM ("public"."contributions" "c"
     JOIN "public"."projects" "p" ON (("p"."id" = "c"."project_id")))
  WHERE (("c"."id" = "contribution_reviews"."contribution_id") AND (("c"."author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("p"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))))));

ALTER TABLE "public"."contribution_reviews" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contribution_version_participants_read" ON "public"."contribution_versions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM "public"."contributions" "c"
  WHERE (("c"."id" = "contribution_versions"."contribution_id") AND (("c"."author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("c"."status" <> 'draft'::"public"."contribution_status") AND (EXISTS ( SELECT 1
           FROM "public"."projects" "p"
          WHERE (("p"."id" = "c"."project_id") AND ("p"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))));

ALTER TABLE "public"."contribution_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."contributions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discovery_state" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_activity_read" ON "public"."activity_events" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM "public"."project_members" "m"
  WHERE (("m"."project_id" = "activity_events"."project_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "member_revision_attributions_read" ON "public"."revision_attributions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_active_project_actor"() AS "is_active_project_actor") AND (EXISTS ( SELECT 1
   FROM "public"."project_revisions" "r"
  WHERE (("r"."id" = "revision_attributions"."revision_id") AND ( SELECT "private"."is_project_member"("r"."project_id") AS "is_project_member"))))));

CREATE POLICY "public_revision_attributions_read" ON "public"."revision_attributions" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."project_revisions" "r"
  WHERE (("r"."id" = "revision_attributions"."revision_id") AND ("r"."arrangement_version_id" IS NOT NULL) AND ( SELECT "private"."can_read_arrangement"("r"."arrangement_version_id") AS "can_read_arrangement")))));

ALTER TABLE "public"."project_stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_catalog_read" ON "public"."public_project_catalog" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "public_discovery_state_read" ON "public"."discovery_state" FOR SELECT TO "authenticated", "anon" USING ("singleton");

ALTER TABLE "public"."public_project_catalog" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."revision_attributions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION "private"."bump_discovery_version"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."fill_contribution_version_project_v3"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."prevent_hidden_workspace_mutation"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."refresh_moderated_project"("p_project_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."refresh_public_project"("p_project_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."refresh_public_project_trigger"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."snapshot_revision_attributions"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."accept_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_contribution_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."accept_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_contribution_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_message" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_contribution_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid", "p_title" "text", "p_description" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_contribution_workspace_v3"("p_project_id" "uuid", "p_request_id" "uuid", "p_expected_current_revision_id" "uuid", "p_title" "text", "p_description" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_contribution_project_context"("p_contribution_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_contribution_project_context"("p_contribution_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_public_profile_history"("p_profile_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_profile_history"("p_profile_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_profile_history"("p_profile_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_public_project_lineage"("p_project_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_project_lineage"("p_project_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_project_lineage"("p_project_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_viewer_dashboard"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_viewer_dashboard"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_viewer_contributions"("p_status" "text", "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_viewer_contributions"("p_status" "text", "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_viewer_projects"("p_scope" "text", "p_review" boolean, "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_viewer_projects"("p_scope" "text", "p_review" boolean, "p_after_updated_at" timestamp with time zone, "p_after_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."review_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_decision" "public"."contribution_review_decision", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_note" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."review_contribution"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_decision" "public"."contribution_review_decision", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid", "p_expected_project_revision_id" "uuid", "p_note" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."search_public_projects"("p_query" "text", "p_genres" "text"[], "p_tags" "text"[], "p_instruments" "text"[], "p_keys" "text"[], "p_bpm_min" numeric, "p_bpm_max" numeric, "p_open" boolean, "p_sort" "text", "p_after_score" numeric, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid", "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."search_public_projects"("p_query" "text", "p_genres" "text"[], "p_tags" "text"[], "p_instruments" "text"[], "p_keys" "text"[], "p_bpm_min" numeric, "p_bpm_max" numeric, "p_open" boolean, "p_sort" "text", "p_after_score" numeric, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid", "p_limit" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."search_public_projects"("p_query" "text", "p_genres" "text"[], "p_tags" "text"[], "p_instruments" "text"[], "p_keys" "text"[], "p_bpm_min" numeric, "p_bpm_max" numeric, "p_open" boolean, "p_sort" "text", "p_after_score" numeric, "p_after_published_at" timestamp with time zone, "p_after_project_id" "uuid", "p_limit" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_expected_manifest_sha256" "text", "p_attestation_version" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_contribution_v3"("p_contribution_id" "uuid", "p_request_id" "uuid", "p_expected_workspace_lock_version" integer, "p_expected_base_revision_id" "uuid", "p_expected_manifest_sha256" "text", "p_attestation_version" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."withdraw_contribution"("p_contribution_id" "uuid", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."withdraw_contribution"("p_contribution_id" "uuid", "p_expected_status" "public"."contribution_status", "p_expected_current_version_id" "uuid") TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_events" TO "service_role";

GRANT SELECT ON TABLE "public"."activity_events" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contribution_reviews" TO "service_role";

GRANT SELECT ON TABLE "public"."contribution_reviews" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contribution_versions" TO "service_role";

GRANT SELECT ON TABLE "public"."contribution_versions" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."contributions" TO "service_role";

GRANT SELECT ON TABLE "public"."contributions" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."discovery_state" TO "service_role";

GRANT SELECT ON TABLE "public"."discovery_state" TO "anon";

GRANT SELECT ON TABLE "public"."discovery_state" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_stats" TO "service_role";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."public_project_catalog" TO "service_role";

GRANT SELECT ON TABLE "public"."public_project_catalog" TO "anon";

GRANT SELECT ON TABLE "public"."public_project_catalog" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."revision_attributions" TO "service_role";

GRANT SELECT ON TABLE "public"."revision_attributions" TO "anon";

GRANT SELECT ON TABLE "public"."revision_attributions" TO "authenticated";
