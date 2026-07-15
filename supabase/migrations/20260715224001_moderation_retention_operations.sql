-- PR 18: moderation, recoverable deletion, reference-safe retention, and
-- authoritative Storage object accounting. Storage rows are read only here;
-- byte deletion is performed by the service-role Node operator.

alter table public.profiles
  add column moderation_state text not null default 'visible'
    check (moderation_state in ('visible','hidden')),
  add column moderation_version integer not null default 1
    check (moderation_version > 0),
  add column moderation_updated_at timestamptz not null default statement_timestamp(),
  add column deletion_requested_at timestamptz,
  add column deletion_restore_until timestamptz,
  add column purged_at timestamptz;

alter table public.projects
  add column moderation_state text not null default 'visible'
    check (moderation_state in ('visible','hidden')),
  add column moderation_version integer not null default 1
    check (moderation_version > 0),
  add column moderation_updated_at timestamptz not null default statement_timestamp(),
  add column purged_at timestamptz;

alter table public.contributions
  add column moderation_state text not null default 'visible'
    check (moderation_state in ('visible','hidden')),
  add column moderation_version integer not null default 1
    check (moderation_version > 0),
  add column moderation_updated_at timestamptz not null default statement_timestamp(),
  add column deleted_at timestamptz,
  add column purged_at timestamptz;

create index profiles_moderation_idx on public.profiles(moderation_state, id);
create index projects_moderation_idx on public.projects(moderation_state, id);
create index contributions_moderation_idx on public.contributions(moderation_state, id);

drop policy profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select to anon,authenticated
using (status='active' and profile_completed_at is not null and moderation_state='visible');

create table private.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  target_kind text not null check (target_kind in ('profile','project','contribution')),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  target_project_id uuid references public.projects(id) on delete restrict,
  target_contribution_id uuid references public.contributions(id) on delete restrict,
  target_label_snapshot text not null check (char_length(target_label_snapshot) between 1 and 160),
  reason text not null check (reason in ('copyright','harassment','sexual_content','hate_or_violence','spam','other')),
  detail text check (detail is null or (detail=btrim(detail) and char_length(detail) between 1 and 2000)),
  status text not null default 'submitted' check (status in ('submitted','reviewing','resolved','dismissed')),
  assigned_admin_id uuid references private.app_admins(user_id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  unique(reporter_id,request_id),
  constraint moderation_reports_one_target check (
    num_nonnulls(target_profile_id,target_project_id,target_contribution_id)=1
    and (target_kind='profile')=(target_profile_id is not null)
    and (target_kind='project')=(target_project_id is not null)
    and (target_kind='contribution')=(target_contribution_id is not null)
  )
);
create index moderation_reports_reporter_created_idx
  on private.moderation_reports(reporter_id,created_at desc,id desc);
create index moderation_reports_queue_idx
  on private.moderation_reports(created_at,id)
  where status in ('submitted','reviewing');
create unique index moderation_reports_unresolved_target_uq
  on private.moderation_reports(reporter_id,target_kind,
    coalesce(target_profile_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_project_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_contribution_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('submitted','reviewing');

create table private.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  report_id uuid references private.moderation_reports(id) on delete restrict,
  action text not null check (action in ('assign_self','dismiss','resolve','hide','restore','suspend_account','restore_account','reject_upload','place_hold','release_hold')),
  target_kind text not null check (target_kind in ('report','profile','project','contribution','asset')),
  target_id uuid not null,
  reason text not null check (reason=btrim(reason) and char_length(reason) between 1 and 500),
  prior_state text,
  resulting_state text,
  created_at timestamptz not null default statement_timestamp(),
  unique(admin_id,request_id)
);
create index moderation_actions_report_idx on private.moderation_actions(report_id,created_at desc,id desc)
  where report_id is not null;
create index moderation_actions_target_idx on private.moderation_actions(target_kind,target_id,created_at desc);

create table private.content_holds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  target_kind text not null check (target_kind in ('profile','project','contribution','asset')),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  target_project_id uuid references public.projects(id) on delete restrict,
  target_contribution_id uuid references public.contributions(id) on delete restrict,
  target_asset_id uuid references public.assets(id) on delete restrict,
  hold_type text not null check (hold_type in ('legal','abuse')),
  reason text not null check (reason=btrim(reason) and char_length(reason) between 1 and 500),
  placed_by uuid not null references private.app_admins(user_id) on delete restrict,
  placed_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  released_by uuid references private.app_admins(user_id) on delete restrict,
  released_at timestamptz,
  unique(placed_by,request_id),
  constraint content_holds_one_target check (
    num_nonnulls(target_profile_id,target_project_id,target_contribution_id,target_asset_id)=1
    and (target_kind='profile')=(target_profile_id is not null)
    and (target_kind='project')=(target_project_id is not null)
    and (target_kind='contribution')=(target_contribution_id is not null)
    and (target_kind='asset')=(target_asset_id is not null)
  ),
  constraint content_holds_release_shape check ((released_at is null)=(released_by is null))
);
create index content_holds_active_idx on private.content_holds(target_kind,placed_at,id)
  where released_at is null;
create index content_holds_profile_idx on private.content_holds(target_profile_id) where target_profile_id is not null;
create index content_holds_project_idx on private.content_holds(target_project_id) where target_project_id is not null;
create index content_holds_contribution_idx on private.content_holds(target_contribution_id) where target_contribution_id is not null;
create index content_holds_asset_idx on private.content_holds(target_asset_id) where target_asset_id is not null;

