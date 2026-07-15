create or replace function public.create_midi_project_workspace(
  p_request_id uuid,p_title text,p_description text,p_bpm numeric,
  p_musical_key text,p_time_signature_numerator smallint,
  p_time_signature_denominator smallint,p_license_code text,
  p_genre_ids uuid[],p_primary_genre_id uuid,p_tag_ids uuid[]
) returns table(project_id uuid,title text,lock_version integer,workspace_id uuid)
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype; v_manifest jsonb; v_bpm numeric:=coalesce(p_bpm,120);
  v_genre_ids uuid[]; v_tag_ids uuid[];
begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='project_actor_ineligible'; end if;
  if p_request_id is null or p_title is null or p_title<>btrim(p_title)
    or char_length(p_title) not between 1 and 120
    or p_description is null or p_description<>btrim(p_description)
    or char_length(p_description)>5000 or v_bpm not between 20 and 300
    or scale(v_bpm)>3 or p_time_signature_numerator not between 1 and 32
    or p_time_signature_denominator<>all(array[1,2,4,8,16,32]) then
    raise sqlstate 'PT400' using message='project_metadata_invalid'; end if;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into v_genre_ids
    from unnest(coalesce(p_genre_ids,'{}'::uuid[])) x;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into v_tag_ids
    from unnest(coalesce(p_tag_ids,'{}'::uuid[])) x;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'midi-project:'||v_actor::text||':'||p_request_id::text,0));
  select * into v_project from public.projects
    where owner_id=v_actor and create_request_id=p_request_id;
  if found then
    select * into v_workspace from public.workspaces w
      where w.project_id=v_project.id and w.owner_id=v_actor and w.status='active';
    if v_project.compatibility<>'midi' or v_workspace.id is null
      or v_project.title<>p_title
      or v_project.description is distinct from nullif(p_description,'')
      or v_project.bpm is distinct from v_bpm
      or v_project.musical_key is distinct from p_musical_key
      or v_project.time_signature_numerator<>p_time_signature_numerator
      or v_project.time_signature_denominator<>p_time_signature_denominator
      or v_project.license_code<>p_license_code
      or coalesce((select array_agg(pg.genre_id order by pg.genre_id)
        from public.project_genres pg where pg.project_id=v_project.id),'{}'::uuid[])<>v_genre_ids
      or (select pg.genre_id from public.project_genres pg
        where pg.project_id=v_project.id and pg.is_primary) is distinct from p_primary_genre_id
      or coalesce((select array_agg(pt.tag_id order by pt.tag_id)
        from public.project_tags pt where pt.project_id=v_project.id),'{}'::uuid[])<>v_tag_ids then
      raise sqlstate 'PT409' using message='project_request_conflict'; end if;
    return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id;
    return;
  end if;
  if coalesce(cardinality(p_genre_ids),0)>3 or coalesce(cardinality(p_tag_ids),0)>10
    or (select count(*)<>count(distinct x) from unnest(coalesce(p_genre_ids,'{}')) x)
    or (select count(*)<>count(distinct x) from unnest(coalesce(p_tag_ids,'{}')) x)
    or (p_primary_genre_id is not null and not p_primary_genre_id=any(coalesce(p_genre_ids,'{}')))
    or not exists(select 1 from public.licenses where code=p_license_code and is_active)
    or exists(select 1 from unnest(coalesce(p_genre_ids,'{}')) x left join public.genres g
      on g.id=x and g.is_active where g.id is null)
    or exists(select 1 from unnest(coalesce(p_tag_ids,'{}')) x left join public.tags t
      on t.id=x and t.is_active where t.id is null) then
    raise sqlstate 'PT400' using message='project_reference_invalid'; end if;
  insert into public.projects(owner_id,create_request_id,title,description,bpm,musical_key,
    time_signature_numerator,time_signature_denominator,license_code,compatibility)
  values(v_actor,p_request_id,p_title,nullif(p_description,''),v_bpm,p_musical_key,
    p_time_signature_numerator,p_time_signature_denominator,p_license_code,'midi')
  returning * into v_project;
  insert into public.project_members values(v_project.id,v_actor,'owner',v_actor,default);
  insert into public.project_genres(project_id,genre_id,is_primary)
    select v_project.id,x,x=p_primary_genre_id from unnest(coalesce(p_genre_ids,'{}')) x;
  insert into public.project_tags(project_id,tag_id)
    select v_project.id,x from unnest(coalesce(p_tag_ids,'{}')) x;
  v_manifest:=jsonb_build_object('manifestVersion',2,'engine','jam-session-composite',
    'engineVersion','jam-session-composite-2_tone-15.1.22','projectId',v_project.id,
    'tempoBpm',v_bpm::double precision,'timeSignature',jsonb_build_object(
      'numerator',p_time_signature_numerator,'denominator',p_time_signature_denominator),
    'durationTicks',7680,'tracks','[]'::jsonb);
  insert into public.workspaces(project_id,owner_id,create_request_id,manifest,
    manifest_version,engine,engine_version,manifest_sha256)
  values(v_project.id,v_actor,p_request_id,v_manifest,2,'jam-session-composite',
    'jam-session-composite-2_tone-15.1.22',encode(extensions.digest(
      convert_to(v_manifest::text,'UTF8'),'sha256'),'hex')) returning * into v_workspace;
  return query select v_project.id,v_project.title,v_project.lock_version,v_workspace.id;
end $$;

revoke all on function public.create_midi_project_workspace(uuid,text,text,numeric,text,
  smallint,smallint,text,uuid[],uuid,uuid[]) from public,anon;
grant execute on function public.create_midi_project_workspace(uuid,text,text,numeric,text,
  smallint,smallint,text,uuid[],uuid,uuid[]) to authenticated;
