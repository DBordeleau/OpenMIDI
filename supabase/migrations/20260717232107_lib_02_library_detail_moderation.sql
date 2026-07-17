-- LIB-02: public listing detail/history/usage plus private rights reporting and moderation.
set check_function_bodies = false;

create table private.midi_library_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  midi_pattern_id uuid not null,
  midi_pattern_version_id uuid not null,
  target_label_snapshot text not null,
  reason text not null default 'unoriginal_or_unauthorized',
  claimant_role text not null,
  original_work_title text,
  source_url text,
  evidence text not null,
  status text not null default 'submitted',
  assigned_admin_id uuid references private.app_admins(user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  unique(reporter_id, request_id),
  constraint midi_library_reports_listing_version_fk foreign key
    (midi_pattern_version_id, midi_pattern_id)
    references public.midi_pattern_versions(id, midi_pattern_id) on delete restrict,
  constraint midi_library_reports_reason_check check (reason='unoriginal_or_unauthorized'),
  constraint midi_library_reports_claimant_check check (
    claimant_role=any(array['rightsholder','authorized_representative','observer','other'])
  ),
  constraint midi_library_reports_title_check check (
    original_work_title is null or (
      original_work_title=btrim(original_work_title)
      and char_length(original_work_title) between 1 and 160
    )
  ),
  constraint midi_library_reports_url_check check (
    source_url is null or (
      source_url=btrim(source_url) and char_length(source_url) between 9 and 500
      and source_url ~ '^https://[^[:space:]]+$'
    )
  ),
  constraint midi_library_reports_evidence_check check (
    evidence=btrim(evidence) and char_length(evidence) between 20 and 2000
  ),
  constraint midi_library_reports_label_check check (
    target_label_snapshot=btrim(target_label_snapshot)
    and char_length(target_label_snapshot) between 1 and 160
  ),
  constraint midi_library_reports_status_check check (
    status=any(array['submitted','reviewing','resolved','dismissed'])
  ),
  constraint midi_library_reports_resolution_check check (
    (status in ('submitted','reviewing') and resolved_at is null)
    or (status in ('resolved','dismissed') and resolved_at is not null)
  )
);

create table private.midi_library_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null unique,
  report_id uuid not null references private.midi_library_reports(id) on delete restrict,
  listing_id uuid not null references public.midi_library_listings(id) on delete restrict,
  action text not null,
  reason text not null,
  expected_report_status text not null,
  expected_target_version integer not null,
  prior_report_status text not null,
  resulting_report_status text not null,
  prior_target_state text not null,
  resulting_target_state text not null,
  prior_target_version integer not null,
  resulting_target_version integer not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint midi_library_moderation_actions_action_check check (
    action=any(array['assign_self','hide','restore','resolve','dismiss'])
  ),
  constraint midi_library_moderation_actions_reason_check check (
    reason=btrim(reason) and char_length(reason) between 1 and 500
  ),
  constraint midi_library_moderation_actions_status_check check (
    expected_report_status=any(array['submitted','reviewing'])
    and prior_report_status=any(array['submitted','reviewing'])
    and resulting_report_status=any(array['submitted','reviewing','resolved','dismissed'])
  ),
  constraint midi_library_moderation_actions_state_check check (
    prior_target_state=any(array['visible','hidden'])
    and resulting_target_state=any(array['visible','hidden'])
  ),
  constraint midi_library_moderation_actions_version_check check (
    expected_target_version > 0 and prior_target_version > 0
    and resulting_target_version >= prior_target_version
  )
);

comment on table private.midi_library_reports is
  'Private bounded claimant/source evidence for exact library listing and pattern-version reports.';
comment on table private.midi_library_moderation_actions is
  'Idempotent administrator audit records for library report and visibility decisions.';

create index midi_library_reports_queue_idx
  on private.midi_library_reports(created_at,id)
  where status in ('submitted','reviewing');
create index midi_library_reports_reporter_recent_idx
  on private.midi_library_reports(reporter_id,created_at desc,id desc);
create unique index midi_library_reports_open_target_idx
  on private.midi_library_reports(reporter_id,listing_id)
  where status in ('submitted','reviewing');
create index midi_library_moderation_actions_listing_idx
  on private.midi_library_moderation_actions(listing_id,created_at desc,id desc);

