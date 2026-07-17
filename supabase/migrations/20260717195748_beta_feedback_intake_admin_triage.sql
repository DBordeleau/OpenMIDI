-- FEEDBACK-01: private beta feedback intake and administrator triage.

create table private.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  reference_id text generated always as (
    'FB-' || upper(substr(replace(id::text, '-', ''), 1, 12))
  ) stored unique,
  submitter_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('bug', 'suggestion')),
  summary text not null check (
    summary = btrim(summary)
    and char_length(summary) between 5 and 120
    and summary !~ '[[:cntrl:]]'
  ),
  details text not null check (
    details = btrim(details)
    and char_length(details) between 20 and 4000
  ),
  source_pathname text not null check (
    source_pathname = btrim(source_pathname)
    and char_length(source_pathname) between 1 and 300
    and left(source_pathname, 1) = '/'
    and left(source_pathname, 2) <> '//'
    and source_pathname !~ '[?#\\]'
    and source_pathname !~ '[[:cntrl:]]'
  ),
  application_version text not null check (
    application_version = btrim(application_version)
    and char_length(application_version) between 1 and 100
    and application_version !~ '[[:cntrl:]]'
  ),
  browser_context text check (
    browser_context is null
    or (
      browser_context = btrim(browser_context)
      and char_length(browser_context) between 1 and 300
      and browser_context !~ '[[:cntrl:]]'
    )
  ),
  status text not null default 'new' check (status in ('new', 'handled')),
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  handled_at timestamptz,
  handled_by uuid references private.app_admins(user_id) on delete restrict,
  admin_note text check (
    admin_note is null
    or (
      admin_note = btrim(admin_note)
      and char_length(admin_note) between 1 and 1000
    )
  ),
  unique (submitter_id, request_id),
  check (
    (status = 'new' and handled_at is null and handled_by is null and admin_note is null)
    or (status = 'handled' and handled_at is not null and handled_by is not null)
  )
);

comment on table private.beta_feedback is
  'Private beta bug reports and suggestions. Access is command-only and separate from moderation reports.';

create table private.beta_feedback_admin_requests (
  admin_id uuid not null references private.app_admins(user_id) on delete restrict,
  request_id uuid not null,
  feedback_id uuid not null references private.beta_feedback(id) on delete cascade,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (admin_id, request_id)
);

comment on table private.beta_feedback_admin_requests is
  'Private mutation idempotency records; cascaded when feedback is irrelevantly deleted.';

create table private.beta_feedback_deletion_audit (
  feedback_id uuid primary key,
  original_kind text not null check (original_kind in ('bug', 'suggestion')),
  deleted_by uuid not null references private.app_admins(user_id) on delete restrict,
  deleted_at timestamptz not null default statement_timestamp(),
  deletion_reason text not null check (
    deletion_reason = btrim(deletion_reason)
    and char_length(deletion_reason) between 5 and 500
  )
);

comment on table private.beta_feedback_deletion_audit is
  'Minimal append-only audit retained after irrelevant feedback content and actor identity are deleted.';

create index beta_feedback_queue_idx
  on private.beta_feedback (status, kind, created_at desc, id desc);
create index beta_feedback_submitter_created_idx
  on private.beta_feedback (submitter_id, created_at desc);

alter table private.beta_feedback enable row level security;
alter table private.beta_feedback_admin_requests enable row level security;
alter table private.beta_feedback_deletion_audit enable row level security;

create trigger beta_feedback_deletion_audit_append_only
before update or delete on private.beta_feedback_deletion_audit
for each row execute function private.reject_append_only_change();