create table private.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  target_kind text not null check (target_kind in ('profile','project','contribution')),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  target_project_id uuid references public.projects(id) on delete restrict,
  target_contribution_id uuid references public.contributions(id) on delete restrict,
  parent_request_id uuid references private.deletion_requests(id) on delete restrict,
  expected_lock_version integer,
  prior_status text not null,
  prior_visibility text,
  prior_open_to_contributions boolean,
  provenance text not null default 'user' check (provenance in ('user','account_cascade','legacy')),
  status text not null default 'recoverable' check (status in ('recoverable','restored','purged')),
  requested_at timestamptz not null default statement_timestamp(),
  restore_until timestamptz not null,
  restored_at timestamptz,
  purged_at timestamptz,
  unique(requester_id,request_id),
  constraint deletion_requests_one_target check (
    num_nonnulls(target_profile_id,target_project_id,target_contribution_id)=1
    and (target_kind='profile')=(target_profile_id is not null)
    and (target_kind='project')=(target_project_id is not null)
    and (target_kind='contribution')=(target_contribution_id is not null)
  ),
  constraint deletion_requests_times check (restore_until=requested_at+interval '30 days'),
  constraint deletion_requests_result check (
    (status='recoverable' and restored_at is null and purged_at is null)
    or (status='restored' and restored_at is not null and purged_at is null)
    or (status='purged' and restored_at is null and purged_at is not null)
  )
);
create unique index deletion_requests_open_target_uq on private.deletion_requests(
  target_kind,
  coalesce(target_profile_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(target_project_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(target_contribution_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status='recoverable';
create index deletion_requests_due_idx on private.deletion_requests(restore_until,id)
  where status='recoverable';
create index deletion_requests_parent_idx on private.deletion_requests(parent_request_id)
  where parent_request_id is not null;

create table private.deletion_request_workspaces (
  deletion_request_id uuid not null references private.deletion_requests(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  prior_status text not null check (prior_status in ('active','archived')),
  archived_at timestamptz not null default statement_timestamp(),
  primary key(deletion_request_id,workspace_id)
);
create index deletion_request_workspaces_workspace_idx on private.deletion_request_workspaces(workspace_id);

alter table private.moderation_reports enable row level security;
alter table private.moderation_actions enable row level security;
alter table private.content_holds enable row level security;
alter table private.deletion_requests enable row level security;
alter table private.deletion_request_workspaces enable row level security;
revoke all on private.moderation_reports,private.moderation_actions,private.content_holds,
  private.deletion_requests,private.deletion_request_workspaces from public,anon,authenticated;

create function private.reject_append_only_change() returns trigger
language plpgsql set search_path='' as $$ begin
  raise sqlstate 'PT403' using message='append_only_record';
end $$;
revoke all on function private.reject_append_only_change() from public,anon,authenticated;
create trigger moderation_actions_append_only before update or delete on private.moderation_actions
  for each row execute function private.reject_append_only_change();

create function private.assert_admin_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='admin_unauthenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null)
    or not (select private.is_admin()) then
    raise sqlstate 'PT404' using message='admin_not_found';
  end if;
  return v_actor;
end $$;
revoke all on function private.assert_admin_actor() from public,anon,authenticated;

create function public.assert_viewer_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select private.assert_admin_actor() is not null
$$;
revoke all on function public.assert_viewer_admin() from public,anon;
grant execute on function public.assert_viewer_admin() to authenticated;

create function public.submit_moderation_report(
  p_request_id uuid,p_target_kind text,p_target_id uuid,p_reason text,p_detail text default null
) returns table(report_id uuid,status text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_existing private.moderation_reports%rowtype;
  v_label text; v_profile uuid; v_project uuid; v_contribution uuid;
begin
  if v_actor is null then raise sqlstate 'PT401' using message='report_unauthenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null)
    then raise sqlstate 'PT403' using message='report_actor_ineligible'; end if;
  if p_request_id is null or p_target_id is null or p_target_kind not in ('profile','project','contribution')
    or p_reason not in ('copyright','harassment','sexual_content','hate_or_violence','spam','other')
    or (p_detail is not null and (btrim(p_detail)='' or char_length(btrim(p_detail))>2000))
    then raise sqlstate '22023' using message='report_invalid'; end if;
  select * into v_existing from private.moderation_reports where reporter_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.target_kind<>p_target_kind
      or coalesce(v_existing.target_profile_id,v_existing.target_project_id,v_existing.target_contribution_id)<>p_target_id
      or v_existing.reason<>p_reason or v_existing.detail is distinct from nullif(btrim(p_detail),'')
      then raise sqlstate 'PT409' using message='report_request_conflict'; end if;
    return query select v_existing.id,v_existing.status,v_existing.created_at; return;
  end if;
  if (select count(*) from private.moderation_reports mr where mr.reporter_id=v_actor and mr.created_at>statement_timestamp()-interval '24 hours')>=10
    then raise sqlstate 'PT429' using message='report_rate_limited'; end if;
  if p_target_kind='profile' then
    select p.id,coalesce('@'||p.username,'Profile') into v_profile,v_label from public.profiles p
      where p.id=p_target_id and p.id<>v_actor and p.status='active' and p.profile_completed_at is not null and p.moderation_state='visible';
  elsif p_target_kind='project' then
    select p.id,left(p.title,160) into v_project,v_label from public.projects p
      where p.id=p_target_id and p.owner_id<>v_actor and p.status='active' and p.deleted_at is null and p.moderation_state='visible'
        and (exists(select 1 from public.public_project_catalog c where c.project_id=p.id)
          or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=v_actor));
  else
    select c.id,left(c.title,160) into v_contribution,v_label from public.contributions c
      join public.projects p on p.id=c.project_id
      where c.id=p_target_id and c.author_id<>v_actor and c.deleted_at is null and c.moderation_state='visible'
        and p.deleted_at is null and p.moderation_state='visible'
        and (c.author_id=v_actor or p.owner_id=v_actor);
  end if;
  if v_label is null then raise sqlstate 'PT404' using message='report_target_not_found'; end if;
  begin
    insert into private.moderation_reports(reporter_id,request_id,target_kind,target_profile_id,target_project_id,target_contribution_id,target_label_snapshot,reason,detail)
    values(v_actor,p_request_id,p_target_kind,v_profile,v_project,v_contribution,v_label,p_reason,nullif(btrim(p_detail),''))
    returning id,moderation_reports.status,moderation_reports.created_at into report_id,status,created_at;
  exception when unique_violation then
    raise sqlstate 'PT409' using message='report_already_open';
  end;
  return next;
end $$;
revoke all on function public.submit_moderation_report(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.submit_moderation_report(uuid,text,uuid,text,text) to authenticated;

create function public.list_viewer_reports(p_after_created_at timestamptz default null,p_after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='reports_unauthenticated'; end if;
  if (p_after_created_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='reports_cursor_invalid'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null)
    then raise sqlstate 'PT403' using message='reports_forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
    select r.id,r.target_kind,
      case r.target_kind
        when 'profile' then coalesce((select '@'||p.username from public.profiles p where p.id=r.target_profile_id and p.status='active' and p.moderation_state='visible'),'Unavailable profile')
        when 'project' then coalesce((select p.title from public.projects p where p.id=r.target_project_id and p.deleted_at is null and p.moderation_state='visible'),'Unavailable project')
        else coalesce((select c.title from public.contributions c where c.id=r.target_contribution_id and c.deleted_at is null and c.moderation_state='visible'),'Unavailable contribution') end target_label,
      case when r.status='submitted' then 'submitted' when r.status='reviewing' then 'reviewing' else 'closed' end status,
      r.created_at,r.resolved_at
    from private.moderation_reports r where r.reporter_id=v_actor
      and (p_after_created_at is null or (r.created_at,r.id)<(p_after_created_at,p_after_id))
    order by r.created_at desc,r.id desc limit 25) x),'[]'::jsonb);
end $$;
revoke all on function public.list_viewer_reports(timestamptz,uuid) from public,anon;
grant execute on function public.list_viewer_reports(timestamptz,uuid) to authenticated;

create function public.list_admin_moderation_queue(p_after_created_at timestamptz default null,p_after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_admin_actor();
  if (p_after_created_at is null)<>(p_after_id is null) then raise sqlstate '22023' using message='admin_cursor_invalid'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (
    select r.id,r.target_kind,r.target_label_snapshot,r.reason,r.status,r.created_at,r.updated_at,
      r.assigned_admin_id is not null assigned
    from private.moderation_reports r where r.status in ('submitted','reviewing')
      and (p_after_created_at is null or (r.created_at,r.id)>(p_after_created_at,p_after_id))
    order by r.created_at,r.id limit 25) x),'[]'::jsonb);
end $$;
revoke all on function public.list_admin_moderation_queue(timestamptz,uuid) from public,anon;
grant execute on function public.list_admin_moderation_queue(timestamptz,uuid) to authenticated;

create function public.get_admin_moderation_target(p_report_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_report private.moderation_reports%rowtype; begin
  perform private.assert_admin_actor();
  select * into v_report from private.moderation_reports where id=p_report_id;
  if not found then raise sqlstate 'PT404' using message='report_not_found'; end if;
  return jsonb_build_object('id',v_report.id,'targetKind',v_report.target_kind,
    'targetId',coalesce(v_report.target_profile_id,v_report.target_project_id,v_report.target_contribution_id),
    'targetLabel',v_report.target_label_snapshot,'reason',v_report.reason,'detail',v_report.detail,
    'status',v_report.status,'createdAt',v_report.created_at,'updatedAt',v_report.updated_at,
    'targetVersion',case v_report.target_kind
      when 'profile' then (select moderation_version from public.profiles where id=v_report.target_profile_id)
      when 'project' then (select moderation_version from public.projects where id=v_report.target_project_id)
      else (select moderation_version from public.contributions where id=v_report.target_contribution_id) end,
    'targetState',case v_report.target_kind
      when 'profile' then (select moderation_state from public.profiles where id=v_report.target_profile_id)
      when 'project' then (select moderation_state from public.projects where id=v_report.target_project_id)
      else (select moderation_state from public.contributions where id=v_report.target_contribution_id) end,
    'holds',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'type',h.hold_type,'placedAt',h.placed_at,'expiresAt',h.expires_at) order by h.placed_at desc)
      from private.content_holds h where h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()) and
        ((v_report.target_kind='profile' and h.target_profile_id=v_report.target_profile_id)
          or (v_report.target_kind='project' and h.target_project_id=v_report.target_project_id)
          or (v_report.target_kind='contribution' and h.target_contribution_id=v_report.target_contribution_id))),'[]'::jsonb));
end $$;
revoke all on function public.get_admin_moderation_target(uuid) from public,anon;
grant execute on function public.get_admin_moderation_target(uuid) to authenticated;

create function private.refresh_moderated_project(p_project_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.projects where id=p_project_id and moderation_state='hidden') then
    delete from public.public_project_catalog where project_id=p_project_id;
  else
    perform private.refresh_public_project(p_project_id);
  end if;
end $$;
revoke all on function private.refresh_moderated_project(uuid) from public,anon,authenticated;

