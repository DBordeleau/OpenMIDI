-- LIB-02 follow-up: bound the detail history before note aggregation while
-- keeping explicit same-pattern comparisons independently authorized.

create or replace function public.get_public_midi_library_listing(p_listing_id uuid)
returns jsonb
language sql stable security definer set search_path=''
as $$
  with visible_listing as (
    select l.*,c.display_name as category_name,pr.display_name as preset_name,
      p.source_pattern_id,p.source_pattern_version_id
    from public.midi_library_listings l
    join public.midi_library_categories c on c.code=l.category_code
    join public.midi_library_presets pr
      on pr.preset_id=l.suggested_preset_id and pr.version=l.suggested_preset_version
    join public.midi_patterns p on p.id=l.midi_pattern_id and p.deleted_at is null
    join public.profiles owner on owner.id=l.owner_id
    where l.id=p_listing_id and l.unlisted_at is null and l.moderation_hidden_at is null
      and owner.status='active' and owner.profile_completed_at is not null
      and owner.moderation_state='visible' and owner.purged_at is null
  ), authorized_version_candidates as (
    select pv.*,(pv.id=l.midi_pattern_version_id) as is_listed_version
    from visible_listing l
    join public.midi_pattern_versions pv on pv.midi_pattern_id=l.midi_pattern_id
    where pv.id=l.midi_pattern_version_id or exists (
      select 1 from public.arrangement_clips ac
      join public.project_revisions r on r.arrangement_version_id=ac.arrangement_version_id
        and r.project_id=ac.project_id
      join public.public_project_catalog pc on pc.project_id=r.project_id
      where ac.midi_pattern_version_id=pv.id
    )
  ), authorized_versions as (
    select * from authorized_version_candidates
    order by is_listed_version desc,version_number desc,id desc
    limit 100
  ), usage_rows as (
    select distinct on (pc.project_id)
      pc.project_id,pc.title,r.id as revision_id,r.revision_number,pc.published_at
    from visible_listing l
    join public.arrangement_clips ac on ac.midi_pattern_version_id=l.midi_pattern_version_id
    join public.project_revisions r on r.arrangement_version_id=ac.arrangement_version_id
      and r.project_id=ac.project_id
    join public.public_project_catalog pc on pc.project_id=r.project_id
    order by pc.project_id,r.revision_number desc,r.id desc
  )
  select jsonb_build_object(
    'listing',jsonb_build_object(
      'listingId',l.id,'midiPatternId',l.midi_pattern_id,
      'midiPatternVersionId',l.midi_pattern_version_id,'title',l.title,
      'description',l.description,'ownerId',l.owner_id,
      'creatorUsername',l.creator_username,'creatorDisplayName',l.creator_display_name,
      'creatorCreditName',l.creator_credit_name,'reuseMode',l.reuse_mode,
      'rightsBasis',l.rights_basis,'attestationVersion',l.attestation_version,
      'attestedAt',l.attested_at,'supportingSourceUrl',l.supporting_source_url,
      'supportingSourceTerms',l.supporting_source_terms,
      'publicDomainRationale',l.public_domain_rationale,
      'category',jsonb_build_object('code',l.category_code,'name',l.category_name),
      'preset',jsonb_build_object('id',l.suggested_preset_id,'version',l.suggested_preset_version,
        'name',l.preset_name,'family',l.instrument_family_code),
      'durationTicks',l.duration_ticks,'durationBeats',l.duration_beats,
      'noteCount',l.note_count,'minPitch',l.min_pitch,'maxPitch',l.max_pitch,
      'polyphony',l.polyphony_kind,'listedAt',l.listed_at,
      'tags',coalesce((select jsonb_agg(jsonb_build_object('code',t.code,'name',t.display_name)
        order by t.sort_order) from public.midi_library_listing_tags j
        join public.midi_library_tags t on t.code=j.tag_code where j.listing_id=l.id),'[]'::jsonb),
      'externalCredits',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'creditedName',ec.credited_name,'role',ec.role,'workTitle',ec.work_title,
        'sourceUrl',ec.source_url,'sourceTerms',ec.source_terms,
        'attributionNote',ec.attribution_note)) order by ec.position)
        from public.midi_pattern_external_credits ec where ec.listing_id=l.id),'[]'::jsonb),
      'notes',coalesce((select jsonb_agg(jsonb_build_object('noteId',n.note_id,
        'startTick',n.start_tick,'durationTicks',n.duration_ticks,'pitch',n.pitch,
        'velocity',n.velocity) order by n.start_tick,n.pitch,n.note_id)
        from public.midi_pattern_notes n
        where n.midi_pattern_version_id=l.midi_pattern_version_id),'[]'::jsonb)
    ),
    'platformLineage',jsonb_strip_nulls(jsonb_build_object(
      'patternId',l.midi_pattern_id,'sourcePatternId',l.source_pattern_id,
      'sourcePatternVersionId',l.source_pattern_version_id,
      'sourceCreatorCreditName',(select pv.creator_credit_name
        from public.midi_pattern_versions pv where pv.id=l.source_pattern_version_id),
      'listedVersionParentId',(select pv.parent_pattern_version_id
        from public.midi_pattern_versions pv where pv.id=l.midi_pattern_version_id),
      'listedVersionSourceId',(select pv.source_pattern_version_id
        from public.midi_pattern_versions pv where pv.id=l.midi_pattern_version_id)
    )),
    'history',coalesce((select jsonb_agg(jsonb_build_object(
      'midiPatternVersionId',pv.id,'midiPatternId',pv.midi_pattern_id,
      'versionNumber',pv.version_number,'creatorId',pv.creator_id,
      'creatorCreditName',pv.creator_credit_name,
      'parentMidiPatternVersionId',pv.parent_pattern_version_id,
      'sourceMidiPatternVersionId',pv.source_pattern_version_id,
      'ppq',pv.ppq,'durationTicks',pv.duration_ticks,'noteCount',pv.note_count,
      'contentSha256',pv.content_sha256,'reuseLicenseCode',pv.reuse_license_code,
      'reuseLicenseVersion',pv.reuse_license_version,'reuseLicenseUrl',pv.reuse_license_url,
      'createdAt',pv.created_at,'notes',coalesce((select jsonb_agg(jsonb_build_object(
        'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,
        'pitch',n.pitch,'velocity',n.velocity) order by n.start_tick,n.pitch,n.note_id)
        from public.midi_pattern_notes n where n.midi_pattern_version_id=pv.id),'[]'::jsonb)
    ) order by pv.version_number) from authorized_versions pv),'[]'::jsonb),
    'usage',jsonb_build_object(
      'publicProjectCount',(select count(*) from usage_rows),
      'projects',coalesce((select jsonb_agg(jsonb_build_object(
        'projectId',u.project_id,'title',u.title,'revisionId',u.revision_id,
        'revisionNumber',u.revision_number,'publishedAt',u.published_at)
        order by u.published_at desc,u.project_id desc) from (select * from usage_rows limit 50) u),'[]'::jsonb)
    )
  ) from visible_listing l