create or replace function public.submit_beta_feedback(
  p_request_id uuid,
  p_kind text,
  p_summary text,
  p_details text,
  p_source_pathname text,
  p_application_version text,
  p_browser_context text default null
) returns table(reference_id text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_kind text := btrim(p_kind);
  v_summary text := btrim(p_summary);
  v_details text := btrim(p_details);
  v_source_pathname text := btrim(p_source_pathname);
  v_application_version text := btrim(p_application_version);
  v_browser_context text := nullif(btrim(p_browser_context), '');
  v_existing private.beta_feedback%rowtype;
begin
  if v_actor is null then
    raise sqlstate 'PT401' using message = 'feedback_unauthenticated';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor
      and p.status = 'active'
      and p.profile_completed_at is not null
  ) then
    raise sqlstate 'PT403' using message = 'feedback_actor_ineligible';
  end if;
  if p_request_id is null
    or v_kind is null or v_kind not in ('bug', 'suggestion')
    or v_summary is null or char_length(v_summary) not between 5 and 120
    or v_summary ~ '[[:cntrl:]]'
    or v_details is null or char_length(v_details) not between 20 and 4000
    or v_source_pathname is null or char_length(v_source_pathname) not between 1 and 300
    or left(v_source_pathname, 1) <> '/'
    or left(v_source_pathname, 2) = '//'
    or v_source_pathname ~ '[?#\\]'
    or v_source_pathname ~ '[[:cntrl:]]'
    or v_application_version is null or char_length(v_application_version) not between 1 and 100
    or v_application_version ~ '[[:cntrl:]]'
    or (v_browser_context is not null and (
      char_length(v_browser_context) > 300 or v_browser_context ~ '[[:cntrl:]]'
    ))
  then
    raise sqlstate 'PT400' using message = 'feedback_invalid';
  end if;

  select * into v_existing
  from private.beta_feedback
  where submitter_id = v_actor and request_id = p_request_id;

  if found then
    if v_existing.kind <> v_kind
      or v_existing.summary <> v_summary
      or v_existing.details <> v_details
      or v_existing.source_pathname <> v_source_pathname
      or v_existing.application_version <> v_application_version
      or v_existing.browser_context is distinct from v_browser_context
    then
      raise sqlstate 'PT409' using message = 'feedback_request_conflict';
    end if;
    return query select v_existing.reference_id, v_existing.created_at;
    return;
  end if;

  if (select count(*) from private.beta_feedback f
      where f.submitter_id = v_actor
        and f.created_at > statement_timestamp() - interval '1 hour') >= 5
  then
    raise sqlstate 'PT429' using message = 'feedback_hourly_limit';
  end if;
  if (select count(*) from private.beta_feedback f
      where f.submitter_id = v_actor
        and f.created_at > statement_timestamp() - interval '24 hours') >= 20
  then
    raise sqlstate 'PT429' using message = 'feedback_daily_limit';
  end if;

  return query
  insert into private.beta_feedback (
    submitter_id, request_id, kind, summary, details, source_pathname,
    application_version, browser_context
  ) values (
    v_actor, p_request_id, v_kind, v_summary, v_details, v_source_pathname,
    v_application_version, v_browser_context
  )
  returning beta_feedback.reference_id, beta_feedback.created_at;
end;
$$;