create function public.apply_moderation_action(
  p_report_id uuid,p_request_id uuid,p_action text,p_reason text,p_expected_report_status text,p_expected_target_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.assert_admin_actor(); v_report private.moderation_reports%rowtype;
  v_existing private.moderation_actions%rowtype; v_target uuid; v_prior text; v_result text;
begin
  if p_request_id is null or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500
    or p_action not in ('assign_self','dismiss','resolve','hide','restore','suspend_account','restore_account')
    then raise sqlstate '22023' using message='moderation_action_invalid'; end if;
  select * into v_existing from private.moderation_actions where admin_id=v_admin and request_id=p_request_id;
  if found then
    if v_existing.report_id is distinct from p_report_id or v_existing.action<>p_action or v_existing.reason<>btrim(p_reason)
      then raise sqlstate 'PT409' using message='moderation_action_request_conflict'; end if;
    return jsonb_build_object('actionId',v_existing.id,'result',v_existing.resulting_state);
  end if;
  select * into v_report from private.moderation_reports where id=p_report_id for update;
  if not found then raise sqlstate 'PT404' using message='report_not_found'; end if;
  if v_report.status<>p_expected_report_status then raise sqlstate 'PT409' using message='report_state_conflict'; end if;
  v_target:=coalesce(v_report.target_profile_id,v_report.target_project_id,v_report.target_contribution_id);
  if p_action='assign_self' then
    update private.moderation_reports set status='reviewing',assigned_admin_id=v_admin,updated_at=statement_timestamp() where id=p_report_id;
    v_prior:=v_report.status; v_result:='reviewing';
  elsif p_action in ('dismiss','resolve') then
    update private.moderation_reports set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,
      resolved_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_report_id;
    v_prior:=v_report.status; v_result:=case when p_action='dismiss' then 'dismissed' else 'resolved' end;
  elsif v_report.target_kind='profile' then
    if p_action in ('hide','restore') then
      select moderation_state into v_prior from public.profiles where id=v_target and moderation_version=p_expected_target_version for update;
      if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
      v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
      update public.profiles set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
      if p_action='hide' then delete from public.public_project_catalog where owner_id=v_target; end if;
      if p_action='restore' then
        perform private.refresh_moderated_project(p.id) from public.projects p where p.owner_id=v_target;
      end if;
    elsif p_action in ('suspend_account','restore_account') then
      select status::text into v_prior from public.profiles where id=v_target and moderation_version=p_expected_target_version for update;
      if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
      v_result:=case when p_action='suspend_account' then 'suspended' else 'active' end;
      update public.profiles set status=v_result::public.account_status,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
      if p_action='suspend_account' then delete from public.public_project_catalog where owner_id=v_target; end if;
      if p_action='restore_account' then
        perform private.refresh_moderated_project(p.id) from public.projects p where p.owner_id=v_target;
      end if;
    else raise sqlstate 'PT409' using message='moderation_action_incompatible'; end if;
  elsif v_report.target_kind='project' and p_action in ('hide','restore') then
    select moderation_state into v_prior from public.projects where id=v_target and moderation_version=p_expected_target_version for update;
    if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
    v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
    update public.projects set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp(),
      open_to_contributions=case when p_action='hide' then false else open_to_contributions end where id=v_target;
    perform private.refresh_moderated_project(v_target);
  elsif v_report.target_kind='contribution' and p_action in ('hide','restore') then
    select moderation_state into v_prior from public.contributions where id=v_target and moderation_version=p_expected_target_version for update;
    if not found then raise sqlstate 'PT409' using message='moderation_target_conflict'; end if;
    v_result:=case when p_action='hide' then 'hidden' else 'visible' end;
    update public.contributions set moderation_state=v_result,moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_target;
  else raise sqlstate 'PT409' using message='moderation_action_incompatible'; end if;
  if p_action not in ('assign_self','dismiss','resolve') then
    update private.moderation_reports set status='resolved',resolved_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_report_id;
  end if;
  insert into private.moderation_actions(admin_id,request_id,report_id,action,target_kind,target_id,reason,prior_state,resulting_state)
  values(v_admin,p_request_id,p_report_id,p_action,case when p_action in ('assign_self','dismiss','resolve') then 'report' else v_report.target_kind end,
    case when p_action in ('assign_self','dismiss','resolve') then p_report_id else v_target end,btrim(p_reason),v_prior,v_result)
  returning id into v_target;
  return jsonb_build_object('actionId',v_target,'result',v_result);
end $$;
revoke all on function public.apply_moderation_action(uuid,uuid,text,text,text,integer) from public,anon;
grant execute on function public.apply_moderation_action(uuid,uuid,text,text,text,integer) to authenticated;

create function public.reject_admin_upload(p_asset_id uuid,p_request_id uuid,p_expected_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.assert_admin_actor(); v_asset public.assets%rowtype; v_action uuid; begin
  if p_expected_status not in ('reserved','uploading','processing','failed') or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500
    then raise sqlstate '22023' using message='upload_rejection_invalid'; end if;
  select * into v_asset from public.assets where id=p_asset_id for update;
  if not found then raise sqlstate 'PT404' using message='asset_not_found'; end if;
  if v_asset.status::text<>p_expected_status or v_asset.status='ready'
    or exists(select 1 from private.retention_blockers(v_asset.id) where blocker_code<>'source_verification')
    then raise sqlstate 'PT409' using message='upload_rejection_blocked'; end if;
  if v_asset.status<>'failed' then perform private.fail_source_asset(v_asset.id,'moderation_rejected'); end if;
  update private.asset_verification_jobs
  set state='permanent_failed',lease_token=null,lease_expires_at=null,completed_at=statement_timestamp(),last_error_code='moderation_rejected'
  where asset_id=v_asset.id and state not in ('succeeded','permanent_failed');
  insert into private.moderation_actions(admin_id,request_id,action,target_kind,target_id,reason,prior_state,resulting_state)
  values(v_admin,p_request_id,'reject_upload','asset',p_asset_id,btrim(p_reason),p_expected_status,'failed')
  on conflict(admin_id,request_id) do update set request_id=excluded.request_id
  returning id into v_action;
  return jsonb_build_object('actionId',v_action,'result','failed');
end $$;

create function public.place_content_hold(p_request_id uuid,p_target_kind text,p_target_id uuid,p_hold_type text,p_reason text,p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.assert_admin_actor(); v_id uuid; begin
  if p_target_kind not in ('profile','project','contribution','asset') or p_hold_type not in ('legal','abuse')
    or p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500 or (p_expires_at is not null and p_expires_at<=statement_timestamp())
    then raise sqlstate '22023' using message='hold_invalid'; end if;
  insert into private.content_holds(request_id,target_kind,target_profile_id,target_project_id,target_contribution_id,target_asset_id,hold_type,reason,placed_by,expires_at)
  values(p_request_id,p_target_kind,case when p_target_kind='profile' then p_target_id end,case when p_target_kind='project' then p_target_id end,
    case when p_target_kind='contribution' then p_target_id end,case when p_target_kind='asset' then p_target_id end,p_hold_type,btrim(p_reason),v_admin,p_expires_at)
  on conflict(placed_by,request_id) do update set request_id=excluded.request_id returning id into v_id;
  insert into private.moderation_actions(admin_id,request_id,action,target_kind,target_id,reason,resulting_state)
  values(v_admin,p_request_id,'place_hold',p_target_kind,p_target_id,btrim(p_reason),p_hold_type)
  on conflict(admin_id,request_id) do nothing;
  return v_id;
end $$;

create function public.release_content_hold(p_hold_id uuid,p_request_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.assert_admin_actor(); v_hold private.content_holds%rowtype; begin
  if p_reason is null or btrim(p_reason)='' or char_length(btrim(p_reason))>500 then raise sqlstate '22023' using message='hold_release_invalid'; end if;
  select * into v_hold from private.content_holds where id=p_hold_id for update;
  if not found then raise sqlstate 'PT404' using message='hold_not_found'; end if;
  if v_hold.released_at is null then update private.content_holds set released_by=v_admin,released_at=statement_timestamp() where id=p_hold_id; end if;
  insert into private.moderation_actions(admin_id,request_id,action,target_kind,target_id,reason,prior_state,resulting_state)
  values(v_admin,p_request_id,'release_hold',v_hold.target_kind,coalesce(v_hold.target_profile_id,v_hold.target_project_id,v_hold.target_contribution_id,v_hold.target_asset_id),btrim(p_reason),v_hold.hold_type,'released')
  on conflict(admin_id,request_id) do nothing;
  return p_hold_id;
end $$;

-- Asset retention blockers are centralized and stable. An empty set is the
-- only eligibility proof accepted by the cleanup finalizer.
create function private.retention_blockers(p_asset_id uuid)
returns table(blocker_code text) language sql stable security definer set search_path='' as $$
  select 'owner_library' where exists(select 1 from public.assets a join public.profiles p on p.id=a.owner_id where a.id=p_asset_id and a.kind='source_audio' and a.status='ready' and p.status='active')
  union all select 'project_asset_reference' where exists(select 1 from public.project_asset_references where asset_id=p_asset_id)
  union all select 'revision_track' where exists(select 1 from public.revision_tracks where asset_id=p_asset_id)
  union all select 'workspace_track' where exists(select 1 from public.workspace_tracks wt join public.workspaces w on w.id=wt.workspace_id where wt.asset_id=p_asset_id and w.status='active')
  union all select 'workspace_snapshot' where exists(select 1 from public.workspaces w where w.snapshot_asset_id=p_asset_id and w.status='active')
  union all select 'contribution_version_track' where exists(select 1 from public.contribution_version_tracks where asset_id=p_asset_id)
  union all select 'contribution_snapshot' where exists(select 1 from public.contribution_versions where snapshot_asset_id=p_asset_id)
  union all select 'current_avatar' where exists(select 1 from public.profiles where avatar_version_id in (select id from public.profile_avatar_versions where source_asset_id=p_asset_id))
  union all select 'image_processing' where exists(select 1 from private.profile_image_processing_jobs where asset_id=p_asset_id and status in ('pending','leased','retry'))
  union all select 'source_verification' where exists(select 1 from private.asset_verification_jobs where asset_id=p_asset_id and state in ('pending','leased','retry_wait'))
  union all select 'asset_hold' where exists(select 1 from private.content_holds h where h.target_asset_id=p_asset_id and h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()))
  union all select 'profile_hold' where exists(select 1 from public.assets a join private.content_holds h on h.target_profile_id=a.owner_id where a.id=p_asset_id and h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()))
  union all select 'project_hold' where exists(select 1 from public.project_asset_references r join private.content_holds h on h.target_project_id=r.project_id where r.asset_id=p_asset_id and h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()))
  union all select 'contribution_hold' where exists(select 1 from public.contribution_version_tracks t join public.contribution_versions v on v.id=t.contribution_version_id join private.content_holds h on h.target_contribution_id=v.contribution_id where t.asset_id=p_asset_id and h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()))
