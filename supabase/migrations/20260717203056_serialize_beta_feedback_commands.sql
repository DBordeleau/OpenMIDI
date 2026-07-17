-- FEEDBACK-01 review repair: serialize per-actor rate/idempotency checks and
-- per-administrator mutation idempotency before reading command state.

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

  -- The profile row is the durable per-submitter mutex. Holding it through the
  -- idempotency lookup, rolling counts, and insert prevents concurrent requests
  -- from observing the same pre-insert state.
  perform 1
  from public.profiles p
  where p.id = v_actor
    and p.status = 'active'
    and p.profile_completed_at is not null
  for update;
  if not found then
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

  -- Serialize before the idempotency lookup. This makes a concurrent retry see
  -- the first committed request row instead of racing ahead to feedback state.
  perform 1
  from private.app_admins a
  where a.user_id = v_admin
  for update;
  if not found then
    raise sqlstate 'PT404' using message = 'admin_not_found';
  end if;

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

revoke all on function public.submit_beta_feedback(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mutate_admin_beta_feedback(uuid, uuid, text, integer, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_beta_feedback(uuid, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.mutate_admin_beta_feedback(uuid, uuid, text, integer, text, text, text)
  to authenticated;

comment on function public.submit_beta_feedback(uuid, text, text, text, text, text, text) is
  'Submits idempotent rate-limited beta feedback while holding the submitter profile row through the command.';
comment on function public.mutate_admin_beta_feedback(uuid, uuid, text, integer, text, text, text) is
  'Mutates beta feedback after serializing administrator request-id lookup on the administrator membership row.';