alter table private.midi_library_reports enable row level security;
alter table private.midi_library_moderation_actions enable row level security;
revoke all on private.midi_library_reports,private.midi_library_moderation_actions
  from public,anon,authenticated;

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
  ), authorized_versions as (
    select pv.* from visible_listing l
    join public.midi_pattern_versions pv on pv.midi_pattern_id=l.midi_pattern_id
    where pv.id=l.midi_pattern_version_id or exists (
      select 1 from public.arrangement_clips ac
      join public.project_revisions r on r.arrangement_version_id=ac.arrangement_version_id
        and r.project_id=ac.project_id
      join public.public_project_catalog pc on pc.project_id=r.project_id
      where ac.midi_pattern_version_id=pv.id
    )
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
declare v_detail jsonb; v_from jsonb; v_to jsonb;
begin
  if p_listing_id is null or p_from_pattern_version_id is null or p_to_pattern_version_id is null then
    raise sqlstate '22023' using message='midi_library_comparison_invalid';
  end if;
  v_detail:=public.get_public_midi_library_listing(p_listing_id);
  if v_detail is null then return null; end if;
  select value into v_from from jsonb_array_elements(v_detail->'history')
    where value->>'midiPatternVersionId'=p_from_pattern_version_id::text;
  select value into v_to from jsonb_array_elements(v_detail->'history')
    where value->>'midiPatternVersionId'=p_to_pattern_version_id::text;
  if v_from is null or v_to is null then
    raise sqlstate 'PT403' using message='midi_library_comparison_not_authorized';
  end if;
  if v_from->>'midiPatternId' is distinct from v_to->>'midiPatternId'
    or v_from->>'midiPatternId' is distinct from v_detail#>>'{listing,midiPatternId}' then
    raise sqlstate 'PT403' using message='midi_library_comparison_pattern_mismatch';
  end if;
  return jsonb_build_object('listingId',p_listing_id,'from',v_from,'to',v_to);
end;
$$;

create or replace function public.submit_midi_library_report(
  p_request_id uuid,p_listing_id uuid,p_claimant_role text,
  p_original_work_title text,p_source_url text,p_evidence text
)
returns table(report_id uuid,status text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_listing public.midi_library_listings%rowtype;
  v_existing private.midi_library_reports%rowtype;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='midi_library_report_unauthenticated'; end if;
  if not (select private.is_active_project_actor()) then
    raise sqlstate 'PT403' using message='midi_library_report_actor_ineligible'; end if;
  if p_request_id is null or p_listing_id is null
    or p_claimant_role<>all(array['rightsholder','authorized_representative','observer','other'])
    or p_evidence is null or p_evidence<>btrim(p_evidence) or char_length(p_evidence) not between 20 and 2000
    or (p_original_work_title is not null and (p_original_work_title<>btrim(p_original_work_title)
      or char_length(p_original_work_title) not between 1 and 160))
    or (p_source_url is not null and (p_source_url<>btrim(p_source_url)
      or char_length(p_source_url) not between 9 and 500
      or p_source_url !~ '^https://[^[:space:]]+$')) then
    raise sqlstate '22023' using message='midi_library_report_invalid';
  end if;
  select * into v_existing from private.midi_library_reports
    where reporter_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.listing_id<>p_listing_id or v_existing.claimant_role<>p_claimant_role
      or v_existing.original_work_title is distinct from p_original_work_title
      or v_existing.source_url is distinct from p_source_url
      or v_existing.evidence<>p_evidence then
      raise sqlstate 'PT409' using message='midi_library_report_request_conflict';
    end if;
    return query select v_existing.id,v_existing.status,v_existing.created_at; return;
  end if;
  if (select count(*) from private.midi_library_reports r
      where r.reporter_id=v_actor and r.created_at>statement_timestamp()-interval '24 hours')
    + (select count(*) from private.moderation_reports r
      where r.reporter_id=v_actor and r.created_at>statement_timestamp()-interval '24 hours') >= 10 then
    raise sqlstate 'PT429' using message='midi_library_report_rate_limited';
  end if;
  select * into v_listing from public.midi_library_listings l
    where l.id=p_listing_id and l.unlisted_at is null and l.moderation_hidden_at is null
      and exists(select 1 from public.profiles p where p.id=l.owner_id and p.status='active'
        and p.profile_completed_at is not null and p.moderation_state='visible' and p.purged_at is null);
  if not found then raise sqlstate 'PT404' using message='midi_library_listing_not_found'; end if;
  if v_listing.owner_id=v_actor then raise sqlstate 'PT409' using message='midi_library_report_self_denied'; end if;
  begin
    insert into private.midi_library_reports(reporter_id,request_id,listing_id,midi_pattern_id,
      midi_pattern_version_id,target_label_snapshot,claimant_role,original_work_title,source_url,evidence)
    values(v_actor,p_request_id,v_listing.id,v_listing.midi_pattern_id,v_listing.midi_pattern_version_id,
      v_listing.title,p_claimant_role,p_original_work_title,p_source_url,p_evidence)
    returning id,midi_library_reports.status,midi_library_reports.created_at
      into report_id,status,created_at;
  exception when unique_violation then
    raise sqlstate 'PT409' using message='midi_library_report_already_open';
  end;
  return next;
end;
$$;

create or replace function public.list_admin_midi_library_reports()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
  perform private.assert_admin_actor();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'listingId',r.listing_id,'title',r.target_label_snapshot,
    'reason',r.reason,'claimantRole',r.claimant_role,'status',r.status,
    'createdAt',r.created_at,'updatedAt',r.updated_at
  ) order by r.created_at,r.id) from (select * from private.midi_library_reports
    where status in ('submitted','reviewing') order by created_at,id limit 50) r),'[]'::jsonb);