$$;
revoke all on function private.retention_blockers(uuid) from public,anon,authenticated;

-- Backfill the legacy project requests conservatively before replacing them.
insert into private.deletion_requests(requester_id,request_id,target_kind,target_project_id,expected_lock_version,prior_status,prior_visibility,prior_open_to_contributions,provenance,requested_at,restore_until)
select d.owner_id,d.request_id,'project',d.project_id,d.expected_lock_version,
  case when p.current_revision_id is null then 'draft' else 'active' end,'private',false,'legacy',d.deleted_at,d.deleted_at+interval '30 days'
from private.project_deletion_requests d join public.projects p on p.id=d.project_id;
drop table private.project_deletion_requests;

create or replace function public.delete_project(p_project_id uuid,p_request_id uuid,p_expected_lock_version integer)
returns table(project_id uuid,deleted_at timestamptz,lock_version integer)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_project public.projects%rowtype; v_request private.deletion_requests%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_delete_unauthenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_actor and status='active' and profile_completed_at is not null) then raise sqlstate 'PT403' using message='project_delete_actor_ineligible'; end if;
  select * into v_request from private.deletion_requests where requester_id=v_actor and request_id=p_request_id;
  if found then
    if v_request.target_project_id is distinct from p_project_id or v_request.expected_lock_version is distinct from p_expected_lock_version then raise sqlstate 'PT409' using message='project_delete_request_conflict'; end if;
    return query select p.id,p.deleted_at,p.lock_version from public.projects p where p.id=p_project_id; return;
  end if;
  select * into v_project from public.projects where id=p_project_id and owner_id=v_actor for update;
  if not found then raise sqlstate 'PT404' using message='project_delete_not_found'; end if;
  if v_project.status='deleted' or v_project.moderation_state<>'visible' or v_project.lock_version<>p_expected_lock_version then raise sqlstate 'PT409' using message='project_delete_conflict'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_project_id,expected_lock_version,prior_status,prior_visibility,prior_open_to_contributions,requested_at,restore_until)
  values(v_actor,p_request_id,'project',p_project_id,p_expected_lock_version,v_project.status::text,v_project.visibility::text,v_project.open_to_contributions,statement_timestamp(),statement_timestamp()+interval '30 days') returning * into v_request;
  insert into private.deletion_request_workspaces(deletion_request_id,workspace_id,prior_status)
    select v_request.id,w.id,w.status from public.workspaces w where w.project_id=p_project_id and w.status='active';
  update public.workspaces w set status='archived',updated_at=statement_timestamp() where w.project_id=p_project_id and w.status='active';
  update public.projects p set visibility='private',status='deleted',open_to_contributions=false,deleted_at=statement_timestamp(),lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id returning p.* into v_project;
  perform private.refresh_moderated_project(p_project_id);
  return query select v_project.id,v_project.deleted_at,v_project.lock_version;
end $$;

create function public.restore_project(p_project_id uuid,p_request_id uuid)
returns table(project_id uuid,status text,lock_version integer) language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_request private.deletion_requests%rowtype; v_project public.projects%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='project_restore_unauthenticated'; end if;
  if p_request_id is null then raise sqlstate '22023' using message='project_restore_invalid'; end if;
  select * into v_request from private.deletion_requests d where d.target_project_id=p_project_id and d.requester_id=v_actor and d.status='recoverable' for update;
  if not found then raise sqlstate 'PT404' using message='project_restore_not_found'; end if;
  if v_request.restore_until<=statement_timestamp() or exists(select 1 from private.content_holds where target_project_id=p_project_id and released_at is null and (expires_at is null or expires_at>statement_timestamp())) then raise sqlstate 'PT409' using message='project_restore_unavailable'; end if;
  select * into v_project from public.projects p where p.id=p_project_id and p.owner_id=v_actor and p.status='deleted' and p.moderation_state='visible' for update;
  if not found then raise sqlstate 'PT409' using message='project_restore_unavailable'; end if;
  update public.projects p set status=v_request.prior_status::public.project_status,visibility=coalesce(v_request.prior_visibility,'private')::public.project_visibility,
    open_to_contributions=coalesce(v_request.prior_open_to_contributions,false),deleted_at=null,lock_version=p.lock_version+1,updated_at=statement_timestamp() where p.id=p_project_id returning p.* into v_project;
  update public.workspaces w set status='active',updated_at=statement_timestamp() from private.deletion_request_workspaces dw
    where dw.deletion_request_id=v_request.id and dw.workspace_id=w.id and dw.prior_status='active' and w.status='archived';
  update private.deletion_requests d set status='restored',restored_at=statement_timestamp() where d.id=v_request.id;
  perform private.refresh_moderated_project(p_project_id);
  return query select v_project.id,v_project.status::text,v_project.lock_version;
end $$;

create function public.delete_own_contribution(p_contribution_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_c public.contributions%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='contribution_delete_unauthenticated'; end if;
  select * into v_c from public.contributions where id=p_contribution_id and author_id=v_actor for update;
  if not found then raise sqlstate 'PT404' using message='contribution_delete_not_found'; end if;
  if v_c.status not in ('rejected','withdrawn') or v_c.deleted_at is not null or v_c.moderation_state<>'visible'
    or exists(select 1 from public.project_revisions where accepted_contribution_id=v_c.id)
    or exists(select 1 from private.content_holds where target_contribution_id=v_c.id and released_at is null and (expires_at is null or expires_at>statement_timestamp()))
    then raise sqlstate 'PT409' using message='contribution_delete_unavailable'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_contribution_id,prior_status,prior_visibility,requested_at,restore_until)
  values(v_actor,p_request_id,'contribution',v_c.id,v_c.status::text,v_c.moderation_state,statement_timestamp(),statement_timestamp()+interval '30 days');
  update public.contributions set deleted_at=statement_timestamp(),moderation_state='hidden',moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=v_c.id;
  return jsonb_build_object('contributionId',v_c.id,'restoreUntil',statement_timestamp()+interval '30 days');
end $$;