$$;

create or replace function public.get_public_midi_library_pattern_comparison(
  p_listing_id uuid,p_from_pattern_version_id uuid,p_to_pattern_version_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_pattern_id uuid;
  v_listed_version_id uuid;
  v_versions jsonb;
  v_from jsonb;
  v_to jsonb;
begin
  if p_listing_id is null or p_from_pattern_version_id is null or p_to_pattern_version_id is null then
    raise sqlstate '22023' using message='midi_library_comparison_invalid';
  end if;

  select l.midi_pattern_id,l.midi_pattern_version_id
    into v_pattern_id,v_listed_version_id
  from public.midi_library_listings l
  join public.midi_patterns p on p.id=l.midi_pattern_id and p.deleted_at is null
  join public.profiles owner on owner.id=l.owner_id
  where l.id=p_listing_id and l.unlisted_at is null and l.moderation_hidden_at is null
    and owner.status='active' and owner.profile_completed_at is not null
    and owner.moderation_state='visible' and owner.purged_at is null;
  if not found then return null; end if;

  with requested(side,version_id) as (
    values ('from',p_from_pattern_version_id),('to',p_to_pattern_version_id)
  ), authorized as (
    select requested.side,pv.*
    from requested
    join public.midi_pattern_versions pv on pv.id=requested.version_id
      and pv.midi_pattern_id=v_pattern_id
    where pv.id=v_listed_version_id or exists (
      select 1 from public.arrangement_clips ac
      join public.project_revisions r on r.arrangement_version_id=ac.arrangement_version_id
        and r.project_id=ac.project_id
      join public.public_project_catalog pc on pc.project_id=r.project_id
      where ac.midi_pattern_version_id=pv.id
    )
  ), payload as (
    select pv.side,jsonb_build_object(
      'midiPatternVersionId',pv.id,'midiPatternId',pv.midi_pattern_id,
      'versionNumber',pv.version_number,'creatorId',pv.creator_id,
      'creatorCreditName',pv.creator_credit_name,
      'parentMidiPatternVersionId',pv.parent_pattern_version_id,
      'sourceMidiPatternVersionId',pv.source_pattern_version_id,
      'ppq',pv.ppq,'durationTicks',pv.duration_ticks,'noteCount',pv.note_count,
      'contentSha256',pv.content_sha256,'reuseLicenseCode',pv.reuse_license_code,
      'reuseLicenseVersion',pv.reuse_license_version,'reuseLicenseUrl',pv.reuse_license_url,
      'createdAt',pv.created_at,'notes',coalesce((select jsonb_agg(jsonb_build_object(
        'noteId',n.note_id,'startTick',n.start_tick,'durationTicks',n.duration_ticks,
        'pitch',n.pitch,'velocity',n.velocity) order by n.start_tick,n.pitch,n.note_id)
        from public.midi_pattern_notes n where n.midi_pattern_version_id=pv.id),'[]'::jsonb)
    ) as value from authorized pv
  )
  select jsonb_object_agg(side,value) into v_versions from payload;
  v_from:=v_versions->'from';
  v_to:=v_versions->'to';
  if v_from is null or v_to is null then
    raise sqlstate 'PT403' using message='midi_library_comparison_not_authorized';
  end if;
  return jsonb_build_object('listingId',p_listing_id,'from',v_from,'to',v_to);
end;
$$;

revoke all on function public.get_public_midi_library_listing(uuid) from public;
revoke all on function public.get_public_midi_library_pattern_comparison(uuid,uuid,uuid) from public;
grant execute on function public.get_public_midi_library_listing(uuid) to anon,authenticated;
grant execute on function public.get_public_midi_library_pattern_comparison(uuid,uuid,uuid) to anon,authenticated;