end;
$$;

create or replace function public.get_admin_midi_library_report(p_report_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_report private.midi_library_reports%rowtype; v_listing public.midi_library_listings%rowtype;
begin
  perform private.assert_admin_actor();
  select * into v_report from private.midi_library_reports where id=p_report_id;
  if not found then return null; end if;
  select * into v_listing from public.midi_library_listings where id=v_report.listing_id;
  return jsonb_strip_nulls(jsonb_build_object(
    'id',v_report.id,'listingId',v_report.listing_id,'midiPatternId',v_report.midi_pattern_id,
    'midiPatternVersionId',v_report.midi_pattern_version_id,'title',v_report.target_label_snapshot,
    'reason',v_report.reason,'claimantRole',v_report.claimant_role,
    'originalWorkTitle',v_report.original_work_title,'sourceUrl',v_report.source_url,
    'evidence',v_report.evidence,'status',v_report.status,
    'reporterId',v_report.reporter_id,'assignedAdminId',v_report.assigned_admin_id,
    'createdAt',v_report.created_at,'updatedAt',v_report.updated_at,
    'targetState',case when v_listing.moderation_hidden_at is null then 'visible' else 'hidden' end,
    'targetVersion',v_listing.moderation_version,'unlistedAt',v_listing.unlisted_at
  ));
end;
$$;

create or replace function public.apply_midi_library_moderation_action(
  p_report_id uuid,p_request_id uuid,p_action text,p_reason text,
  p_expected_report_status text,p_expected_target_version integer
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=private.assert_admin_actor(); v_report private.midi_library_reports%rowtype;
  v_listing public.midi_library_listings%rowtype;
  v_existing private.midi_library_moderation_actions%rowtype;
  v_prior_target text; v_result_target text; v_result_status text; v_result_version integer;
begin
  if p_request_id is null or p_report_id is null or p_reason is null or p_reason<>btrim(p_reason)
    or char_length(p_reason) not between 1 and 500
    or p_action<>all(array['assign_self','hide','restore','resolve','dismiss'])
    or p_expected_report_status<>all(array['submitted','reviewing'])
    or p_expected_target_version is null or p_expected_target_version<1 then
    raise sqlstate '22023' using message='midi_library_moderation_action_invalid';
  end if;
  select * into v_existing from private.midi_library_moderation_actions where request_id=p_request_id;
  if found then
    if v_existing.admin_id<>v_admin or v_existing.report_id<>p_report_id
      or v_existing.action<>p_action or v_existing.reason<>p_reason
      or v_existing.expected_report_status<>p_expected_report_status
      or v_existing.expected_target_version<>p_expected_target_version then
      raise sqlstate 'PT409' using message='midi_library_moderation_request_conflict';
    end if;
    return jsonb_build_object('actionId',v_existing.id,
      'reportStatus',v_existing.resulting_report_status,
      'targetState',v_existing.resulting_target_state,
      'targetVersion',v_existing.resulting_target_version);
  end if;
  select * into v_report from private.midi_library_reports where id=p_report_id for update;
  if not found then raise sqlstate 'PT404' using message='midi_library_report_not_found'; end if;
  if v_report.status<>p_expected_report_status then
    raise sqlstate 'PT409' using message='midi_library_report_state_conflict'; end if;
  select * into v_listing from public.midi_library_listings where id=v_report.listing_id for update;
  if v_listing.moderation_version<>p_expected_target_version then
    raise sqlstate 'PT409' using message='midi_library_moderation_target_conflict'; end if;
  v_prior_target:=case when v_listing.moderation_hidden_at is null then 'visible' else 'hidden' end;
  v_result_target:=v_prior_target; v_result_status:=v_report.status;
  v_result_version:=v_listing.moderation_version;
  if p_action='assign_self' then
    v_result_status:='reviewing';
    update private.midi_library_reports set status='reviewing',assigned_admin_id=v_admin,
      updated_at=statement_timestamp() where id=v_report.id;
  elsif p_action in ('resolve','dismiss') then
    v_result_status:=case when p_action='resolve' then 'resolved' else 'dismissed' end;
    update private.midi_library_reports set status=v_result_status,assigned_admin_id=coalesce(assigned_admin_id,v_admin),
      resolved_at=statement_timestamp(),updated_at=statement_timestamp() where id=v_report.id;
  elsif p_action='hide' then
    if v_prior_target<>'visible' then raise sqlstate 'PT409' using message='midi_library_already_hidden'; end if;
    update public.midi_library_listings set moderation_hidden_at=statement_timestamp(),
      moderation_version=moderation_version+1 where id=v_listing.id;
    v_result_target:='hidden'; v_result_version:=v_result_version+1;
    v_result_status:='reviewing';
    update private.midi_library_reports set status='reviewing',assigned_admin_id=coalesce(assigned_admin_id,v_admin),
      updated_at=statement_timestamp() where id=v_report.id;
  elsif p_action='restore' then
    if v_prior_target<>'hidden' then raise sqlstate 'PT409' using message='midi_library_already_visible'; end if;
    update public.midi_library_listings set moderation_hidden_at=null,
      moderation_version=moderation_version+1 where id=v_listing.id;
    v_result_target:='visible'; v_result_version:=v_result_version+1;
    v_result_status:='reviewing';
    update private.midi_library_reports set status='reviewing',assigned_admin_id=coalesce(assigned_admin_id,v_admin),
      updated_at=statement_timestamp() where id=v_report.id;
  end if;
  insert into private.midi_library_moderation_actions(admin_id,request_id,report_id,listing_id,
    action,reason,expected_report_status,expected_target_version,prior_report_status,
    resulting_report_status,prior_target_state,resulting_target_state,prior_target_version,resulting_target_version)
  values(v_admin,p_request_id,v_report.id,v_report.listing_id,p_action,p_reason,
    p_expected_report_status,p_expected_target_version,v_report.status,v_result_status,
    v_prior_target,v_result_target,v_listing.moderation_version,v_result_version)
  returning id into v_existing.id;
  return jsonb_build_object('actionId',v_existing.id,'reportStatus',v_result_status,
    'targetState',v_result_target,'targetVersion',v_result_version);
end;
$$;

revoke all on function public.get_public_midi_library_listing(uuid) from public;
grant execute on function public.get_public_midi_library_listing(uuid) to anon,authenticated;
revoke all on function public.get_public_midi_library_pattern_comparison(uuid,uuid,uuid) from public;
grant execute on function public.get_public_midi_library_pattern_comparison(uuid,uuid,uuid) to anon,authenticated;
revoke all on function public.submit_midi_library_report(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.submit_midi_library_report(uuid,uuid,text,text,text,text) to authenticated;
revoke all on function public.list_admin_midi_library_reports() from public,anon;
grant execute on function public.list_admin_midi_library_reports() to authenticated;
revoke all on function public.get_admin_midi_library_report(uuid) from public,anon;
grant execute on function public.get_admin_midi_library_report(uuid) to authenticated;
revoke all on function public.apply_midi_library_moderation_action(uuid,uuid,text,text,text,integer) from public,anon;
grant execute on function public.apply_midi_library_moderation_action(uuid,uuid,text,text,text,integer) to authenticated;