create function public.restore_own_contribution(p_contribution_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_request private.deletion_requests%rowtype; begin
  select * into v_request from private.deletion_requests where requester_id=v_actor and target_contribution_id=p_contribution_id and status='recoverable' for update;
  if not found or v_request.restore_until<=statement_timestamp() then raise sqlstate 'PT404' using message='contribution_restore_not_found'; end if;
  if not exists(select 1 from public.contributions c join public.projects p on p.id=c.project_id where c.id=p_contribution_id and p.deleted_at is null and p.moderation_state='visible') then raise sqlstate 'PT409' using message='contribution_restore_unavailable'; end if;
  update public.contributions set deleted_at=null,moderation_state='visible',moderation_version=moderation_version+1,moderation_updated_at=statement_timestamp() where id=p_contribution_id;
  update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_request.id;
  return jsonb_build_object('contributionId',p_contribution_id,'status','restored');
end $$;

create function public.request_account_deletion(p_request_id uuid,p_username text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_profile public.profiles%rowtype; v_parent private.deletion_requests%rowtype; v_project public.projects%rowtype; v_child private.deletion_requests%rowtype; begin
  if v_actor is null then raise sqlstate 'PT401' using message='account_delete_unauthenticated'; end if;
  select * into v_profile from public.profiles where id=v_actor and status='active' and profile_completed_at is not null for update;
  if not found or v_profile.username<>p_username then raise sqlstate 'PT403' using message='account_delete_confirmation_invalid'; end if;
  insert into private.deletion_requests(requester_id,request_id,target_kind,target_profile_id,prior_status,prior_visibility,requested_at,restore_until)
  values(v_actor,p_request_id,'profile',v_actor,v_profile.status::text,v_profile.moderation_state,statement_timestamp(),statement_timestamp()+interval '30 days') returning * into v_parent;
  for v_project in select * from public.projects where owner_id=v_actor and status<>'deleted' and moderation_state='visible' for update loop
    insert into private.deletion_requests(requester_id,request_id,target_kind,target_project_id,parent_request_id,expected_lock_version,prior_status,prior_visibility,prior_open_to_contributions,provenance,requested_at,restore_until)
    values(v_actor,gen_random_uuid(),'project',v_project.id,v_parent.id,v_project.lock_version,v_project.status::text,v_project.visibility::text,v_project.open_to_contributions,'account_cascade',v_parent.requested_at,v_parent.restore_until) returning * into v_child;
    insert into private.deletion_request_workspaces(deletion_request_id,workspace_id,prior_status) select v_child.id,w.id,w.status from public.workspaces w where w.project_id=v_project.id and w.status='active';
    update public.workspaces set status='archived',updated_at=statement_timestamp() where project_id=v_project.id and status='active';
    update public.projects set visibility='private',status='deleted',open_to_contributions=false,deleted_at=statement_timestamp(),lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_project.id;
    perform private.refresh_moderated_project(v_project.id);
  end loop;
  update public.workspaces set status='archived',updated_at=statement_timestamp() where owner_id=v_actor and status='active';
  if v_profile.avatar_version_id is not null then perform public.remove_own_avatar(v_profile.avatar_version_id); end if;
  update public.profiles set status='deleted',deletion_requested_at=v_parent.requested_at,deletion_restore_until=v_parent.restore_until where id=v_actor;
  delete from public.public_project_catalog where owner_id=v_actor;
  return jsonb_build_object('requestId',v_parent.id,'restoreUntil',v_parent.restore_until);
end $$;

create function public.get_own_account_recovery()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); begin
  if v_actor is null then raise sqlstate 'PT401' using message='recovery_unauthenticated'; end if;
  return (select jsonb_build_object('requestId',d.id,'requestedAt',d.requested_at,'restoreUntil',d.restore_until,'canRestore',d.restore_until>statement_timestamp() and d.status='recoverable','username',p.username)
    from private.deletion_requests d join public.profiles p on p.id=d.target_profile_id where d.target_profile_id=v_actor and d.status='recoverable' order by d.requested_at desc limit 1);
end $$;

create function public.restore_own_account()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_parent private.deletion_requests%rowtype; v_child private.deletion_requests%rowtype; begin
  select * into v_parent from private.deletion_requests where target_profile_id=v_actor and status='recoverable' for update;
  if not found or v_parent.restore_until<=statement_timestamp() then raise sqlstate 'PT404' using message='recovery_unavailable'; end if;
  if exists(select 1 from private.content_holds where target_profile_id=v_actor and released_at is null and (expires_at is null or expires_at>statement_timestamp())) then raise sqlstate 'PT409' using message='recovery_held'; end if;
  update public.profiles set status='active',deletion_requested_at=null,deletion_restore_until=null where id=v_actor and moderation_state='visible';
  if not found then raise sqlstate 'PT409' using message='recovery_moderated'; end if;
  for v_child in select * from private.deletion_requests where parent_request_id=v_parent.id and status='recoverable' for update loop
    if v_child.target_project_id is not null and exists(select 1 from public.projects where id=v_child.target_project_id and status='deleted' and moderation_state='visible') then
      update public.projects set status=v_child.prior_status::public.project_status,visibility=coalesce(v_child.prior_visibility,'private')::public.project_visibility,
        open_to_contributions=coalesce(v_child.prior_open_to_contributions,false),deleted_at=null,lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_child.target_project_id;
      update public.workspaces w set status='active',updated_at=statement_timestamp() from private.deletion_request_workspaces dw where dw.deletion_request_id=v_child.id and dw.workspace_id=w.id and w.status='archived';
      update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_child.id;
      perform private.refresh_moderated_project(v_child.target_project_id);
    end if;
  end loop;
  update private.deletion_requests set status='restored',restored_at=statement_timestamp() where id=v_parent.id;
  return jsonb_build_object('status','restored');
end $$;

-- Retention run/lease state. Object paths remain private and are returned only
-- to service_role claims.
create table private.retention_runs (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null default 'retention-v1',
  mode text not null check (mode in ('preview','execute')),
  status text not null default 'running' check (status in ('running','complete','failed')),
  requested_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  candidate_count integer not null default 0,
  completed_count integer not null default 0,
  blocked_count integer not null default 0,
  failed_count integer not null default 0
);
create table private.retention_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.retention_runs(id) on delete restrict,
  policy_version text not null,
  rule_code text not null check (rule_code in ('failed_upload_24h','snapshot_30d','peak_expired_24h','avatar_superseded','deletion_expired_30d','moderation_metadata_180d')),
  subject_kind text not null check (subject_kind in ('asset','peak','avatar','deletion','metadata')),
  subject_id uuid not null,
  status text not null default 'pending' check (status in ('pending','leased','retry','complete','blocked','dead')),
  eligible_at timestamptz not null,
  byte_estimate bigint not null default 0 check (byte_estimate>=0),
  proof_version text not null default 'blockers-v1',
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique(policy_version,rule_code,subject_kind,subject_id)
);
create index retention_cleanup_due_idx on private.retention_cleanup_jobs(status,next_attempt_at,id)
  where status in ('pending','retry','leased');
create index retention_cleanup_run_idx on private.retention_cleanup_jobs(run_id,status,id);
create index retention_cleanup_claim_idx on private.retention_cleanup_jobs(run_id,next_attempt_at,id)
  where status in ('pending','retry','leased');
create table private.retention_cleanup_objects (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.retention_cleanup_jobs(id) on delete restrict,
  bucket text not null,
  object_path text not null,
  deleted_at timestamptz,
  already_missing boolean not null default false,
  unique(job_id,bucket,object_path)
);
create index retention_cleanup_objects_job_idx on private.retention_cleanup_objects(job_id);
alter table private.retention_runs enable row level security;
alter table private.retention_cleanup_jobs enable row level security;
alter table private.retention_cleanup_objects enable row level security;
revoke all on private.retention_runs,private.retention_cleanup_jobs,private.retention_cleanup_objects from public,anon,authenticated;