create or replace function public.list_admin_beta_feedback(
  p_status text default null,
  p_kind text default null,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor();
  if (p_status is not null and p_status not in ('new', 'handled'))
    or (p_kind is not null and p_kind not in ('bug', 'suggestion'))
    or ((p_after_created_at is null) <> (p_after_id is null))
  then
    raise sqlstate 'PT400' using message = 'feedback_filter_invalid';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id desc)
    from (
      select
        f.id,
        f.reference_id,
        f.kind,
        f.summary,
        f.source_pathname,
        f.created_at,
        f.status,
        f.lock_version,
        (f.browser_context is not null) as has_browser_context
      from private.beta_feedback f
      where (p_status is null or f.status = p_status)
        and (p_kind is null or f.kind = p_kind)
        and (
          p_after_created_at is null
          or (f.created_at, f.id) < (p_after_created_at, p_after_id)
        )
      order by f.created_at desc, f.id desc
      limit 25
    ) q
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_admin_beta_feedback(p_feedback_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin_actor();
  select jsonb_build_object(
    'id', f.id,
    'referenceId', f.reference_id,
    'kind', f.kind,
    'summary', f.summary,
    'details', f.details,
    'sourcePathname', f.source_pathname,
    'applicationVersion', f.application_version,
    'browserContext', f.browser_context,
    'status', f.status,
    'lockVersion', f.lock_version,
    'createdAt', f.created_at,
    'updatedAt', f.updated_at,
    'handledAt', f.handled_at,
    'handledBy', f.handled_by,
    'adminNote', f.admin_note,
    'submitterId', f.submitter_id,
    'submitterUsername', p.username
  ) into v_result
  from private.beta_feedback f
  join public.profiles p on p.id = f.submitter_id
  where f.id = p_feedback_id;

  return v_result;
end;
$$;

create or replace function public.mutate_admin_beta_feedback(
  p_feedback_id uuid,
  p_request_id uuid,
  p_action text,
  p_expected_lock_version integer,
  p_kind text default null,
  p_note text default null,
  p_deletion_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.assert_admin_actor();
  v_action text := btrim(p_action);
  v_kind text := nullif(btrim(p_kind), '');
  v_note text := nullif(btrim(p_note), '');
  v_deletion_reason text := nullif(btrim(p_deletion_reason), '');
  v_payload jsonb;
  v_existing private.beta_feedback_admin_requests%rowtype;
  v_feedback private.beta_feedback%rowtype;
  v_result jsonb;
  v_audit private.beta_feedback_deletion_audit%rowtype;
begin
  if p_feedback_id is null or p_request_id is null
    or p_expected_lock_version is null or p_expected_lock_version < 1
    or v_action is null or v_action not in ('classify', 'handle', 'reopen', 'delete')
    or (v_kind is not null and v_kind not in ('bug', 'suggestion'))
    or (v_note is not null and char_length(v_note) > 1000)
    or (v_deletion_reason is not null and char_length(v_deletion_reason) > 500)
    or (v_action = 'classify' and v_kind is null)
    or (v_action = 'delete' and (v_deletion_reason is null or char_length(v_deletion_reason) < 5))
  then
    raise sqlstate 'PT400' using message = 'feedback_admin_action_invalid';
  end if;

  v_payload := jsonb_build_object(
    'feedbackId', p_feedback_id,
    'action', v_action,
    'expectedLockVersion', p_expected_lock_version,
    'kind', v_kind,
    'note', v_note,
    'deletionReason', v_deletion_reason
  );

  select * into v_existing
  from private.beta_feedback_admin_requests
  where admin_id = v_admin and request_id = p_request_id;
  if found then
    if v_existing.payload <> v_payload then
      raise sqlstate 'PT409' using message = 'feedback_admin_request_conflict';
    end if;
    return v_existing.result;
  end if;

  select * into v_feedback
  from private.beta_feedback
  where id = p_feedback_id
  for update;

  if not found then
    if v_action = 'delete' then
      select * into v_audit
      from private.beta_feedback_deletion_audit
      where feedback_id = p_feedback_id;
      if found
        and v_audit.deleted_by = v_admin
        and v_audit.deletion_reason = v_deletion_reason
      then
        return jsonb_build_object('feedbackId', p_feedback_id, 'deleted', true);
      end if;
    end if;
    raise sqlstate 'PT404' using message = 'feedback_not_found';
  end if;

  if v_feedback.lock_version <> p_expected_lock_version then
    raise sqlstate 'PT409' using message = 'feedback_stale';
  end if;

  if v_action = 'classify' then
    update private.beta_feedback
    set kind = v_kind,
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = p_feedback_id
    returning jsonb_build_object(
      'feedbackId', id, 'kind', kind, 'status', status, 'lockVersion', lock_version
    ) into v_result;
  elsif v_action = 'handle' then
    if v_feedback.status <> 'new' then
      raise sqlstate 'PT409' using message = 'feedback_state_conflict';
    end if;
    update private.beta_feedback
    set status = 'handled',
        handled_at = statement_timestamp(),
        handled_by = v_admin,
        admin_note = v_note,
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = p_feedback_id
    returning jsonb_build_object(
      'feedbackId', id, 'kind', kind, 'status', status, 'lockVersion', lock_version
    ) into v_result;
  elsif v_action = 'reopen' then
    if v_feedback.status <> 'handled' then
      raise sqlstate 'PT409' using message = 'feedback_state_conflict';
    end if;
    update private.beta_feedback
    set status = 'new',
        handled_at = null,
        handled_by = null,
        admin_note = null,
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = p_feedback_id
    returning jsonb_build_object(
      'feedbackId', id, 'kind', kind, 'status', status, 'lockVersion', lock_version
    ) into v_result;
  else
    insert into private.beta_feedback_deletion_audit (
      feedback_id, original_kind, deleted_by, deletion_reason
    ) values (
      v_feedback.id, v_feedback.kind, v_admin, v_deletion_reason
    );
    delete from private.beta_feedback where id = p_feedback_id;
    return jsonb_build_object('feedbackId', p_feedback_id, 'deleted', true);
  end if;

  insert into private.beta_feedback_admin_requests (
    admin_id, request_id, feedback_id, payload, result
  ) values (
    v_admin, p_request_id, p_feedback_id, v_payload, v_result
  );
  return v_result;
end;
$$;

revoke all on table private.beta_feedback from public, anon, authenticated, service_role;
revoke all on table private.beta_feedback_admin_requests from public, anon, authenticated, service_role;
revoke all on table private.beta_feedback_deletion_audit from public, anon, authenticated, service_role;

revoke all on function public.submit_beta_feedback(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.list_admin_beta_feedback(text, text, timestamptz, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_admin_beta_feedback(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mutate_admin_beta_feedback(uuid, uuid, text, integer, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_beta_feedback(uuid, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.list_admin_beta_feedback(text, text, timestamptz, uuid)
  to authenticated;
grant execute on function public.get_admin_beta_feedback(uuid)
  to authenticated;
grant execute on function public.mutate_admin_beta_feedback(uuid, uuid, text, integer, text, text, text)
  to authenticated;