create function public.operator_retention_preview(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
  if p_limit not between 1 and 500 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  return jsonb_build_object('policyVersion','retention-v1','limit',p_limit,'groups',jsonb_build_array(
    jsonb_build_object('rule','failed_upload_24h','count',(select count(*) from (select a.id from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)) limit p_limit) q),'bytes',(select coalesce(sum(a.reserved_byte_size),0) from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)))),
    jsonb_build_object('rule','snapshot_30d','count',(select count(*) from (select a.id from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)) limit p_limit) q),'bytes',(select coalesce(sum(coalesce(a.byte_size,a.reserved_byte_size)),0) from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)))),
    jsonb_build_object('rule','peak_expired_24h','count',(select count(*) from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours')),'bytes',(select coalesce(sum(coalesce(d.byte_size,d.expected_byte_size)),0) from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours'))),
    jsonb_build_object('rule','avatar_superseded','count',(select count(*) from private.profile_avatar_cleanup_jobs where status in ('pending','retry') and next_attempt_at<=statement_timestamp()),'bytes',(select coalesce(sum(coalesce(v.byte_size,0)+a.reserved_byte_size),0) from private.profile_avatar_cleanup_jobs j join public.profile_avatar_versions v on v.id=j.avatar_version_id join public.assets a on a.id=j.source_asset_id where j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp())),
    jsonb_build_object('rule','deletion_expired_30d','count',(select count(*) from private.deletion_requests where status='recoverable' and restore_until<=statement_timestamp()),'bytes',0),
    jsonb_build_object('rule','moderation_metadata_180d','count',(select count(*) from private.moderation_reports where status in ('resolved','dismissed') and resolved_at<=statement_timestamp()-interval '180 days'),'bytes',0)
  ));
end $$;

create function public.operator_start_retention_run(p_limit integer default 100)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_run uuid:=gen_random_uuid(); begin
  if p_limit not between 1 and 100 then raise sqlstate '22023' using message='retention_limit_invalid'; end if;
  insert into private.retention_runs(id,mode) values(v_run,'execute');
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','failed_upload_24h','asset',a.id,a.failed_at+interval '24 hours',coalesce(a.byte_size,a.reserved_byte_size)
    from public.assets a where a.status='failed' and a.failed_at<=statement_timestamp()-interval '24 hours' and not exists(select 1 from private.retention_blockers(a.id)) order by a.failed_at,a.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','snapshot_30d','asset',a.id,a.created_at+interval '30 days',coalesce(a.byte_size,a.reserved_byte_size)
    from public.assets a where a.kind='workspace_snapshot' and a.created_at<=statement_timestamp()-interval '30 days' and not exists(select 1 from private.retention_blockers(a.id)) order by a.created_at,a.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','peak_expired_24h','peak',d.id,coalesce(d.failed_at,d.expires_at)+interval '24 hours',coalesce(d.byte_size,d.expected_byte_size)
    from public.waveform_peak_derivatives d where (d.status='reserved' and d.expires_at<=statement_timestamp()-interval '24 hours') or (d.status='failed' and d.failed_at<=statement_timestamp()-interval '24 hours')
    order by coalesce(d.failed_at,d.expires_at),d.id limit p_limit on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at,byte_estimate)
    select v_run,'retention-v1','avatar_superseded','avatar',j.avatar_version_id,j.next_attempt_at,coalesce(v.byte_size,0)+a.reserved_byte_size
    from private.profile_avatar_cleanup_jobs j join public.profile_avatar_versions v on v.id=j.avatar_version_id join public.assets a on a.id=j.source_asset_id
    where j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp() order by j.next_attempt_at,j.avatar_version_id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
    select v_run,'retention-v1','deletion_expired_30d','deletion',d.id,d.restore_until from private.deletion_requests d where d.status='recoverable' and d.restore_until<=statement_timestamp() order by d.restore_until,d.id limit p_limit
    on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_jobs(run_id,policy_version,rule_code,subject_kind,subject_id,eligible_at)
    select v_run,'retention-v1','moderation_metadata_180d','metadata',r.id,r.resolved_at+interval '180 days' from private.moderation_reports r
    where r.status in ('resolved','dismissed') and r.resolved_at<=statement_timestamp()-interval '180 days' and r.detail is not null
    order by r.resolved_at,r.id limit p_limit on conflict(policy_version,rule_code,subject_kind,subject_id) do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,a.bucket,a.object_path from private.retention_cleanup_jobs j join public.assets a on j.subject_kind='asset' and a.id=j.subject_id where j.run_id=v_run on conflict do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,d.bucket,d.object_path from private.retention_cleanup_jobs j join public.waveform_peak_derivatives d on j.subject_kind='peak' and d.id=j.subject_id where j.run_id=v_run on conflict do nothing;
  insert into private.retention_cleanup_objects(job_id,bucket,object_path)
    select j.id,'public-avatars',v.public_object_path from private.retention_cleanup_jobs j join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id where j.run_id=v_run
    union all select j.id,a.bucket,a.object_path from private.retention_cleanup_jobs j join public.profile_avatar_versions v on j.subject_kind='avatar' and v.id=j.subject_id join public.assets a on a.id=v.source_asset_id where j.run_id=v_run on conflict do nothing;
  update private.retention_runs set candidate_count=(select count(*) from private.retention_cleanup_jobs where run_id=v_run) where id=v_run;
  return v_run;
end $$;

create function public.operator_claim_retention_job(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job private.retention_cleanup_jobs%rowtype; v_token uuid:=gen_random_uuid(); begin
  select * into v_job from private.retention_cleanup_jobs j where j.run_id=p_run_id and ((j.status in ('pending','retry') and j.next_attempt_at<=statement_timestamp()) or (j.status='leased' and j.lease_expires_at<=statement_timestamp()))
    order by j.next_attempt_at,j.id for update skip locked limit 1;
  if not found then return null; end if;
  update private.retention_cleanup_jobs set status='leased',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=statement_timestamp()+interval '2 minutes' where id=v_job.id;
  return jsonb_build_object('jobId',v_job.id,'rule',v_job.rule_code,'subjectKind',v_job.subject_kind,'subjectId',v_job.subject_id,'leaseToken',v_token,'attempt',v_job.attempt_count+1,
    'objects',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'bucket',o.bucket,'path',o.object_path) order by o.id) from private.retention_cleanup_objects o where o.job_id=v_job.id),'[]'::jsonb));
end $$;

create function public.operator_finalize_retention_job(p_job_id uuid,p_lease_token uuid,p_deleted_object_ids uuid[],p_missing_object_ids uuid[])
returns text language plpgsql security definer set search_path='' as $$
declare v_job private.retention_cleanup_jobs%rowtype; v_asset public.assets%rowtype; v_version public.profile_avatar_versions%rowtype; begin
  select * into v_job from private.retention_cleanup_jobs where id=p_job_id for update;
  if not found then raise sqlstate 'PT404' using message='retention_job_not_found'; end if;
  if v_job.status='complete' then return 'complete'; end if;
  if v_job.status<>'leased' or v_job.lease_token<>p_lease_token or v_job.lease_expires_at<=statement_timestamp() then raise sqlstate 'PT409' using message='retention_lease_invalid'; end if;
  if exists(select 1 from private.retention_cleanup_objects where job_id=v_job.id and deleted_at is null and id<>all(coalesce(p_deleted_object_ids,'{}')) and id<>all(coalesce(p_missing_object_ids,'{}'))) then raise sqlstate 'PT409' using message='retention_objects_incomplete'; end if;
  if v_job.subject_kind='asset' then
    select * into v_asset from public.assets where id=v_job.subject_id for update;
    if exists(select 1 from private.retention_blockers(v_asset.id)) then update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_after_claim',lease_token=null,lease_expires_at=null where id=v_job.id; update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id; return 'blocked_after_claim'; end if;
    if v_asset.status<>'deleted' then
      if v_asset.kind='source_audio' and v_asset.status='ready' then
        update public.global_storage_usage set source_bytes=greatest(0,source_bytes-coalesce(v_asset.byte_size,0)),updated_at=statement_timestamp() where singleton;
        update public.user_storage_usage set source_bytes=greatest(0,source_bytes-coalesce(v_asset.byte_size,0)),updated_at=statement_timestamp() where user_id=v_asset.owner_id;
      end if;
      update public.assets set status='deleted',failure_code=null,failed_at=null,deleted_at=statement_timestamp() where id=v_asset.id;
    end if;
  elsif v_job.subject_kind='peak' then
    update public.global_storage_usage g set reserved_derived_bytes=greatest(0,g.reserved_derived_bytes-d.expected_byte_size),updated_at=statement_timestamp()
      from public.waveform_peak_derivatives d where d.id=v_job.subject_id and d.status='reserved' and g.singleton;
    delete from public.waveform_peak_derivatives where id=v_job.subject_id and status in ('reserved','failed');
  elsif v_job.subject_kind='avatar' then
    select * into v_version from public.profile_avatar_versions where id=v_job.subject_id for update;
    if exists(select 1 from public.profiles where avatar_version_id=v_version.id) then update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_after_claim',lease_token=null,lease_expires_at=null where id=v_job.id; return 'blocked_after_claim'; end if;
    update public.profile_avatar_versions set status='cleaned',cleaned_at=coalesce(cleaned_at,statement_timestamp()) where id=v_version.id;
    update public.assets set status='deleted',failure_code=null,failed_at=null,deleted_at=coalesce(deleted_at,statement_timestamp()) where id=v_version.source_asset_id and status<>'deleted';
    update private.profile_avatar_cleanup_jobs set status='complete',lease_token=null,lease_expires_at=null,updated_at=statement_timestamp() where avatar_version_id=v_version.id;
  elsif v_job.subject_kind='deletion' then
    if exists(select 1 from private.deletion_requests d join private.content_holds h on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()) and
      ((d.target_profile_id is not null and h.target_profile_id=d.target_profile_id) or (d.target_project_id is not null and h.target_project_id=d.target_project_id) or (d.target_contribution_id is not null and h.target_contribution_id=d.target_contribution_id)) where d.id=v_job.subject_id) then
      update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_after_claim',lease_token=null,lease_expires_at=null where id=v_job.id;
      update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
      return 'blocked_after_claim';
    end if;
    update private.deletion_requests set status='purged',purged_at=statement_timestamp() where id=v_job.subject_id and status='recoverable' and restore_until<=statement_timestamp();
    update public.profiles set purged_at=statement_timestamp(),bio=null,display_name='Deleted musician' where id=(select target_profile_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.projects set purged_at=statement_timestamp(),description=null where id=(select target_project_id from private.deletion_requests where id=v_job.subject_id) and status='deleted';
    update public.contributions set purged_at=statement_timestamp(),description=null where id=(select target_contribution_id from private.deletion_requests where id=v_job.subject_id) and deleted_at is not null;
  elsif v_job.subject_kind='metadata' then
    if exists(select 1 from private.moderation_reports r join private.content_holds h on h.released_at is null and (h.expires_at is null or h.expires_at>statement_timestamp()) and
      ((r.target_profile_id is not null and h.target_profile_id=r.target_profile_id) or (r.target_project_id is not null and h.target_project_id=r.target_project_id) or (r.target_contribution_id is not null and h.target_contribution_id=r.target_contribution_id)) where r.id=v_job.subject_id) then
      update private.retention_cleanup_jobs set status='blocked',last_error_code='blocked_after_claim',lease_token=null,lease_expires_at=null where id=v_job.id;
      update private.retention_runs set blocked_count=blocked_count+1 where id=v_job.run_id;
      return 'blocked_after_claim';
    end if;
    update private.moderation_reports set detail=null,target_label_snapshot='Unavailable target',updated_at=statement_timestamp() where id=v_job.subject_id and resolved_at<=statement_timestamp()-interval '180 days';
  end if;
  update private.retention_cleanup_objects set deleted_at=statement_timestamp(),already_missing=(id=any(coalesce(p_missing_object_ids,'{}'))) where job_id=v_job.id and id=any(coalesce(p_deleted_object_ids,'{}')||coalesce(p_missing_object_ids,'{}'));
  update private.retention_cleanup_jobs set status='complete',completed_at=statement_timestamp(),lease_token=null,lease_expires_at=null where id=v_job.id;
  update private.retention_runs set completed_count=completed_count+1 where id=v_job.run_id;
  return 'complete';
end $$;

create function public.operator_retry_retention_job(p_job_id uuid,p_lease_token uuid,p_error_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_attempt integer; v_run uuid; begin
  select attempt_count,run_id into v_attempt,v_run from private.retention_cleanup_jobs where id=p_job_id and status='leased' and lease_token=p_lease_token for update;
  if not found then raise sqlstate 'PT409' using message='retention_lease_invalid'; end if;
  update private.retention_cleanup_jobs set status=case when v_attempt>=8 then 'dead' else 'retry' end,next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,power(2,v_attempt)::integer*10)),lease_token=null,lease_expires_at=null,last_error_code=left(p_error_code,80) where id=p_job_id;
  if v_attempt>=8 then update private.retention_runs set failed_count=failed_count+1 where id=v_run; return 'dead'; end if;
  return 'retry';
end $$;

create function public.operator_complete_retention_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  update private.retention_runs set status=case when exists(select 1 from private.retention_cleanup_jobs where run_id=p_run_id and status='dead') then 'failed' else 'complete' end,completed_at=statement_timestamp() where id=p_run_id and not exists(select 1 from private.retention_cleanup_jobs where run_id=p_run_id and status in ('pending','retry','leased'));
  return (select jsonb_build_object('runId',id,'status',status,'candidateCount',candidate_count,'completedCount',completed_count,'blockedCount',blocked_count,'failedCount',failed_count) from private.retention_runs where id=p_run_id);
end $$;

create function public.get_admin_storage_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
  perform private.assert_admin_actor();
  return jsonb_build_object(
    'thresholds',jsonb_build_object('warningBytes',786432000,'stopBytes',891289600),
    'total',jsonb_build_object('objectCount',(select count(*) from storage.objects),'bytes',(select coalesce(sum(case when metadata->>'size'~'^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0) from storage.objects),'unknownSizeCount',(select count(*) from storage.objects where not coalesce(metadata->>'size','')~'^[0-9]+$')),
    'buckets',coalesce((select jsonb_agg(to_jsonb(x) order by x.bucket) from (select bucket_id bucket,count(*) object_count,coalesce(sum(case when metadata->>'size'~'^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0) bytes,count(*) filter(where not coalesce(metadata->>'size','')~'^[0-9]+$') unknown_size_count from storage.objects group by bucket_id) x),'[]'::jsonb),
    'registered',jsonb_build_object('sourceBytes',(select source_bytes from public.global_storage_usage),'reservedSourceBytes',(select reserved_source_bytes from public.global_storage_usage),'derivedBytes',(select derived_bytes from public.global_storage_usage),'reservedDerivedBytes',(select reserved_derived_bytes from public.global_storage_usage)),
    'untrackedObjectCount',(select count(*) from storage.objects o where not exists(select 1 from public.assets a where a.bucket=o.bucket_id and a.object_path=o.name) and not exists(select 1 from public.waveform_peak_derivatives d where d.bucket=o.bucket_id and d.object_path=o.name) and not exists(select 1 from public.profile_avatar_versions v where o.bucket_id='public-avatars' and v.public_object_path=o.name)),
    'dueCleanupCount',(select count(*) from private.retention_cleanup_jobs where status in ('pending','retry') and next_attempt_at<=statement_timestamp()),
    'lastRun',(select jsonb_build_object('id',id,'status',status,'requestedAt',requested_at,'completedAt',completed_at,'candidateCount',candidate_count,'completedCount',completed_count,'blockedCount',blocked_count,'failedCount',failed_count) from private.retention_runs order by requested_at desc limit 1)
  );
end $$;

-- Admission uses actual object metadata plus reservations not yet materialized
-- and registered ready assets whose object is unexpectedly absent.
create or replace function public.reserve_source_asset(p_request_id uuid,p_expected_byte_size bigint,p_filename text,p_declared_media_type text default null,p_client_duration_ms integer default null,p_expected_sha256 text default null)
returns table(asset_id uuid,bucket text,object_path text,expires_at timestamptz,user_remaining_bytes bigint,global_remaining_bytes bigint,capacity_warning boolean)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_asset public.assets%rowtype; v_upload public.asset_uploads%rowtype; v_user public.user_storage_usage%rowtype; v_id uuid; v_effective bigint; v_unknown bigint;
begin
 if v_actor is null then raise sqlstate 'PT401' using message='asset_unauthenticated'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.status='active' and p.profile_completed_at is not null) then raise sqlstate 'PT403' using message='asset_actor_ineligible'; end if;
 if p_expected_byte_size not between 1 and 47185920 or p_filename is null or btrim(p_filename)='' or char_length(btrim(p_filename))>255 or (p_client_duration_ms is not null and p_client_duration_ms not between 1 and 600000) or (p_expected_sha256 is not null and p_expected_sha256 !~ '^[0-9a-f]{64}$') then raise sqlstate '22023' using message='asset_invalid_declaration'; end if;
 select * into v_upload from public.asset_uploads u where u.owner_id=v_actor and u.request_id=p_request_id;
 if found then
  select * into v_asset from public.assets a where a.id=v_upload.asset_id;
  if v_upload.expected_byte_size<>p_expected_byte_size or v_upload.client_filename<>btrim(p_filename) or v_upload.client_media_type is distinct from nullif(p_declared_media_type,'') or v_upload.client_duration_ms is distinct from p_client_duration_ms or v_upload.expected_sha256 is distinct from p_expected_sha256 then raise sqlstate '23505' using message='asset_request_conflict'; end if;
  select * into v_user from public.user_storage_usage where user_id=v_actor;
  select coalesce(sum(case when metadata->>'size'~'^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),count(*) filter(where not coalesce(metadata->>'size','')~'^[0-9]+$') into v_effective,v_unknown from storage.objects;
  return query select v_asset.id,v_asset.bucket,v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes,891289600-v_effective,(v_unknown>0 or v_effective>=786432000); return;
 end if;
 if not coalesce((select enabled from private.source_admission_control where singleton),false) then raise sqlstate 'PT403' using message='audio_uploads_unavailable'; end if;
 perform 1 from public.global_storage_usage where singleton for update;
 insert into public.user_storage_usage(user_id) values(v_actor) on conflict do nothing;
 select * into v_user from public.user_storage_usage where user_id=v_actor for update;
 if v_user.source_bytes+v_user.reserved_source_bytes+p_expected_byte_size>209715200 then raise sqlstate 'PT429' using message='asset_user_quota_exceeded'; end if;
 select coalesce(sum(case when metadata->>'size'~'^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),count(*) filter(where not coalesce(metadata->>'size','')~'^[0-9]+$') into v_effective,v_unknown from storage.objects;
 v_effective:=v_effective
  +(select coalesce(sum(a.reserved_byte_size),0) from public.assets a where a.status in ('reserved','uploading','processing') and not exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_path))
  +(select coalesce(sum(a.byte_size),0) from public.assets a where a.status='ready' and not exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.object_path));
 if v_unknown>0 or v_effective+p_expected_byte_size>891289600 then raise sqlstate 'PT429' using message='asset_global_quota_exceeded'; end if;
 v_id:=gen_random_uuid();
 insert into public.assets(id,owner_id,object_path,original_filename,declared_media_type,reserved_byte_size) values(v_id,v_actor,v_actor::text||'/'||v_id::text||'/source',btrim(p_filename),nullif(p_declared_media_type,''),p_expected_byte_size) returning * into v_asset;
 insert into public.asset_uploads(asset_id,owner_id,request_id,expected_byte_size,expected_sha256,client_duration_ms,client_filename,client_media_type,expires_at) values(v_id,v_actor,p_request_id,p_expected_byte_size,p_expected_sha256,p_client_duration_ms,btrim(p_filename),nullif(p_declared_media_type,''),statement_timestamp()+interval '24 hours') returning * into v_upload;
 update public.global_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where singleton;
 update public.user_storage_usage set reserved_source_bytes=reserved_source_bytes+p_expected_byte_size,updated_at=statement_timestamp() where user_id=v_actor;
 return query select v_id,'source-audio',v_asset.object_path,v_upload.expires_at,209715200-v_user.source_bytes-v_user.reserved_source_bytes-p_expected_byte_size,891289600-v_effective-p_expected_byte_size,(v_effective+p_expected_byte_size)>=786432000;
end $$;

-- Hidden/deleted targets fail closed for signed source access.
create or replace function private.can_read_source_asset(p_asset_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.assets a where a.id=p_asset_id and a.kind='source_audio' and a.status='ready' and a.deleted_at is null and (
    (a.owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=a.owner_id and p.status='active'))
    or exists(select 1 from public.revision_tracks rt join public.project_revisions r on r.id=rt.revision_id join public.projects p on p.id=r.project_id where rt.asset_id=a.id and p.deleted_at is null and p.moderation_state='visible' and ((exists(select 1 from public.public_project_catalog c where c.project_id=p.id and c.current_revision_id=r.id)) or ((select private.is_active_project_actor()) and (select private.is_project_member(p.id)))))
    or ((select private.is_active_project_actor()) and exists(select 1 from public.workspace_tracks wt join public.workspaces w on w.id=wt.workspace_id join public.projects p on p.id=w.project_id where wt.asset_id=a.id and w.owner_id=(select auth.uid()) and w.status='active' and p.deleted_at is null and p.moderation_state='visible'))
    or ((select private.is_active_project_actor()) and exists(select 1 from public.contribution_version_tracks t join public.contribution_versions v on v.id=t.contribution_version_id join public.contributions c on c.id=v.contribution_id join public.projects p on p.id=c.project_id where t.asset_id=a.id and c.deleted_at is null and c.moderation_state='visible' and p.deleted_at is null and p.moderation_state='visible' and (c.author_id=(select auth.uid()) or (p.owner_id=(select auth.uid()) and c.status<>'draft'))))
  ))
$$;

create function private.prevent_hidden_workspace_mutation() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.projects p where p.id=coalesce(new.project_id,old.project_id) and (p.deleted_at is not null or p.moderation_state='hidden'))
    or exists(select 1 from public.contributions c where c.id=coalesce(new.contribution_id,old.contribution_id) and (c.deleted_at is not null or c.moderation_state='hidden'))
    then raise sqlstate 'PT403' using message='moderated_content_unavailable'; end if;
  return new;
end $$;
create trigger workspaces_hidden_mutation before insert or update on public.workspaces for each row execute function private.prevent_hidden_workspace_mutation();
revoke all on function private.prevent_hidden_workspace_mutation() from public,anon,authenticated;

create function private.prevent_hidden_content_mutation() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if old.moderation_state='hidden' and new.moderation_state='hidden'
    and (select auth.uid()) is not null and not private.is_admin()
    then raise sqlstate 'PT403' using message='moderated_content_unavailable'; end if;
  return new;
end $$;
create trigger projects_hidden_mutation before update on public.projects for each row execute function private.prevent_hidden_content_mutation();
create trigger contributions_hidden_mutation before update on public.contributions for each row execute function private.prevent_hidden_content_mutation();
revoke all on function private.prevent_hidden_content_mutation() from public,anon,authenticated;

-- Grants are deliberately narrow. Operator functions remain service-role only.
revoke all on function public.reject_admin_upload(uuid,uuid,text,text),public.place_content_hold(uuid,text,uuid,text,text,timestamptz),public.release_content_hold(uuid,uuid,text),
  public.restore_project(uuid,uuid),public.delete_own_contribution(uuid,uuid),public.restore_own_contribution(uuid),public.request_account_deletion(uuid,text),public.get_own_account_recovery(),public.restore_own_account(),public.get_admin_storage_summary() from public,anon;
grant execute on function public.reject_admin_upload(uuid,uuid,text,text),public.place_content_hold(uuid,text,uuid,text,text,timestamptz),public.release_content_hold(uuid,uuid,text),public.get_admin_storage_summary() to authenticated;
grant execute on function public.restore_project(uuid,uuid),public.delete_own_contribution(uuid,uuid),public.restore_own_contribution(uuid),public.request_account_deletion(uuid,text),public.get_own_account_recovery(),public.restore_own_account() to authenticated;
revoke all on function public.operator_retention_preview(integer),public.operator_start_retention_run(integer),public.operator_claim_retention_job(uuid),public.operator_finalize_retention_job(uuid,uuid,uuid[],uuid[]),public.operator_retry_retention_job(uuid,uuid,text),public.operator_complete_retention_run(uuid) from public,anon,authenticated;
grant execute on function public.operator_retention_preview(integer),public.operator_start_retention_run(integer),public.operator_claim_retention_job(uuid),public.operator_finalize_retention_job(uuid,uuid,uuid[],uuid[]),public.operator_retry_retention_job(uuid,uuid,text),public.operator_complete_retention_run(uuid) to service_role;

comment on table private.moderation_reports is 'Private reports. Submission has no visibility side effect; reporter status is exposed only through a coarse RPC.';
comment on table private.moderation_actions is 'Append-only administrator action audit without public report or actor exposure.';
comment on function private.retention_blockers(uuid) is 'Central reference and hold graph; any returned code blocks Storage byte deletion.';
comment on function public.operator_retention_preview(integer) is 'Read-only bounded retention preview; returns grouped counts and byte estimates without object paths.';
